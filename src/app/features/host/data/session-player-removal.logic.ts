import type { PokerSession } from './poker-store.service';

export function removeSessionPlayerFromSession(
  session: PokerSession,
  sessionPlayerId: string
): PokerSession {
  if (session.status !== 'ACTIVE') {
    throw new Error('Cannot remove a player from a completed session.');
  }

  return {
    ...session,
    players: session.players.filter((player) => player.id !== sessionPlayerId),
    transactions: session.transactions.filter(
      (transaction) => transaction.playerId !== sessionPlayerId
    ),
    timeCalls: (session.timeCalls ?? []).filter(
      (timeCall) => timeCall.sessionPlayerId !== sessionPlayerId
    )
  };
}
