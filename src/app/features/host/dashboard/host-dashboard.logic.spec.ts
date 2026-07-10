import { shouldShowActiveSessionsEmptyState } from './host-dashboard.logic';

describe('host dashboard empty state', () => {
  it('does not show no-active-session while sessions are still loading for the first time', () => {
    expect(
      shouldShowActiveSessionsEmptyState({
        activeSessionCount: 0,
        sessionsLoaded: false
      })
    ).toBeFalse();
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
});
