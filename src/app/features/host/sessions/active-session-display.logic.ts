export function initialExpandedTableIds<T extends { id: string }>(tables: readonly T[]): string[] {
  return tables[0] ? [tables[0].id] : [];
}

export function allPlayersCashedOut<T extends { status: 'ACTIVE' | 'COMPLETED' }>(
  players: readonly T[]
): boolean {
  return players.every((player) => player.status === 'COMPLETED');
}
