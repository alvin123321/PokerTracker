import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { MINI_GAME_LOCAL_STORAGE_KEY } from './mini-game-local.store';
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
});
