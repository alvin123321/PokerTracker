import {
  shouldShowActiveSessionsEmptyState,
  shouldShowActiveSessionsLoadingState
} from './host-dashboard.logic';

describe('host dashboard empty state', () => {
  it('does not show no-active-session while sessions are still loading for the first time', () => {
    expect(
      shouldShowActiveSessionsEmptyState({
        activeSessionCount: 0,
        sessionsLoaded: false,
        initialLoadingWindowExpired: false
      })
    ).toBeFalse();
  });

  it('shows no-active-session after the first-load window expires even if refresh is still pending', () => {
    expect(
      shouldShowActiveSessionsEmptyState({
        activeSessionCount: 0,
        sessionsLoaded: false,
        initialLoadingWindowExpired: true
      })
    ).toBeTrue();
  });

  it('shows no-active-session after sessions load and there are no active sessions', () => {
    expect(
      shouldShowActiveSessionsEmptyState({
        activeSessionCount: 0,
        sessionsLoaded: true
      })
    ).toBeTrue();
  });

  it('does not show no-active-session when an active session exists', () => {
    expect(
      shouldShowActiveSessionsEmptyState({
        activeSessionCount: 1,
        sessionsLoaded: true
      })
    ).toBeFalse();
  });

  it('only shows the loading animation during the first-load window', () => {
    expect(
      shouldShowActiveSessionsLoadingState({
        activeSessionCount: 0,
        sessionsLoaded: false,
        initialLoadingWindowExpired: false
      })
    ).toBeTrue();

    expect(
      shouldShowActiveSessionsLoadingState({
        activeSessionCount: 0,
        sessionsLoaded: false,
        initialLoadingWindowExpired: true
      })
    ).toBeFalse();
  });
});
