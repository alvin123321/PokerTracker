import type { PokerSession } from './poker-store.service';

export function removeSessionTableFromSession(
  session: PokerSession,
  tableId: string
): PokerSession {
  if (session.status !== 'ACTIVE') {
    throw new Error('Cannot delete a table from a completed session.');
  }

  const removedPlayerIds = new Set(
    session.players.filter((player) => player.tableId === tableId).map((player) => player.id)
  );

  return {
    ...session,
    tables: session.tables.filter((table) => table.id !== tableId),
    players: session.players.filter((player) => player.tableId !== tableId),
    transactions: session.transactions.filter(
      (transaction) =>
        transaction.tableId !== tableId && !removedPlayerIds.has(transaction.playerId)
    ),
    timeCalls: (session.timeCalls ?? []).filter(
      (timeCall) => !removedPlayerIds.has(timeCall.sessionPlayerId)
    )
  };
}
