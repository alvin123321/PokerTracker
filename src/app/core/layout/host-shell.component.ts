import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LucideAlarmClock,
  LucideArrowLeft,
  LucideArrowLeftRight,
  LucideCalculator,
  LucideHistory,
  LucideHouse,
  LucideLogOut,
  LucideMessageCircle,
  LucideUserRound,
  LucideUsersRound
} from '@lucide/angular';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStateService } from '../auth/auth-state.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../../features/host/shared/confirmation-dialog.component';
import { displayNameInitials } from '../../features/profile/profile.logic';

@Component({
  selector: 'app-host-shell',
  imports: [
    LucideAlarmClock,
    LucideArrowLeft,
    LucideArrowLeftRight,
    LucideCalculator,
    LucideHistory,
    LucideHouse,
    LucideLogOut,
    LucideMessageCircle,
    LucideUserRound,
    LucideUsersRound,
    MatDialogModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="relative z-50 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="host-shell-nav mx-auto grid max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <a
            routerLink="/host/dashboard"
            class="chat-shell-back"
            aria-label="Back to Home"
            title="Back to Home"
          >
            <svg lucideArrowLeft [strokeWidth]="2.4" aria-hidden="true"></svg>
          </a>
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
          <div class="host-account-menu-shell" (click)="$event.stopPropagation()">
            <button
              type="button"
              class="host-account-menu-toggle"
              aria-label="Open account menu"
              aria-controls="host-account-menu"
              [attr.aria-expanded]="accountMenuOpen()"
              (click)="toggleAccountMenu()"
            >
              <span class="pokertrack-profile-avatar" aria-hidden="true">
                {{ profileInitials() }}
              </span>
            </button>

            @if (accountMenuOpen()) {
              <div id="host-account-menu" class="host-account-menu" role="menu">
                <a
                  routerLink="/host/profile"
                  class="host-account-menu-item"
                  role="menuitem"
                  (click)="closeAccountMenu()"
                >
                  <svg lucideUserRound [strokeWidth]="2.2" aria-hidden="true"></svg>
                  <span>Profile</span>
                </a>
                @if (authState.isHostAdmin()) {
                  <a
                    routerLink="/host/players"
                    class="host-account-menu-item"
                    role="menuitem"
                    (click)="closeAccountMenu()"
                  >
                    <svg lucideUsersRound [strokeWidth]="2.2" aria-hidden="true"></svg>
                    <span>Members</span>
                  </a>
                } @else if (authState.role() === 'MANAGER') {
                  <a
                    routerLink="/player/dashboard"
                    class="host-account-menu-item"
                    role="menuitem"
                    (click)="closeAccountMenu()"
                  >
                    <svg lucideArrowLeftRight [strokeWidth]="2.2" aria-hidden="true"></svg>
                    <span>My Games</span>
                  </a>
                }
                <button
                  type="button"
                  class="host-account-menu-item host-account-signout"
                  role="menuitem"
                  [disabled]="signingOut()"
                  (click)="signOut()"
                >
                  <svg lucideLogOut [strokeWidth]="2.2" aria-hidden="true"></svg>
                  <span>{{ signingOut() ? 'Signing out...' : 'Sign out' }}</span>
                </button>
              </div>
            }
          </div>
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
              routerLink="/host/chat"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
            >
              Chat
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
        <a
          routerLink="/host/chat"
          routerLinkActive="host-mobile-tab-active"
          class="host-mobile-tab"
          aria-label="Chat"
        >
          <svg
            lucideMessageCircle
            class="pokertrack-nav-icon"
            [strokeWidth]="3"
            [absoluteStrokeWidth]="true"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">Chat</span>
        </a>
        @if (authState.isHostAdmin()) {
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
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly accountMenuOpen = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly profileName = computed(
    () => this.authState.profile()?.displayName ?? 'Profile'
  );
  protected readonly profileInitials = computed(() => displayNameInitials(this.profileName()));

  @HostListener('document:click')
  protected closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeAccountMenuFromKeyboard(): void {
    this.closeAccountMenu();
  }

  protected toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
  }

  protected async signOut(): Promise<void> {
    this.closeAccountMenu();
    const data: ConfirmationDialogData = {
      title: 'Sign out?',
      message: 'You will need to sign in again before using PokerTracker.',
      confirmLabel: 'Sign out',
      tone: 'danger'
    };
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        data,
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    if (!Boolean(await firstValueFrom(dialogRef.afterClosed()))) {
      return;
    }

    try {
      this.signingOut.set(true);
      await this.authState.signOut();
      await this.router.navigateByUrl('/login');
    } finally {
      this.signingOut.set(false);
    }
  }
}
