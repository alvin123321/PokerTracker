export function initialExpandedTableIds<T extends { id: string }>(tables: readonly T[]): string[] {
  return tables[0] ? [tables[0].id] : [];
}

export function canModifyActiveSessionRecords(
  status: 'ACTIVE' | 'COMPLETED',
  isTableOperator: boolean
): boolean {
  return status === 'ACTIVE' && isTableOperator;
}

export function allPlayersCashedOut<
  T extends { status: 'ACTIVE' | 'COMPLETED'; removedAt?: string | null }
>(
  players: readonly T[]
): boolean {
  return players.every((player) => Boolean(player.removedAt) || player.status === 'COMPLETED');
}
