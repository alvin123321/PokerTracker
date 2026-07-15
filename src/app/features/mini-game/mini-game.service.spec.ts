import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { MINI_GAME_LOCAL_STORAGE_KEY } from './mini-game-local.constants';
import { MiniGameService } from './mini-game.service';

describe('MiniGameService development adapter', () => {
  const user = signal({ id: 'dev-host-admin' });
  const profile = signal({ id: 'dev-host-admin', displayName: 'Admin', role: 'HOST' });
  const requireClient = jasmine.createSpy('requireClient');

  beforeEach(() => {
    localStorage.removeItem(MINI_GAME_LOCAL_STORAGE_KEY);
    requireClient.calls.reset();
    requireClient.and.throwError('Supabase must not be used in development mode.');
    user.set({ id: 'dev-host-admin' });
    profile.set({ id: 'dev-host-admin', displayName: 'Admin', role: 'HOST' });

    TestBed.configureTestingModule({
      providers: [
        MiniGameService,
        {
          provide: AuthStateService,
          useValue: { user, profile },
        },
        {
          provide: SupabaseService,
          useValue: { client: null, isConfigured: false, requireClient },
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem(MINI_GAME_LOCAL_STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  it('uses browser-local persistence for reads and mutations when Supabase is unavailable', async () => {
    const service = TestBed.inject(MiniGameService);
    const created = await service.create('Local preview', 2, 10);
    const loaded = await service.loadCurrent();

    expect(created.snapshot?.name).toBe('Local preview');
    expect(loaded?.id).toBe(created.gameId);
    expect(service.current()?.id).toBe(created.gameId);
    expect(requireClient).not.toHaveBeenCalled();
  });

  it('claims local celebrations without invoking a Supabase RPC', async () => {
    const service = TestBed.inject(MiniGameService);

    expect(await service.claimCelebration('missing-game')).toBeFalse();
    expect(requireClient).not.toHaveBeenCalled();
  });

  it('keeps the initiating viewer when the local adapter loads asynchronously', async () => {
    const service = TestBed.inject(MiniGameService);
    const perform = jasmine.createSpy('perform').and.returnValue({
      ok: true,
      gameId: 'game-1',
      stateVersion: 1,
      equityStatus: 'PENDING',
      snapshot: null,
    });
    let resolveStore!: (store: unknown) => void;
    const storePromise = new Promise<unknown>((resolve) => {
      resolveStore = resolve;
    });
    const testService = service as unknown as {
      getLocalStore(): Promise<unknown>;
    };
    spyOn(testService, 'getLocalStore').and.returnValue(storePromise);

    const actionPromise = service.create('Local preview', 2, 10);
    user.set({ id: 'dev-player' });
    profile.set({ id: 'dev-player', displayName: 'Player', role: 'PLAYER' });
    resolveStore({ current: () => null, perform });
    await actionPromise;

    expect(perform).toHaveBeenCalledOnceWith(
      { action: 'create', name: 'Local preview', minPlayers: 2, maxPlayers: 10 },
      { userId: 'dev-host-admin', displayName: 'Admin', role: 'HOST' },
    );
  });
});

describe('MiniGameService history request ordering', () => {
  const user = signal<{ id: string } | null>(null);
  const profile = signal<{ id: string; displayName: string; role: 'PLAYER' } | null>(null);
  let rpc: jasmine.Spy;
  let historyRequests: Array<Deferred<{ data: unknown; error: unknown }>>;

  beforeEach(() => {
    historyRequests = [];
    rpc = jasmine.createSpy('rpc').and.callFake((name: string) => {
      if (name !== 'list_mini_game_history') {
        return Promise.resolve({ data: null, error: null });
      }

      const request = deferred<{ data: unknown; error: unknown }>();
      historyRequests.push(request);
      return request.promise;
    });

    TestBed.configureTestingModule({
      providers: [
        MiniGameService,
        {
          provide: AuthStateService,
          useValue: { user, profile },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: null,
            isConfigured: true,
            requireClient: () => ({ rpc }),
          },
        },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps the latest request loading when an older empty success completes first', async () => {
    const service = await createHistoryService();
    const older = service.loadHistory();
    const latest = service.loadHistory();

    historyRequests[0].resolve({ data: [], error: null });
    const olderResult = await older;

    expect(olderResult.history).toEqual([]);
    expect(olderResult.success).toBeTrue();
    expect(olderResult.current).toBeFalse();
    expect(service.historyLoading()).toBeTrue();
    expect(service.error()).toBeNull();

    historyRequests[1].resolve({ data: [], error: null });
    await latest;
  });

  it('does not let an older failure replace a newer successful result', async () => {
    const service = await createHistoryService();
    const older = service.loadHistory();
    const latest = service.loadHistory();
    const latestSnapshot = historySnapshot('latest-game');

    historyRequests[1].resolve({ data: [latestSnapshot], error: null });
    const latestResult = await latest;

    expect(latestResult.success).toBeTrue();
    expect(latestResult.current).toBeTrue();
    expect(service.history().map((game) => game.id)).toEqual(['latest-game']);
    expect(service.historyLoading()).toBeFalse();
    expect(service.error()).toBeNull();

    historyRequests[0].resolve({ data: null, error: new Error('Stale history failure') });
    const olderResult = await older;

    expect(olderResult.history).toEqual([]);
    expect(olderResult.success).toBeFalse();
    expect(olderResult.current).toBeFalse();
    expect(service.history().map((game) => game.id)).toEqual(['latest-game']);
    expect(service.error()).toBeNull();
  });

  it('does not let an older success replace a newer failed result', async () => {
    const service = await createHistoryService();
    const seed = service.loadHistory();
    historyRequests[0].resolve({ data: [historySnapshot('seed-game')], error: null });
    await seed;

    const older = service.loadHistory();
    const latest = service.loadHistory();
    historyRequests[2].resolve({ data: null, error: new Error('Latest history failure') });
    const latestResult = await latest;

    expect(latestResult.history).toEqual([]);
    expect(latestResult.success).toBeFalse();
    expect(latestResult.current).toBeTrue();
    expect(service.history().map((game) => game.id)).toEqual(['seed-game']);
    expect(service.error()).toBe('Latest history failure');

    historyRequests[1].resolve({ data: [historySnapshot('stale-game')], error: null });
    const olderResult = await older;

    expect(olderResult.success).toBeTrue();
    expect(olderResult.current).toBeFalse();
    expect(service.history().map((game) => game.id)).toEqual(['seed-game']);
    expect(service.error()).toBe('Latest history failure');
  });

  async function createHistoryService(): Promise<MiniGameService> {
    const service = TestBed.inject(MiniGameService);
    await Promise.resolve();
    return service;
  }
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function historySnapshot(id: string): Record<string, unknown> {
  return {
    id,
    creatorHostId: 'history-host',
    name: id,
    minPlayers: 2,
    maxPlayers: 10,
    status: 'COMPLETE',
    isCurrent: false,
    stateVersion: 5,
    equityVersion: 5,
    equityStatus: 'READY',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:05:00.000Z',
    completedAt: '2026-07-15T00:05:00.000Z',
    archivedAt: null,
    activePlayerCount: 0,
    viewerParticipantId: null,
    viewerCelebrationSeen: true,
    board: [
      { position: 1, code: 'Ac' },
      { position: 2, code: 'Kd' },
      { position: 3, code: 'Qh' },
      { position: 4, code: 'Js' },
      { position: 5, code: 'Tc' },
    ],
    participants: [],
    winnerParticipantIds: [],
  };
}
