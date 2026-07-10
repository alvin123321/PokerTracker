export interface ActiveSessionsEmptyStateInput {
  activeSessionCount: number;
  sessionsLoaded: boolean;
}

export function shouldShowActiveSessionsEmptyState(input: ActiveSessionsEmptyStateInput): boolean {
  return input.sessionsLoaded && input.activeSessionCount === 0;
}
