import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Subject, Subscription, auditTime } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { environment } from '../../../../environments/environment';
import { removeSessionPlayerFromSession } from './session-player-removal.logic';
import { removeSessionTableFromSession } from './session-table-removal.logic';
import { sessionLoadEffectAction } from './session-load.logic';
import {
  localPlayerSlug as buildLocalPlayerSlug,
  usernameFromDisplayName as buildUsernameFromDisplayName
} from './username.logic';
import { sessionRealtimeTables, shouldReconnectRealtimeChannel } from './realtime.logic';
import {
  CALL_TIME_DURATION_SECONDS,
  CALL_TIME_LIMIT,
  CALL_TIME_SYNC_BUFFER_SECONDS,
  timeCallPhase,
  timeCallProgress,
  timeCallSecondsRemaining,
  timeCallStartsInSeconds
} from './time-call.logic';
import {
  messageFromSupabaseFunctionError,
  messageFromUnknownError
} from '../shared/action-feedback.logic';

export { CALL_TIME_DURATION_SECONDS, CALL_TIME_LIMIT } from './time-call.logic';

interface RefreshSessionsOptions {
  showLoading?: boolean;
}

export type PokerSessionStatus = 'ACTIVE' | 'COMPLETED';
export type PokerTableStatus = 'ACTIVE' | 'CLOSED';
export type PokerPlayerStatus = 'ACTIVE' | 'COMPLETED';
export type PokerTransactionType = 'BUYIN' | 'REBUY' | 'CASHOUT';
export type TimeCallStatus = 'RUNNING' | 'FINISHED' | 'EXPIRED' | 'CANCELLED';
export type ResolvedTimeCallStatus = Exclude<TimeCallStatus, 'RUNNING'>;

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

export interface TimeCall {
  id: string;
  sessionId: string;
  sessionPlayerId: string;
  status: TimeCallStatus;
  startedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
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
  timeCalls: TimeCall[];
}

export interface SessionTotals {
  totalPlayers: number;
  activePlayers: number;
  cashedOutPlayers: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalNet: number;
}

export interface PlayerPublicTableSummary {
  sessionPlayerId: string;
  sessionId: string;
  tableId: string | null;
  activePlayerCount: number;
  totalActivePlayerChips: number;
}

export interface PlayerPublicTableRosterEntry {
  sessionPlayerId: string;
  sessionId: string;
  tableId: string | null;
  name: string;
  status: PokerPlayerStatus;
  isNetLeader?: boolean;
}

export interface PlayerActiveTable {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionCreatedAt: string;
  tableId: string;
  tableName: string;
  tableNumber: number;
  tableCreatedAt: string;
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

interface PlayerPublicTableSummaryRow {
  session_player_id: string;
  session_id: string;
  table_id: string | null;
  active_player_count: number | string;
  total_active_player_chips: number | string;
}

interface PlayerPublicTableRosterRow {
  session_player_id: string;
  session_id: string;
  table_id: string | null;
  player_name: string;
  status: PokerPlayerStatus;
  is_net_leader?: boolean;
}

interface PlayerActiveTableRow {
  session_id: string;
  session_name: string;
  session_date: string;
  session_created_at: string;
  table_id: string;
  table_name: string;
  table_number: number;
  table_created_at: string;
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

interface TimeCallRow {
  id: string;
  session_id: string;
  session_player_id: string;
  status: TimeCallStatus;
  started_at: string;
  expires_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface TimeCallRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Partial<TimeCallRow>;
  old?: Partial<TimeCallRow>;
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

interface ResetRegisteredPlayerPasswordResponse {
  ok: boolean;
  temporaryPassword: string;
}

interface LocalSharedState {
  sessions?: PokerSession[];
  registeredPlayers?: RegisteredPlayerOption[];
  deletedRegisteredPlayerIds?: string[];
}

const localStorageKey = 'pokertrack.localPokerStore.sessionTables.v2';
const legacyLocalStorageKey = 'pokertrack.mockPokerStore';
const localRegisteredPlayersStorageKey = 'pokertrack.localRegisteredPlayers.sessionTables.v2';
const localDeletedRegisteredPlayersStorageKey =
  'pokertrack.localDeletedRegisteredPlayers.sessionTables.v2';
const developmentPasswordOverridesStorageKey = 'pokertrack.developmentPasswordOverrides.v1';
const developmentProductionSnapshotAppliedAtStorageKey =
  'pokertrack.productionSnapshot.appliedAt.sessionTables.v2';
const developmentProductionSnapshotPath = '/snapshots/production-sync.json';

interface DevelopmentProductionSnapshot {
  syncedAt?: string;
  sessions?: PokerSession[];
  registeredPlayers?: RegisteredPlayerOption[];
}

@Injectable({
  providedIn: 'root'
})
export class PokerStoreService implements OnDestroy {
  private readonly authState = inject(AuthStateService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly sessionsSignal = signal<PokerSession[]>(this.loadSessions());
  private readonly playerPublicTableSummariesSignal = signal<PlayerPublicTableSummary[]>([]);
  private readonly playerPublicTableRosterSignal = signal<PlayerPublicTableRosterEntry[]>([]);
  private readonly playerActiveTablesSignal = signal<PlayerActiveTable[]>([]);
  private readonly localRegisteredPlayersSignal = signal<RegisteredPlayerOption[]>(
    this.loadLocalRegisteredPlayers()
  );
  private readonly localDeletedRegisteredPlayerIdsSignal = signal<string[]>(
    this.loadLocalDeletedRegisteredPlayerIds()
  );
  private readonly loadingSignal = signal(false);
  private readonly sessionsLoadedSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly timeCallSchemaReadySignal = signal(true);
  private readonly nowSignal = signal(Date.now());
  private readonly realtimeRefreshSignal = new Subject<void>();
  private readonly realtimeRefreshSubscription: Subscription;
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeUserKey: string | null = null;
  private loadedSupabaseUserId: string | null = null;
  private loadedSupabaseRole: string | null = null;
  private playerActiveTablesUserId =
    this.authState.role() === 'PLAYER' ? (this.authState.user()?.id ?? null) : null;
  private playerActiveTablesRequestVersion = 0;
  private serverTimeOffsetMs = 0;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private localSharedPollTimer: ReturnType<typeof setInterval> | null = null;
  private realtimeReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly expiringTimeCallIds = new Set<string>();

  readonly sessions = this.sessionsSignal.asReadonly();
  readonly playerPublicTableSummaries = this.playerPublicTableSummariesSignal.asReadonly();
  readonly playerPublicTableRoster = this.playerPublicTableRosterSignal.asReadonly();
  readonly playerActiveTables = this.playerActiveTablesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly sessionsLoaded = this.sessionsLoadedSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly timeCallSchemaReady = this.timeCallSchemaReadySignal.asReadonly();
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
      const userId = user?.id ?? null;
      const playerActiveTablesUserId = role === 'PLAYER' ? userId : null;

      if (playerActiveTablesUserId !== this.playerActiveTablesUserId) {
        this.playerActiveTablesUserId = playerActiveTablesUserId;
        this.playerActiveTablesRequestVersion += 1;
        this.playerActiveTablesSignal.set([]);
      }

      const loadAction = sessionLoadEffectAction({
        initialized,
        userId,
        usesSupabase: this.shouldUseSupabaseForUser(userId),
        loadedSupabaseUserId:
          this.loadedSupabaseRole === role ? this.loadedSupabaseUserId : null
      });

      if (loadAction === 'WAIT_FOR_AUTH') {
        this.teardownRealtimeChannel();
        return;
      }

      if (loadAction === 'LOAD_LOCAL_SESSIONS') {
        this.teardownRealtimeChannel();
        this.loadedSupabaseUserId = null;
        this.loadedSupabaseRole = null;
        void this.refreshHostSessions({ showLoading: false });
        return;
      }

      this.setupRealtimeChannel(userId, role);

      if (loadAction === 'SKIP_CURRENT_SUPABASE_USER') {
        return;
      }

      this.loadedSupabaseUserId = userId;
      this.loadedSupabaseRole = role;
      void this.refreshSessions();
    });

    if (typeof window !== 'undefined') {
      this.countdownTimer = window.setInterval(() => {
        this.nowSignal.set(Date.now());
        this.expireDueTimeCalls();
      }, 250);

      if (this.shouldUseLocalSharedData()) {
        void this.loadLocalSharedState();
        this.localSharedPollTimer = window.setInterval(() => {
          void this.loadLocalSharedState();
        }, 1500);
      }
    }
  }

  ngOnDestroy(): void {
    this.teardownRealtimeChannel();
    this.realtimeRefreshSubscription.unsubscribe();
    this.realtimeRefreshSignal.complete();

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    if (this.localSharedPollTimer) {
      clearInterval(this.localSharedPollTimer);
      this.localSharedPollTimer = null;
    }

    if (this.realtimeReconnectTimer) {
      clearTimeout(this.realtimeReconnectTimer);
      this.realtimeReconnectTimer = null;
    }
  }

  async refreshSessions(options: RefreshSessionsOptions = {}): Promise<void> {
    await this.refreshHostSessions(options);
  }

  supportsSharedSessionUpdates(): boolean {
    return this.shouldUseSupabase() || this.shouldUseLocalSharedData();
  }

  async refreshHostSessions(options: RefreshSessionsOptions = {}): Promise<void> {
    const showLoading = options.showLoading ?? true;

    if (this.shouldUseLocalSharedData()) {
      await this.loadLocalSharedState();
      this.playerActiveTablesSignal.set([]);
      this.markSessionsLoaded();
      return;
    }

    if (!this.shouldUseSupabase()) {
      await this.refreshDevelopmentProductionSnapshot({ showLoading });
      this.playerActiveTablesSignal.set([]);
      this.markSessionsLoaded();
      return;
    }

    if (showLoading) {
      this.setLoading(true);
    }
    this.setError(null);

    try {
      await this.syncServerClock();

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

      await this.refreshPlayerActiveTables();

      if (sessionIds.length === 0) {
        this.sessionsSignal.set([]);
        this.playerPublicTableSummariesSignal.set([]);
        this.playerPublicTableRosterSignal.set([]);
        return;
      }

      const [tablesResult, sessionPlayersResult, transactionsResult, timeCallsResult] = await Promise.all([
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
          .order('created_at', { ascending: true }),
        client
          .from('time_calls')
          .select('id,session_id,session_player_id,status,started_at,expires_at,resolved_at,resolved_by')
          .in('session_id', sessionIds)
          .order('started_at', { ascending: true })
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

      let timeCalls: TimeCallRow[] = [];

      if (timeCallsResult.error) {
        if (this.isMissingTimeCallSchema(timeCallsResult.error)) {
          this.timeCallSchemaReadySignal.set(false);
        } else {
          throw timeCallsResult.error;
        }
      } else {
        this.timeCallSchemaReadySignal.set(true);
        timeCalls = (timeCallsResult.data ?? []) as TimeCallRow[];
      }

      const sessionPlayers = (sessionPlayersResult.data ?? []) as SessionPlayerRow[];
      const playerIds = [...new Set(sessionPlayers.map((player) => player.player_id))];
      const playersById = await this.loadPlayersById(playerIds);
      const tables = (tablesResult.data ?? []) as SessionTableRow[];
      const transactions = (transactionsResult.data ?? []) as TransactionRow[];

      this.sessionsSignal.set(
        sessions.map((session) =>
          this.mapSession(session, tables, sessionPlayers, playersById, transactions, timeCalls)
        )
      );

      await this.refreshPlayerPublicTableSummaries(sessionIds);
    } catch (error) {
      this.setError(this.toMessage(error));
      throw error;
    } finally {
      if (showLoading) {
        this.setLoading(false);
      }
      this.markSessionsLoaded();
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

      const createdSession = this.mapSession(data as SessionRow, [], [], new Map(), [], []);
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
      transactions: [],
      timeCalls: []
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

  async deleteTable(sessionId: string, tableId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService.requireClient().rpc('delete_session_table', {
        p_table_id: tableId
      });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    this.updateSession(sessionId, (session) => removeSessionTableFromSession(session, tableId));
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
      try {
        await this.refreshHostSessions();
      } catch {
        this.setError(null);
      }
      return;
    }

    this.updateSessions((sessions) => sessions.filter((session) => session.id !== sessionId));
  }

  async removeSessionPlayer(sessionId: string, sessionPlayerId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      const { error } = await this.supabaseService.requireClient().rpc('remove_session_player', {
        p_session_player_id: sessionPlayerId
      });

      if (error) {
        throw error;
      }

      await this.refreshHostSessions();
      return;
    }

    this.updateSession(sessionId, (session) =>
      removeSessionPlayerFromSession(session, sessionPlayerId)
    );
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

  private async refreshPlayerPublicTableSummaries(sessionIds: string[]): Promise<void> {
    if (this.authState.role() !== 'PLAYER') {
      this.playerPublicTableSummariesSignal.set([]);
      this.playerPublicTableRosterSignal.set([]);
      return;
    }

    const { data, error } = await this.supabaseService
      .requireClient()
      .rpc('player_public_table_summaries', {
        p_session_ids: sessionIds
      });

    if (error) {
      if (this.isMissingPublicTableSummaryRpc(error)) {
        this.playerPublicTableSummariesSignal.set([]);
        return;
      }

      throw error;
    }

    this.playerPublicTableSummariesSignal.set(
      ((data ?? []) as PlayerPublicTableSummaryRow[]).map((row) => ({
        sessionPlayerId: row.session_player_id,
        sessionId: row.session_id,
        tableId: row.table_id ?? null,
        activePlayerCount: this.toNumber(row.active_player_count),
        totalActivePlayerChips: this.toNumber(row.total_active_player_chips)
      }))
    );

    await this.refreshPlayerPublicTableRoster(sessionIds);
  }

  private async refreshPlayerActiveTables(): Promise<void> {
    const requestingUserId = this.authState.user()?.id ?? null;
    const requestVersion = ++this.playerActiveTablesRequestVersion;

    if (!requestingUserId || this.authState.role() !== 'PLAYER' || !this.shouldUseSupabase()) {
      this.playerActiveTablesSignal.set([]);
      return;
    }

    const { data, error } = await this.supabaseService.requireClient().rpc('player_active_tables');

    if (
      requestVersion !== this.playerActiveTablesRequestVersion ||
      this.authState.user()?.id !== requestingUserId ||
      this.authState.role() !== 'PLAYER' ||
      !this.shouldUseSupabase()
    ) {
      return;
    }

    if (error) {
      throw error;
    }

    this.playerActiveTablesSignal.set(
      ((data ?? []) as PlayerActiveTableRow[]).map((row) => ({
        sessionId: row.session_id,
        sessionName: row.session_name,
        sessionDate: row.session_date,
        sessionCreatedAt: row.session_created_at,
        tableId: row.table_id,
        tableName: row.table_name,
        tableNumber: this.toNumber(row.table_number),
        tableCreatedAt: row.table_created_at
      }))
    );
  }

  private async refreshPlayerPublicTableRoster(sessionIds: string[]): Promise<void> {
    const { data, error } = await this.supabaseService
      .requireClient()
      .rpc('player_public_table_roster', {
        p_session_ids: sessionIds
      });

    if (error) {
      if (this.isMissingPublicTableRosterRpc(error)) {
        this.playerPublicTableRosterSignal.set([]);
        return;
      }

      throw error;
    }

    this.playerPublicTableRosterSignal.set(
      ((data ?? []) as PlayerPublicTableRosterRow[]).map((row) => ({
        sessionPlayerId: row.session_player_id,
        sessionId: row.session_id,
        tableId: row.table_id ?? null,
        name: this.titleCaseName(row.player_name || 'Unknown player'),
        status: row.status,
        isNetLeader: row.is_net_leader === true
      }))
    );
  }

  sortedPlayersForActiveSession(session: PokerSession | undefined): SessionPlayer[] {
    return [...(session?.players ?? [])].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ACTIVE' ? -1 : 1;
      }

      if (a.status === 'COMPLETED') {
        const netSort = b.net - a.net;

        if (netSort !== 0) {
          return netSort;
        }
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
        `${await messageFromSupabaseFunctionError(
          error,
          'Unable to create registered player.'
        )} Deploy the latest create-registered-player Edge Function, then try again.`
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
      throw new Error(
        await messageFromSupabaseFunctionError(error, 'Unable to delete registered player.')
      );
    }

    if (!data?.ok) {
      throw new Error('Unable to delete registered player.');
    }

    await this.refreshHostSessions();
  }

  async resetRegisteredPlayerPassword(userId: string): Promise<string> {
    if (!this.shouldUseSupabase()) {
      this.saveDevelopmentPasswordOverride(userId, '123456');
      return '123456';
    }

    const { data, error } = await this.supabaseService
      .requireClient()
      .functions.invoke<ResetRegisteredPlayerPasswordResponse>('reset-registered-player-password', {
        body: {
          userId
        }
      });

    if (error) {
      throw new Error(
        await messageFromSupabaseFunctionError(error, 'Unable to reset registered player password.')
      );
    }

    if (!data?.ok) {
      throw new Error('Unable to reset player password.');
    }

    return data.temporaryPassword;
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

  async requestTimeCall(sessionId: string, sessionPlayerId: string): Promise<void> {
    if (this.shouldUseSupabase()) {
      if (!this.timeCallSchemaReadySignal()) {
        throw new Error(this.timeCallSetupMessage());
      }

      const { data, error } = await this.supabaseService.requireClient().rpc('request_time_call', {
        p_session_id: sessionId,
        p_session_player_id: sessionPlayerId
      });

      if (error) {
        if (this.isMissingTimeCallSchema(error)) {
          this.timeCallSchemaReadySignal.set(false);
          throw new Error(this.timeCallSetupMessage());
        }

        throw error;
      }

      await this.syncServerClock();

      if (data) {
        this.upsertTimeCall(this.mapTimeCall(data as TimeCallRow));
      } else {
        await this.refreshHostSessions();
      }

      return;
    }

    const now = new Date();
    const startsAt = new Date(now.getTime() + CALL_TIME_SYNC_BUFFER_SECONDS * 1000);
    const expiresAt = new Date(startsAt.getTime() + CALL_TIME_DURATION_SECONDS * 1000).toISOString();

    this.updateSession(sessionId, (session) => {
      const timeCalls = this.expireTimeCalls(session.timeCalls ?? []);
      const player = session.players.find((item) => item.id === sessionPlayerId);

      if (session.status !== 'ACTIVE') {
        throw new Error('Cannot call time in a completed session.');
      }

      if (!player) {
        throw new Error('Player is not in this session.');
      }

      if (player.status !== 'ACTIVE') {
        throw new Error('Cashed-out players cannot call time.');
      }

      if (!this.isCurrentPlayer(player)) {
        throw new Error('You can only call time for your own seat.');
      }

      if (this.activeTimeCallFrom(timeCalls)) {
        throw new Error('A call-time clock is already running.');
      }

      if (this.usedTimeCallCountFrom(timeCalls, player.id) >= CALL_TIME_LIMIT) {
        throw new Error('No call times remaining.');
      }

      return {
        ...session,
        timeCalls: [
          ...timeCalls,
          {
            id: this.createId('time-call'),
            sessionId,
            sessionPlayerId,
            status: 'RUNNING',
            startedAt: startsAt.toISOString(),
            expiresAt,
            resolvedAt: null,
            resolvedBy: null
          }
        ]
      };
    });
  }

  async resolveTimeCall(timeCallId: string, status: ResolvedTimeCallStatus): Promise<void> {
    if (this.shouldUseSupabase()) {
      if (!this.timeCallSchemaReadySignal()) {
        throw new Error(this.timeCallSetupMessage());
      }

      const { data, error } = await this.supabaseService.requireClient().rpc('resolve_time_call', {
        p_time_call_id: timeCallId,
        p_status: status
      });

      if (error) {
        if (this.isMissingTimeCallSchema(error)) {
          this.timeCallSchemaReadySignal.set(false);
          throw new Error(this.timeCallSetupMessage());
        }

        throw error;
      }

      if (data) {
        this.upsertTimeCall(this.mapTimeCall(data as TimeCallRow));
      } else {
        await this.refreshHostSessions();
      }

      return;
    }

    const now = this.serverNowMs();
    const resolvedAt = new Date(now).toISOString();
    const resolvedBy = this.authState.user()?.id ?? null;

    this.updateSessions((sessions) =>
      sessions.map((session) => ({
        ...session,
        timeCalls: (session.timeCalls ?? []).map((timeCall) => {
          if (timeCall.id !== timeCallId || timeCall.status !== 'RUNNING') {
            return timeCall;
          }

          if (status === 'EXPIRED' && new Date(timeCall.expiresAt).getTime() > now) {
            return timeCall;
          }

          return {
            ...timeCall,
            status,
            resolvedAt,
            resolvedBy
          };
        })
      }))
    );
  }

  timeCallsForSession(session: PokerSession | undefined): TimeCall[] {
    return session?.timeCalls ?? [];
  }

  activeTimeCallForSession(session: PokerSession | undefined): TimeCall | undefined {
    this.nowSignal();
    return this.activeTimeCallFrom(session?.timeCalls ?? []);
  }

  timeCallsForPlayer(session: PokerSession | undefined, sessionPlayerId: string): TimeCall[] {
    return (session?.timeCalls ?? []).filter((timeCall) => timeCall.sessionPlayerId === sessionPlayerId);
  }

  remainingTimeCallsForPlayer(session: PokerSession | undefined, sessionPlayerId: string): number {
    return Math.max(
      0,
      CALL_TIME_LIMIT -
        this.usedTimeCallCountFrom(session?.timeCalls ?? [], sessionPlayerId)
    );
  }

  canRequestTimeCall(session: PokerSession | undefined, player: SessionPlayer | undefined): boolean {
    if (!session || !player) {
      return false;
    }

    return (
      session.status === 'ACTIVE' &&
      player.status === 'ACTIVE' &&
      (!this.shouldUseSupabase() || this.timeCallSchemaReadySignal()) &&
      this.isCurrentPlayer(player) &&
      !this.activeTimeCallForSession(session) &&
      this.remainingTimeCallsForPlayer(session, player.id) > 0
    );
  }

  isTimeCallRunningForPlayer(session: PokerSession | undefined, sessionPlayerId: string): boolean {
    return this.activeTimeCallForSession(session)?.sessionPlayerId === sessionPlayerId;
  }

  secondsRemainingFor(timeCall: TimeCall | undefined): number {
    const now = this.serverNowMs();

    if (!timeCall || timeCall.status !== 'RUNNING') {
      return 0;
    }

    return timeCallSecondsRemaining(timeCall.startedAt, timeCall.expiresAt, now);
  }

  timeCallProgressFor(timeCall: TimeCall | undefined): number {
    const now = this.serverNowMs();

    if (!timeCall) {
      return 0;
    }

    return timeCallProgress(timeCall.startedAt, timeCall.expiresAt, now);
  }

  timeCallStartsInSecondsFor(timeCall: TimeCall | undefined): number {
    if (!timeCall || timeCall.status !== 'RUNNING') {
      return 0;
    }

    return timeCallStartsInSeconds(timeCall.startedAt, this.serverNowMs());
  }

  isTimeCallStarting(timeCall: TimeCall | undefined): boolean {
    return Boolean(
      timeCall &&
        timeCall.status === 'RUNNING' &&
        timeCallPhase(timeCall.startedAt, timeCall.expiresAt, this.serverNowMs()) === 'STARTING'
    );
  }

  playerNameForTimeCall(session: PokerSession | undefined, timeCall: TimeCall | undefined): string {
    if (!session || !timeCall) {
      return 'No player';
    }

    return (
      session.players.find((player) => player.id === timeCall.sessionPlayerId)?.name ??
      'Unknown player'
    );
  }

  private serverNowMs(): number {
    return this.nowSignal() + this.serverTimeOffsetMs;
  }

  private async syncServerClock(): Promise<void> {
    if (!this.shouldUseSupabase()) {
      this.serverTimeOffsetMs = 0;
      return;
    }

    try {
      const requestedAt = Date.now();
      const { data, error } = await this.supabaseService.requireClient().rpc('get_server_now');
      const receivedAt = Date.now();

      if (error || !data) {
        return;
      }

      const serverNow = new Date(data as string).getTime();
      const estimatedLocalNow = requestedAt + (receivedAt - requestedAt) / 2;
      this.serverTimeOffsetMs = serverNow - estimatedLocalNow;
    } catch {
      // Existing deployments may not have the helper RPC yet; local time remains the fallback.
    }
  }

  private upsertTimeCall(timeCall: TimeCall): boolean {
    let didUpdate = false;

    this.updateSessions((sessions) =>
      sessions.map((session) => {
        if (session.id !== timeCall.sessionId) {
          return session;
        }

        didUpdate = true;
        const timeCalls = session.timeCalls ?? [];
        const existingIndex = timeCalls.findIndex((item) => item.id === timeCall.id);
        const nextTimeCalls =
          existingIndex >= 0
            ? timeCalls.map((item) => (item.id === timeCall.id ? timeCall : item))
            : [...timeCalls, timeCall];

        return {
          ...session,
          timeCalls: nextTimeCalls
        };
      })
    );

    return didUpdate;
  }

  private removeTimeCall(timeCallId: string): boolean {
    let didUpdate = false;

    this.updateSessions((sessions) =>
      sessions.map((session) => {
        const nextTimeCalls = (session.timeCalls ?? []).filter((timeCall) => timeCall.id !== timeCallId);

        if (nextTimeCalls.length === (session.timeCalls ?? []).length) {
          return session;
        }

        didUpdate = true;
        return {
          ...session,
          timeCalls: nextTimeCalls
        };
      })
    );

    return didUpdate;
  }

  private handleTimeCallRealtimePayload(payload: TimeCallRealtimePayload): void {
    void this.syncServerClock();

    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;

      if (!id || !this.removeTimeCall(id)) {
        this.queueRealtimeRefresh();
      }

      return;
    }

    const record = payload.new;

    if (!this.isTimeCallRow(record)) {
      this.queueRealtimeRefresh();
      return;
    }

    if (!this.upsertTimeCall(this.mapTimeCall(record))) {
      this.queueRealtimeRefresh();
    }
  }

  private isTimeCallRow(row: Partial<TimeCallRow> | undefined): row is TimeCallRow {
    return Boolean(
      row?.id &&
        row.session_id &&
        row.session_player_id &&
        row.status &&
        row.started_at &&
        row.expires_at &&
        Object.prototype.hasOwnProperty.call(row, 'resolved_at') &&
        Object.prototype.hasOwnProperty.call(row, 'resolved_by')
    );
  }

  private mapSession(
    session: SessionRow,
    tables: SessionTableRow[],
    sessionPlayers: SessionPlayerRow[],
    playersById: Map<string, PlayerRow>,
    transactions: TransactionRow[],
    timeCalls: TimeCallRow[] = []
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
        .map((transaction) => this.mapTransaction(transaction)),
      timeCalls: timeCalls
        .filter((timeCall) => timeCall.session_id === session.id)
        .map((timeCall) => this.mapTimeCall(timeCall))
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

  private mapTimeCall(timeCall: TimeCallRow): TimeCall {
    return {
      id: timeCall.id,
      sessionId: timeCall.session_id,
      sessionPlayerId: timeCall.session_player_id,
      status: timeCall.status,
      startedAt: timeCall.started_at,
      expiresAt: timeCall.expires_at,
      resolvedAt: timeCall.resolved_at,
      resolvedBy: timeCall.resolved_by
    };
  }

  private activeTimeCallFrom(timeCalls: TimeCall[]): TimeCall | undefined {
    return timeCalls.find((timeCall) => timeCall.status === 'RUNNING');
  }

  private usedTimeCallCountFrom(timeCalls: TimeCall[], sessionPlayerId: string): number {
    return timeCalls.filter(
      (timeCall) =>
        timeCall.sessionPlayerId === sessionPlayerId &&
        (timeCall.status === 'RUNNING' ||
          timeCall.status === 'FINISHED' ||
          timeCall.status === 'EXPIRED')
    ).length;
  }

  private isCurrentPlayer(player: SessionPlayer): boolean {
    const userId = this.authState.user()?.id ?? null;
    const playerName = this.authState.profile()?.displayName?.trim().toLocaleLowerCase() ?? '';

    return Boolean(
      (userId && player.userId === userId) ||
        (!player.userId && playerName && player.name.trim().toLocaleLowerCase() === playerName)
    );
  }

  private expireDueTimeCalls(): void {
    const dueCalls = this.sessionsSignal()
      .flatMap((session) => session.timeCalls ?? [])
      .filter(
        (timeCall) =>
          timeCall.status === 'RUNNING' &&
          new Date(timeCall.expiresAt).getTime() <= this.serverNowMs()
      );

    if (dueCalls.length === 0) {
      return;
    }

    if (!this.shouldUseSupabase()) {
      this.updateSessions((sessions) =>
        sessions.map((session) => ({
          ...session,
          timeCalls: this.expireTimeCalls(session.timeCalls ?? [])
        }))
      );
      return;
    }

    for (const timeCall of dueCalls) {
      if (this.expiringTimeCallIds.has(timeCall.id)) {
        continue;
      }

      this.expiringTimeCallIds.add(timeCall.id);
      void this.resolveTimeCall(timeCall.id, 'EXPIRED').finally(() => {
        this.expiringTimeCallIds.delete(timeCall.id);
      });
    }
  }

  private expireTimeCalls(timeCalls: TimeCall[]): TimeCall[] {
    const now = this.serverNowMs();
    const resolvedAt = new Date(now).toISOString();

    return timeCalls.map((timeCall) =>
      timeCall.status === 'RUNNING' && new Date(timeCall.expiresAt).getTime() <= now
        ? {
            ...timeCall,
            status: 'EXPIRED',
            resolvedAt
          }
        : timeCall
    );
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
      transactions: [],
      timeCalls: []
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
    const handleChange = (payload: unknown) => {
      const table = (payload as { table?: string }).table;

      if (table === 'time_calls') {
        this.handleTimeCallRealtimePayload(payload as TimeCallRealtimePayload);
        return;
      }

      this.queueRealtimeRefresh();
    };

    for (const table of sessionRealtimeTables()) {
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
        return;
      }

      if (shouldReconnectRealtimeChannel(status)) {
        this.scheduleRealtimeReconnect();
      }
    });

    this.realtimeChannel = channel;
    this.realtimeUserKey = userKey;
  }

  private teardownRealtimeChannel(): void {
    if (this.realtimeReconnectTimer) {
      clearTimeout(this.realtimeReconnectTimer);
      this.realtimeReconnectTimer = null;
    }

    if (this.realtimeChannel) {
      void this.supabaseService.client?.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = null;
    this.realtimeUserKey = null;
  }

  private scheduleRealtimeReconnect(): void {
    if (this.realtimeReconnectTimer || !this.shouldUseSupabase()) {
      return;
    }

    this.realtimeReconnectTimer = setTimeout(() => {
      this.realtimeReconnectTimer = null;
      const user = this.authState.user();
      const role = this.authState.role();

      this.teardownRealtimeChannel();
      this.setupRealtimeChannel(user?.id ?? null, role);
      void this.refreshSessions();
    }, 1000);
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
    return buildLocalPlayerSlug(name);
  }

  private usernameFromDisplayName(displayName: string): string {
    return buildUsernameFromDisplayName(displayName);
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
    return messageFromUnknownError(error, 'Unable to sync poker data.');
  }

  private hasMessage(error: unknown): error is { message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }

  private isMissingTimeCallSchema(error: unknown): boolean {
    if (!this.hasMessage(error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';

    return (
      (message.includes('schema cache') || code === 'PGRST202' || code === 'PGRST205') &&
      (message.includes('time_calls') ||
        message.includes('request_time_call') ||
        message.includes('resolve_time_call'))
    );
  }

  private isMissingPublicTableSummaryRpc(error: unknown): boolean {
    if (!this.hasMessage(error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';

    return (
      (message.includes('schema cache') || code === 'PGRST202' || code === 'PGRST205') &&
      message.includes('player_public_table_summaries')
    );
  }

  private isMissingPublicTableRosterRpc(error: unknown): boolean {
    if (!this.hasMessage(error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';

    return (
      (message.includes('schema cache') || code === 'PGRST202' || code === 'PGRST205') &&
      message.includes('player_public_table_roster')
    );
  }

  private timeCallSetupMessage(): string {
    return 'Call Time database setup is not installed yet. Apply the call-time migration, then refresh.';
  }

  private setLoading(value: boolean): void {
    this.loadingSignal.set(value);
  }

  private markSessionsLoaded(): void {
    this.sessionsLoadedSignal.set(true);
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
      return environment.production ? [] : this.createDevelopmentPreviewSessions();
    }

    try {
      const sessions = JSON.parse(raw) as PokerSession[];
      return environment.production ? sessions : this.withDevelopmentPreviewSessions(sessions);
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
    void this.saveLocalSharedState({ sessions });
  }

  private async refreshDevelopmentProductionSnapshot(
    options: RefreshSessionsOptions = {}
  ): Promise<void> {
    if (environment.production || typeof fetch === 'undefined') {
      return;
    }

    const showLoading = options.showLoading ?? true;

    if (showLoading) {
      this.setLoading(true);
    }

    try {
      const response = await fetch(`${developmentProductionSnapshotPath}?t=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        return;
      }

      const snapshot = (await response.json()) as DevelopmentProductionSnapshot;
      const snapshotVersion = snapshot.syncedAt?.trim() || 'production-sync-snapshot';
      const appliedVersion = localStorage.getItem(developmentProductionSnapshotAppliedAtStorageKey);
      const hasLocalSessionData = Boolean(
        localStorage.getItem(localStorageKey) ?? localStorage.getItem(legacyLocalStorageKey)
      );

      if (appliedVersion === snapshotVersion) {
        return;
      }

      if (!appliedVersion && hasLocalSessionData) {
        localStorage.setItem(developmentProductionSnapshotAppliedAtStorageKey, snapshotVersion);
        return;
      }

      if (Array.isArray(snapshot.sessions)) {
        this.sessionsSignal.set(snapshot.sessions);
        this.saveSessions(snapshot.sessions);
      }

      if (Array.isArray(snapshot.registeredPlayers)) {
        this.localRegisteredPlayersSignal.set(snapshot.registeredPlayers);
        this.saveLocalRegisteredPlayers(snapshot.registeredPlayers);
      }

      localStorage.setItem(developmentProductionSnapshotAppliedAtStorageKey, snapshotVersion);
    } catch {
      // Missing or invalid local snapshots should not block development mode.
    } finally {
      if (showLoading) {
        this.setLoading(false);
      }
    }
  }

  private withDevelopmentPreviewSessions(sessions: PokerSession[]): PokerSession[] {
    const hasPlayerPreview = sessions.some((session) =>
      session.players.some((player) => player.userId === 'dev-player')
    );

    if (hasPlayerPreview) {
      return sessions;
    }

    return [...this.createDevelopmentPreviewSessions(), ...sessions];
  }

  private createDevelopmentPreviewSessions(): PokerSession[] {
    const activeSessionId = 'dev-preview-session-july-game';
    const activeTableId = 'dev-preview-table-main';
    const completedSessionId = 'dev-preview-session-june-game';
    const completedTableId = 'dev-preview-table-june-main';

    return [
      {
        id: activeSessionId,
        name: 'July 7 Game',
        sessionDate: '2026-07-07',
        status: 'ACTIVE',
        createdAt: '2026-07-07T18:30:00.000Z',
        closedAt: null,
        tables: [
          {
            id: activeTableId,
            sessionId: activeSessionId,
            name: 'Main Table',
            status: 'ACTIVE',
            tableNumber: 1,
            createdAt: '2026-07-07T18:30:00.000Z',
            closedAt: null
          }
        ],
        players: [
          {
            id: 'dev-preview-player-current',
            playerRecordId: 'dev-preview-record-current',
            tableId: activeTableId,
            userId: 'dev-player',
            name: 'Player',
            status: 'ACTIVE',
            totalBuyIn: 500,
            cashOut: 0,
            net: -500,
            joinedAt: '2026-07-07T18:36:00.000Z',
            completedAt: null
          },
          {
            id: 'dev-preview-player-gene',
            playerRecordId: 'dev-preview-record-gene',
            tableId: activeTableId,
            userId: null,
            name: 'Gene',
            status: 'ACTIVE',
            totalBuyIn: 300,
            cashOut: 0,
            net: -300,
            joinedAt: '2026-07-07T18:34:00.000Z',
            completedAt: null
          },
          {
            id: 'dev-preview-player-maxi',
            playerRecordId: 'dev-preview-record-maxi',
            tableId: activeTableId,
            userId: null,
            name: 'Maxi',
            status: 'COMPLETED',
            totalBuyIn: 400,
            cashOut: 720,
            net: 320,
            joinedAt: '2026-07-07T18:32:00.000Z',
            completedAt: '2026-07-07T20:15:00.000Z'
          }
        ],
        transactions: [
          {
            id: 'dev-preview-tx-current-buyin',
            sessionId: activeSessionId,
            tableId: activeTableId,
            playerId: 'dev-preview-player-current',
            type: 'BUYIN',
            amount: 300,
            createdAt: '2026-07-07T18:36:00.000Z',
            comment: 'Opening buy-in'
          },
          {
            id: 'dev-preview-tx-current-rebuy',
            sessionId: activeSessionId,
            tableId: activeTableId,
            playerId: 'dev-preview-player-current',
            type: 'REBUY',
            amount: 200,
            createdAt: '2026-07-07T19:18:00.000Z',
            comment: 'Second bullet'
          },
          {
            id: 'dev-preview-tx-gene-buyin',
            sessionId: activeSessionId,
            tableId: activeTableId,
            playerId: 'dev-preview-player-gene',
            type: 'BUYIN',
            amount: 300,
            createdAt: '2026-07-07T18:34:00.000Z'
          },
          {
            id: 'dev-preview-tx-maxi-buyin',
            sessionId: activeSessionId,
            tableId: activeTableId,
            playerId: 'dev-preview-player-maxi',
            type: 'BUYIN',
            amount: 400,
            createdAt: '2026-07-07T18:32:00.000Z'
          },
          {
            id: 'dev-preview-tx-maxi-cashout',
            sessionId: activeSessionId,
            tableId: activeTableId,
            playerId: 'dev-preview-player-maxi',
            type: 'CASHOUT',
            amount: 720,
            createdAt: '2026-07-07T20:15:00.000Z'
          }
        ],
        timeCalls: []
      },
      {
        id: completedSessionId,
        name: 'June 30 Game',
        sessionDate: '2026-06-30',
        status: 'COMPLETED',
        createdAt: '2026-06-30T18:20:00.000Z',
        closedAt: '2026-06-30T23:05:00.000Z',
        tables: [
          {
            id: completedTableId,
            sessionId: completedSessionId,
            name: 'Main Table',
            status: 'CLOSED',
            tableNumber: 1,
            createdAt: '2026-06-30T18:20:00.000Z',
            closedAt: '2026-06-30T23:05:00.000Z'
          }
        ],
        players: [
          {
            id: 'dev-preview-player-current-closed',
            playerRecordId: 'dev-preview-record-current',
            tableId: completedTableId,
            userId: 'dev-player',
            name: 'Player',
            status: 'COMPLETED',
            totalBuyIn: 450,
            cashOut: 650,
            net: 200,
            joinedAt: '2026-06-30T18:28:00.000Z',
            completedAt: '2026-06-30T22:42:00.000Z'
          }
        ],
        transactions: [
          {
            id: 'dev-preview-tx-current-closed-buyin',
            sessionId: completedSessionId,
            tableId: completedTableId,
            playerId: 'dev-preview-player-current-closed',
            type: 'BUYIN',
            amount: 300,
            createdAt: '2026-06-30T18:28:00.000Z'
          },
          {
            id: 'dev-preview-tx-current-closed-rebuy',
            sessionId: completedSessionId,
            tableId: completedTableId,
            playerId: 'dev-preview-player-current-closed',
            type: 'REBUY',
            amount: 150,
            createdAt: '2026-06-30T20:02:00.000Z'
          },
          {
            id: 'dev-preview-tx-current-closed-cashout',
            sessionId: completedSessionId,
            tableId: completedTableId,
            playerId: 'dev-preview-player-current-closed',
            type: 'CASHOUT',
            amount: 650,
            createdAt: '2026-06-30T22:42:00.000Z'
          }
        ],
        timeCalls: []
      }
    ];
  }

  private saveLocalRegisteredPlayers(players: RegisteredPlayerOption[]): void {
    if (typeof localStorage === 'undefined' || this.shouldUseSupabase()) {
      return;
    }

    localStorage.setItem(localRegisteredPlayersStorageKey, JSON.stringify(players));
    void this.saveLocalSharedState({ registeredPlayers: players });
  }

  private saveLocalDeletedRegisteredPlayerIds(ids: string[]): void {
    if (typeof localStorage === 'undefined' || this.shouldUseSupabase()) {
      return;
    }

    localStorage.setItem(localDeletedRegisteredPlayersStorageKey, JSON.stringify(ids));
    void this.saveLocalSharedState({ deletedRegisteredPlayerIds: ids });
  }

  private saveDevelopmentPasswordOverride(profileId: string, password: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const rawOverrides = localStorage.getItem(developmentPasswordOverridesStorageKey);
    let overrides: Record<string, string> = {};

    if (rawOverrides) {
      try {
        overrides = JSON.parse(rawOverrides) as Record<string, string>;
      } catch {
        overrides = {};
      }
    }

    overrides[profileId] = password;
    localStorage.setItem(developmentPasswordOverridesStorageKey, JSON.stringify(overrides));
  }

  private shouldUseLocalSharedData(): boolean {
    return !environment.production && !this.supabaseService.isConfigured && typeof window !== 'undefined';
  }

  private localSharedDataUrl(path: string): string {
    const hostname = window.location.hostname || '127.0.0.1';
    return `http://${hostname}:4300${path}`;
  }

  private async loadLocalSharedState(): Promise<void> {
    if (!this.shouldUseLocalSharedData()) {
      return;
    }

    try {
      const response = await fetch(this.localSharedDataUrl('/state'), { cache: 'no-store' });

      if (!response.ok) {
        return;
      }

      const state = (await response.json()) as LocalSharedState;

      if (Array.isArray(state.sessions)) {
        this.sessionsSignal.set(state.sessions);
        localStorage.setItem(localStorageKey, JSON.stringify(state.sessions));
        localStorage.removeItem(legacyLocalStorageKey);
      }

      if (Array.isArray(state.registeredPlayers)) {
        this.localRegisteredPlayersSignal.set(state.registeredPlayers);
        localStorage.setItem(
          localRegisteredPlayersStorageKey,
          JSON.stringify(state.registeredPlayers)
        );
      }

      if (Array.isArray(state.deletedRegisteredPlayerIds)) {
        this.localDeletedRegisteredPlayerIdsSignal.set(state.deletedRegisteredPlayerIds);
        localStorage.setItem(
          localDeletedRegisteredPlayersStorageKey,
          JSON.stringify(state.deletedRegisteredPlayerIds)
        );
      }
    } catch {
      // The shared local server is optional; browser-local data remains as a fallback.
    }
  }

  private async saveLocalSharedState(state: LocalSharedState): Promise<void> {
    if (!this.shouldUseLocalSharedData()) {
      return;
    }

    try {
      await fetch(this.localSharedDataUrl('/state'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(state)
      });
    } catch {
      // The shared local server is optional; browser-local data remains as a fallback.
    }
  }
}
