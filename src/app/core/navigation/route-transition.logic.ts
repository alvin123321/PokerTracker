export type RouteTransitionDirection = 'forward' | 'back';

export function routeTransitionDirection(navigationTrigger: string | undefined): RouteTransitionDirection {
  return navigationTrigger === 'popstate' ? 'back' : 'forward';
}
