import { DOCUMENT } from '@angular/common';
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { shouldRunRouteViewTransition } from './core/navigation/route-transition.logic';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideRouter(
      routes,
      withViewTransitions({
        onViewTransitionCreated: ({ transition }) => {
          const document = inject(DOCUMENT);

          if (!shouldRunRouteViewTransition(document.documentElement.dataset['routeTransition'])) {
            transition.skipTransition();
          }
        }
      })
    )
  ]
};
