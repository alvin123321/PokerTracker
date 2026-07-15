import { evaluate, odds } from '@poker-apprentice/hand-evaluator';

import { MINI_GAME_LOCAL_STORAGE_KEY } from './mini-game-local.constants';
import { mapMiniGameSnapshot, normalizeMiniGamePercentages } from './mini-game.logic';
import {
  MiniGameActionRequest,
  MiniGameActionSuccess,
  MiniGameEquity,
  MiniGameParticipant,
  MiniGameSnapshot,
  MiniGameViewerRole,
} from './mini-game.models';

export interface MiniGameLocalViewer {
  userId: string;
  displayName: string;
  role: MiniGameViewerRole;
}

interface MiniGameLocalState {
  nextId: number;
  games: MiniGameSnapshot[];
  celebrationClaims: Record<string, string[]>;
}

interface CompletedLocalGameResult {
  equities: MiniGameEquity[];
  winnerParticipantIds: string[];
}

const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const suits = ['c', 'd', 'h', 's'] as const;
type Card = `${(typeof ranks)[number]}${(typeof suits)[number]}`;
const deck = ranks.flatMap((rank) => suits.map((suit) => `${rank}${suit}` as Card));
const cardPattern = /^[2-9TJQKA][cdhs]$/;

export function evaluateCompletedLocalGame(
  participants: MiniGameParticipant[],
  boardCodes: string[],
  stateVersion: number,
  calculatedAt: string,
): CompletedLocalGameResult {
  if (participants.length === 0 || boardCodes.length !== 5) {
    throw new Error('A completed mini-game needs players and five board cards.');
  }

  const board = boardCodes.map(asCard);
  const results = odds(
    participants.map((participant) => participant.cards.map((card) => asCard(card.code))),
    {
      communityCards: board,
      expectedCommunityCardCount: 5,
      expectedHoleCardCount: 2,
      minimumHoleCardsUsed: 0,
      maximumHoleCardsUsed: 2,
    },
  );
  const percentages = normalizeMiniGamePercentages(results.map((result) => result.equity));
  const equities = participants.map((participant, index): MiniGameEquity => ({
    stateVersion,
    share: results[index].equity,
    percentage: percentages[index],
    wins: results[index].wins,
    ties: results[index].ties,
    totalOutcomes: results[index].total,
    finalHandLabel: handLabel(
      evaluate({
        holeCards: participant.cards.map((card) => asCard(card.code)),
        communityCards: board,
      }).strength,
    ),
    calculatedAt,
  }));

  return {
    equities,
    winnerParticipantIds: participants
      .filter((_, index) => results[index].equity > 0)
      .map((participant) => participant.id),
  };
}

export class MiniGameLocalStore {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly random: () => number = Math.random,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  current(viewer: MiniGameLocalViewer): MiniGameSnapshot | null {
    const state = this.read();
    const game = state.games.find((candidate) => candidate.isCurrent) ?? null;
    return game ? this.forViewer(game, viewer, state.celebrationClaims) : null;
  }

  history(viewer: MiniGameLocalViewer): MiniGameSnapshot[] {
    const state = this.read();

    return state.games
      .filter((game) => game.status === 'COMPLETE')
      .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)))
      .map((game) => this.forViewer(game, viewer, state.celebrationClaims));
  }

  detail(gameId: string, viewer: MiniGameLocalViewer): MiniGameSnapshot | null {
    const state = this.read();
    const game = state.games.find((candidate) => candidate.id === gameId) ?? null;
    return game ? this.forViewer(game, viewer, state.celebrationClaims) : null;
  }

  perform(request: MiniGameActionRequest, viewer: MiniGameLocalViewer): MiniGameActionSuccess {
    const state = this.read();
    let snapshot: MiniGameSnapshot | undefined;

    if (request.action === 'create') {
      snapshot = this.createGame(state, request, viewer);
    } else {
      const game = state.games.find((candidate) => candidate.id === request.gameId);

      if (!game) {
        throw new Error('Mini-game not found.');
      }

      snapshot = this.mutateGame(state, game, request, viewer);
    }

    this.write(state);

    return {
      ok: true,
      gameId: request.action === 'create' ? snapshot.id : request.gameId,
      stateVersion: snapshot.stateVersion,
      equityStatus: snapshot.equityStatus,
      snapshot: this.forViewer(snapshot, viewer, state.celebrationClaims),
    };
  }

  claimCelebration(gameId: string, viewerUserId: string): boolean {
    const state = this.read();
    const game = state.games.find((candidate) => candidate.id === gameId);

    if (
      !game ||
      game.status !== 'COMPLETE' ||
      !game.participants.some((participant) => participant.userId === viewerUserId)
    ) {
      return false;
    }

    const claims = state.celebrationClaims[gameId] ?? [];

    if (claims.includes(viewerUserId)) {
      return false;
    }

    state.celebrationClaims[gameId] = [...claims, viewerUserId];
    this.write(state);
    return true;
  }

  private createGame(
    state: MiniGameLocalState,
    request: Extract<MiniGameActionRequest, { action: 'create' }>,
    viewer: MiniGameLocalViewer,
  ): MiniGameSnapshot {
    if (viewer.role !== 'HOST') {
      throw new Error('Host privileges are required to create a mini-game.');
    }

    this.validateSettings(request.name, request.minPlayers, request.maxPlayers);
    const current = state.games.find((game) => game.isCurrent);

    if (current && current.status !== 'COMPLETE') {
      throw new Error('A current mini-game already exists.');
    }

    if (current) {
      current.isCurrent = false;
      current.archivedAt = this.now();
    }

    const timestamp = this.now();
    const game: MiniGameSnapshot = {
      id: this.nextId(state, 'game'),
      creatorHostId: viewer.userId,
      name: request.name.trim(),
      minPlayers: request.minPlayers,
      maxPlayers: request.maxPlayers,
      status: 'OPEN',
      isCurrent: true,
      stateVersion: 1,
      equityVersion: 0,
      equityStatus: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      archivedAt: null,
      activePlayerCount: 0,
      viewerParticipantId: null,
      viewerCelebrationSeen: false,
      board: [],
      participants: [],
      winnerParticipantIds: [],
    };

    state.games.push(game);
    return game;
  }

  private mutateGame(
    state: MiniGameLocalState,
    game: MiniGameSnapshot,
    request: Exclude<MiniGameActionRequest, { action: 'create' }>,
    viewer: MiniGameLocalViewer,
  ): MiniGameSnapshot {
    switch (request.action) {
      case 'update':
        this.assertCreator(game, viewer);
        this.assertOpen(game);
        this.validateSettings(request.name, request.minPlayers, request.maxPlayers);
        if (request.maxPlayers < game.participants.length) {
          throw new Error('Maximum players cannot be lower than the joined player count.');
        }
        game.name = request.name.trim();
        game.minPlayers = request.minPlayers;
        game.maxPlayers = request.maxPlayers;
        this.advance(game);
        break;
      case 'join':
        this.assertOpen(game);
        if (game.participants.some((participant) => participant.userId === viewer.userId)) {
          throw new Error('You already joined this mini-game.');
        }
        if (game.participants.length >= game.maxPlayers) {
          throw new Error('The mini-game is full.');
        }
        game.participants.push({
          id: this.nextId(state, 'participant'),
          userId: viewer.userId,
          displayName: viewer.displayName,
          joinPosition:
            Math.max(0, ...game.participants.map((participant) => participant.joinPosition)) + 1,
          joinedAt: this.now(),
          cards: this.draw(game, 2).map((code, index) => ({ position: index + 1, code })),
          equity: null,
        });
        this.advance(game);
        break;
      case 'remove':
        this.assertCreator(game, viewer);
        this.assertOpen(game);
        game.participants = game.participants.filter(
          (participant) => participant.id !== request.participantId,
        );
        this.advance(game);
        break;
      case 'reshuffle':
        this.assertCreator(game, viewer);
        this.assertOpen(game);
        game.board = [];
        game.participants.forEach((participant) => {
          participant.cards = [];
          participant.equity = null;
        });
        game.participants.forEach((participant) => {
          participant.cards = this.draw(game, 2).map((code, index) => ({
            position: index + 1,
            code,
          }));
        });
        this.advance(game);
        break;
      case 'start':
        this.assertCreator(game, viewer);
        this.assertOpen(game);
        if (game.participants.length < game.minPlayers) {
          throw new Error('Not enough players have joined this mini-game.');
        }
        game.board = this.draw(game, 3).map((code, index) => ({ position: index + 1, code }));
        game.status = 'FLOP';
        this.advance(game);
        break;
      case 'reveal-turn':
        this.assertCreator(game, viewer);
        if (game.status !== 'FLOP') {
          throw new Error('The turn can only be revealed after the flop.');
        }
        game.board.push({ position: 4, code: this.draw(game, 1)[0] });
        game.status = 'TURN';
        this.advance(game);
        break;
      case 'reveal-river': {
        this.assertCreator(game, viewer);
        if (game.status !== 'TURN') {
          throw new Error('The river can only be revealed after the turn.');
        }
        game.board.push({ position: 5, code: this.draw(game, 1)[0] });
        game.status = 'COMPLETE';
        game.completedAt = this.now();
        this.advance(game);
        const result = evaluateCompletedLocalGame(
          game.participants,
          game.board.map((card) => card.code),
          game.stateVersion,
          this.now(),
        );
        game.participants.forEach((participant, index) => {
          participant.equity = result.equities[index];
        });
        game.winnerParticipantIds = result.winnerParticipantIds;
        game.equityVersion = game.stateVersion;
        game.equityStatus = 'READY';
        break;
      }
      case 'archive':
        this.assertCreator(game, viewer);
        if (
          game.status !== 'COMPLETE' ||
          game.equityStatus !== 'READY' ||
          game.equityVersion !== game.stateVersion
        ) {
          throw new Error('Only a completed mini-game with a final winner can be completed.');
        }
        game.isCurrent = false;
        game.archivedAt = this.now();
        game.updatedAt = this.now();
        break;
      case 'delete':
        this.assertCreator(game, viewer);
        if (!['OPEN', 'COMPLETE'].includes(game.status)) {
          throw new Error('A running mini-game cannot be deleted.');
        }
        state.games = state.games.filter((candidate) => candidate.id !== game.id);
        return { ...game, isCurrent: false };
      case 'recalculate':
        if (game.status !== 'COMPLETE') {
          throw new Error('Final winner calculation is available after the river.');
        }
        break;
    }

    game.activePlayerCount = game.participants.length;
    return game;
  }

  private advance(game: MiniGameSnapshot): void {
    game.stateVersion += 1;
    game.equityVersion = 0;
    game.equityStatus = 'PENDING';
    game.updatedAt = this.now();
    game.winnerParticipantIds = [];
    game.participants.forEach((participant) => {
      participant.equity = null;
    });
    game.activePlayerCount = game.participants.length;
  }

  private draw(game: MiniGameSnapshot, count: number): string[] {
    const usedCards = new Set([
      ...game.board.map((card) => card.code),
      ...game.participants.flatMap((participant) => participant.cards.map((card) => card.code)),
    ]);
    const available = deck.filter((card) => !usedCards.has(card));

    for (let index = available.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
    }

    if (available.length < count) {
      throw new Error('Not enough cards remain in the deck.');
    }

    return available.slice(0, count);
  }

  private assertCreator(game: MiniGameSnapshot, viewer: MiniGameLocalViewer): void {
    if (viewer.role !== 'HOST' || game.creatorHostId !== viewer.userId) {
      throw new Error('Only the creator host can manage this mini-game.');
    }
  }

  private assertOpen(game: MiniGameSnapshot): void {
    if (game.status !== 'OPEN') {
      throw new Error('Joining is closed after the mini-game starts.');
    }
  }

  private validateSettings(name: string, minPlayers: number, maxPlayers: number): void {
    const cleanName = name.trim();

    if (cleanName.length < 2 || cleanName.length > 40) {
      throw new Error('Mini-game name must be between 2 and 40 characters.');
    }

    if (
      !Number.isInteger(minPlayers) ||
      !Number.isInteger(maxPlayers) ||
      minPlayers < 2 ||
      maxPlayers > 10 ||
      minPlayers > maxPlayers
    ) {
      throw new Error('Player limits must be between 2 and 10.');
    }
  }

  private forViewer(
    game: MiniGameSnapshot,
    viewer: MiniGameLocalViewer,
    celebrationClaims: Record<string, string[]>,
  ): MiniGameSnapshot {
    const snapshot = clone(game);
    snapshot.viewerParticipantId =
      snapshot.participants.find((participant) => participant.userId === viewer.userId)?.id ?? null;
    snapshot.viewerCelebrationSeen =
      celebrationClaims[snapshot.id]?.includes(viewer.userId) ?? false;
    return snapshot;
  }

  private nextId(state: MiniGameLocalState, prefix: string): string {
    const id = `${prefix}-${state.nextId}`;
    state.nextId += 1;
    return id;
  }

  private read(): MiniGameLocalState {
    const rawState = this.storage.getItem(MINI_GAME_LOCAL_STORAGE_KEY);

    if (!rawState) {
      return { nextId: 1, games: [], celebrationClaims: {} };
    }

    try {
      const parsed = JSON.parse(rawState) as Partial<MiniGameLocalState>;
      const games = Array.isArray(parsed.games)
        ? parsed.games
            .map((game) => mapMiniGameSnapshot(game))
            .filter((game): game is MiniGameSnapshot => game !== null)
        : [];

      return {
        nextId: Number.isSafeInteger(parsed.nextId) ? Number(parsed.nextId) : 1,
        games,
        celebrationClaims:
          parsed.celebrationClaims && typeof parsed.celebrationClaims === 'object'
            ? parsed.celebrationClaims
            : {},
      };
    } catch {
      return { nextId: 1, games: [], celebrationClaims: {} };
    }
  }

  private write(state: MiniGameLocalState): void {
    const canonical: MiniGameLocalState = {
      ...state,
      games: state.games.map((game) => ({
        ...game,
        viewerParticipantId: null,
        viewerCelebrationSeen: false,
      })),
    };

    this.storage.setItem(MINI_GAME_LOCAL_STORAGE_KEY, JSON.stringify(canonical));
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asCard(code: string): Card {
  if (!cardPattern.test(code)) {
    throw new Error(`Invalid mini-game card: ${code}.`);
  }

  return code as Card;
}

function handLabel(strength: number): string {
  const labels = [
    'High Card',
    'Pair',
    'Two Pair',
    'Three of a Kind',
    'Straight',
    'Flush',
    'Full House',
    'Four of a Kind',
    'Straight Flush',
    'Straight Flush',
  ];

  return labels[strength] ?? 'Final Hand';
}
