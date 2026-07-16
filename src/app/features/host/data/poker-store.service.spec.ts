import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { PokerSession, PokerStoreService } from './poker-store.service';

describe('PokerStoreService player active tables', () => {
  let from: jasmine.Spy;
  let rpc: jasmine.Spy;
  let user: WritableSignal<{ id: string } | null>;
  let role: WritableSignal<'PLAYER' | null>;

  beforeEach(() => {
    user = signal({ id: 'player-a' });
    role = signal('PLAYER');
    from = jasmine.createSpy('from').and.returnValue({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null })
      })
    });
    rpc = jasmine.createSpy('rpc').and.callFake((name: string) => {
      if (name === 'player_active_tables') {
        return Promise.resolve({
          data: [
            {
              session_id: 'session-a',
              session_name: 'Friday Game',
              session_date: '2026-07-15',
              session_created_at: '2026-07-15T20:00:00.000Z',
              table_id: 'table-a',
              table_name: 'Main Table',
              table_number: 1,
              table_created_at: '2026-07-15T20:01:00.000Z'
            }
          ],
          error: null
        });
      }

      return Promise.resolve({ data: null, error: null });
    });

    TestBed.configureTestingModule({
      providers: [
        PokerStoreService,
        {
          provide: AuthStateService,
          useValue: {
            initialized: signal(false),
            user,
            role
          }
        },
        {
          provide: SupabaseService,
          useValue: {
            client: null,
            isConfigured: true,
            requireClient: () => ({ from, rpc })
          }
        }
      ]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the active-table directory when the player has no participated sessions', async () => {
    const store = TestBed.inject(PokerStoreService);

    await store.refreshSessions();

    expect(rpc).toHaveBeenCalledWith('player_active_tables');
    expect(store.playerActiveTables()).toEqual([
      {
        sessionId: 'session-a',
        sessionName: 'Friday Game',
        sessionDate: '2026-07-15',
        sessionCreatedAt: '2026-07-15T20:00:00.000Z',
        tableId: 'table-a',
        tableName: 'Main Table',
        tableNumber: 1,
        tableCreatedAt: '2026-07-15T20:01:00.000Z'
      }
    ]);
  });

  it('clears the active-table directory when the user signs out', async () => {
    const store = TestBed.inject(PokerStoreService);
    const storeInternals = store as unknown as {
      playerActiveTablesSignal: { set(tables: unknown[]): void };
    };
    storeInternals.playerActiveTablesSignal.set([{}]);

    user.set(null);
    TestBed.flushEffects();
    await Promise.resolve();

    expect(store.playerActiveTables()).toEqual([]);
  });
});

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
