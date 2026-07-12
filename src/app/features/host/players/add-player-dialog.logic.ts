export function sortRegisteredPlayerOptions<T extends { id: string }>(
  players: T[],
  sessionMemberUserIds: readonly string[]
): T[] {
  const sessionMembers = new Set(sessionMemberUserIds);

  return [...players].sort(
    (left, right) => Number(sessionMembers.has(left.id)) - Number(sessionMembers.has(right.id))
  );
}
