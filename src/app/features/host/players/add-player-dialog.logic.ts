interface RegisteredPlayerIdentity {
  id: string;
  username?: string;
  displayName?: string | null;
}

export type AddPlayerSearchResult<T extends RegisteredPlayerIdentity> =
  | { kind: 'empty' }
  | { kind: 'existing'; player: T }
  | { kind: 'already-in-game'; player: T }
  | { kind: 'new'; name: string };

export function resolveAddPlayerSearch<T extends RegisteredPlayerIdentity>(
  players: readonly T[],
  search: string,
  sessionMemberUserIds: readonly string[],
  sessionMemberNames: readonly string[] = []
): AddPlayerSearchResult<T> {
  const name = search.trim();

  if (!name) {
    return { kind: 'empty' };
  }

  const normalizedName = normalizePlayerName(name);
  const player = players.find((option) =>
    [option.displayName, option.username]
      .filter((label): label is string => Boolean(label?.trim()))
      .some((label) => normalizePlayerName(label) === normalizedName)
  );

  if (!player) {
    return { kind: 'new', name };
  }

  return isRegisteredPlayerInSession(player, sessionMemberUserIds, sessionMemberNames)
    ? { kind: 'already-in-game', player }
    : { kind: 'existing', player };
}

export function isRegisteredPlayerInSession(
  player: RegisteredPlayerIdentity,
  sessionMemberUserIds: readonly string[],
  sessionMemberNames: readonly string[] = []
): boolean {
  if (new Set(sessionMemberUserIds).has(player.id)) {
    return true;
  }

  const memberNames = new Set(sessionMemberNames.map(normalizePlayerName));
  const labels = [player.displayName, player.username]
    .filter((name): name is string => Boolean(name?.trim()))
    .map(normalizePlayerName);

  return labels.some((label) => memberNames.has(label));
}

export function sortRegisteredPlayerOptions<T extends RegisteredPlayerIdentity>(
  players: T[],
  sessionMemberUserIds: readonly string[],
  sessionMemberNames: readonly string[] = []
): T[] {
  return [...players].sort(
    (left, right) =>
      Number(isRegisteredPlayerInSession(left, sessionMemberUserIds, sessionMemberNames)) -
      Number(isRegisteredPlayerInSession(right, sessionMemberUserIds, sessionMemberNames))
  );
}

function normalizePlayerName(name: string): string {
  return name.trim().toLocaleLowerCase();
}
