import type { PokerSession, SessionPlayer, TimeCall } from '../../host/data/poker-store.service';

export type PlayerCallTimeDisplayState = 'CLOCK' | 'BUTTON' | 'NONE';

export function playerCallTimeDisplayState(
  session: PokerSession,
  player: SessionPlayer,
  activeCall: TimeCall | undefined
): PlayerCallTimeDisplayState {
  if (!isActivePlayerAtActiveTable(session, player)) {
    return 'NONE';
  }

  if (activeCall) {
    return 'CLOCK';
  }

  return 'BUTTON';
}

function isActivePlayerAtActiveTable(session: PokerSession, player: SessionPlayer): boolean {
  const playerTable = session.tables.find((table) => table.id === player.tableId);

  return (
    session.status === 'ACTIVE' &&
    player.status === 'ACTIVE' &&
    (!playerTable || playerTable.status === 'ACTIVE')
  );
}
