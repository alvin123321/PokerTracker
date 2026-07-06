import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';

@Component({
  selector: 'app-player-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="mx-auto flex max-w-5xl flex-col items-stretch gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <a routerLink="/player/dashboard" class="shrink-0 text-lg font-semibold text-white">PokerTrack</a>
          <div class="grid min-w-0 grid-cols-2 items-center gap-1 sm:flex sm:gap-2 sm:overflow-x-auto">
            <a
              routerLink="/player/dashboard"
              routerLinkActive="bg-white/10 text-white"
              class="shrink-0 rounded-md px-2.5 py-2 text-center text-sm text-neutral-300 transition hover:text-white sm:px-3"
            >
              My Sessions
            </a>
            @if (authState.profile(); as profile) {
              <span class="hidden rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-sm font-semibold text-sky-100 sm:inline-flex">
                {{ profile.displayName ?? 'Player' }}
              </span>
            }
            <button
              type="button"
              class="shrink-0 rounded-md border border-white/10 px-2.5 py-2 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white sm:px-3"
              (click)="signOut()"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <div class="mx-auto w-full max-w-5xl px-3 py-5 sm:px-5 sm:py-8">
        <router-outlet />
      </div>
    </main>
  `
})
export class PlayerShellComponent {
  protected readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.authState.signOut();
    await this.router.navigateByUrl('/login');
  }
}
