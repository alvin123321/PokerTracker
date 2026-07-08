import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Subject, Subscription, auditTime } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';

export type PokerSessionStatus = 'ACTIVE' | 'COMPLETED';
export type PokerTableStatus = 'ACTIVE' | 'CLOSED';
export type PokerPlayerStatus = 'ACTIVE' | 'COMPLETED';
export type PokerTransactionType = 'BUYIN' | 'REBUY' | 'CASHOUT';

export function defaultPokerTableName(tableNumber: number): string {
  if (tableNumber === 1) {
    return 'Main Table';
  }

  if (tableNumber === 2) {
    return 'Side Table';
  }

  return `Table ${Math.max(3, tableNumber)}`;
}

export interface PokerTransaction {
  id: string;
  sessionId: string;
  tableId: string | null;
  playerId: string;
  type: PokerTransactionType;
  amount: number;
  createdAt: string;
  comment?: string;
  deletedAt?: string;
}

export interface PokerTable {
  id: string;
  sessionId: string;
  name: string;
  status: PokerTableStatus;
  tableNumber: number;
  createdAt: string;
  closedAt: string | null;
}

export interface SessionPlayer {
  id: string;
  playerRecordId?: string;
  tableId: string | null;
  userId?: string | null;
  name: string;
  status: PokerPlayerStatus;
  totalBuyIn: number;
  cashOut: number;
  net: number;
  joinedAt: string;
  completedAt: string | null;
}

export interface PokerSession {
  id: string;
  name: string;
  sessionDate: string;
  status: PokerSessionStatus;
  createdAt: string;
  closedAt: string | null;
  tables: PokerTable[];
  players: SessionPlayer[];
  transactions: PokerTransaction[];
}

export interface SessionTotals {
  totalPlayers: number;
  activePlayers: number;
  cashedOutPlayers: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
}

export interface RegisteredPlayerOption {
  id: string;
  username: string;
  displayName: string | null;
  role: 'MANAGER' | 'PLAYER';
}

interface SessionRow {
  id: string;
  host_id: string;
  name: string;
  session_date: string;
  status: PokerSessionStatus;
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
  table_id?: string | null;
  player_id: string;
  status: PokerPlayerStatus;
  total_buy_in: number | string;
  cash_out: number | string;
  net: number | string;
  joined_at: string;
  completed_at: string | null;
}

interface TransactionRow {
  id: string;
  session_id: string;
  table_id?: string | null;
  player_id: string;
  session_player_id: string;
  type: PokerTransactionType;
  amount: number | string;
  created_at: string;
  comment: string | null;
  deleted_at: string | null;
}

interface SessionTableRow {
  id: string;
  session_id: string;
  name: string;
  status: PokerTableStatus;
  table_number: number;
  created_at: string;
  closed_at: string | null;
}

interface RegisteredPlayerRow {
  id: string;
  username?: string | null;
  display_name: string | null;
  role?: 'MANAGER' | 'PLAYER' | null;
}

interface CreateRegisteredPlayerResponse {
  player: {
    id: string;
    username: string;
    displayName: string | null;
  };
  temporaryPassword: string;
}

interface DeleteRegisteredPlayerResponse {
  ok: boolean;
}

const localStorageKey = 'pokertrack.localPokerStore.sessionTables.v2';
const legacyLocalStorageKey = 'pokertrack.mockPokerStore';
const localRegisteredPlayersStorageKey = 'pokertrack.localRegisteredPlayers.sessionTables.v2';
const localDeletedRegisteredPlayersStorageKey =
  'pokertrack.localDeletedRegisteredPlayers.sessionTables.v2';

@Injectable({
  providedIn: 'root'
})
export class PokerStoreService implements OnDestroy {
  private readonly authState = inject(AuthStateService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly sessionsSignal = signal<PokerSession[]>(this.loadSessions());
  private readonly localRegisteredPlayersSignal = signal<RegisteredPlayerOption[]>(
    this.loadLocalRegisteredPlayers()
  );
  private readonly localDeletedRegisteredPlayerIdsSignal = signal<string[]>(
    this.loadLocalDeletedRegisteredPlayerIds()
  );
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly realtimeRefreshSignal = new Subject<void>();
  private readonly realtimeRefreshSubscription: Subscription;
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeUserKey: string | null = null;
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
    this.realtimeRefreshSubscription = this.realtimeRefreshSignal
      .pipe(auditTime(250))
      .subscribe(() => {
        void this.refreshSessions();
      });

    effect(() => {
      const initialized = this.authState.initialized();
      const user = this.authState.user();
      const role = this.authState.role();

      if (!initialized || !this.shouldUseSupabaseForUser(user?.id ?? null)) {
        this.teardownRealtimeChannel();
        return;
      }

      this.setupRealtimeChannel(user?.id ?? null, role);

      if (this.loadedSupabaseUserId === user?.id) {
        return;
      }

      this.loadedSupabaseUserId = user?.id ?? null;
      void this.refreshSessions();
    });
  }

  ngOnDestroy(): void {
    this.teardownRealtimeChannel();
    this.realtimeRefreshSubscription.unsubscribe();
    this.realtimeRefreshSignal.complete();
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

      const [tablesResult, sessionPlayersResult, transactionsResult] = await Promise.all([
        client
          .from('session_tables')
          .select('id,session_id,name,status,table_number,created_at,closed_at')
          .in('session_id', sessionIds)
          .order('table_number', { ascending: true }),
        client
          .from('session_players')
          .select(
            'id,session_id,table_id,player_id,status,total_buy_in,cash_out,net,joined_at,completed_at'
          )
          .in('session_id', sessionIds)
          .order('joined_at', { ascending: true }),
        client
          .from('transactions')
          .select('id,session_id,table_id,player_id,session_player_id,type,amount,created_at,comment,deleted_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true })
      ]);

      if (tablesResult.error) {
        throw tablesResult.error;
      }

      if (sessionPlayersResult.error) {
        throw sessionPlayersResult.error;
      }

      if (transactionsResult.error) {
        throw transactionsResult.error;
      }

      const sessionPlayers = (sessionPlayersResult.data ?? []) as SessionPlayerRow[];
      const playerIds = [...new Set(sessionPlayers.map((player) => player.player_id))];
      const playersById = await this.loadPlayersById(playerIds);
      const tables = (tablesResult.data ?? []) as SessionTableRow[];
      const transactions = (transactionsResult.data ?? []) as TransactionRow[];

      this.sessionsSignal.set(
        sessions.map((session) =>
          this.mapSession(session, tables, sessionPlayers, playersById, transactions)
        )
      );
    } catch (error) {
      this.setError(this.toMessage(error));
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async createSession(name: string, sessionDate: string): Promise<PokerSession> {
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

      const createdSession = this.mapSession(data as SessionRow, [], [], new Map(), []);
      await this.refreshHostSessions();

      return this.getSession(createdSession.id) ?? createdSession;
    }

    const session: PokerSession = {
      id: this.createId('session'),
      name: name.trim(),
      sessionDate,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      closedAt: null,
      tables: [],
      players: [],
      transactions: []
    };

    this.updateSessions((sessions) => [session, ...sessions]);

    return session;
  }

  getSession(sessionId: string | null): PokerSession | undefined {
    return this.sessionsSignal().find((session) => session.id === sessionId);
  }

  async createTable(sessionId: string, name: string): Promise<PokerTable> {
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error('Table name is required.');
    }

    if (this.shouldUseSupabase()) {
      const { data, error } = await this.supabaseService.requireClient().rpc('create_session_table', {
        p_session_id: sessionId,
        p_name: cleanName
      });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return this.mapTable(data as SessionTableRow);
    }

    const session = this.getSession(sessionId);
    const tableNumber = (session?.tables ?? []).length + 1;
    const table: PokerTable = {
      id: this.createId('table'),
      sessionId,
      name: cleanName,
      status: 'ACTIVE',
      tableNumber,
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    this.updateSession(sessionId, (currentSession) => ({
      ...currentSession,
      tables: [...currentSession.tables, table]
    }));

    return table;
  }

  async listRegisteredPlayers(): Promise<RegisteredPlayerOption[]> {
    if (!this.shouldUseSupabase()) {
      return this.localRegisteredPlayers();
    }

    const client = this.supabaseService.requireClient();
    const { data: directRows, error: directError } = await client
      .from('users')
      .select('id,username,display_name,role')
      .in('role', ['PLAYER', 'MANAGER'])
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
    return players
      .map((player) => ({
        id: player.id,
        username: player.username ?? player.id.slice(0, 8),
        displayName: player.display_name ? this.titleCaseName(player.display_name) : null,
        role: (player.role === 'MANAGER' ? 'MANAGER' : 'PLAYER') as RegisteredPlayerOption['role']
      }))
      .sort((a, b) =>
        this.registeredPlayerSortName(a).localeCompare(this.registeredPlayerSortName(b))
      );
  }

  async addPlayer(
    sessionId: string,
    name: string,
    buyIn: number,
    comment = '',
    playerUserId: string | null = null,
    createRegisteredPlayer = false,
    tableId: string | null = null
  ): Promise<void> {
    const targetTableId = tableId ?? this.defaultTableId(sessionId);

    if (!targetTableId) {
      throw new Error('Create a table before adding players.');
    }

    if (this.shouldUseSupabase()) {
      let targetUserId = playerUserId;
      let targetName = name.trim();

      if (createRegisteredPlayer) {
        const createdPlayer = await this.createRegisteredPlayer(targetName);
        targetUserId = createdPlayer.id;
        targetName = createdPlayer.displayName ?? createdPlayer.username;
      }

      targetName = this.titleCaseName(targetName);

      const { error } = await this.supabaseService
        .requireClient()
        .rpc('add_player_to_session', {
          p_session_id: sessionId,
          p_table_id: targetTableId,
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

    let targetName = this.titleCaseName(name);
    let targetUserId = playerUserId;

    if (!this.shouldUseSupabase()) {
      const localPlayer = this.upsertLocalRegisteredPlayer(targetName, targetUserId);
      targetName = localPlayer.displayName ?? localPlayer.username;
      targetUserId = localPlayer.id;
    }

    const joinedAt = new Date().toISOString();
    const playerId = this.createId('player');
    const cleanBuyIn = this.normalizeAmount(buyIn);
    const player: SessionPlayer = {
      id: playerId,
      tableId: targetTableId,
      userId: targetUserId,
      name: targetName,
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
        this.createTransaction(session.id, targetTableId, playerId, 'BUYIN', cleanBuyIn, joinedAt, comment)
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
        this.createTransaction(
          session.id,
          this.tableIdForPlayer(session, sessionPlayerId),
          sessionPlayerId,
          'REBUY',
          rebuyAmount,
          createdAt,
          comment
        )
      ]
    }));
  }

  async recordCashOut(sessionId: string, sessionPlayerId: string, amount: number): Promise<void> {
    const currentPlayer = this.getSession(sessionId)?.players.find((player) => player.id === sessionPlayerId);

    if (this.shouldUseSupabase()) {
      const rpcName = currentPlayer?.status === 'COMPLETED' ? 'update_cashout' : 'record_cashout';
      const { error } = await this.supabaseService.requireClient().rpc(rpcName, {
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
          completedAt: player.completedAt ?? completedAt
        };
      }),
      transactions: [
        ...session.transactions,
        this.createTransaction(
          session.id,
          this.tableIdForPlayer(session, sessionPlayerId),
          sessionPlayerId,
          'CASHOUT',
          cashOut,
          completedAt
        )
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
    const currentSession = this.getSession(sessionId);

    if (currentSession?.players.some((player) => player.status === 'ACTIVE')) {
      throw new Error('Cash out all players before closing this session.');
    }

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

    const closedAt = new Date().toISOString();

    this.updateSession(sessionId, (session) => ({
      ...session,
      status: 'COMPLETED',
      closedAt,
      tables: session.tables.map((table) => ({
        ...table,
        status: 'CLOSED',
        closedAt: table.closedAt ?? closedAt
      }))
    }));
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService.requireClient().rpc('delete_session', {
        p_session_id: sessionId
      });

      if (error) {
        throw error;
      }

      this.updateSessions((sessions) => sessions.filter((session) => session.id !== sessionId));
      await this.refreshHostSessions();
      return;
    }

    this.updateSessions((sessions) => sessions.filter((session) => session.id !== sessionId));
  }

  totalsFor(session: PokerSession | undefined): SessionTotals {
    const players = session?.players ?? [];

    return {
      totalPlayers: players.length,
      activePlayers: players.filter((player) => player.status === 'ACTIVE').length,
      cashedOutPlayers: players.filter((player) => player.status === 'COMPLETED').length,
      totalBuyIn: players.reduce((sum, player) => sum + player.totalBuyIn, 0),
      totalCashOut: players.reduce((sum, player) => sum + player.cashOut, 0),
      totalNet: players.reduce((sum, player) => sum + player.net, 0)
    };
  }

  sortedPlayersByNet(session: PokerSession | undefined): SessionPlayer[] {
    return [...(session?.players ?? [])].sort((a, b) => b.net - a.net);
  }

  totalsForTable(session: PokerSession | undefined, tableId: string | null): SessionTotals {
    return this.totalsFor({
      ...(session ?? this.emptySession()),
      players: this.playersForTable(session, tableId)
    });
  }

  playersForTable(session: PokerSession | undefined, tableId: string | null): SessionPlayer[] {
    return (session?.players ?? []).filter((player) => player.tableId === tableId);
  }

  sortedPlayersForActiveSession(session: PokerSession | undefined): SessionPlayer[] {
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
    session: PokerSession | undefined,
    playerId: string
  ): PokerTransaction[] {
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

  async createRegisteredPlayer(displayName: string): Promise<RegisteredPlayerOption> {
    if (!this.shouldUseSupabase()) {
      return this.upsertLocalRegisteredPlayer(displayName);
    }

    const cleanDisplayName = displayName.trim();
    const username = this.usernameFromDisplayName(cleanDisplayName);
    const { data, error } = await this.supabaseService
      .requireClient()
      .functions.invoke<CreateRegisteredPlayerResponse>('create-registered-player', {
        body: {
          displayName: cleanDisplayName,
          username
        }
      });

    if (error) {
      throw new Error(
        `${this.toMessage(error)} Deploy the latest create-registered-player Edge Function, then try again.`
      );
    }

    if (!data?.player) {
      throw new Error('Unable to create registered player.');
    }

    return {
      ...data.player,
      role: 'PLAYER'
    };
  }

  async deleteRegisteredPlayer(userId: string): Promise<void> {
    if (!this.shouldUseSupabase()) {
      this.updateLocalDeletedRegisteredPlayerIds((ids) =>
        ids.includes(userId) ? ids : [...ids, userId]
      );
      this.updateLocalRegisteredPlayers((players) => players.filter((player) => player.id !== userId));
      this.updateSessions((sessions) =>
        sessions.map((session) => ({
          ...session,
          players: session.players.map((player) =>
            player.userId === userId ? { ...player, userId: null } : player
          )
        }))
      );
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

  async setRegisteredPlayerRole(userId: string, role: 'MANAGER' | 'PLAYER'): Promise<void> {
    if (!this.shouldUseSupabase()) {
      this.updateLocalRegisteredPlayers((players) =>
        players.map((player) => (player.id === userId ? { ...player, role } : player))
      );
      return;
    }

    const { error } = await this.supabaseService.requireClient().rpc('set_registered_user_role', {
      p_user_id: userId,
      p_role: role
    });

    if (error) {
      throw error;
    }

    await this.refreshHostSessions();
  }

  private mapSession(
    session: SessionRow,
    tables: SessionTableRow[],
    sessionPlayers: SessionPlayerRow[],
    playersById: Map<string, PlayerRow>,
    transactions: TransactionRow[]
  ): PokerSession {
    const currentSessionPlayers = sessionPlayers.filter((player) => player.session_id === session.id);
    const currentTables = tables.filter((table) => table.session_id === session.id);

    return {
      id: session.id,
      name: session.name,
      sessionDate: session.session_date,
      status: session.status,
      createdAt: session.created_at,
      closedAt: session.closed_at,
      tables: currentTables.map((table) => this.mapTable(table)),
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
  ): SessionPlayer {
    return {
      id: sessionPlayer.id,
      playerRecordId: sessionPlayer.player_id,
      tableId: sessionPlayer.table_id ?? null,
      userId: player?.user_id ?? null,
      name: this.titleCaseName(player?.name ?? 'Unknown player'),
      status: sessionPlayer.status,
      totalBuyIn: this.toNumber(sessionPlayer.total_buy_in),
      cashOut: this.toNumber(sessionPlayer.cash_out),
      net: this.toNumber(sessionPlayer.net),
      joinedAt: sessionPlayer.joined_at,
      completedAt: sessionPlayer.completed_at
    };
  }

  private mapTransaction(transaction: TransactionRow): PokerTransaction {
    return {
      id: transaction.id,
      sessionId: transaction.session_id,
      tableId: transaction.table_id ?? null,
      playerId: transaction.session_player_id,
      type: transaction.type,
      amount: this.toNumber(transaction.amount),
      createdAt: transaction.created_at,
      ...(transaction.comment ? { comment: transaction.comment } : {}),
      ...(transaction.deleted_at ? { deletedAt: transaction.deleted_at } : {})
    };
  }

  private mapTable(table: SessionTableRow): PokerTable {
    return {
      id: table.id,
      sessionId: table.session_id,
      name: table.name,
      status: table.status,
      tableNumber: table.table_number,
      createdAt: table.created_at,
      closedAt: table.closed_at
    };
  }

  private updateSession(
    sessionId: string,
    updater: (session: PokerSession) => PokerSession
  ): void {
    this.updateSessions((sessions) =>
      sessions.map((session) => (session.id === sessionId ? updater(session) : session))
    );
  }

  private updateSessions(updater: (sessions: PokerSession[]) => PokerSession[]): void {
    const sessions = updater(this.sessionsSignal());
    this.sessionsSignal.set(sessions);
    this.saveSessions(sessions);
  }

  private createTransaction(
    sessionId: string,
    tableId: string | null,
    playerId: string,
    type: PokerTransactionType,
    amount: number,
    createdAt: string,
    comment = ''
  ): PokerTransaction {
    const cleanComment = comment.trim();

    return {
      id: this.createId('transaction'),
      sessionId,
      tableId,
      playerId,
      type,
      amount,
      createdAt,
      ...(cleanComment ? { comment: cleanComment } : {})
    };
  }

  private defaultTableId(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    return session?.tables.find((table) => table.status === 'ACTIVE')?.id ?? session?.tables[0]?.id ?? null;
  }

  private tableIdForPlayer(session: PokerSession, playerId: string): string | null {
    return session.players.find((player) => player.id === playerId)?.tableId ?? this.defaultTableId(session.id);
  }

  private emptySession(): PokerSession {
    return {
      id: '',
      name: '',
      sessionDate: '',
      status: 'ACTIVE',
      createdAt: '',
      closedAt: null,
      tables: [],
      players: [],
      transactions: []
    };
  }

  private recalculatePlayerBuyIn(
    players: SessionPlayer[],
    transactions: PokerTransaction[],
    playerId: string
  ): SessionPlayer[] {
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

  private setupRealtimeChannel(userId: string | null, role: string | null): void {
    if (!userId || !role) {
      this.teardownRealtimeChannel();
      return;
    }

    const userKey = `${role}:${userId}`;

    if (this.realtimeUserKey === userKey && this.realtimeChannel) {
      return;
    }

    this.teardownRealtimeChannel();

    const client = this.supabaseService.requireClient();
    const channel = client.channel(`pokertrack-session-sync:${userKey}`);
    const handleChange = () => this.queueRealtimeRefresh();

    for (const table of ['sessions', 'players', 'session_players', 'transactions']) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table
        },
        handleChange
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.queueRealtimeRefresh();
      }
    });

    this.realtimeChannel = channel;
    this.realtimeUserKey = userKey;
  }

  private teardownRealtimeChannel(): void {
    if (this.realtimeChannel) {
      void this.supabaseService.client?.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = null;
    this.realtimeUserKey = null;
  }

  private queueRealtimeRefresh(): void {
    if (this.shouldUseSupabase()) {
      this.realtimeRefreshSignal.next();
    }
  }

  private shouldUseSupabase(): boolean {
    return this.shouldUseSupabaseForUser(this.authState.user()?.id ?? null);
  }

  private shouldUseSupabaseForUser(userId: string | null): boolean {
    return Boolean(
        this.supabaseService.isConfigured &&
        userId &&
        !userId.startsWith('mock-') &&
        !userId.startsWith('dev-') &&
        (this.authState.role() === 'HOST' ||
          this.authState.role() === 'MANAGER' ||
          this.authState.role() === 'PLAYER')
    );
  }

  private normalizeAmount(amount: number): number {
    return Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  }

  private localRegisteredPlayers(): RegisteredPlayerOption[] {
    const deletedIds = new Set(this.localDeletedRegisteredPlayerIdsSignal());
    const playersByKey = new Map<string, RegisteredPlayerOption>(
      this.localRegisteredPlayersSignal()
        .filter((player) => !deletedIds.has(player.id))
        .map((player) => [player.id, player])
    );

    for (const session of this.sessionsSignal()) {
      for (const player of session.players) {
        const displayName = this.titleCaseName(player.name);
        const id = player.userId ?? this.localRegisteredPlayerId(displayName);

        if (!deletedIds.has(id) && !playersByKey.has(id)) {
          playersByKey.set(id, {
            id,
            username: this.usernameFromDisplayName(displayName),
            displayName,
            role: 'PLAYER'
          });
        }
      }
    }

    return [...playersByKey.values()].sort((a, b) =>
      this.registeredPlayerSortName(a).localeCompare(this.registeredPlayerSortName(b))
    );
  }

  private upsertLocalRegisteredPlayer(
    displayName: string,
    preferredId: string | null = null
  ): RegisteredPlayerOption {
    const cleanDisplayName = this.titleCaseName(displayName);
    const id = preferredId ?? this.localRegisteredPlayerId(cleanDisplayName);
    const existingPlayer = this.localRegisteredPlayersSignal().find((player) => player.id === id);
    const player: RegisteredPlayerOption = {
      id,
      username: existingPlayer?.username ?? this.usernameFromDisplayName(cleanDisplayName),
      displayName: cleanDisplayName,
      role: existingPlayer?.role ?? 'PLAYER'
    };

    this.updateLocalDeletedRegisteredPlayerIds((ids) => ids.filter((deletedId) => deletedId !== id));
    this.updateLocalRegisteredPlayers((players) => [
      ...players.filter((item) => item.id !== player.id),
      player
    ]);

    return player;
  }

  private updateLocalRegisteredPlayers(
    updater: (players: RegisteredPlayerOption[]) => RegisteredPlayerOption[]
  ): void {
    const players = updater(this.localRegisteredPlayersSignal());
    this.localRegisteredPlayersSignal.set(players);
    this.saveLocalRegisteredPlayers(players);
  }

  private updateLocalDeletedRegisteredPlayerIds(updater: (ids: string[]) => string[]): void {
    const ids = updater(this.localDeletedRegisteredPlayerIdsSignal());
    this.localDeletedRegisteredPlayerIdsSignal.set(ids);
    this.saveLocalDeletedRegisteredPlayerIds(ids);
  }

  private localRegisteredPlayerId(name: string): string {
    return `local-player-${this.localPlayerSlug(name)}`;
  }

  private localPlayerSlug(name: string): string {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);

    return normalized.length >= 3 ? normalized : 'player';
  }

  private usernameFromDisplayName(displayName: string): string {
    const normalized = displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);

    return normalized.length >= 3 ? normalized : `player-${Date.now().toString(36)}`;
  }

  private titleCaseName(name: string): string {
    return name
      .trim()
      .toLocaleLowerCase()
      .replace(/\b[\p{L}\p{N}]/gu, (letter) => letter.toLocaleUpperCase());
  }

  private registeredPlayerSortName(player: RegisteredPlayerOption): string {
    return (player.displayName ?? player.username).trim().toLocaleLowerCase();
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

    return 'Unable to sync poker data.';
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

  private loadSessions(): PokerSession[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(localStorageKey) ?? localStorage.getItem(legacyLocalStorageKey);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as PokerSession[];
    } catch {
      localStorage.removeItem(localStorageKey);
      localStorage.removeItem(legacyLocalStorageKey);
      return [];
    }
  }

  private loadLocalRegisteredPlayers(): RegisteredPlayerOption[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(localRegisteredPlayersStorageKey);

    if (!raw) {
      return [];
    }

    try {
      const players = JSON.parse(raw) as RegisteredPlayerOption[];
      return players.filter((player) => player.id && player.username);
    } catch {
      localStorage.removeItem(localRegisteredPlayersStorageKey);
      return [];
    }
  }

  private loadLocalDeletedRegisteredPlayerIds(): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(localDeletedRegisteredPlayersStorageKey);

    if (!raw) {
      return [];
    }

    try {
      const ids = JSON.parse(raw) as string[];
      return ids.filter((id) => typeof id === 'string' && id.length > 0);
    } catch {
      localStorage.removeItem(localDeletedRegisteredPlayersStorageKey);
      return [];
    }
  }

  private saveSessions(sessions: PokerSession[]): void {
    if (typeof localStorage === 'undefined' || this.shouldUseSupabase()) {
      return;
    }

    localStorage.setItem(localStorageKey, JSON.stringify(sessions));
    localStorage.removeItem(legacyLocalStorageKey);
  }

  private saveLocalRegisteredPlayers(players: RegisteredPlayerOption[]): void {
    if (typeof localStorage === 'undefined' || this.shouldUseSupabase()) {
      return;
    }

    localStorage.setItem(localRegisteredPlayersStorageKey, JSON.stringify(players));
  }

  private saveLocalDeletedRegisteredPlayerIds(ids: string[]): void {
    if (typeof localStorage === 'undefined' || this.shouldUseSupabase()) {
      return;
    }

    localStorage.setItem(localDeletedRegisteredPlayersStorageKey, JSON.stringify(ids));
  }
}
