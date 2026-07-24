import { removeSessionPlayerFromSession } from './session-player-removal.logic';

import type { PokerSession, SessionPlayer } from './poker-store.service';

describe('session player removal logic', () => {
  it('soft-removes the session player while retaining their transaction history', () => {
    const session = makeSession({
      players: [
        makePlayer({ id: 'seat-a', name: 'Alvin', totalBuyIn: 600 }),
        makePlayer({ id: 'seat-b', name: 'Gene', totalBuyIn: 300 })
      ],
      transactions: [
        makeTransaction({ id: 'tx-a-buyin', playerId: 'seat-a', amount: 300, type: 'BUYIN' }),
        makeTransaction({ id: 'tx-a-rebuy', playerId: 'seat-a', amount: 300, type: 'REBUY' }),
        makeTransaction({ id: 'tx-b-buyin', playerId: 'seat-b', amount: 300, type: 'BUYIN' })
      ]
    });

    const updatedSession = removeSessionPlayerFromSession(session, 'seat-a', {
      removedAt: '2026-07-23T03:00:00.000Z',
      removedBy: 'manager-one',
      removedByName: 'Manager One'
    });

    expect(updatedSession.players.map((player) => player.id)).toEqual(['seat-a', 'seat-b']);
    expect(updatedSession.players[0].removedAt).toBe('2026-07-23T03:00:00.000Z');
    expect(updatedSession.players[0].removedByName).toBe('Manager One');
    expect(updatedSession.transactions.map((transaction) => transaction.id)).toEqual([
      'tx-a-buyin',
      'tx-a-rebuy',
      'tx-b-buyin'
    ]);
  });

  it('rejects removing players from completed sessions', () => {
    const session = makeSession({
      status: 'COMPLETED',
      players: [makePlayer({ id: 'seat-a' })]
    });

    expect(() =>
      removeSessionPlayerFromSession(session, 'seat-a', {
        removedAt: '2026-07-23T03:00:00.000Z',
        removedBy: 'manager-one',
        removedByName: 'Manager One'
      })
    ).toThrowError('Cannot remove a player from a completed session.');
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
