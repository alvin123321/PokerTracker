import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';

export type MockSessionStatus = 'ACTIVE' | 'COMPLETED';
export type MockPlayerStatus = 'ACTIVE' | 'COMPLETED';
export type MockTransactionType = 'BUYIN' | 'REBUY' | 'CASHOUT';

export interface MockTransaction {
  id: string;
  sessionId: string;
  playerId: string;
  type: MockTransactionType;
  amount: number;
  createdAt: string;
  comment?: string;
  deletedAt?: string;
}

export interface MockSessionPlayer {
  id: string;
  playerRecordId?: string;
  userId?: string | null;
  name: string;
  status: MockPlayerStatus;
  totalBuyIn: number;
  cashOut: number;
  net: number;
  joinedAt: string;
  completedAt: string | null;
}

export interface MockPokerSession {
  id: string;
  name: string;
  sessionDate: string;
  status: MockSessionStatus;
  createdAt: string;
  closedAt: string | null;
  players: MockSessionPlayer[];
  transactions: MockTransaction[];
}

export interface SessionTotals {
  totalPlayers: number;
  activePlayers: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
}

export interface RegisteredPlayerOption {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
}

interface SessionRow {
  id: string;
  host_id: string;
  name: string;
  session_date: string;
  status: MockSessionStatus;
  created_at: string;
  closed_at: string | null;
}

interface PlayerRow {
  id: string;
  user_id: string | null;
  host_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface SessionPlayerRow {
  id: string;
  session_id: string;
  player_id: string;
  status: MockPlayerStatus;
  total_buy_in: number | string;
  cash_out: number | string;
  net: number | string;
  joined_at: string;
  completed_at: string | null;
}

interface TransactionRow {
  id: string;
  session_id: string;
  player_id: string;
  session_player_id: string;
  type: MockTransactionType;
  amount: number | string;
  created_at: string;
  comment: string | null;
  deleted_at: string | null;
}

interface RegisteredPlayerRow {
  id: string;
  username?: string | null;
  display_name: string | null;
  email: string;
}

interface CreateRegisteredPlayerResponse {
  player: {
    id: string;
    username: string;
    displayName: string | null;
    email: string;
  };
  temporaryPassword: string;
}

interface DeleteRegisteredPlayerResponse {
  ok: boolean;
}

const storageKey = 'pokertrack.mockPokerStore';

@Injectable({
  providedIn: 'root'
})
export class MockPokerStoreService {
  private readonly authState = inject(AuthStateService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly sessionsSignal = signal<MockPokerSession[]>(this.loadSessions());
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private loadedSupabaseUserId: string | null = null;

  readonly sessions = this.sessionsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly activeSessions = computed(() =>
    this.sessionsSignal().filter((session) => session.status === 'ACTIVE')
  );
  readonly completedSessions = computed(() =>
    this.sessionsSignal().filter((session) => session.status === 'COMPLETED')
  );

  constructor() {
    effect(() => {
      const initialized = this.authState.initialized();
      const user = this.authState.user();

      if (!initialized || !this.shouldUseSupabaseForUser(user?.id ?? null)) {
        return;
      }

      if (this.loadedSupabaseUserId === user?.id) {
        return;
      }

      this.loadedSupabaseUserId = user?.id ?? null;
      void this.refreshSessions();
    });
  }

  async refreshSessions(): Promise<void> {
    await this.refreshHostSessions();
  }

  async refreshHostSessions(): Promise<void> {
    if (!this.shouldUseSupabase()) {
      return;
    }

    this.setLoading(true);
    this.setError(null);

    try {
      const client = this.supabaseService.requireClient();
      const { data: sessionRows, error: sessionsError } = await client
        .from('sessions')
        .select('id,host_id,name,session_date,status,created_at,closed_at')
        .order('created_at', { ascending: false });

      if (sessionsError) {
        throw sessionsError;
      }

      const sessions = (sessionRows ?? []) as SessionRow[];
      const sessionIds = sessions.map((session) => session.id);

      if (sessionIds.length === 0) {
        this.sessionsSignal.set([]);
        return;
      }

      const [sessionPlayersResult, transactionsResult] = await Promise.all([
        client
          .from('session_players')
          .select(
            'id,session_id,player_id,status,total_buy_in,cash_out,net,joined_at,completed_at'
          )
          .in('session_id', sessionIds)
          .order('joined_at', { ascending: true }),
        client
          .from('transactions')
          .select('id,session_id,player_id,session_player_id,type,amount,created_at,comment,deleted_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true })
      ]);

      if (sessionPlayersResult.error) {
        throw sessionPlayersResult.error;
      }

      if (transactionsResult.error) {
        throw transactionsResult.error;
      }

      const sessionPlayers = (sessionPlayersResult.data ?? []) as SessionPlayerRow[];
      const playerIds = [...new Set(sessionPlayers.map((player) => player.player_id))];
      const playersById = await this.loadPlayersById(playerIds);
      const transactions = (transactionsResult.data ?? []) as TransactionRow[];

      this.sessionsSignal.set(
        sessions.map((session) =>
          this.mapSession(session, sessionPlayers, playersById, transactions)
        )
      );
    } catch (error) {
      this.setError(this.toMessage(error));
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async createSession(name: string, sessionDate: string): Promise<MockPokerSession> {
    if (this.shouldUseSupabase()) {
      const { data, error } = await this.supabaseService
        .requireClient()
        .rpc('create_session', {
          p_name: name.trim(),
          p_session_date: sessionDate
        });

      if (error) {
        throw error;
      }

      const createdSession = this.mapSession(data as SessionRow, [], new Map(), []);
      await this.refreshHostSessions();

      return this.getSession(createdSession.id) ?? createdSession;
    }

    const session: MockPokerSession = {
      id: this.createId('session'),
      name: name.trim(),
      sessionDate,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      closedAt: null,
      players: [],
      transactions: []
    };

    this.updateSessions((sessions) => [session, ...sessions]);

    return session;
  }

  getSession(sessionId: string | null): MockPokerSession | undefined {
    return this.sessionsSignal().find((session) => session.id === sessionId);
  }

  async listRegisteredPlayers(): Promise<RegisteredPlayerOption[]> {
    if (!this.shouldUseSupabase()) {
      return [];
    }

    const client = this.supabaseService.requireClient();
    const { data: directRows, error: directError } = await client
      .from('users')
      .select('id,email,display_name')
      .eq('role', 'PLAYER')
      .order('display_name', { ascending: true });

    if (!directError && directRows && directRows.length > 0) {
      return this.mapRegisteredPlayers(directRows as RegisteredPlayerRow[]);
    }

    const { data, error } = await client.rpc('list_registered_players');

    if (error) {
      throw new Error(
        `${this.toMessage(error)} Run the latest Supabase player directory migration, then reload the page.`
      );
    }

    const rpcRows = (data ?? []) as RegisteredPlayerRow[];

    if (rpcRows.length > 0 || !directError) {
      return this.mapRegisteredPlayers(rpcRows);
    }

    return [];
  }

  private mapRegisteredPlayers(players: RegisteredPlayerRow[]): RegisteredPlayerOption[] {
    return players.map((player) => ({
      id: player.id,
      username: player.username ?? player.email.split('@')[0],
      displayName: player.display_name,
      email: player.email
    }));
  }

  async addPlayer(
    sessionId: string,
    name: string,
    buyIn: number,
    comment = '',
    playerUserId: string | null = null,
    createRegisteredPlayer = false
  ): Promise<void> {
    if (this.shouldUseSupabase()) {
      let targetUserId = playerUserId;
      let targetName = name.trim();

      if (createRegisteredPlayer) {
        const createdPlayer = await this.createRegisteredPlayer(targetName);
        targetUserId = createdPlayer.id;
        targetName = createdPlayer.displayName ?? createdPlayer.username;
      }

      const { error } = await this.supabaseService
        .requireClient()
        .rpc('add_player_to_session', {
          p_session_id: sessionId,
          p_player_name: targetName,
          p_buy_in: this.normalizeAmount(buyIn),
          p_existing_player_id: null,
          p_player_user_id: targetUserId,
          p_comment: comment.trim() || null
        });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    const joinedAt = new Date().toISOString();
    const playerId = this.createId('player');
    const cleanBuyIn = this.normalizeAmount(buyIn);
    const player: MockSessionPlayer = {
      id: playerId,
      name: name.trim(),
      status: 'ACTIVE',
      totalBuyIn: cleanBuyIn,
      cashOut: 0,
      net: 0 - cleanBuyIn,
      joinedAt,
      completedAt: null
    };

    this.updateSession(sessionId, (session) => ({
      ...session,
      players: [...session.players, player],
      transactions: [
        ...session.transactions,
        this.createTransaction(session.id, playerId, 'BUYIN', cleanBuyIn, joinedAt, comment)
      ]
    }));
  }

  async recordRebuy(
    sessionId: string,
    sessionPlayerId: string,
    amount: number,
    comment = ''
  ): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService
        .requireClient()
        .rpc('record_rebuy', {
          p_session_player_id: sessionPlayerId,
          p_amount: this.normalizeAmount(amount),
          p_comment: comment.trim() || null
        });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    const createdAt = new Date().toISOString();
    const rebuyAmount = this.normalizeAmount(amount);

    this.updateSession(sessionId, (session) => ({
      ...session,
      players: session.players.map((player) => {
        if (player.id !== sessionPlayerId || player.status === 'COMPLETED') {
          return player;
        }

        const totalBuyIn = player.totalBuyIn + rebuyAmount;

        return {
          ...player,
          totalBuyIn,
          net: player.cashOut - totalBuyIn
        };
      }),
      transactions: [
        ...session.transactions,
        this.createTransaction(session.id, sessionPlayerId, 'REBUY', rebuyAmount, createdAt, comment)
      ]
    }));
  }

  async recordCashOut(sessionId: string, sessionPlayerId: string, amount: number): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService
        .requireClient()
        .rpc('record_cashout', {
          p_session_player_id: sessionPlayerId,
          p_amount: this.normalizeAmount(amount)
        });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    const completedAt = new Date().toISOString();
    const cashOut = this.normalizeAmount(amount);

    this.updateSession(sessionId, (session) => ({
      ...session,
      players: session.players.map((player) => {
        if (player.id !== sessionPlayerId) {
          return player;
        }

        return {
          ...player,
          status: 'COMPLETED',
          cashOut,
          net: cashOut - player.totalBuyIn,
          completedAt
        };
      }),
      transactions: [
        ...session.transactions,
        this.createTransaction(session.id, sessionPlayerId, 'CASHOUT', cashOut, completedAt)
      ]
    }));
  }

  async updateBuyInTransaction(
    sessionId: string,
    transactionId: string,
    amount: number,
    comment = ''
  ): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService
        .requireClient()
        .rpc('update_buy_in_transaction', {
          p_transaction_id: transactionId,
          p_amount: this.normalizeAmount(amount),
          p_comment: comment.trim() || null
        });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    const updatedAmount = this.normalizeAmount(amount);
    const cleanComment = comment.trim();

    this.updateSession(sessionId, (session) => {
      const transaction = session.transactions.find((item) => item.id === transactionId);

      if (!transaction || (transaction.type !== 'BUYIN' && transaction.type !== 'REBUY')) {
        return session;
      }

      const transactions = session.transactions.map((item) =>
        item.id === transactionId
          ? { ...item, amount: updatedAmount, comment: cleanComment || undefined }
          : item
      );

      return {
        ...session,
        players: this.recalculatePlayerBuyIn(session.players, transactions, transaction.playerId),
        transactions
      };
    });
  }

  async deleteBuyInTransaction(sessionId: string, transactionId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService
        .requireClient()
        .rpc('delete_buy_in_transaction', {
          p_transaction_id: transactionId
        });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    const deletedAt = new Date().toISOString();

    this.updateSession(sessionId, (session) => {
      const transaction = session.transactions.find((item) => item.id === transactionId);

      if (!transaction || (transaction.type !== 'BUYIN' && transaction.type !== 'REBUY')) {
        return session;
      }

      const transactions = session.transactions.map((item) =>
        item.id === transactionId ? { ...item, deletedAt } : item
      );

      return {
        ...session,
        players: this.recalculatePlayerBuyIn(session.players, transactions, transaction.playerId),
        transactions
      };
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService.requireClient().rpc('close_session', {
        p_session_id: sessionId
      });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    this.updateSession(sessionId, (session) => ({
      ...session,
      status: 'COMPLETED',
      closedAt: new Date().toISOString()
    }));
  }

  totalsFor(session: MockPokerSession | undefined): SessionTotals {
    const players = session?.players ?? [];

    return {
      totalPlayers: players.length,
      activePlayers: players.filter((player) => player.status === 'ACTIVE').length,
      totalBuyIn: players.reduce((sum, player) => sum + player.totalBuyIn, 0),
      totalCashOut: players.reduce((sum, player) => sum + player.cashOut, 0),
      totalNet: players.reduce((sum, player) => sum + player.net, 0)
    };
  }

  sortedPlayersByNet(session: MockPokerSession | undefined): MockSessionPlayer[] {
    return [...(session?.players ?? [])].sort((a, b) => b.net - a.net);
  }

  sortedPlayersForActiveSession(session: MockPokerSession | undefined): MockSessionPlayer[] {
    return [...(session?.players ?? [])].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ACTIVE' ? -1 : 1;
      }

      if (a.status === 'COMPLETED') {
        return b.cashOut - a.cashOut;
      }

      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }

  buyInTransactionsForPlayer(
    session: MockPokerSession | undefined,
    playerId: string
  ): MockTransaction[] {
    return [...(session?.transactions ?? [])]
      .filter(
        (transaction) =>
          transaction.playerId === playerId &&
          (transaction.type === 'BUYIN' || transaction.type === 'REBUY')
      )
      .sort((a, b) => {
        if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) {
          return a.deletedAt ? 1 : -1;
        }

        return a.createdAt.localeCompare(b.createdAt);
      });
  }

  private async loadPlayersById(playerIds: string[]): Promise<Map<string, PlayerRow>> {
    if (playerIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabaseService
      .requireClient()
      .from('players')
      .select('id,user_id,host_id,name,created_at,updated_at')
      .in('id', playerIds);

    if (error) {
      throw error;
    }

    return new Map(((data ?? []) as PlayerRow[]).map((player) => [player.id, player]));
  }

  async createRegisteredPlayer(username: string): Promise<RegisteredPlayerOption> {
    const { data, error } = await this.supabaseService
      .requireClient()
      .functions.invoke<CreateRegisteredPlayerResponse>('create-registered-player', {
        body: {
          username
        }
      });

    if (error) {
      throw error;
    }

    if (!data?.player) {
      throw new Error('Unable to create registered player.');
    }

    return data.player;
  }

  async deleteRegisteredPlayer(userId: string): Promise<void> {
    if (!this.shouldUseSupabase()) {
      return;
    }

    const { data, error } = await this.supabaseService
      .requireClient()
      .functions.invoke<DeleteRegisteredPlayerResponse>('delete-registered-player', {
        body: {
          userId
        }
      });

    if (error) {
      throw error;
    }

    if (!data?.ok) {
      throw new Error('Unable to delete registered player.');
    }

    await this.refreshHostSessions();
  }

  private mapSession(
    session: SessionRow,
    sessionPlayers: SessionPlayerRow[],
    playersById: Map<string, PlayerRow>,
    transactions: TransactionRow[]
  ): MockPokerSession {
    const currentSessionPlayers = sessionPlayers.filter((player) => player.session_id === session.id);

    return {
      id: session.id,
      name: session.name,
      sessionDate: session.session_date,
      status: session.status,
      createdAt: session.created_at,
      closedAt: session.closed_at,
      players: currentSessionPlayers.map((sessionPlayer) =>
        this.mapSessionPlayer(sessionPlayer, playersById.get(sessionPlayer.player_id))
      ),
      transactions: transactions
        .filter((transaction) => transaction.session_id === session.id)
        .map((transaction) => this.mapTransaction(transaction))
    };
  }

  private mapSessionPlayer(
    sessionPlayer: SessionPlayerRow,
    player: PlayerRow | undefined
  ): MockSessionPlayer {
    return {
      id: sessionPlayer.id,
      playerRecordId: sessionPlayer.player_id,
      userId: player?.user_id ?? null,
      name: player?.name ?? 'Unknown player',
      status: sessionPlayer.status,
      totalBuyIn: this.toNumber(sessionPlayer.total_buy_in),
      cashOut: this.toNumber(sessionPlayer.cash_out),
      net: this.toNumber(sessionPlayer.net),
      joinedAt: sessionPlayer.joined_at,
      completedAt: sessionPlayer.completed_at
    };
  }

  private mapTransaction(transaction: TransactionRow): MockTransaction {
    return {
      id: transaction.id,
      sessionId: transaction.session_id,
      playerId: transaction.session_player_id,
      type: transaction.type,
      amount: this.toNumber(transaction.amount),
      createdAt: transaction.created_at,
      ...(transaction.comment ? { comment: transaction.comment } : {}),
      ...(transaction.deleted_at ? { deletedAt: transaction.deleted_at } : {})
    };
  }

  private updateSession(
    sessionId: string,
    updater: (session: MockPokerSession) => MockPokerSession
  ): void {
    this.updateSessions((sessions) =>
      sessions.map((session) => (session.id === sessionId ? updater(session) : session))
    );
  }

  private updateSessions(updater: (sessions: MockPokerSession[]) => MockPokerSession[]): void {
    const sessions = updater(this.sessionsSignal());
    this.sessionsSignal.set(sessions);
    this.saveSessions(sessions);
  }

  private createTransaction(
    sessionId: string,
    playerId: string,
    type: MockTransactionType,
    amount: number,
    createdAt: string,
    comment = ''
  ): MockTransaction {
    const cleanComment = comment.trim();

    return {
      id: this.createId('transaction'),
      sessionId,
      playerId,
      type,
      amount,
      createdAt,
      ...(cleanComment ? { comment: cleanComment } : {})
    };
  }

  private recalculatePlayerBuyIn(
    players: MockSessionPlayer[],
    transactions: MockTransaction[],
    playerId: string
  ): MockSessionPlayer[] {
    const totalBuyIn = transactions
      .filter(
        (item) =>
          item.playerId === playerId &&
          !item.deletedAt &&
          (item.type === 'BUYIN' || item.type === 'REBUY')
      )
      .reduce((sum, item) => sum + item.amount, 0);

    return players.map((player) => {
      if (player.id !== playerId) {
        return player;
      }

      return {
        ...player,
        totalBuyIn,
        net: player.cashOut - totalBuyIn
      };
    });
  }

  private shouldUseSupabase(): boolean {
    return this.shouldUseSupabaseForUser(this.authState.user()?.id ?? null);
  }

  private shouldUseSupabaseForUser(userId: string | null): boolean {
    return Boolean(
      this.supabaseService.isConfigured &&
        userId &&
        !userId.startsWith('mock-') &&
        (this.authState.role() === 'HOST' || this.authState.role() === 'PLAYER')
    );
  }

  private normalizeAmount(amount: number): number {
    return Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  }

  private toNumber(value: number | string): number {
    return Number(value) || 0;
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (this.hasMessage(error)) {
      return error.message;
    }

    return 'Something went wrong.';
  }

  private hasMessage(error: unknown): error is { message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }

  private setLoading(value: boolean): void {
    this.loadingSignal.set(value);
  }

  private setError(value: string | null): void {
    this.errorSignal.set(value);
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private loadSessions(): MockPokerSession[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as MockPokerSession[];
    } catch {
      localStorage.removeItem(storageKey);
      return [];
    }
  }

  private saveSessions(sessions: MockPokerSession[]): void {
    if (typeof localStorage === 'undefined' || this.shouldUseSupabase()) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }
}
