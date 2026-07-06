import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';

@Component({
  selector: 'app-host-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="host-shell-nav mx-auto grid max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <span aria-hidden="true" class="hidden sm:block"></span>
          <a routerLink="/host/dashboard" class="pokertrack-brand justify-self-center" aria-label="Poker Tracker dashboard">
            <span class="pokertrack-brand-mark" aria-hidden="true">
              <span class="pokertrack-brand-suit">&spades;</span>
            </span>
            <span class="pokertrack-brand-name">
              <span>Poker</span><span>Tracker</span>
            </span>
          </a>
          <div class="grid min-w-0 grid-cols-4 items-center gap-1 text-sm sm:flex sm:justify-self-end sm:gap-2 sm:overflow-x-auto">
            <a
              routerLink="/host/dashboard"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link shrink-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:px-3"
            >
              Dashboard
            </a>
            @if (authState.isHostAdmin()) {
              <a
                routerLink="/host/sessions/history"
                routerLinkActive="pokertrack-nav-link-active"
                class="pokertrack-nav-link shrink-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:px-3"
              >
                History
              </a>
              <a
                routerLink="/host/players"
                routerLinkActive="pokertrack-nav-link-active"
                class="pokertrack-nav-link shrink-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:px-3"
              >
                Member
              </a>
            }
            <button
              type="button"
              class="pokertrack-nav-link shrink-0 rounded-md border border-white/10 px-2 py-2 text-neutral-300 sm:px-3"
              (click)="signOut()"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <div class="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <router-outlet />
      </div>
    </main>
  `
})
export class HostShellComponent {
  protected readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.authState.signOut();
    await this.router.navigateByUrl('/login');
  }
}
