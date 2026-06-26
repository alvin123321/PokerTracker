import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';

@Component({
  selector: 'app-host-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a routerLink="/host/dashboard" class="text-lg font-semibold text-white">PokerTrack</a>
          <div class="flex items-center gap-2 text-sm">
            <a
              routerLink="/host/dashboard"
              routerLinkActive="bg-white/10 text-white"
              class="rounded-md px-3 py-2 text-neutral-300 transition hover:text-white"
            >
              Dashboard
            </a>
            <a
              routerLink="/host/sessions/history"
              routerLinkActive="bg-white/10 text-white"
              class="rounded-md px-3 py-2 text-neutral-300 transition hover:text-white"
            >
              History
            </a>
            <a
              routerLink="/host/players"
              routerLinkActive="bg-white/10 text-white"
              class="rounded-md px-3 py-2 text-neutral-300 transition hover:text-white"
            >
              Players
            </a>
            <button
              type="button"
              class="rounded-md border border-white/10 px-3 py-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
              (click)="signOut()"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <div class="mx-auto w-full max-w-7xl px-5 py-8">
        <router-outlet />
      </div>
    </main>
  `
})
export class HostShellComponent {
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.authState.signOut();
    await this.router.navigateByUrl('/login');
  }
}
