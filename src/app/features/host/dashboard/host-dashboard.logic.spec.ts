import {
  groupDashboardTablePlayers,
  sortDashboardTablePlayers,
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

describe('host dashboard table player sorting', () => {
  it('sorts active players alphabetically and keeps cashed-out players at the bottom', () => {
    const sorted = sortDashboardTablePlayers([
      { id: '4', name: 'Maxi', status: 'COMPLETED' },
      { id: '2', name: 'alvin', status: 'ACTIVE' },
      { id: '5', name: 'Gene', status: 'COMPLETED' },
      { id: '1', name: '1010', status: 'ACTIVE' },
      { id: '3', name: 'kevin', status: 'ACTIVE' }
    ]);

    expect(sorted.map((player) => player.name)).toEqual(['1010', 'alvin', 'kevin', 'Gene', 'Maxi']);
  });

  it('groups active and cashed-out players after sorting each group alphabetically', () => {
    const groups = groupDashboardTablePlayers([
      { id: '4', name: 'Maxi', status: 'COMPLETED' },
      { id: '2', name: 'alvin', status: 'ACTIVE' },
      { id: '5', name: 'Gene', status: 'COMPLETED' },
      { id: '1', name: '1010', status: 'ACTIVE' },
      { id: '3', name: 'kevin', status: 'ACTIVE' }
    ]);

    expect(groups.activePlayers.map((player) => player.name)).toEqual(['1010', 'alvin', 'kevin']);
    expect(groups.cashedOutPlayers.map((player) => player.name)).toEqual(['Gene', 'Maxi']);
  });

  it('sorts cashed-out players by net from highest to lowest', () => {
    const sorted = sortDashboardTablePlayers([
      { id: 'low', name: 'Alpha', status: 'COMPLETED', net: -100 },
      { id: 'high', name: 'Zebra', status: 'COMPLETED', net: 250 },
      { id: 'active', name: 'Active', status: 'ACTIVE', net: -50 }
    ]);

    expect(sorted.map((player) => player.id)).toEqual(['active', 'high', 'low']);
  });
});
