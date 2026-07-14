import { Component, computed, inject } from '@angular/core';
import {
  LucideAlarmClock,
  LucideCalculator,
  LucideHistory,
  LucideHouse,
  LucideUsersRound
} from '@lucide/angular';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';
import { displayNameInitials } from '../../features/profile/profile.logic';

@Component({
  selector: 'app-host-shell',
  imports: [
    LucideAlarmClock,
    LucideCalculator,
    LucideHistory,
    LucideHouse,
    LucideUsersRound,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="host-shell-nav mx-auto grid max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <a
            routerLink="/host/dashboard"
            class="pokertrack-brand host-shell-brand justify-self-center"
            aria-label="Poker Tracker dashboard"
          >
            <span class="pokertrack-brand-mark" aria-hidden="true">
              <span class="pokertrack-brand-suit">&spades;</span>
            </span>
            <span class="pokertrack-brand-name">
              <span>Poker</span><span>Tracker</span>
            </span>
          </a>
          <a routerLink="/host/profile" class="pokertrack-profile-chip" aria-label="Profile">
            <span class="pokertrack-profile-avatar">{{ profileInitials() }}</span>
            <span class="pokertrack-profile-name">{{ profileName() }}</span>
          </a>
          <div class="host-shell-desktop-nav hidden min-w-0 items-center gap-2 text-sm sm:flex sm:justify-self-end">
            <a
              routerLink="/host/dashboard"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
            >
              Dashboard
            </a>
            <a
              routerLink="/host/session-overview"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
            >
              Session Overview
            </a>
            <a
              routerLink="/host/pot-calculator"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
            >
              Calculator
            </a>
            @if (authState.isHostAdmin()) {
              <a
                routerLink="/host/sessions/history"
                routerLinkActive="pokertrack-nav-link-active"
                class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
              >
                History
              </a>
              <a
                routerLink="/host/players"
                routerLinkActive="pokertrack-nav-link-active"
                class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
              >
                Member
              </a>
            }
          </div>
        </nav>
      </header>

      <div class="pokertrack-route-content mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <router-outlet />
      </div>

      <nav class="host-mobile-tabs sm:hidden" aria-label="Host navigation">
        <a
          routerLink="/host/dashboard"
          routerLinkActive="host-mobile-tab-active"
          class="host-mobile-tab"
          aria-label="Dashboard"
        >
          <svg
            lucideHouse
            class="pokertrack-nav-icon"
            [strokeWidth]="3"
            [absoluteStrokeWidth]="true"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">Dashboard</span>
        </a>
        <a
          routerLink="/host/session-overview"
          routerLinkActive="host-mobile-tab-active"
          class="host-mobile-tab"
          aria-label="Clock"
        >
          <svg
            lucideAlarmClock
            class="pokertrack-nav-icon"
            [strokeWidth]="3"
            [absoluteStrokeWidth]="true"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">Clock</span>
        </a>
        <a
          routerLink="/host/pot-calculator"
          routerLinkActive="host-mobile-tab-active"
          class="host-mobile-tab"
          aria-label="Pot Calculator"
        >
          <svg
            lucideCalculator
            class="pokertrack-nav-icon"
            [strokeWidth]="3"
            [absoluteStrokeWidth]="true"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">Pot Calculator</span>
        </a>
        @if (authState.isHostAdmin()) {
          <a
            routerLink="/host/players"
            routerLinkActive="host-mobile-tab-active"
            class="host-mobile-tab"
            aria-label="Players"
          >
            <svg
              lucideUsersRound
              class="pokertrack-nav-icon"
              [strokeWidth]="3"
              [absoluteStrokeWidth]="true"
              aria-hidden="true"
            ></svg>
            <span class="sr-only">Players</span>
          </a>
          <a
            routerLink="/host/sessions/history"
            routerLinkActive="host-mobile-tab-active"
            class="host-mobile-tab"
            aria-label="History"
          >
            <svg
              lucideHistory
              class="pokertrack-nav-icon"
              [strokeWidth]="3"
              [absoluteStrokeWidth]="true"
              aria-hidden="true"
            ></svg>
            <span class="sr-only">History</span>
          </a>
        }
      </nav>
    </main>
  `
})
export class HostShellComponent {
  protected readonly authState = inject(AuthStateService);
  protected readonly profileName = computed(
    () => this.authState.profile()?.displayName ?? 'Profile'
  );
  protected readonly profileInitials = computed(() => displayNameInitials(this.profileName()));
}
