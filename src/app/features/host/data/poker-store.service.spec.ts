import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import {
  PokerSession,
  PokerStoreService,
  roleUsesPlayerParticipationData
} from './poker-store.service';

describe('PokerStoreService role data access', () => {
  it('uses player participation data for players and managers', () => {
    expect(roleUsesPlayerParticipationData('PLAYER')).toBeTrue();
    expect(roleUsesPlayerParticipationData('MANAGER')).toBeTrue();
    expect(roleUsesPlayerParticipationData('HOST')).toBeFalse();
    expect(roleUsesPlayerParticipationData(null)).toBeFalse();
  });
});

describe('PokerStoreService player active tables', () => {
  let from: jasmine.Spy;
  let rpc: jasmine.Spy;
  let initialized: WritableSignal<boolean>;
  let user: WritableSignal<{ id: string } | null>;
  let role: WritableSignal<'HOST' | 'PLAYER' | null>;
  let activeTableRequests: Array<Deferred<SupabaseResult>>;

  beforeEach(() => {
    initialized = signal(false);
    user = signal({ id: 'player-a' });
    role = signal('PLAYER');
    activeTableRequests = [];
    from = jasmine.createSpy('from').and.returnValue({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null })
      })
    });
    rpc = jasmine.createSpy('rpc').and.callFake((name: string) => {
      if (name === 'player_active_tables') {
        const request = deferred<SupabaseResult>();
        activeTableRequests.push(request);
        return request.promise;
      }

      return Promise.resolve({ data: null, error: null });
    });
    const channel = {
      on: jasmine.createSpy('on'),
      subscribe: jasmine.createSpy('subscribe')
    };
    channel.on.and.returnValue(channel);
    channel.subscribe.and.returnValue(channel);
    const removeChannel = jasmine.createSpy('removeChannel').and.resolveTo('ok');

    TestBed.configureTestingModule({
      providers: [
        PokerStoreService,
        {
          provide: AuthStateService,
          useValue: {
            initialized,
            user,
            role
          }
        },
        {
          provide: SupabaseService,
          useValue: {
            client: null,
            isConfigured: true,
            requireClient: () => ({
              from,
              rpc,
              channel: () => channel,
              removeChannel
            })
          }
        }
      ]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the active-table directory when the player has no participated sessions', async () => {
    const store = TestBed.inject(PokerStoreService);
    const refresh = store.refreshSessions();
    await flushAsyncWork();

    activeTableRequests[0].resolve(activeTableResult());
    await refresh;

    expect(rpc).toHaveBeenCalledWith('player_active_tables');
    expect(store.playerActiveTables()).toEqual([activeTable()]);
  });

  it('keeps the newest same-player directory response when requests resolve newest-first', async () => {
    const store = TestBed.inject(PokerStoreService);
    const olderRefresh = store.refreshSessions();
    await flushAsyncWork();
    const newerRefresh = store.refreshSessions();
    await flushAsyncWork();

    expect(activeTableRequests).toHaveSize(2);

    activeTableRequests[1].resolve(
      activeTableResult({ tableId: 'table-new', tableName: 'Newest Table' })
    );
    await newerRefresh;
    expect(store.playerActiveTables()).toEqual([
      activeTable({ tableId: 'table-new', tableName: 'Newest Table' })
    ]);

    activeTableRequests[0].resolve(
      activeTableResult({ tableId: 'table-old', tableName: 'Older Table' })
    );
    await olderRefresh;

    expect(store.playerActiveTables()).toEqual([
      activeTable({ tableId: 'table-new', tableName: 'Newest Table' })
    ]);
  });

  it('immediately clears a populated directory when switching player accounts', async () => {
    const store = TestBed.inject(PokerStoreService);
    const refresh = store.refreshSessions();
    await flushAsyncWork();

    activeTableRequests[0].resolve(activeTableResult());
    await refresh;
    expect(store.playerActiveTables()).toEqual([activeTable()]);

    user.set({ id: 'player-b' });
    TestBed.flushEffects();

    expect(store.playerActiveTables()).toEqual([]);
  });

  it('preserves the last confirmed directory when a same-player refresh fails', async () => {
    const store = TestBed.inject(PokerStoreService);
    const successfulRefresh = store.refreshSessions();
    await flushAsyncWork();
    activeTableRequests[0].resolve(activeTableResult());
    await successfulRefresh;

    const failure = new Error('Directory refresh failed');
    const failedRefresh = store.refreshSessions();
    await flushAsyncWork();
    activeTableRequests[1].resolve({ data: null, error: failure });

    await expectAsync(failedRefresh).toBeRejectedWith(failure);
    expect(store.playerActiveTables()).toEqual([activeTable()]);
    expect(store.error()).toBe('Directory refresh failed');
  });

  it('does not apply a pending directory response after sign-out', async () => {
    const store = TestBed.inject(PokerStoreService);
    const refresh = store.refreshSessions();
    await flushAsyncWork();

    user.set(null);
    await flushAuthEffect();
    activeTableRequests[0].resolve(activeTableResult());
    await refresh;

    expect(store.playerActiveTables()).toEqual([]);
  });

  it('does not apply a pending directory response after switching player accounts', async () => {
    const store = TestBed.inject(PokerStoreService);
    const refresh = store.refreshSessions();
    await flushAsyncWork();

    user.set({ id: 'player-b' });
    await flushAuthEffect();
    activeTableRequests[0].resolve(activeTableResult());
    await refresh;

    expect(store.playerActiveTables()).toEqual([]);
  });

  it('does not apply a pending directory response after leaving the player role', async () => {
    const store = TestBed.inject(PokerStoreService);
    const refresh = store.refreshSessions();
    await flushAsyncWork();

    role.set('HOST');
    await flushAuthEffect();
    activeTableRequests[0].resolve(activeTableResult());
    await refresh;

    expect(store.playerActiveTables()).toEqual([]);
  });

  it('loads the directory when a user arrives before their player role', async () => {
    initialized.set(true);
    user.set(null);
    role.set(null);
    const store = TestBed.inject(PokerStoreService);
    await flushAuthEffect();

    user.set({ id: 'player-a' });
    await flushAuthEffect();
    expect(activeTableRequests).toHaveSize(0);

    role.set('PLAYER');
    await flushAuthEffect();
    expect(activeTableRequests).toHaveSize(1);

    activeTableRequests[0].resolve(activeTableResult());
    await flushAsyncWork();
    expect(store.playerActiveTables()).toEqual([activeTable()]);
  });

  it('reloads the directory when the same Supabase user becomes a player', async () => {
    initialized.set(true);
    role.set('HOST');
    const store = TestBed.inject(PokerStoreService);
    await flushAuthEffect();
    expect(store.sessionsLoaded()).toBeTrue();
    expect(activeTableRequests).toHaveSize(0);

    role.set('PLAYER');
    await flushAuthEffect();

    expect(activeTableRequests).toHaveSize(1);
    activeTableRequests[0].resolve(activeTableResult());
    await flushAsyncWork();
    expect(store.playerActiveTables()).toEqual([activeTable()]);
  });

  async function flushAuthEffect(): Promise<void> {
    TestBed.flushEffects();
    await flushAsyncWork();
  }
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

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface SupabaseResult {
  data: unknown;
  error: unknown;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

interface ActiveTableOverrides {
  tableId?: string;
  tableName?: string;
}

function activeTableResult(overrides: ActiveTableOverrides = {}): SupabaseResult {
  return {
    data: [
      {
        session_id: 'session-a',
        session_name: 'Friday Game',
        session_date: '2026-07-15',
        session_created_at: '2026-07-15T20:00:00.000Z',
        table_id: overrides.tableId ?? 'table-a',
        table_name: overrides.tableName ?? 'Main Table',
        table_number: 1,
        table_created_at: '2026-07-15T20:01:00.000Z'
      }
    ],
    error: null
  };
}

function activeTable(overrides: ActiveTableOverrides = {}) {
  return {
    sessionId: 'session-a',
    sessionName: 'Friday Game',
    sessionDate: '2026-07-15',
    sessionCreatedAt: '2026-07-15T20:00:00.000Z',
    tableId: overrides.tableId ?? 'table-a',
    tableName: overrides.tableName ?? 'Main Table',
    tableNumber: 1,
    tableCreatedAt: '2026-07-15T20:01:00.000Z'
  };
}
