import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthStateService } from './auth-state.service';

const returnUrlFromSegments = (segments: { path: string }[]) =>
  `/${segments.map((segment) => segment.path).join('/')}`;

export const authGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  await authState.initialize();

  if (authState.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: returnUrlFromSegments(segments) }
  });
};

export const loginGuard: CanMatchFn = async () => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  await authState.initialize();

  if (!authState.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([authState.redirectPathForProfile()]);
};
