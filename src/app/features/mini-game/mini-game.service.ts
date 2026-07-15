import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  messageFromSupabaseFunctionError,
  messageFromUnknownError,
} from '../host/shared/action-feedback.logic';
import {
  canManageMiniGame,
  isMiniGameEquityFresh,
  mapMiniGameSnapshot,
  shouldApplyMiniGameSnapshotResponse,
} from './mini-game.logic';
import {
  MINI_GAME_LOCAL_STORAGE_KEY,
  MiniGameLocalStore,
  MiniGameLocalViewer,
} from './mini-game-local.store';
import {
  MiniGameActionName,
  MiniGameActionRequest,
  MiniGameActionSuccess,
  MiniGameEquityStatus,
  MiniGameParticipant,
  MiniGameSnapshot,
} from './mini-game.models';

@Injectable({ providedIn: 'root' })
export class MiniGameService implements OnDestroy {
  private readonly authState = inject(AuthStateService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly localStore = new MiniGameLocalStore();
  private readonly currentSignal = signal<MiniGameSnapshot | null>(null);
  private readonly historySignal = signal<MiniGameSnapshot[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly historyLoadingSignal = signal(false);
  private readonly actionSignal = signal<MiniGameActionName | null>(null);
  private readonly errorSignal = signal<string | null>(null);
  private readonly warningSignal = signal<string | null>(null);
  private readonly realtimeConnectedSignal = signal(false);
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeUserId: string | null = null;
  private refreshQueued = false;
  private refreshInFlight = false;
  private historyRequested = false;
  private snapshotOperationOrder = 0;
  private lastAppliedSnapshotOrder = 0;
  private historyLoadOrder = 0;
  private activeActionOrder = 0;
  private readonly retriedStateVersions = new Set<string>();
  private readonly localStorageListener = (event: StorageEvent) => {
    if (event.key !== MINI_GAME_LOCAL_STORAGE_KEY) {
      return;
    }

    void Promise.all([
      this.loadCurrent(),
      this.historyRequested ? this.loadHistory() : Promise.resolve([]),
    ]);
  };

  readonly current = this.currentSignal.asReadonly();
  readonly history = this.historySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly historyLoading = this.historyLoadingSignal.asReadonly();
  readonly action = this.actionSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly warning = this.warningSignal.asReadonly();
  readonly realtimeConnected = this.realtimeConnectedSignal.asReadonly();
  readonly isConfigured = this.supabaseService.isConfigured;
  readonly equityFresh = computed(() => {
    const snapshot = this.currentSignal();
    return snapshot ? isMiniGameEquityFresh(snapshot) : false;
  });
  readonly canManage = computed(() => {
    const snapshot = this.currentSignal();
    const profile = this.authState.profile();
    const userId = this.authState.user()?.id;

    return snapshot ? canManageMiniGame(snapshot, userId, profile?.role) : false;
  });
  readonly viewerParticipant = computed<MiniGameParticipant | null>(() => {
    const snapshot = this.currentSignal();
    return (
      snapshot?.participants.find(
        (participant) => participant.id === snapshot.viewerParticipantId,
      ) ?? null
    );
  });

  constructor() {
    if (!this.supabaseService.isConfigured && typeof window !== 'undefined') {
      window.addEventListener('storage', this.localStorageListener);
    }

    effect(() => {
      const userId = this.authState.user()?.id ?? null;

      queueMicrotask(() => {
        if (!userId) {
          const operationOrder = ++this.snapshotOperationOrder;
          this.applyCurrentSnapshot(null, operationOrder);
          this.historySignal.set([]);
          this.historyRequested = false;
          this.disconnectRealtime();
          return;
        }

        void this.loadCurrent();
        this.connectRealtime(userId);
      });
    });
  }

  ngOnDestroy(): void {
    this.disconnectRealtime();

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.localStorageListener);
    }
  }

  async loadCurrent(): Promise<MiniGameSnapshot | null> {
    const operationOrder = ++this.snapshotOperationOrder;
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (!this.supabaseService.isConfigured) {
        const snapshot = this.localStore.current(this.localViewer());
        this.applyCurrentSnapshot(snapshot, operationOrder);
        return snapshot;
      }

      const { data, error } = await this.supabaseService
        .requireClient()
        .rpc('get_current_mini_game');

      if (error) {
        throw error;
      }

      const snapshot = mapMiniGameSnapshot(data);
      const applied = this.applyCurrentSnapshot(snapshot, operationOrder);

      if (snapshot && applied) {
        this.retryPendingEquity(snapshot);
      }

      return snapshot;
    } catch (error) {
      this.errorSignal.set(messageFromUnknownError(error, 'Unable to load the mini-game.'));
      return null;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async loadHistory(): Promise<MiniGameSnapshot[]> {
    const loadOrder = ++this.historyLoadOrder;
    this.historyRequested = true;
    this.historyLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (!this.supabaseService.isConfigured) {
        const history = this.localStore.history(this.localViewer());
        if (loadOrder === this.historyLoadOrder) {
          this.historySignal.set(history);
        }
        return history;
      }

      const { data, error } = await this.supabaseService
        .requireClient()
        .rpc('list_mini_game_history');

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        throw new Error('Mini-game history response is invalid.');
      }

      const history = data
        .map((snapshot) => mapMiniGameSnapshot(snapshot))
        .filter((snapshot): snapshot is MiniGameSnapshot => snapshot !== null);
      if (loadOrder === this.historyLoadOrder) {
        this.historySignal.set(history);
      }
      return history;
    } catch (error) {
      this.errorSignal.set(messageFromUnknownError(error, 'Unable to load mini-game history.'));
      return [];
    } finally {
      this.historyLoadingSignal.set(false);
    }
  }

  async loadDetail(gameId: string): Promise<MiniGameSnapshot | null> {
    this.errorSignal.set(null);

    try {
      if (!this.supabaseService.isConfigured) {
        return this.localStore.detail(gameId, this.localViewer());
      }

      const { data, error } = await this.supabaseService
        .requireClient()
        .rpc('get_mini_game_detail', { p_game_id: gameId });

      if (error) {
        throw error;
      }

      return mapMiniGameSnapshot(data);
    } catch (error) {
      this.errorSignal.set(messageFromUnknownError(error, 'Unable to load this mini-game.'));
      return null;
    }
  }

  create(name: string, minPlayers: number, maxPlayers: number): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'create', name, minPlayers, maxPlayers });
  }

  update(
    gameId: string,
    name: string,
    minPlayers: number,
    maxPlayers: number,
  ): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'update', gameId, name, minPlayers, maxPlayers });
  }

  join(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'join', gameId });
  }

  remove(gameId: string, participantId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'remove', gameId, participantId });
  }

  reshuffle(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'reshuffle', gameId });
  }

  start(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'start', gameId });
  }

  revealTurn(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'reveal-turn', gameId });
  }

  revealRiver(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'reveal-river', gameId });
  }

  archive(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'archive', gameId });
  }

  delete(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'delete', gameId });
  }

  recalculate(gameId: string): Promise<MiniGameActionSuccess> {
    return this.performAction({ action: 'recalculate', gameId });
  }

  async claimCelebration(gameId: string): Promise<boolean> {
    try {
      if (!this.supabaseService.isConfigured) {
        const userId = this.authState.user()?.id;
        const claimed = userId ? this.localStore.claimCelebration(gameId, userId) : false;

        if (claimed) {
          this.currentSignal.update((snapshot) =>
            snapshot?.id === gameId ? { ...snapshot, viewerCelebrationSeen: true } : snapshot,
          );
        }

        return claimed;
      }

      const { data, error } = await this.supabaseService
        .requireClient()
        .rpc('claim_mini_game_celebration', { p_game_id: gameId });

      if (error) {
        throw error;
      }

      const claimed = data === true;

      if (claimed) {
        this.currentSignal.update((snapshot) =>
          snapshot?.id === gameId ? { ...snapshot, viewerCelebrationSeen: true } : snapshot,
        );
      }

      return claimed;
    } catch (error) {
      this.errorSignal.set(
        messageFromUnknownError(error, 'Unable to load the winner celebration.'),
      );
      return false;
    }
  }

  clearFeedback(): void {
    this.errorSignal.set(null);
    this.warningSignal.set(null);
  }

  private async performAction(request: MiniGameActionRequest): Promise<MiniGameActionSuccess> {
    const operationOrder = ++this.snapshotOperationOrder;
    this.activeActionOrder = operationOrder;
    this.actionSignal.set(request.action);
    this.errorSignal.set(null);
    this.warningSignal.set(null);

    try {
      let result: MiniGameActionSuccess;

      if (!this.supabaseService.isConfigured) {
        result = this.localStore.perform(request, this.localViewer());
      } else {
        const { data, error } = await this.supabaseService
          .requireClient()
          .functions.invoke('mini-game-action', { body: request });

        if (error) {
          throw error;
        }

        result = this.parseActionSuccess(data);
      }
      this.warningSignal.set(result.warning ?? null);

      if (request.action === 'delete' || request.action === 'archive') {
        this.applyCurrentSnapshot(null, operationOrder);
      } else if (result.snapshot !== undefined) {
        this.applyCurrentSnapshot(result.snapshot ?? null, operationOrder);
      } else {
        await this.loadCurrent();
      }

      if (
        request.action === 'reveal-river' ||
        request.action === 'archive' ||
        request.action === 'delete'
      ) {
        void this.loadHistory();
      }

      return result;
    } catch (error) {
      const message = await messageFromSupabaseFunctionError(
        error,
        'Unable to update the mini-game.',
      );
      this.errorSignal.set(message);
      throw new Error(message);
    } finally {
      if (this.activeActionOrder === operationOrder) {
        this.actionSignal.set(null);
      }
    }
  }

  private parseActionSuccess(value: unknown): MiniGameActionSuccess {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Mini-game action returned an invalid response.');
    }

    const row = value as Record<string, unknown>;

    if (row['ok'] !== true) {
      throw new Error(
        typeof row['error'] === 'string' ? row['error'] : 'Mini-game action was not completed.',
      );
    }

    const equityStatus = row['equityStatus'];

    if (!['PENDING', 'READY', 'ERROR'].includes(String(equityStatus))) {
      throw new Error('Mini-game action returned an invalid equity status.');
    }

    const result: MiniGameActionSuccess = {
      ok: true,
      gameId: String(row['gameId'] ?? ''),
      stateVersion: Number(row['stateVersion']),
      equityStatus: equityStatus as MiniGameEquityStatus,
    };

    if (!result.gameId || !Number.isSafeInteger(result.stateVersion)) {
      throw new Error('Mini-game action returned an invalid version.');
    }

    if ('snapshot' in row) {
      result.snapshot = mapMiniGameSnapshot(row['snapshot']);
    }

    if (typeof row['warning'] === 'string' && row['warning'].trim()) {
      result.warning = row['warning'].trim();
    }

    return result;
  }

  private localViewer(): MiniGameLocalViewer {
    const user = this.authState.user();
    const profile = this.authState.profile();

    if (!user || !profile) {
      throw new Error('Authentication required.');
    }

    return {
      userId: user.id,
      displayName: profile.displayName?.trim() || 'Player',
      role: profile.role,
    };
  }

  private connectRealtime(userId: string): void {
    if (!this.supabaseService.isConfigured || this.realtimeUserId === userId) {
      return;
    }

    this.disconnectRealtime();
    let channel = this.supabaseService.requireClient().channel('pokertrack-global-mini-game');

    for (const table of [
      'mini_games',
      'mini_game_participants',
      'mini_game_cards',
      'mini_game_equities',
    ]) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        this.queueRealtimeRefresh(),
      );
    }

    channel.subscribe((status) => {
      this.realtimeConnectedSignal.set(status === 'SUBSCRIBED');
    });

    this.realtimeChannel = channel;
    this.realtimeUserId = userId;
  }

  private disconnectRealtime(): void {
    if (this.realtimeChannel) {
      void this.supabaseService.client?.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = null;
    this.realtimeUserId = null;
    this.realtimeConnectedSignal.set(false);
  }

  private queueRealtimeRefresh(): void {
    this.refreshQueued = true;

    if (!this.refreshInFlight) {
      queueMicrotask(() => void this.flushRealtimeRefresh());
    }
  }

  private async flushRealtimeRefresh(): Promise<void> {
    if (this.refreshInFlight) {
      return;
    }

    this.refreshInFlight = true;

    try {
      while (this.refreshQueued) {
        this.refreshQueued = false;
        await Promise.all([
          this.loadCurrent(),
          this.historyRequested ? this.loadHistory() : Promise.resolve([]),
        ]);
      }
    } finally {
      this.refreshInFlight = false;
    }
  }

  private applyCurrentSnapshot(snapshot: MiniGameSnapshot | null, operationOrder: number): boolean {
    if (
      !shouldApplyMiniGameSnapshotResponse(
        this.currentSignal(),
        snapshot,
        operationOrder,
        this.lastAppliedSnapshotOrder,
      )
    ) {
      return false;
    }

    this.currentSignal.set(snapshot);
    this.lastAppliedSnapshotOrder = Math.max(this.lastAppliedSnapshotOrder, operationOrder);
    return true;
  }

  private retryPendingEquity(snapshot: MiniGameSnapshot): void {
    if (snapshot.equityStatus !== 'PENDING' || this.actionSignal() !== null) {
      return;
    }

    const retryKey = `${snapshot.id}:${snapshot.stateVersion}`;

    if (this.retriedStateVersions.has(retryKey)) {
      return;
    }

    this.retriedStateVersions.add(retryKey);
    queueMicrotask(() => {
      void this.recalculate(snapshot.id).catch(() => undefined);
    });
  }
}
