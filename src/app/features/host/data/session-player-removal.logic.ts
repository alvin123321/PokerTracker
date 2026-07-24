import type { PokerSession } from './poker-store.service';

export interface SessionPlayerRemovalAudit {
  removedAt: string;
  removedBy: string;
  removedByName: string;
}

export function removeSessionPlayerFromSession(
  session: PokerSession,
  sessionPlayerId: string,
  audit: SessionPlayerRemovalAudit
): PokerSession {
  if (session.status !== 'ACTIVE') {
    throw new Error('Cannot remove a player from a completed session.');
  }

  return {
    ...session,
    players: session.players.map((player) =>
      player.id === sessionPlayerId
        ? {
            ...player,
            removedAt: audit.removedAt,
            removedBy: audit.removedBy,
            removedByName: audit.removedByName
          }
        : player
    ),
    timeCalls: (session.timeCalls ?? []).filter(
      (timeCall) => timeCall.sessionPlayerId !== sessionPlayerId
    )
  };
}
