import { gameTimelineTransactions } from '../../host/data/session-timeline.logic';
import type { MiniGameSnapshot } from '../../mini-game/mini-game.models';

import type {
  PlayerActiveTable,
  PlayerPublicTableRosterEntry,
  PlayerPublicTableSummary,
  PokerSession,
  PokerTransaction,
  SessionPlayer,
  TimeCall
} from '../../host/data/poker-store.service';

export type PlayerCallTimeDisplayState = 'CLOCK' | 'BUTTON' | 'NONE';
export type PlayerGameStatusKind = 'ACTIVE' | 'COMPLETED';
export type PlayerGameStatMode = 'ACTIVE_GAME' | 'COMPLETED_GAME';
export type PlayerGameDetailSection = 'players' | 'timeline';

export interface PlayerCallTimePollingInput {
  activeEntryCount: number;
  supportsSharedUpdates: boolean;
  schemaReady: boolean;
}

export function joinedMiniGameHistory(games: MiniGameSnapshot[]): MiniGameSnapshot[] {
  return games.filter((game) => game.viewerParticipantId !== null);
}

export function managerSessionTipTotal(
  session: PokerSession,
  managerUserId: string | null
): number {
  if (!managerUserId) {
    return 0;
  }

  return (session.financialEntries ?? [])
    .filter(
      (entry) =>
        entry.entryType === 'TIP' &&
        entry.managerUserId === managerUserId &&
        !entry.deletedAt
    )
    .reduce((total, entry) => total + entry.amount, 0);
}

export function unseatedPlayerActiveTables(
  activeTables: PlayerActiveTable[],
  seatedTableIds: ReadonlySet<string>
): PlayerActiveTable[] {
  return activeTables
    .filter((table) => !seatedTableIds.has(table.tableId))
    .sort(
      (left, right) =>
        right.sessionDate.localeCompare(left.sessionDate) ||
        left.sessionCreatedAt.localeCompare(right.sessionCreatedAt) ||
        left.tableNumber - right.tableNumber ||
        left.tableId.localeCompare(right.tableId)
    );
}

export function playerGameDetailSections(
  mode: PlayerGameStatMode
): PlayerGameDetailSection[] {
  return mode === 'COMPLETED_GAME' ? ['timeline', 'players'] : ['players', 'timeline'];
}

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

export function playerHasSharedCallTimeClock(
  session: PokerSession,
  player: SessionPlayer,
  activeCall: TimeCall | undefined
): boolean {
  return playerCallTimeDisplayState(session, player, activeCall) === 'CLOCK';
}

export function playerGameTimeline(transactions: PokerTransaction[]): PokerTransaction[] {
  return gameTimelineTransactions(transactions);
}

export function playerGameStatusKind(
  session: PokerSession,
  player: SessionPlayer
): PlayerGameStatusKind {
  return session.status === 'ACTIVE' && player.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED';
}

export function playerGameStatMode(session: PokerSession, player: SessionPlayer): PlayerGameStatMode {
  return playerGameStatusKind(session, player) === 'ACTIVE' ? 'ACTIVE_GAME' : 'COMPLETED_GAME';
}

export function totalActivePlayers(session: PokerSession): number {
  return session.players.filter(
    (player) => player.status === 'ACTIVE' && !player.removedAt
  ).length;
}

export function totalActivePlayerChips(session: PokerSession): number {
  return session.players
    .filter((player) => player.status === 'ACTIVE' && !player.removedAt)
    .reduce((total, player) => total + player.totalBuyIn, 0);
}

export function playerPublicTableStats(
  session: PokerSession,
  player: SessionPlayer,
  summaries: PlayerPublicTableSummary[]
): { activePlayerCount: number; totalActivePlayerChips: number } {
  const publicSummary = summaries.find(
    (summary) => summary.sessionId === session.id && summary.sessionPlayerId === player.id
  );

  if (publicSummary) {
    return {
      activePlayerCount: publicSummary.activePlayerCount,
      totalActivePlayerChips: publicSummary.totalActivePlayerChips
    };
  }

  const activePlayers = session.players.filter(
    (sessionPlayer) => sessionPlayer.status === 'ACTIVE' && !sessionPlayer.removedAt
  );

  return {
    activePlayerCount: activePlayers.length,
    totalActivePlayerChips: activePlayers.reduce(
      (total, sessionPlayer) => total + sessionPlayer.totalBuyIn,
      0
    )
  };
}

export function playerPublicTableRoster(
  session: PokerSession,
  player: SessionPlayer,
  rosterEntries: PlayerPublicTableRosterEntry[]
): PlayerPublicTableRosterEntry[] {
  const publicRoster = rosterEntries.filter((entry) => entry.sessionId === session.id);
  const netLeaderByTable = new Map<string | null, { highestNet: number; leaderCount: number }>();

  const visibleSessionPlayers = session.players.filter(
    (sessionPlayer) => !sessionPlayer.removedAt
  );

  for (const sessionPlayer of visibleSessionPlayers) {
    const currentLeader = netLeaderByTable.get(sessionPlayer.tableId);

    if (!currentLeader || sessionPlayer.net > currentLeader.highestNet) {
      netLeaderByTable.set(sessionPlayer.tableId, {
        highestNet: sessionPlayer.net,
        leaderCount: 1
      });
    } else if (sessionPlayer.net === currentLeader.highestNet) {
      netLeaderByTable.set(sessionPlayer.tableId, {
        highestNet: currentLeader.highestNet,
        leaderCount: currentLeader.leaderCount + 1
      });
    }
  }

  const roster =
    publicRoster.length > 0
      ? publicRoster
      : visibleSessionPlayers.map((sessionPlayer) => ({
          sessionPlayerId: sessionPlayer.id,
          sessionId: session.id,
          tableId: sessionPlayer.tableId,
          name: sessionPlayer.name,
          status: sessionPlayer.status,
          isNetLeader:
            session.status === 'COMPLETED' &&
            sessionPlayer.net === netLeaderByTable.get(sessionPlayer.tableId)?.highestNet &&
            netLeaderByTable.get(sessionPlayer.tableId)?.leaderCount === 1
        }));

  return [...roster].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'ACTIVE' ? -1 : 1;
    }

    const nameSort = a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base'
    });

    if (nameSort !== 0) {
      return nameSort;
    }

    return a.sessionPlayerId.localeCompare(b.sessionPlayerId);
  });
}

export function playerTableDetailRoster(
  session: PokerSession,
  player: SessionPlayer,
  rosterEntries: PlayerPublicTableRosterEntry[]
): PlayerPublicTableRosterEntry[] {
  const tableRoster = playerPublicTableRoster(session, player, rosterEntries).filter(
    (entry) => entry.tableId === player.tableId
  );
  const flaggedLeaders = tableRoster.filter((entry) => entry.isNetLeader === true);
  const leaderId =
    session.status === 'COMPLETED' && flaggedLeaders.length === 1
      ? flaggedLeaders[0].sessionPlayerId
      : null;

  return tableRoster.map((entry) => ({
    ...entry,
    isNetLeader: entry.sessionPlayerId === leaderId
  }));
}

export function shouldPollPlayerCallTime(input: PlayerCallTimePollingInput): boolean {
  return input.activeEntryCount > 0 && input.supportsSharedUpdates && input.schemaReady;
}

function isActivePlayerAtActiveTable(session: PokerSession, player: SessionPlayer): boolean {
  const playerTable = session.tables.find((table) => table.id === player.tableId);

  return (
    session.status === 'ACTIVE' &&
    player.status === 'ACTIVE' &&
    (!playerTable || playerTable.status === 'ACTIVE')
  );
}
