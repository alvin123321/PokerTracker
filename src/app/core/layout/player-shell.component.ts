import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';

@Component({
  selector: 'app-player-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <a routerLink="/player/dashboard" class="text-lg font-semibold text-white">PokerTrack</a>
          <div class="flex items-center gap-2">
            <a
              routerLink="/player/dashboard"
              routerLinkActive="bg-white/10 text-white"
              class="rounded-md px-3 py-2 text-sm text-neutral-300 transition hover:text-white"
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
              class="rounded-md border border-white/10 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"
              (click)="signOut()"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <div class="mx-auto w-full max-w-5xl px-5 py-8">
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
