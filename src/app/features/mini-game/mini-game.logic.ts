import {
  MiniGameBoardSlot,
  MiniGameCard,
  MiniGameEquity,
  MiniGameEquityStatus,
  MiniGameHistoryView,
  MiniGameParticipant,
  MiniGameSnapshot,
  MiniGameStatus,
  MiniGameViewerRole,
} from './mini-game.models';

const cardCodePattern = /^[2-9TJQKA][cdhs]$/;
const miniGameStatuses = new Set<MiniGameStatus>(['OPEN', 'FLOP', 'TURN', 'COMPLETE']);
const equityStatuses = new Set<MiniGameEquityStatus>(['PENDING', 'READY', 'ERROR']);

export function mapMiniGameSnapshot(value: unknown): MiniGameSnapshot | null {
  if (value === null || value === undefined) {
    return null;
  }

  const row = asRecord(value, 'Mini-game snapshot');
  const status = requiredString(row, 'status') as MiniGameStatus;
  const equityStatus = requiredString(row, 'equityStatus') as MiniGameEquityStatus;

  if (!miniGameStatuses.has(status)) {
    throw new Error('Mini-game snapshot has an invalid status.');
  }

  if (!equityStatuses.has(equityStatus)) {
    throw new Error('Mini-game snapshot has an invalid equity status.');
  }

  const board = requiredArray(row, 'board')
    .map((card) => mapCard(card, 'board card'))
    .sort((left, right) => left.position - right.position);
  const participants = requiredArray(row, 'participants')
    .map(mapParticipant)
    .sort((left, right) => left.joinPosition - right.joinPosition);

  validateBoard(status, board);
  validatePublicCards(board, participants);

  return {
    id: requiredString(row, 'id'),
    creatorHostId: requiredString(row, 'creatorHostId'),
    name: requiredString(row, 'name'),
    minPlayers: requiredInteger(row, 'minPlayers'),
    maxPlayers: requiredInteger(row, 'maxPlayers'),
    status,
    isCurrent: requiredBoolean(row, 'isCurrent'),
    stateVersion: requiredInteger(row, 'stateVersion'),
    equityVersion: requiredInteger(row, 'equityVersion'),
    equityStatus,
    createdAt: requiredString(row, 'createdAt'),
    updatedAt: requiredString(row, 'updatedAt'),
    completedAt: optionalString(row, 'completedAt'),
    archivedAt: optionalString(row, 'archivedAt'),
    activePlayerCount: requiredInteger(row, 'activePlayerCount'),
    viewerParticipantId: optionalString(row, 'viewerParticipantId'),
    viewerCelebrationSeen: requiredBoolean(row, 'viewerCelebrationSeen'),
    board,
    participants,
    winnerParticipantIds: requiredArray(row, 'winnerParticipantIds').map((id) =>
      stringValue(id, 'winner participant id'),
    ),
  };
}

export function canManageMiniGame(
  snapshot: MiniGameSnapshot,
  userId: string | null | undefined,
  role: MiniGameViewerRole | null | undefined,
): boolean {
  return role === 'HOST' && Boolean(userId) && snapshot.creatorHostId === userId;
}

export function isMiniGameEquityFresh(snapshot: MiniGameSnapshot): boolean {
  if (snapshot.equityStatus !== 'READY' || snapshot.equityVersion !== snapshot.stateVersion) {
    return false;
  }

  return snapshot.participants.every(
    (participant) => participant.equity?.stateVersion === snapshot.stateVersion,
  );
}

export function canClaimMiniGameCelebration(snapshot: MiniGameSnapshot): boolean {
  return (
    snapshot.status === 'COMPLETE' &&
    Boolean(snapshot.viewerParticipantId) &&
    !snapshot.viewerCelebrationSeen &&
    snapshot.winnerParticipantIds.length > 0 &&
    isMiniGameEquityFresh(snapshot)
  );
}

export function shouldApplyMiniGameSnapshotResponse(
  current: MiniGameSnapshot | null,
  incoming: MiniGameSnapshot | null,
  responseOrder: number,
  lastAppliedOrder: number,
): boolean {
  if (current && incoming && current.id === incoming.id) {
    if (incoming.stateVersion !== current.stateVersion) {
      return incoming.stateVersion > current.stateVersion;
    }

    const equityRank: Record<MiniGameEquityStatus, number> = {
      ERROR: 0,
      PENDING: 1,
      READY: 2,
    };
    const incomingRank = equityRank[incoming.equityStatus];
    const currentRank = equityRank[current.equityStatus];

    if (incomingRank !== currentRank) {
      return incomingRank > currentRank;
    }
  }

  return responseOrder >= lastAppliedOrder;
}

export function miniGameBoardSlots(snapshot: MiniGameSnapshot): MiniGameBoardSlot[] {
  const cardsByPosition = new Map(snapshot.board.map((card) => [card.position, card]));

  return Array.from({ length: 5 }, (_, index) => ({
    position: index + 1,
    card: cardsByPosition.get(index + 1) ?? null,
  }));
}

export function normalizeMiniGamePercentages(shares: number[]): number[] {
  if (shares.length === 0) {
    return [];
  }

  if (shares.some((share) => !Number.isFinite(share) || share < 0)) {
    throw new Error('Mini-game equity shares must be finite, non-negative numbers.');
  }

  const total = shares.reduce((sum, share) => sum + share, 0);
  const normalized =
    total > 0 ? shares.map((share) => share / total) : shares.map(() => 1 / shares.length);
  const scaled = normalized.map((share) => share * 1000);
  const tenths = scaled.map(Math.floor);
  let remaining = 1000 - tenths.reduce((sum, value) => sum + value, 0);
  const remainderOrder = scaled
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let index = 0; index < remaining; index += 1) {
    tenths[remainderOrder[index % remainderOrder.length].index] += 1;
  }

  return tenths.map((value) => value / 10);
}

export function miniGameEquityPercentage(
  equity: MiniGameEquity | null,
  stateVersion: number,
  equityFresh: boolean,
): number | null {
  if (
    !equityFresh ||
    !equity ||
    equity.stateVersion !== stateVersion ||
    !Number.isFinite(equity.percentage) ||
    equity.percentage < 0 ||
    equity.percentage > 100
  ) {
    return null;
  }

  return equity.percentage;
}

export function miniGameHistoryViewFromQuery(value: string | null): MiniGameHistoryView {
  return value === 'mini-games' ? 'mini-games' : 'tables';
}

export function miniGameWinnerParticipants(snapshot: MiniGameSnapshot): MiniGameParticipant[] {
  const winnerIds = new Set(snapshot.winnerParticipantIds);
  return snapshot.participants.filter((participant) => winnerIds.has(participant.id));
}

function mapParticipant(value: unknown): MiniGameParticipant {
  const row = asRecord(value, 'Mini-game participant');
  const cards = requiredArray(row, 'cards')
    .map((card) => mapCard(card, 'participant card'))
    .sort((left, right) => left.position - right.position);

  if (cards.length !== 2 || cards[0]?.position !== 1 || cards[1]?.position !== 2) {
    throw new Error('Every active mini-game participant must have two public cards.');
  }

  return {
    id: requiredString(row, 'id'),
    userId: requiredString(row, 'userId'),
    displayName: requiredString(row, 'displayName'),
    joinPosition: requiredInteger(row, 'joinPosition'),
    joinedAt: requiredString(row, 'joinedAt'),
    cards,
    equity: row['equity'] === null || row['equity'] === undefined ? null : mapEquity(row['equity']),
  };
}

function mapEquity(value: unknown): MiniGameEquity {
  const row = asRecord(value, 'Mini-game equity');

  return {
    stateVersion: requiredInteger(row, 'stateVersion'),
    share: requiredNumber(row, 'share'),
    percentage: requiredNumber(row, 'percentage'),
    wins: requiredInteger(row, 'wins'),
    ties: requiredInteger(row, 'ties'),
    totalOutcomes: requiredInteger(row, 'totalOutcomes'),
    finalHandLabel: optionalString(row, 'finalHandLabel'),
    calculatedAt: requiredString(row, 'calculatedAt'),
  };
}

function mapCard(value: unknown, label: string): MiniGameCard {
  const row = asRecord(value, label);
  const position = requiredInteger(row, 'position');
  const code = requiredString(row, 'code');

  if (!cardCodePattern.test(code)) {
    throw new Error(`Mini-game snapshot contains an invalid card: ${code}.`);
  }

  return { position, code };
}

function validateBoard(status: MiniGameStatus, board: MiniGameCard[]): void {
  const expectedCount: Record<MiniGameStatus, number> = {
    OPEN: 0,
    FLOP: 3,
    TURN: 4,
    COMPLETE: 5,
  };

  if (
    board.length !== expectedCount[status] ||
    board.some((card, index) => card.position !== index + 1)
  ) {
    throw new Error('Mini-game snapshot board does not match its status.');
  }
}

function validatePublicCards(board: MiniGameCard[], participants: MiniGameParticipant[]): void {
  const codes = [
    ...board.map((card) => card.code),
    ...participants.flatMap((participant) => participant.cards.map((card) => card.code)),
  ];

  if (new Set(codes).size !== codes.length) {
    throw new Error('Mini-game snapshot contains duplicate cards.');
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value as Record<string, unknown>;
}

function requiredArray(row: Record<string, unknown>, key: string): unknown[] {
  const value = row[key];

  if (!Array.isArray(value)) {
    throw new Error(`Mini-game snapshot field ${key} must be an array.`);
  }

  return value;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  return stringValue(row[key], `Mini-game snapshot field ${key}`);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function optionalString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  return stringValue(value, `Mini-game snapshot field ${key}`);
}

function requiredBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];

  if (typeof value !== 'boolean') {
    throw new Error(`Mini-game snapshot field ${key} must be a boolean.`);
  }

  return value;
}

function requiredInteger(row: Record<string, unknown>, key: string): number {
  const value = requiredNumber(row, key);

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Mini-game snapshot field ${key} must be an integer.`);
  }

  return value;
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const rawValue = row[key];
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Mini-game snapshot field ${key} must be numeric.`);
  }

  return value;
}
