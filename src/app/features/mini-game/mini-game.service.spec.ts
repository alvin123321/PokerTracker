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
