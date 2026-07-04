import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Subject, Subscription, auditTime } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';

export type PokerSessionStatus = 'ACTIVE' | 'COMPLETED';
export type PokerPlayerStatus = 'ACTIVE' | 'COMPLETED';
export type PokerTransactionType = 'BUYIN' | 'REBUY' | 'CASHOUT';
export type RecordedHandStatus = 'DRAFT' | 'SAVED';
export type RecordedHandStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
export type RecordedHandActionType = 'RAISE' | 'CALL' | 'CHECK' | 'FOLD' | 'BET' | 'ALL_IN';

export interface RecordedHandAction {
  id: string;
  handId: string;
  street: RecordedHandStreet;
  actionOrder: number;
  sessionPlayerId: string;
  playerName: string;
  actionType: RecordedHandActionType;
  amount: number | null;
  createdAt: string;
}

export interface RecordedHandBoardCard {
  rank: string;
  suit: 'HEART' | 'DIAMOND' | 'CLUB' | 'SPADE';
}

export interface RecordedHand {
  id: string;
  sessionId: string;
  createdBy: string;
  creatorPlayerId: string | null;
  title?: string;
  comment?: string;
  tags: string[];
  playerIds: string[];
  board: RecordedHandBoardCard[];
  status: RecordedHandStatus;
  createdAt: string;
  updatedAt: string;
  actions: RecordedHandAction[];
}

export interface SaveRecordedHandInput {
  sessionId: string;
  title?: string;
  comment?: string;
  tags: string[];
  playerIds: string[];
  board: RecordedHandBoardCard[];
  status: RecordedHandStatus;
  actions: Array<{
    street: RecordedHandStreet;
    sessionPlayerId: string;
    actionType: RecordedHandActionType;
    amount: number | null;
  }>;
}

export interface PokerTransaction {
  id: string;
  sessionId: string;
  playerId: string;
  type: PokerTransactionType;
  amount: number;
  createdAt: string;
  comment?: string;
  deletedAt?: string;
}

export interface SessionPlayer {
  id: string;
  playerRecordId?: string;
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
  players: SessionPlayer[];
  transactions: PokerTransaction[];
  recordedHands: RecordedHand[];
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
  player_id: string;
  session_player_id: string;
  type: PokerTransactionType;
  amount: number | string;
  created_at: string;
  comment: string | null;
  deleted_at: string | null;
}

interface RecordedHandRow {
  id: string;
  session_id: string;
  created_by: string;
  creator_player_id: string | null;
  title: string | null;
  comment: string | null;
  tags: string[] | null;
  player_ids?: string[] | null;
  board: RecordedHandBoardCard[] | null;
  status: RecordedHandStatus;
  created_at: string;
  updated_at: string;
}

interface RecordedHandActionRow {
  id: string;
  hand_id: string;
  street: RecordedHandStreet;
  action_order: number;
  session_player_id: string;
  action_type: RecordedHandActionType;
  amount: number | string | null;
  created_at: string;
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

const localStorageKey = 'pokertrack.localPokerStore';
const legacyLocalStorageKey = 'pokertrack.mockPokerStore';
const localRegisteredPlayersStorageKey = 'pokertrack.localRegisteredPlayers';
const localDeletedRegisteredPlayersStorageKey = 'pokertrack.localDeletedRegisteredPlayers';
const localProductionSnapshotMarkerStorageKey = 'pokertrack.localProductionSnapshotCopiedAt';
const localProductionSnapshotPath = '/snapshots/production-copy.json';

interface LocalProductionSnapshot {
  copiedAt: string;
  sessions: PokerSession[];
  registeredPlayers: RegisteredPlayerOption[];
}

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
  private localProductionSnapshotLoadPromise: Promise<void> | null = null;

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
        void this.loadLocalProductionSnapshotIfNeeded(user?.id ?? null);
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

      const [sessionPlayersResult, transactionsResult, recordedHandsResult] = await Promise.all([
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
          .order('created_at', { ascending: true }),
        client
          .from('recorded_hands')
          .select(
            'id,session_id,created_by,creator_player_id,title,comment,tags,player_ids,board,status,created_at,updated_at'
          )
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
      ]);

      if (sessionPlayersResult.error) {
        throw sessionPlayersResult.error;
      }

      if (transactionsResult.error) {
        throw transactionsResult.error;
      }

      if (recordedHandsResult.error) {
        throw recordedHandsResult.error;
      }

      const sessionPlayers = (sessionPlayersResult.data ?? []) as SessionPlayerRow[];
      const playerIds = [...new Set(sessionPlayers.map((player) => player.player_id))];
      const playersById = await this.loadPlayersById(playerIds);
      const transactions = (transactionsResult.data ?? []) as TransactionRow[];
      const recordedHands = (recordedHandsResult.data ?? []) as RecordedHandRow[];
      const recordedHandIds = recordedHands.map((hand) => hand.id);
      const recordedHandActions =
        recordedHandIds.length > 0
          ? await this.loadRecordedHandActions(recordedHandIds)
          : [];

      this.sessionsSignal.set(
        sessions.map((session) =>
          this.mapSession(
            session,
            sessionPlayers,
            playersById,
            transactions,
            recordedHands,
            recordedHandActions
          )
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

      const createdSession = this.mapSession(data as SessionRow, [], new Map(), []);
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
      players: [],
      transactions: [],
      recordedHands: []
    };

    this.updateSessions((sessions) => [session, ...sessions]);

    return session;
  }

  getSession(sessionId: string | null): PokerSession | undefined {
    return this.sessionsSignal().find((session) => session.id === sessionId);
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

      targetName = this.titleCaseName(targetName);

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

  async deleteSession(sessionId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService
        .requireClient()
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      this.updateSessions((sessions) => sessions.filter((session) => session.id !== sessionId));
      await this.refreshHostSessions();
      return;
    }

    this.updateSessions((sessions) => sessions.filter((session) => session.id !== sessionId));
  }

  async saveRecordedHand(input: SaveRecordedHandInput): Promise<void> {
    const session = this.getSession(input.sessionId);

    if (!session) {
      throw new Error('Session not found.');
    }

    const cleanInput = {
      ...input,
      tags: input.tags.slice(0, 8),
      playerIds: input.playerIds.filter((playerId) =>
        session.players.some((player) => player.id === playerId)
      ),
      board: input.board.slice(0, 5),
      comment: input.comment?.trim() ?? '',
      title: input.title?.trim() ?? ''
    };

    const creatorPlayerId = this.creatorPlayerIdForSession(session);

    if (this.shouldUseSupabase()) {
      const client = this.supabaseService.requireClient();
      const { data: handRow, error: handError } = await client
        .from('recorded_hands')
        .insert({
          session_id: cleanInput.sessionId,
          created_by: this.authState.user()?.id,
          creator_player_id: creatorPlayerId,
          title: cleanInput.title || null,
          comment: cleanInput.comment || null,
          tags: cleanInput.tags,
          player_ids: cleanInput.playerIds,
          board: cleanInput.board,
          status: cleanInput.status
        })
        .select(
          'id,session_id,created_by,creator_player_id,title,comment,tags,player_ids,board,status,created_at,updated_at'
        )
        .single<RecordedHandRow>();

      if (handError) {
        throw handError;
      }

      if (cleanInput.actions.length > 0) {
        const { error: actionsError } = await client.from('recorded_hand_actions').insert(
          cleanInput.actions.map((action, index) => ({
            hand_id: handRow.id,
            street: action.street,
            action_order: index + 1,
            session_player_id: action.sessionPlayerId,
            action_type: action.actionType,
            amount: action.amount === null ? null : this.normalizeAmount(action.amount)
          }))
        );

        if (actionsError) {
          throw actionsError;
        }
      }

      await this.refreshHostSessions();
      return;
    }

    const now = new Date().toISOString();
    const handId = this.createId('hand');
    const hand: RecordedHand = {
      id: handId,
      sessionId: cleanInput.sessionId,
      createdBy: this.authState.user()?.id ?? 'local-user',
      creatorPlayerId,
      ...(cleanInput.title ? { title: cleanInput.title } : {}),
      ...(cleanInput.comment ? { comment: cleanInput.comment } : {}),
      tags: cleanInput.tags,
      playerIds: cleanInput.playerIds,
      board: cleanInput.board,
      status: cleanInput.status,
      createdAt: now,
      updatedAt: now,
      actions: cleanInput.actions.map((action, index) => ({
        id: this.createId('hand-action'),
        handId,
        street: action.street,
        actionOrder: index + 1,
        sessionPlayerId: action.sessionPlayerId,
        playerName:
          session.players.find((player) => player.id === action.sessionPlayerId)?.name ??
          'Unknown player',
        actionType: action.actionType,
        amount: action.amount === null ? null : this.normalizeAmount(action.amount),
        createdAt: now
      }))
    };

    this.updateSession(cleanInput.sessionId, (currentSession) => ({
      ...currentSession,
      recordedHands: [hand, ...(currentSession.recordedHands ?? [])]
    }));
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

  recordedHandsForSession(session: PokerSession | undefined): RecordedHand[] {
    return [...(session?.recordedHands ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    sessionPlayers: SessionPlayerRow[],
    playersById: Map<string, PlayerRow>,
    transactions: TransactionRow[],
    recordedHands: RecordedHandRow[] = [],
    recordedHandActions: RecordedHandActionRow[] = []
  ): PokerSession {
    const currentSessionPlayers = sessionPlayers.filter((player) => player.session_id === session.id);
    const mappedPlayers = currentSessionPlayers.map((sessionPlayer) =>
      this.mapSessionPlayer(sessionPlayer, playersById.get(sessionPlayer.player_id))
    );

    return {
      id: session.id,
      name: session.name,
      sessionDate: session.session_date,
      status: session.status,
      createdAt: session.created_at,
      closedAt: session.closed_at,
      players: mappedPlayers,
      transactions: transactions
        .filter((transaction) => transaction.session_id === session.id)
        .map((transaction) => this.mapTransaction(transaction)),
      recordedHands: recordedHands
        .filter((hand) => hand.session_id === session.id)
        .map((hand) => this.mapRecordedHand(hand, recordedHandActions, mappedPlayers))
    };
  }

  private mapSessionPlayer(
    sessionPlayer: SessionPlayerRow,
    player: PlayerRow | undefined
  ): SessionPlayer {
    return {
      id: sessionPlayer.id,
      playerRecordId: sessionPlayer.player_id,
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
      playerId: transaction.session_player_id,
      type: transaction.type,
      amount: this.toNumber(transaction.amount),
      createdAt: transaction.created_at,
      ...(transaction.comment ? { comment: transaction.comment } : {}),
      ...(transaction.deleted_at ? { deletedAt: transaction.deleted_at } : {})
    };
  }

  private mapRecordedHand(
    hand: RecordedHandRow,
    actions: RecordedHandActionRow[],
    sessionPlayers: SessionPlayer[]
  ): RecordedHand {
    return {
      id: hand.id,
      sessionId: hand.session_id,
      createdBy: hand.created_by,
      creatorPlayerId: hand.creator_player_id,
      ...(hand.title ? { title: hand.title } : {}),
      ...(hand.comment ? { comment: hand.comment } : {}),
      tags: Array.isArray(hand.tags) ? hand.tags : [],
      playerIds: Array.isArray(hand.player_ids) ? hand.player_ids : [],
      board: Array.isArray(hand.board) ? hand.board : [],
      status: hand.status,
      createdAt: hand.created_at,
      updatedAt: hand.updated_at,
      actions: actions
        .filter((action) => action.hand_id === hand.id)
        .sort((a, b) => a.action_order - b.action_order)
        .map((action) => this.mapRecordedHandAction(action, sessionPlayers))
    };
  }

  private mapRecordedHandAction(
    action: RecordedHandActionRow,
    sessionPlayers: SessionPlayer[]
  ): RecordedHandAction {
    return {
      id: action.id,
      handId: action.hand_id,
      street: action.street,
      actionOrder: action.action_order,
      sessionPlayerId: action.session_player_id,
      playerName:
        sessionPlayers.find((player) => player.id === action.session_player_id)?.name ??
        'Unknown player',
      actionType: action.action_type,
      amount: action.amount === null ? null : this.toNumber(action.amount),
      createdAt: action.created_at
    };
  }

  private async loadRecordedHandActions(handIds: string[]): Promise<RecordedHandActionRow[]> {
    if (handIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseService
      .requireClient()
      .from('recorded_hand_actions')
      .select('id,hand_id,street,action_order,session_player_id,action_type,amount,created_at')
      .in('hand_id', handIds)
      .order('action_order', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as RecordedHandActionRow[];
  }

  private creatorPlayerIdForSession(session: PokerSession): string | null {
    const userId = this.authState.user()?.id ?? null;

    if (!userId) {
      return null;
    }

    return session.players.find((player) => player.userId === userId)?.id ?? null;
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
      playerId,
      type,
      amount,
      createdAt,
      ...(cleanComment ? { comment: cleanComment } : {})
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

    for (const table of [
      'sessions',
      'players',
      'session_players',
      'transactions',
      'recorded_hands',
      'recorded_hand_actions'
    ]) {
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
      return (JSON.parse(raw) as PokerSession[]).map((session) => ({
        ...session,
        recordedHands: session.recordedHands ?? []
      }));
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

  private async loadLocalProductionSnapshotIfNeeded(userId: string | null): Promise<void> {
    if (
      userId !== 'dev-host-admin' ||
      typeof localStorage === 'undefined' ||
      typeof fetch === 'undefined' ||
      this.shouldUseSupabaseForUser(userId)
    ) {
      return;
    }

    if (this.localProductionSnapshotLoadPromise) {
      return this.localProductionSnapshotLoadPromise;
    }

    this.localProductionSnapshotLoadPromise = this.loadLocalProductionSnapshot();

    try {
      await this.localProductionSnapshotLoadPromise;
    } finally {
      this.localProductionSnapshotLoadPromise = null;
    }
  }

  private async loadLocalProductionSnapshot(): Promise<void> {
    const response = await fetch(localProductionSnapshotPath, { cache: 'no-store' });

    if (!response.ok) {
      return;
    }

    const snapshot = (await response.json()) as Partial<LocalProductionSnapshot>;

    if (
      !snapshot.copiedAt ||
      !Array.isArray(snapshot.sessions) ||
      !Array.isArray(snapshot.registeredPlayers)
    ) {
      return;
    }

    if (localStorage.getItem(localProductionSnapshotMarkerStorageKey) === snapshot.copiedAt) {
      return;
    }

    this.sessionsSignal.set(snapshot.sessions);
    this.localRegisteredPlayersSignal.set(snapshot.registeredPlayers);
    this.localDeletedRegisteredPlayerIdsSignal.set([]);

    this.saveSessions(snapshot.sessions);
    this.saveLocalRegisteredPlayers(snapshot.registeredPlayers);
    this.saveLocalDeletedRegisteredPlayerIds([]);
    localStorage.setItem(localProductionSnapshotMarkerStorageKey, snapshot.copiedAt);
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
