import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';
import { displayNameInitials } from '../../features/profile/profile.logic';

@Component({
  selector: 'app-player-shell',
  imports: [RouterLink, RouterOutlet],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="host-shell-nav mx-auto grid max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <a
            routerLink="/player/dashboard"
            class="pokertrack-brand host-shell-brand justify-self-center"
            aria-label="Poker Tracker player dashboard"
          >
            <span class="pokertrack-brand-mark" aria-hidden="true">
              <span class="pokertrack-brand-suit">&spades;</span>
            </span>
            <span class="pokertrack-brand-name">
              <span>Poker</span><span>Tracker</span>
            </span>
          </a>
          <a routerLink="/player/profile" class="pokertrack-profile-chip" aria-label="Profile">
            <span class="pokertrack-profile-avatar">{{ profileInitials() }}</span>
            <span class="pokertrack-profile-name">{{ profileName() }}</span>
          </a>
        </nav>
      </header>

      <div class="pokertrack-route-content mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <router-outlet />
      </div>
    </main>
  `,
  styles: [
    `
      main {
        overflow-x: clip;
      }
    `
  ]
})
export class PlayerShellComponent {
  protected readonly authState = inject(AuthStateService);
  protected readonly profileName = computed(
    () => this.authState.profile()?.displayName ?? 'Profile'
  );
  protected readonly profileInitials = computed(() => displayNameInitials(this.profileName()));
}
