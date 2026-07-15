import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { PokerSession, PokerStoreService } from './poker-store.service';

describe('PokerStoreService completed session deletion', () => {
  let rpc: jasmine.Spy;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: null, error: null });

    TestBed.configureTestingModule({
      providers: [
        PokerStoreService,
        {
          provide: AuthStateService,
          useValue: {
            initialized: signal(false),
            user: signal({ id: 'host-admin' }),
            role: signal('HOST')
          }
        },
        {
          provide: SupabaseService,
          useValue: {
            client: null,
            isConfigured: true,
            requireClient: () => ({ rpc })
          }
        }
      ]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps a committed deletion successful when the best-effort refresh fails', async () => {
    const store = TestBed.inject(PokerStoreService);
    const storeInternals = store as unknown as {
      sessionsSignal: { set(sessions: PokerSession[]): void };
    };
    storeInternals.sessionsSignal.set([completedSession()]);
    spyOn(store, 'refreshHostSessions').and.rejectWith(new Error('Refresh failed after commit'));

    await expectAsync(store.deleteSession('completed-session')).toBeResolved();

    expect(rpc).toHaveBeenCalledOnceWith('delete_session', {
      p_session_id: 'completed-session'
    });
    expect(store.getSession('completed-session')).toBeUndefined();
  });

  it('keeps an RPC failure observable and does not remove the local session', async () => {
    const store = TestBed.inject(PokerStoreService);
    const storeInternals = store as unknown as {
      sessionsSignal: { set(sessions: PokerSession[]): void };
    };
    storeInternals.sessionsSignal.set([completedSession()]);
    rpc.and.resolveTo({ data: null, error: new Error('Delete RPC failed') });

    await expectAsync(store.deleteSession('completed-session')).toBeRejectedWithError(
      'Delete RPC failed'
    );
    expect(store.getSession('completed-session')).toBeDefined();
  });
});

function completedSession(): PokerSession {
  return {
    id: 'completed-session',
    name: 'Completed session',
    sessionDate: '2026-07-15',
    status: 'COMPLETED',
    createdAt: '2026-07-15T00:00:00.000Z',
    closedAt: '2026-07-15T01:00:00.000Z',
    tables: [],
    players: [],
    transactions: [],
    timeCalls: []
  };
}
