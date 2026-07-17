import {
  joinedMiniGameHistory,
  playerCallTimeDisplayState,
  playerGameDetailSections,
  playerHasSharedCallTimeClock,
  playerGameTimeline,
  playerGameStatusKind,
  playerGameStatMode,
  playerPublicTableRoster,
  playerTableDetailRoster,
  playerPublicTableStats,
  shouldPollPlayerCallTime,
  totalActivePlayerChips,
  totalActivePlayers,
  unseatedPlayerActiveTables
} from './player-dashboard.logic';

import type { MiniGameSnapshot } from '../../mini-game/mini-game.models';

import type {
  PlayerActiveTable,
  PokerSession,
  PokerTransaction,
  PokerTransactionType,
  SessionPlayer,
  TimeCall
} from '../../host/data/poker-store.service';

describe('unseatedPlayerActiveTables', () => {
  it('removes seated tables and orders remaining tables by session date and table number', () => {
    const tableB2 = makeActiveTable({ tableId: 'table-b-2', tableNumber: 2 });
    const tableA1 = makeActiveTable({
      tableId: 'table-a-1',
      sessionDate: '2026-07-08',
      tableNumber: 1
    });
    const tableB1 = makeActiveTable({ tableId: 'table-b-1', tableNumber: 1 });

    expect(
      unseatedPlayerActiveTables(
        [tableB2, tableA1, tableB1],
        new Set(['table-a-1'])
      ).map((table) => table.tableId)
    ).toEqual(['table-b-1', 'table-b-2']);
  });

  it('does not mutate the active-table directory input', () => {
    const activeTables = [
      makeActiveTable({ tableId: 'table-b-2', tableNumber: 2 }),
      makeActiveTable({ tableId: 'table-b-1', tableNumber: 1 })
    ];
    const originalOrder = [...activeTables];

    unseatedPlayerActiveTables(activeTables, new Set());

    expect(activeTables).toEqual(originalOrder);
  });

  it('returns an empty list for an empty directory', () => {
    expect(unseatedPlayerActiveTables([], new Set())).toEqual([]);
  });
});

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

describe('player dashboard call-time sync polling', () => {
  it('polls quietly when an active player session can receive shared clock updates', () => {
    expect(
      shouldPollPlayerCallTime({
        activeEntryCount: 1,
        supportsSharedUpdates: true,
        schemaReady: true
      })
    ).toBeTrue();
  });

  it('does not poll without active player sessions or call-time schema support', () => {
    expect(
      shouldPollPlayerCallTime({
        activeEntryCount: 0,
        supportsSharedUpdates: true,
        schemaReady: true
      })
    ).toBeFalse();

    expect(
      shouldPollPlayerCallTime({
        activeEntryCount: 1,
        supportsSharedUpdates: true,
        schemaReady: false
      })
    ).toBeFalse();
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

describe('player mini-game history', () => {
  it('keeps only mini-games joined by the current player', () => {
    const games = [
      makeMiniGame({ id: 'joined', viewerParticipantId: 'participant-1' }),
      makeMiniGame({ id: 'watched', viewerParticipantId: null })
    ];

    expect(joinedMiniGameHistory(games).map((game) => game.id)).toEqual(['joined']);
  });

  it('puts timeline first only for completed table games', () => {
    expect(playerGameDetailSections('ACTIVE_GAME')).toEqual(['players', 'timeline']);
    expect(playerGameDetailSections('COMPLETED_GAME')).toEqual(['timeline', 'players']);
  });
});

describe('player public table stats', () => {
  it('uses public table summary when RLS only exposes the current player row', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', totalBuyIn: 100 });
    const session = makeSession({ players: [player] });

    expect(
      playerPublicTableStats(session, player, [
        {
          sessionPlayerId: player.id,
          sessionId: session.id,
          tableId: 'table-a',
          activePlayerCount: 4,
          totalActivePlayerChips: 1300
        }
      ])
    ).toEqual({
      activePlayerCount: 4,
      totalActivePlayerChips: 1300
    });
  });

  it('falls back to visible active game players when no public summary is available', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', totalBuyIn: 100 });
    const session = makeSession({
      players: [
        player,
        makePlayer({ id: 'seat-b', tableId: 'table-a', totalBuyIn: 300 }),
        makePlayer({ id: 'seat-c', tableId: 'table-b', totalBuyIn: 700 })
      ]
    });

    expect(playerPublicTableStats(session, player, [])).toEqual({
      activePlayerCount: 3,
      totalActivePlayerChips: 1100
    });
  });

  it('includes visible unassigned active game players in fallback stats', () => {
    const player = makePlayer({ id: 'seat-a', tableId: null, totalBuyIn: 100 });
    const session = makeSession({
      players: [player, makePlayer({ id: 'seat-b', tableId: null, totalBuyIn: 300 })]
    });

    expect(
      playerPublicTableStats(session, player, [
        {
          sessionPlayerId: player.id,
          sessionId: session.id,
          tableId: null,
          activePlayerCount: 2,
          totalActivePlayerChips: 400
        }
      ])
    ).toEqual({
      activePlayerCount: 2,
      totalActivePlayerChips: 400
    });
  });
});

describe('player public table roster', () => {
  it('identifies one unique local net leader for a completed table', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin', net: 50 });
    const session = makeSession({
      status: 'COMPLETED',
      players: [
        player,
        makePlayer({ id: 'seat-b', tableId: 'table-a', name: 'Gene', net: 120 }),
        makePlayer({ id: 'seat-c', tableId: 'table-b', name: 'Sarah', net: 300 })
      ]
    });

    const roster = playerTableDetailRoster(session, player, []);

    expect(roster.map((entry) => `${entry.name}:${entry.isNetLeader}`)).toEqual([
      'Alvin:false',
      'Gene:true'
    ]);
  });

  it('does not identify a net leader while the session is active', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin', net: 50 });
    const session = makeSession({
      players: [
        player,
        makePlayer({ id: 'seat-b', tableId: 'table-a', name: 'Gene', net: 120 })
      ]
    });

    expect(
      playerTableDetailRoster(session, player, []).map(
        (entry) => `${entry.name}:${entry.isNetLeader}`
      )
    ).toEqual(['Alvin:false', 'Gene:false']);
  });

  it('does not identify a net leader when completed-table leaders are tied', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin', net: 100 });
    const session = makeSession({
      status: 'COMPLETED',
      players: [
        player,
        makePlayer({ id: 'seat-b', tableId: 'table-a', name: 'Gene', net: 100 })
      ]
    });

    expect(
      playerTableDetailRoster(session, player, []).map(
        (entry) => `${entry.name}:${entry.isNetLeader}`
      )
    ).toEqual(['Alvin:false', 'Gene:false']);
  });

  it('rejects multiple public leader flags for the same completed table', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin' });
    const session = makeSession({ status: 'COMPLETED', players: [player] });
    const roster = playerTableDetailRoster(session, player, [
      {
        sessionPlayerId: 'seat-a',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Alvin',
        status: 'COMPLETED',
        isNetLeader: true
      },
      {
        sessionPlayerId: 'seat-b',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Gene',
        status: 'COMPLETED',
        isNetLeader: true
      }
    ]);

    expect(roster.map((entry) => entry.isNetLeader)).toEqual([false, false]);
  });

  it('uses public roster entries for the whole active game, including cashed-out players', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin' });
    const session = makeSession({ players: [player] });

    const roster = playerPublicTableRoster(session, player, [
      {
        sessionPlayerId: 'seat-b',
        sessionId: session.id,
        tableId: 'table-b',
        name: 'Gene',
        status: 'COMPLETED'
      },
      {
        sessionPlayerId: 'seat-c',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Kevin',
        status: 'ACTIVE'
      },
      {
        sessionPlayerId: 'seat-a',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Alvin',
        status: 'ACTIVE'
      }
    ]);

    expect(roster.map((entry) => `${entry.name}:${entry.status}`)).toEqual([
      'Alvin:ACTIVE',
      'Kevin:ACTIVE',
      'Gene:COMPLETED'
    ]);
  });

  it('uses public roster entries when RLS only exposes the current player row', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin' });
    const session = makeSession({ players: [player] });

    const roster = playerPublicTableRoster(session, player, [
      {
        sessionPlayerId: 'seat-b',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Gene',
        status: 'COMPLETED'
      },
      {
        sessionPlayerId: 'seat-c',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Kevin',
        status: 'ACTIVE'
      },
      {
        sessionPlayerId: 'seat-a',
        sessionId: session.id,
        tableId: 'table-a',
        name: 'Alvin',
        status: 'ACTIVE'
      }
    ]);

    expect(roster.map((entry) => `${entry.name}:${entry.status}`)).toEqual([
      'Alvin:ACTIVE',
      'Kevin:ACTIVE',
      'Gene:COMPLETED'
    ]);
  });

  it('falls back to visible active game players in development/local mode', () => {
    const player = makePlayer({ id: 'seat-a', tableId: 'table-a', name: 'Alvin' });
    const session = makeSession({
      players: [
        player,
        makePlayer({ id: 'seat-b', tableId: 'table-a', name: 'Gene', status: 'COMPLETED' }),
        makePlayer({ id: 'seat-c', tableId: 'table-a', name: 'Kevin' }),
        makePlayer({ id: 'seat-d', tableId: 'table-b', name: 'Sarah' })
      ]
    });

    const roster = playerPublicTableRoster(session, player, []);

    expect(roster.map((entry) => `${entry.name}:${entry.status}`)).toEqual([
      'Alvin:ACTIVE',
      'Kevin:ACTIVE',
      'Sarah:ACTIVE',
      'Gene:COMPLETED'
    ]);
  });

  it('includes unassigned players from the active game when the public roster exposes them', () => {
    const player = makePlayer({ id: 'seat-a', tableId: null, name: 'Alvin' });
    const session = makeSession({
      players: [
        player,
        makePlayer({ id: 'seat-b', tableId: null, name: 'Gene' })
      ]
    });

    const roster = playerPublicTableRoster(session, player, [
      {
        sessionPlayerId: 'seat-a',
        sessionId: session.id,
        tableId: null,
        name: 'Alvin',
        status: 'ACTIVE'
      },
      {
        sessionPlayerId: 'seat-b',
        sessionId: session.id,
        tableId: null,
        name: 'Gene',
        status: 'ACTIVE'
      }
    ]);

    expect(roster.map((entry) => entry.name)).toEqual(['Alvin', 'Gene']);
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

function makeActiveTable(overrides: Partial<PlayerActiveTable> = {}): PlayerActiveTable {
  return {
    sessionId: 'session-a',
    sessionName: 'July 8 Game',
    sessionDate: '2026-07-09',
    sessionCreatedAt: '2026-07-09T01:00:00.000Z',
    tableId: 'table-a-1',
    tableName: 'Table 1',
    tableNumber: 1,
    tableCreatedAt: '2026-07-09T01:00:00.000Z',
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

function makeMiniGame(overrides: Partial<MiniGameSnapshot> = {}): MiniGameSnapshot {
  return {
    id: 'mini-game-a',
    creatorHostId: 'host-a',
    name: 'Holdem',
    minPlayers: 2,
    maxPlayers: 6,
    status: 'COMPLETE',
    isCurrent: false,
    stateVersion: 1,
    equityVersion: 1,
    equityStatus: 'READY',
    createdAt: '2026-07-08T01:00:00.000Z',
    updatedAt: '2026-07-08T01:00:00.000Z',
    completedAt: '2026-07-08T02:00:00.000Z',
    archivedAt: null,
    activePlayerCount: 2,
    viewerParticipantId: 'participant-a',
    viewerCelebrationSeen: true,
    board: [],
    participants: [],
    winnerParticipantIds: [],
    ...overrides
  };
}
