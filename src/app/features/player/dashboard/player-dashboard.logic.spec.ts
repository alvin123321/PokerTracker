import {
  playerCallTimeDisplayState,
  playerHasSharedCallTimeClock,
  playerGameTimeline,
  playerGameStatusKind,
  playerGameStatMode,
  totalActivePlayerChips,
  totalActivePlayers
} from './player-dashboard.logic';

import type {
  PokerSession,
  PokerTransaction,
  PokerTransactionType,
  SessionPlayer,
  TimeCall
} from '../../host/data/poker-store.service';

describe('player dashboard call-time display', () => {
  it('shows the shared countdown clock when another active player has called time', () => {
    const player = makePlayer({ id: 'seat-b' });
    const session = makeSession({
      players: [makePlayer({ id: 'seat-a' }), player],
      timeCalls: [makeTimeCall({ sessionPlayerId: 'seat-a' })]
    });

    expect(playerCallTimeDisplayState(session, player, session.timeCalls[0])).toBe('CLOCK');
  });

  it('uses the same shared clock view for the caller and tablemates', () => {
    const caller = makePlayer({ id: 'seat-a' });
    const tablemate = makePlayer({ id: 'seat-b' });
    const session = makeSession({
      players: [caller, tablemate],
      timeCalls: [makeTimeCall({ sessionPlayerId: caller.id })]
    });

    expect(playerHasSharedCallTimeClock(session, caller, session.timeCalls[0])).toBeTrue();
    expect(playerHasSharedCallTimeClock(session, tablemate, session.timeCalls[0])).toBeTrue();
  });

  it('shows the call-time button when no table clock is running', () => {
    const player = makePlayer({ id: 'seat-a' });
    const session = makeSession({ players: [player] });

    expect(playerCallTimeDisplayState(session, player, undefined)).toBe('BUTTON');
  });

  it('hides call time for closed tables', () => {
    const player = makePlayer({ tableId: 'table-a' });
    const session = makeSession({
      players: [player],
      tables: [
        {
          id: 'table-a',
          sessionId: 'session-a',
          name: 'Main Table',
          status: 'CLOSED',
          tableNumber: 1,
          createdAt: '2026-07-08T01:00:00.000Z',
          closedAt: '2026-07-08T02:00:00.000Z'
        }
      ]
    });

    expect(playerCallTimeDisplayState(session, player, undefined)).toBe('NONE');
  });
});

describe('playerGameTimeline', () => {
  it('includes buy-in, rebuy, and cash-out rows in time order', () => {
    const rows = playerGameTimeline([
      makeTransaction({
        id: 'cashout',
        type: 'CASHOUT',
        amount: 500,
        createdAt: '2026-07-08T04:00:00.000Z'
      }),
      makeTransaction({
        id: 'buyin',
        type: 'BUYIN',
        amount: 200,
        createdAt: '2026-07-08T01:00:00.000Z'
      }),
      makeTransaction({
        id: 'rebuy',
        type: 'REBUY',
        amount: 300,
        createdAt: '2026-07-08T02:00:00.000Z'
      })
    ]);

    expect(rows.map((row) => row.id)).toEqual(['buyin', 'rebuy', 'cashout']);
  });

  it('omits deleted transaction rows', () => {
    const rows = playerGameTimeline([
      makeTransaction({ id: 'buyin', type: 'BUYIN' }),
      makeTransaction({ id: 'deleted-cashout', type: 'CASHOUT', deletedAt: '2026-07-08T04:30:00.000Z' })
    ]);

    expect(rows.map((row) => row.id)).toEqual(['buyin']);
  });
});

describe('player game status display', () => {
  it('uses active-player and chip totals while the game is active', () => {
    const session = makeSession({
      players: [
        makePlayer({ id: 'seat-a', status: 'ACTIVE', totalBuyIn: 100 }),
        makePlayer({ id: 'seat-b', status: 'ACTIVE', totalBuyIn: 250 }),
        makePlayer({ id: 'seat-c', status: 'COMPLETED', totalBuyIn: 500 })
      ]
    });
    const player = session.players[0];

    expect(playerGameStatusKind(session, player)).toBe('ACTIVE');
    expect(playerGameStatMode(session, player)).toBe('ACTIVE_GAME');
    expect(totalActivePlayers(session)).toBe(2);
    expect(totalActivePlayerChips(session)).toBe(350);
  });

  it('uses completed cash-out and net stats after the player is completed', () => {
    const session = makeSession({ status: 'COMPLETED' });
    const player = makePlayer({ status: 'COMPLETED', cashOut: 500, net: 200 });

    expect(playerGameStatusKind(session, player)).toBe('COMPLETED');
    expect(playerGameStatMode(session, player)).toBe('COMPLETED_GAME');
  });
});

function makeSession(overrides: Partial<PokerSession> = {}): PokerSession {
  return {
    id: 'session-a',
    name: 'July 8 Game',
    sessionDate: '2026-07-08',
    status: 'ACTIVE',
    createdAt: '2026-07-08T01:00:00.000Z',
    closedAt: null,
    tables: [],
    players: [],
    transactions: [],
    timeCalls: [],
    ...overrides
  };
}

function makePlayer(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'seat-a',
    tableId: null,
    userId: 'user-a',
    name: 'Alvin',
    status: 'ACTIVE',
    totalBuyIn: 100,
    cashOut: 0,
    net: 0,
    joinedAt: '2026-07-08T01:00:00.000Z',
    completedAt: null,
    ...overrides
  };
}

function makeTimeCall(overrides: Partial<TimeCall> = {}): TimeCall {
  return {
    id: 'time-call-a',
    sessionId: 'session-a',
    sessionPlayerId: 'seat-a',
    status: 'RUNNING',
    startedAt: '2026-07-08T01:00:00.000Z',
    expiresAt: '2026-07-08T01:00:30.000Z',
    resolvedAt: null,
    resolvedBy: null,
    ...overrides
  };
}

function makeTransaction(overrides: Partial<PokerTransaction> = {}): PokerTransaction {
  const type: PokerTransactionType = overrides.type ?? 'BUYIN';

  return {
    id: `${type.toLowerCase()}-a`,
    sessionId: 'session-a',
    tableId: 'table-a',
    playerId: 'seat-a',
    type,
    amount: 100,
    createdAt: '2026-07-08T01:00:00.000Z',
    ...overrides
  };
}
