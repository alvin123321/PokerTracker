import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthStateService } from './auth-state.service';

const redirectToLogin = (router: Router, segments: { path: string }[]) =>
  router.createUrlTree(['/login'], {
    queryParams: { returnUrl: `/${segments.map((segment) => segment.path).join('/')}` }
  });

export const hostGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  await authState.initialize();

  if (!authState.isAuthenticated()) {
    return redirectToLogin(router, segments);
  }

  if (authState.isTableOperator()) {
    return true;
  }

  return router.createUrlTree(['/player/dashboard']);
};

export const hostAdminGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  await authState.initialize();

  if (!authState.isAuthenticated()) {
    return redirectToLogin(router, segments);
  }

  if (authState.isHostAdmin()) {
    return true;
  }

  return router.createUrlTree(['/host/dashboard']);
};

export const playerGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  await authState.initialize();

  if (!authState.isAuthenticated()) {
    return redirectToLogin(router, segments);
  }

  if (authState.role() === 'PLAYER' || authState.role() === 'MANAGER') {
    return true;
  }

  return router.createUrlTree(['/host/dashboard']);
};
