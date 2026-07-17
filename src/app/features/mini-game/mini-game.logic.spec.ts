import {
  canClaimMiniGameCelebration,
  canManageMiniGame,
  isMiniGameEquityFresh,
  mapMiniGameSnapshot,
  miniGameBoardSlots,
  miniGameEquityPercentage,
  miniGameHistoryViewFromQuery,
  normalizeMiniGamePercentages,
  shouldApplyMiniGameSnapshotResponse,
} from './mini-game.logic';

describe('mini-game snapshot mapping', () => {
  it('maps the database JSON contract and stabilizes participant/card order', () => {
    const snapshot = mapMiniGameSnapshot(
      makeSnapshot({
        stateVersion: '7',
        equityVersion: '7',
        board: [
          { position: 3, code: '2h' },
          { position: 1, code: 'As' },
          { position: 2, code: 'Kd' },
        ],
        participants: [
          makeParticipant({
            id: 'participant-b',
            userId: 'user-b',
            displayName: 'Ben',
            joinPosition: 2,
            cards: [
              { position: 2, code: '4c' },
              { position: 1, code: '3c' },
            ],
            equity: makeEquity({ percentage: '35.5' }),
          }),
          makeParticipant({
            id: 'participant-a',
            userId: 'user-a',
            displayName: 'Ada',
            joinPosition: 1,
            cards: [
              { position: 2, code: 'Qh' },
              { position: 1, code: 'Qs' },
            ],
            equity: makeEquity({ percentage: '64.5' }),
          }),
        ],
      }),
    );

    expect(snapshot?.stateVersion).toBe(7);
    expect(snapshot?.board.map((card) => card.code)).toEqual(['As', 'Kd', '2h']);
    expect(snapshot?.participants.map((participant) => participant.displayName)).toEqual([
      'Ada',
      'Ben',
    ]);
    expect(snapshot?.participants[0].cards.map((card) => card.code)).toEqual(['Qs', 'Qh']);
    expect(snapshot?.participants[0].equity?.percentage).toBe(64.5);
  });

  it('returns null for an absent current game', () => {
    expect(mapMiniGameSnapshot(null)).toBeNull();
  });

  it('rejects duplicate public cards', () => {
    expect(() =>
      mapMiniGameSnapshot(
        makeSnapshot({
          participants: [
            makeParticipant({
              cards: [
                { position: 1, code: 'As' },
                { position: 2, code: 'Kd' },
              ],
            }),
          ],
          board: [
            { position: 1, code: 'As' },
            { position: 2, code: '2c' },
            { position: 3, code: '3d' },
          ],
        }),
      ),
    ).toThrowError('Mini-game snapshot contains duplicate cards.');
  });
});

describe('mini-game permissions and freshness', () => {
  const snapshot = mapMiniGameSnapshot(makeSnapshot())!;

  it('allows only the creator host to manage controls', () => {
    expect(canManageMiniGame(snapshot, 'host-a', 'HOST')).toBeTrue();
    expect(canManageMiniGame(snapshot, 'host-b', 'HOST')).toBeFalse();
    expect(canManageMiniGame(snapshot, 'host-a', 'MANAGER')).toBeFalse();
    expect(canManageMiniGame(snapshot, 'host-a', 'PLAYER')).toBeFalse();
  });

  it('requires READY equity for the exact current state version', () => {
    expect(isMiniGameEquityFresh(snapshot)).toBeTrue();
    expect(isMiniGameEquityFresh({ ...snapshot, equityStatus: 'PENDING' })).toBeFalse();
    expect(
      isMiniGameEquityFresh({ ...snapshot, equityVersion: snapshot.stateVersion - 1 }),
    ).toBeFalse();
  });

  it('claims a winner celebration only after a fresh completed result exists', () => {
    const completed = mapMiniGameSnapshot(
      makeSnapshot({
        status: 'COMPLETE',
        board: [
          { position: 1, code: 'As' },
          { position: 2, code: 'Kd' },
          { position: 3, code: '2h' },
          { position: 4, code: '3c' },
          { position: 5, code: '4d' },
        ],
        viewerParticipantId: 'participant-a',
        participants: [makeParticipant()],
        winnerParticipantIds: ['participant-a'],
      }),
    )!;

    expect(canClaimMiniGameCelebration(completed)).toBeTrue();
    expect(canClaimMiniGameCelebration({ ...completed, equityStatus: 'PENDING' })).toBeFalse();
    expect(
      canClaimMiniGameCelebration({ ...completed, equityVersion: completed.stateVersion - 1 }),
    ).toBeFalse();
    expect(canClaimMiniGameCelebration({ ...completed, winnerParticipantIds: [] })).toBeFalse();
    expect(canClaimMiniGameCelebration({ ...completed, viewerCelebrationSeen: true })).toBeFalse();
  });

  it('rejects stale snapshot responses while allowing fresher equity for the same state', () => {
    const ready = mapMiniGameSnapshot(makeSnapshot())!;
    const pending = { ...ready, equityStatus: 'PENDING' as const, equityVersion: 0 };

    expect(
      shouldApplyMiniGameSnapshotResponse(
        ready,
        { ...ready, stateVersion: ready.stateVersion - 1 },
        8,
        7,
      ),
    ).toBeFalse();
    expect(shouldApplyMiniGameSnapshotResponse(ready, pending, 8, 7)).toBeFalse();
    expect(shouldApplyMiniGameSnapshotResponse(pending, ready, 6, 7)).toBeTrue();
    expect(shouldApplyMiniGameSnapshotResponse(ready, null, 6, 7)).toBeFalse();
    expect(
      shouldApplyMiniGameSnapshotResponse(
        ready,
        { ...ready, id: 'game-b', stateVersion: 1 },
        6,
        7,
      ),
    ).toBeFalse();
    expect(
      shouldApplyMiniGameSnapshotResponse(
        ready,
        { ...ready, id: 'game-b', stateVersion: 1 },
        8,
        7,
      ),
    ).toBeTrue();
  });
});

describe('mini-game presentation logic', () => {
  it('displays normalized equity instead of deriving a pure win rate', () => {
    const snapshot = mapMiniGameSnapshot(
      makeSnapshot({
        participants: [
          makeParticipant({
            equity: makeEquity({
              share: 2,
              percentage: 50,
              wins: 0,
              ties: 4,
              totalOutcomes: 4,
            }),
          }),
        ],
      }),
    )!;

    expect(
      miniGameEquityPercentage(
        snapshot.participants[0].equity,
        snapshot.stateVersion,
        true,
      ),
    ).toBe(50);
  });

  it('hides equity while the calculation is pending or stale', () => {
    const snapshot = mapMiniGameSnapshot(
      makeSnapshot({ participants: [makeParticipant()] }),
    )!;

    expect(
      miniGameEquityPercentage(
        snapshot.participants[0].equity,
        snapshot.stateVersion,
        false,
      ),
    ).toBeNull();
    expect(
      miniGameEquityPercentage(
        snapshot.participants[0].equity,
        snapshot.stateVersion + 1,
        true,
      ),
    ).toBeNull();
  });

  it('allocates one-decimal percentages with a stable largest remainder', () => {
    expect(normalizeMiniGamePercentages([1 / 3, 1 / 3, 1 / 3])).toEqual([33.4, 33.3, 33.3]);
    expect(normalizeMiniGamePercentages([0.6, 0.4])).toEqual([60, 40]);
    expect(normalizeMiniGamePercentages([])).toEqual([]);
  });

  it('always returns five dimensionally stable board slots', () => {
    const snapshot = mapMiniGameSnapshot(makeSnapshot())!;
    const slots = miniGameBoardSlots(snapshot);

    expect(slots.length).toBe(5);
    expect(slots.map((slot) => slot.card?.code ?? null)).toEqual(['As', 'Kd', '2h', null, null]);
  });

  it('selects mini-game history only for its explicit query value', () => {
    expect(miniGameHistoryViewFromQuery('mini-games')).toBe('mini-games');
    expect(miniGameHistoryViewFromQuery('tables')).toBe('tables');
    expect(miniGameHistoryViewFromQuery(null)).toBe('tables');
    expect(miniGameHistoryViewFromQuery('unexpected')).toBe('tables');
  });
});

function makeSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'game-a',
    creatorHostId: 'host-a',
    name: 'Friday Draw',
    minPlayers: 2,
    maxPlayers: 10,
    status: 'FLOP',
    isCurrent: true,
    stateVersion: 4,
    equityVersion: 4,
    equityStatus: 'READY',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:05:00.000Z',
    completedAt: null,
    archivedAt: null,
    activePlayerCount: 0,
    viewerParticipantId: null,
    viewerCelebrationSeen: false,
    board: [
      { position: 1, code: 'As' },
      { position: 2, code: 'Kd' },
      { position: 3, code: '2h' },
    ],
    participants: [],
    winnerParticipantIds: [],
    ...overrides,
  };
}

function makeParticipant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'participant-a',
    userId: 'user-a',
    displayName: 'Ada',
    joinPosition: 1,
    joinedAt: '2026-07-14T12:01:00.000Z',
    cards: [
      { position: 1, code: 'Qs' },
      { position: 2, code: 'Qh' },
    ],
    equity: makeEquity(),
    ...overrides,
  };
}

function makeEquity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    stateVersion: 4,
    share: 1,
    percentage: 100,
    wins: 1,
    ties: 0,
    totalOutcomes: 1,
    finalHandLabel: null,
    calculatedAt: '2026-07-14T12:05:00.000Z',
    ...overrides,
  };
}
