interface RegisteredPlayerIdentity {
  id: string;
  username?: string;
  displayName?: string | null;
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
