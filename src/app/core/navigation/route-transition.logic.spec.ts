import { routeTransitionDirection, shouldAnimateRouteTransition } from './route-transition.logic';

describe('routeTransitionDirection', () => {
  it('uses a backward page turn for browser history navigation', () => {
    expect(routeTransitionDirection('popstate')).toBe('back');
  });

  it('uses a backward direction when leaving a session summary for history', () => {
    expect(
      routeTransitionDirection('imperative', '/host/sessions/session-123/summary', '/host/sessions/history')
    ).toBe('back');
  });
});

describe('shouldAnimateRouteTransition', () => {
  it('does not animate shell tab changes', () => {
    expect(shouldAnimateRouteTransition('/host/dashboard', '/host/players')).toBeFalse();
  });

  it('animates entering a session detail page', () => {
    expect(shouldAnimateRouteTransition('/host/sessions/history', '/host/sessions/session-123')).toBeTrue();
  });

  it('animates returning from a detail page', () => {
    expect(shouldAnimateRouteTransition('/host/sessions/session-123', '/host/sessions/history')).toBeTrue();
  });
});
