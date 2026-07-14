import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { routeTransitionDirection, shouldAnimateRouteTransition } from './core/navigation/route-transition.logic';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private routeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => this.prepareRouteTransition(event.navigationTrigger, event.url));
  }

  private prepareRouteTransition(navigationTrigger: string | undefined, targetUrl: string): void {
    const window = this.document.defaultView;

    if (!window) {
      return;
    }

    if (!shouldAnimateRouteTransition(this.router.url, targetUrl)) {
      if (this.routeTransitionTimer) {
        window.clearTimeout(this.routeTransitionTimer);
        this.routeTransitionTimer = null;
      }

      delete this.document.documentElement.dataset['routeTransition'];
      return;
    }

    this.document.documentElement.dataset['routeTransition'] = routeTransitionDirection(navigationTrigger);

    if (this.routeTransitionTimer) {
      window.clearTimeout(this.routeTransitionTimer);
    }

    this.routeTransitionTimer = window.setTimeout(() => {
      delete this.document.documentElement.dataset['routeTransition'];
      this.routeTransitionTimer = null;
    }, 700);
  }
}
