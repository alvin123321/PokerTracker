export type RouteTransitionDirection = 'forward' | 'back';

export function routeTransitionDirection(
  navigationTrigger: string | undefined,
  currentUrl?: string,
  targetUrl?: string,
): RouteTransitionDirection {
  if (navigationTrigger === 'popstate') {
    return 'back';
  }

  return currentUrl && targetUrl && isDetailRoute(currentUrl) && !isDetailRoute(targetUrl)
    ? 'back'
    : 'forward';
}

export function shouldAnimateRouteTransition(currentUrl: string, targetUrl: string): boolean {
  return isDetailRoute(currentUrl) || isDetailRoute(targetUrl);
}

export function shouldRunRouteViewTransition(direction: string | undefined): boolean {
  return direction === 'forward' || direction === 'back';
}

function isDetailRoute(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];

  return (
    /^\/(?:host|player)\/profile$/.test(path) ||
    /^\/(?:host|player)\/mini-games\/[^/]+$/.test(path) ||
    /^\/player\/sessions\/[^/]+$/.test(path) ||
    /^\/host\/sessions\/(?!history(?:\/|$)|new(?:\/|$))[^/]+(?:\/summary)?$/.test(path)
  );
}
