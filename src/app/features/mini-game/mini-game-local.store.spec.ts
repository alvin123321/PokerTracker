import { MiniGameActionRequest, MiniGameSnapshot } from './mini-game.models';
import {
  MiniGameLocalStore,
  MiniGameLocalViewer,
  evaluateCompletedLocalGame,
} from './mini-game-local.store';

describe('MiniGameLocalStore', () => {
  let storage: MemoryStorage;
  let store: MiniGameLocalStore;

  const host: MiniGameLocalViewer = {
    userId: 'dev-host-admin',
    displayName: 'Admin',
    role: 'HOST',
  };
  const player: MiniGameLocalViewer = {
    userId: 'dev-player',
    displayName: 'Player',
    role: 'PLAYER',
  };
  const secondPlayer: MiniGameLocalViewer = {
    userId: 'dev-player-two',
    displayName: 'Second Player',
    role: 'PLAYER',
  };

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new MiniGameLocalStore(
      storage,
      () => 0.42,
      () => '2026-07-14T12:00:00.000Z',
    );
  });

  it('deals two globally unique public cards to every joined player', () => {
    const game = perform(
      { action: 'create', name: 'Local table', minPlayers: 2, maxPlayers: 10 },
      host,
    );

    perform({ action: 'join', gameId: game.id }, host);
    const joined = perform({ action: 'join', gameId: game.id }, player);
    const cards = joined.participants.flatMap((participant) =>
      participant.cards.map((card) => card.code),
    );

    expect(cards).toHaveSize(4);
    expect(new Set(cards).size).toBe(4);
    expect(joined.viewerParticipantId).toBe(
      joined.participants.find((participant) => participant.userId === player.userId)?.id ?? null,
    );
  });

  it('rejects joining twice and starting below the configured minimum', () => {
    const game = perform(
      { action: 'create', name: 'Local table', minPlayers: 2, maxPlayers: 10 },
      host,
    );
    perform({ action: 'join', gameId: game.id }, host);

    expect(() => perform({ action: 'join', gameId: game.id }, host)).toThrowError(
      /already joined/i,
    );
    expect(() => perform({ action: 'start', gameId: game.id }, host)).toThrowError(
      /not enough players/i,
    );
  });

  it('selects and publishes the winner as part of revealing the river', () => {
    const river = runningGameThroughRiver();

    expect(river.status).toBe('COMPLETE');
    expect(river.board).toHaveSize(5);
    expect(river.equityStatus).toBe('READY');
    expect(river.equityVersion).toBe(river.stateVersion);
    expect(river.winnerParticipantIds.length).toBeGreaterThan(0);

    const playerView = store.current(player);
    expect(playerView?.winnerParticipantIds).toEqual(river.winnerParticipantIds);
  });

  it('archives a completed game out of dashboards while preserving history', () => {
    const river = runningGameThroughRiver();
    const archived = perform({ action: 'archive', gameId: river.id }, host);

    expect(archived.isCurrent).toBeFalse();
    expect(store.current(host)).toBeNull();
    expect(store.history(player).map((game) => game.id)).toContain(river.id);
    expect(store.detail(river.id, player)?.winnerParticipantIds).toEqual(
      river.winnerParticipantIds,
    );
  });

  it('deletes a result from both dashboards and history', () => {
    const river = runningGameThroughRiver();
    perform({ action: 'delete', gameId: river.id }, host);

    expect(store.current(host)).toBeNull();
    expect(store.history(player)).toEqual([]);
    expect(store.detail(river.id, player)).toBeNull();
  });

  it('claims the winner celebration once per participant', () => {
    const river = runningGameThroughRiver();

    expect(store.claimCelebration(river.id, player.userId)).toBeTrue();
    expect(store.claimCelebration(river.id, player.userId)).toBeFalse();
    expect(store.claimCelebration(river.id, 'not-joined')).toBeFalse();
  });

  it('reads persisted state once per public snapshot operation', () => {
    const river = runningGameThroughRiver();

    storage.resetGetItemCalls();
    store.current(player);
    expect(storage.getItemCalls).toBe(1);

    storage.resetGetItemCalls();
    store.history(player);
    expect(storage.getItemCalls).toBe(1);

    storage.resetGetItemCalls();
    store.detail(river.id, player);
    expect(storage.getItemCalls).toBe(1);

    storage.resetGetItemCalls();
    store.perform({ action: 'archive', gameId: river.id }, host);
    expect(storage.getItemCalls).toBe(1);
  });

  it('does not clone the full state through JSON before persistence', () => {
    const game = perform(
      { action: 'create', name: 'Local table', minPlayers: 2, maxPlayers: 10 },
      host,
    );
    const parseSpy = spyOn(JSON, 'parse').and.callThrough();

    store.perform({ action: 'join', gameId: game.id }, host);

    expect(parseSpy.calls.count()).toBeLessThanOrEqual(2);
  });

  function runningGameThroughRiver(): MiniGameSnapshot {
    const game = perform(
      { action: 'create', name: 'Local table', minPlayers: 2, maxPlayers: 10 },
      host,
    );
    perform({ action: 'join', gameId: game.id }, host);
    perform({ action: 'join', gameId: game.id }, player);
    perform({ action: 'join', gameId: game.id }, secondPlayer);
    perform({ action: 'start', gameId: game.id }, host);
    perform({ action: 'reveal-turn', gameId: game.id }, host);
    return perform({ action: 'reveal-river', gameId: game.id }, host);
  }

  function perform(request: MiniGameActionRequest, viewer: MiniGameLocalViewer): MiniGameSnapshot {
    const result = store.perform(request, viewer);

    if (!result.snapshot) {
      throw new Error('Expected a local snapshot.');
    }

    return result.snapshot;
  }
});

describe('evaluateCompletedLocalGame', () => {
  it('supports split-pot winners and labels final hands', () => {
    const result = evaluateCompletedLocalGame(
      [participant('one', ['2c', '3d']), participant('two', ['4c', '5d'])],
      ['As', 'Ks', 'Qs', 'Js', 'Ts'],
      7,
      '2026-07-14T12:05:00.000Z',
    );

    expect(result.winnerParticipantIds).toEqual(['one', 'two']);
    expect(result.equities.map((equity) => equity.percentage)).toEqual([50, 50]);
    expect(result.equities.map((equity) => equity.finalHandLabel)).toEqual([
      'Straight Flush',
      'Straight Flush',
    ]);
  });
});

function participant(id: string, cards: [string, string]) {
  return {
    id,
    userId: `user-${id}`,
    displayName: id,
    joinPosition: 1,
    joinedAt: '2026-07-14T12:00:00.000Z',
    cards: cards.map((code, index) => ({ position: index + 1, code })),
    equity: null,
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  getItemCalls = 0;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    this.getItemCalls += 1;
    return this.values.get(key) ?? null;
  }

  resetGetItemCalls(): void {
    this.getItemCalls = 0;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
