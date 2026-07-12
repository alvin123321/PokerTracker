export function initialExpandedTableIds<T extends { id: string }>(tables: readonly T[]): string[] {
  return tables[0] ? [tables[0].id] : [];
}
