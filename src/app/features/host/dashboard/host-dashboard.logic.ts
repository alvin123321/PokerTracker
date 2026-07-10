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
