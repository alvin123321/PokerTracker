export interface ActiveSessionsEmptyStateInput {
  activeSessionCount: number;
  sessionsLoaded: boolean;
  initialLoadingWindowExpired?: boolean;
}

export function shouldShowActiveSessionsEmptyState(input: ActiveSessionsEmptyStateInput): boolean {
  return (
    input.activeSessionCount === 0 &&
    (input.sessionsLoaded || Boolean(input.initialLoadingWindowExpired))
  );
}

export interface ActiveSessionsLoadingStateInput {
  activeSessionCount: number;
  sessionsLoaded: boolean;
  initialLoadingWindowExpired: boolean;
}

export function shouldShowActiveSessionsLoadingState(
  input: ActiveSessionsLoadingStateInput
): boolean {
  return (
    !input.sessionsLoaded &&
    input.activeSessionCount === 0 &&
    !input.initialLoadingWindowExpired
  );
}

export interface DashboardTablePlayerSortInput {
  id: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETED';
  joinedAt?: string;
}

export function sortDashboardTablePlayers<T extends DashboardTablePlayerSortInput>(
  players: T[]
): T[] {
  return [...players].sort((a, b) => {
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

    const joinedSort = (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '');

    if (joinedSort !== 0) {
      return joinedSort;
    }

    return a.id.localeCompare(b.id);
  });
}
