import { playerCallTimeDisplayState } from './player-dashboard.logic';

import type { PokerSession, SessionPlayer, TimeCall } from '../../host/data/poker-store.service';

describe('player dashboard call-time display', () => {
  it('shows the shared countdown clock when another active player has called time', () => {
    const player = makePlayer({ id: 'seat-b' });
    const session = makeSession({
      players: [makePlayer({ id: 'seat-a' }), player],
      timeCalls: [makeTimeCall({ sessionPlayerId: 'seat-a' })]
    });

    expect(playerCallTimeDisplayState(session, player, session.timeCalls[0])).toBe('CLOCK');
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
