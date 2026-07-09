import { removeSessionTableFromSession } from './session-table-removal.logic';

import type { PokerSession, PokerTable, SessionPlayer } from './poker-store.service';

describe('session table removal logic', () => {
  it('removes a table and every player, transaction, and time call seated at that table', () => {
    const session = makeSession({
      tables: [makeTable({ id: 'table-a' }), makeTable({ id: 'table-b', name: 'Side Table' })],
      players: [
        makePlayer({ id: 'seat-a', tableId: 'table-a' }),
        makePlayer({ id: 'seat-b', tableId: 'table-b' })
      ],
      transactions: [
        makeTransaction({ id: 'tx-a', tableId: 'table-a', playerId: 'seat-a' }),
        makeTransaction({ id: 'tx-b', tableId: 'table-b', playerId: 'seat-b' })
      ],
      timeCalls: [
        makeTimeCall({ id: 'call-a', sessionPlayerId: 'seat-a' }),
        makeTimeCall({ id: 'call-b', sessionPlayerId: 'seat-b' })
      ]
    });

    const updatedSession = removeSessionTableFromSession(session, 'table-a');

    expect(updatedSession.tables.map((table) => table.id)).toEqual(['table-b']);
    expect(updatedSession.players.map((player) => player.id)).toEqual(['seat-b']);
    expect(updatedSession.transactions.map((transaction) => transaction.id)).toEqual(['tx-b']);
    expect(updatedSession.timeCalls.map((timeCall) => timeCall.id)).toEqual(['call-b']);
  });

  it('rejects deleting tables from completed sessions', () => {
    const session = makeSession({
      status: 'COMPLETED',
      tables: [makeTable({ id: 'table-a' })]
    });

    expect(() => removeSessionTableFromSession(session, 'table-a')).toThrowError(
      'Cannot delete a table from a completed session.'
    );
  });
});

function makeSession(overrides: Partial<PokerSession> = {}): PokerSession {
  return {
    id: 'session-a',
    name: 'July 9 Game',
    sessionDate: '2026-07-09',
    status: 'ACTIVE',
    createdAt: '2026-07-09T01:00:00.000Z',
    closedAt: null,
    tables: [],
    players: [],
    transactions: [],
    timeCalls: [],
    ...overrides
  };
}

function makeTable(overrides: Partial<PokerTable> = {}): PokerTable {
  return {
    id: 'table-a',
    sessionId: 'session-a',
    name: 'Main Table',
    status: 'ACTIVE',
    tableNumber: 1,
    createdAt: '2026-07-09T01:00:00.000Z',
    closedAt: null,
    ...overrides
  };
}

function makePlayer(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'seat-a',
    tableId: 'table-a',
    userId: 'user-a',
    name: 'Alvin',
    status: 'ACTIVE',
    totalBuyIn: 300,
    cashOut: 0,
    net: -300,
    joinedAt: '2026-07-09T01:00:00.000Z',
    completedAt: null,
    ...overrides
  };
}

function makeTransaction(
  overrides: Partial<PokerSession['transactions'][number]> = {}
): PokerSession['transactions'][number] {
  return {
    id: 'tx-a',
    sessionId: 'session-a',
    tableId: 'table-a',
    playerId: 'seat-a',
    type: 'BUYIN',
    amount: 300,
    createdAt: '2026-07-09T01:00:00.000Z',
    ...overrides
  };
}

function makeTimeCall(
  overrides: Partial<PokerSession['timeCalls'][number]> = {}
): PokerSession['timeCalls'][number] {
  return {
    id: 'call-a',
    sessionId: 'session-a',
    sessionPlayerId: 'seat-a',
    status: 'RUNNING',
    startedAt: '2026-07-09T01:00:00.000Z',
    expiresAt: '2026-07-09T01:01:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
    ...overrides
  };
}
