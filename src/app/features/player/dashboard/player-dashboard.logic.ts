import { gameTimelineTransactions } from '../../host/data/session-timeline.logic';

import type {
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
export type PlayerDashboardTab = 'overview' | 'sessions' | 'calculator';

const playerDashboardTabOrder: PlayerDashboardTab[] = ['calculator', 'overview', 'sessions'];

export function playerTabTransitionDirection(
  currentTab: PlayerDashboardTab,
  nextTab: PlayerDashboardTab
): 'forward' | 'back' {
  return playerDashboardTabOrder.indexOf(nextTab) > playerDashboardTabOrder.indexOf(currentTab)
    ? 'forward'
    : 'back';
}

export interface PlayerCallTimePollingInput {
  activeEntryCount: number;
  supportsSharedUpdates: boolean;
  schemaReady: boolean;
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
  return session.players.filter((player) => player.status === 'ACTIVE').length;
}

export function totalActivePlayerChips(session: PokerSession): number {
  return session.players
    .filter((player) => player.status === 'ACTIVE')
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
    (sessionPlayer) => sessionPlayer.status === 'ACTIVE'
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

  const roster =
    publicRoster.length > 0
      ? publicRoster
      : session.players
          .map((sessionPlayer) => ({
            sessionPlayerId: sessionPlayer.id,
            sessionId: session.id,
            tableId: sessionPlayer.tableId,
            name: sessionPlayer.name,
            status: sessionPlayer.status
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
