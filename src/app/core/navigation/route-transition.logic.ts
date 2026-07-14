export type RouteTransitionDirection = 'forward' | 'back';

export function routeTransitionDirection(navigationTrigger: string | undefined): RouteTransitionDirection {
  return navigationTrigger === 'popstate' ? 'back' : 'forward';
}

export function shouldAnimateRouteTransition(currentUrl: string, targetUrl: string): boolean {
  return isDetailRoute(currentUrl) || isDetailRoute(targetUrl);
}

function isDetailRoute(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];

  return (
    /^\/(?:host|player)\/profile$/.test(path) ||
    /^\/player\/sessions\/[^/]+$/.test(path) ||
    /^\/host\/sessions\/(?!history(?:\/|$)|new(?:\/|$))[^/]+(?:\/summary)?$/.test(path)
  );
}
