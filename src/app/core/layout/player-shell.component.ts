import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LucideArrowLeft,
  LucideArrowLeftRight,
  LucideCalculator,
  LucideHistory,
  LucideHouse,
  LucideLogOut,
  LucideMessageCircle,
  LucideUserRound
} from '@lucide/angular';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStateService } from '../auth/auth-state.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../../features/host/shared/confirmation-dialog.component';
import { displayNameInitials } from '../../features/profile/profile.logic';

@Component({
  selector: 'app-player-shell',
  imports: [
    LucideArrowLeft,
    LucideArrowLeftRight,
    LucideCalculator,
    LucideHistory,
    LucideHouse,
    LucideLogOut,
    LucideMessageCircle,
    LucideUserRound,
    MatDialogModule,
    RouterLink,
    RouterOutlet
  ],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="relative z-50 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="host-shell-nav mx-auto grid max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <a
            routerLink="/player/dashboard"
            [queryParams]="{ tab: playerShellBackTab() }"
            class="chat-shell-back"
            [class.player-session-back]="isPlayerSessionDetailRoute()"
            [attr.aria-label]="playerShellBackLabel()"
            [title]="playerShellBackLabel()"
          >
            <svg lucideArrowLeft [strokeWidth]="2.4" aria-hidden="true"></svg>
          </a>
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
          <div class="host-account-menu-shell" (click)="$event.stopPropagation()">
            <button
              type="button"
              class="host-account-menu-toggle"
              aria-label="Open account menu"
              aria-controls="player-account-menu"
              [attr.aria-expanded]="accountMenuOpen()"
              (click)="toggleAccountMenu()"
            >
              <span class="pokertrack-profile-avatar" aria-hidden="true">
                {{ profileInitials() }}
              </span>
            </button>

            @if (accountMenuOpen()) {
              <div id="player-account-menu" class="host-account-menu" role="menu">
                <a
                  routerLink="/player/profile"
                  class="host-account-menu-item"
                  role="menuitem"
                  (click)="closeAccountMenu()"
                >
                  <svg lucideUserRound [strokeWidth]="2.2" aria-hidden="true"></svg>
                  <span>Profile</span>
                </a>
                @if (authState.role() === 'MANAGER') {
                  <a
                    routerLink="/host/dashboard"
                    class="host-account-menu-item"
                    role="menuitem"
                    (click)="closeAccountMenu()"
                  >
                    <svg lucideArrowLeftRight [strokeWidth]="2.2" aria-hidden="true"></svg>
                    <span>Manage Tables</span>
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
        </nav>
      </header>

      <div class="pokertrack-route-content mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <router-outlet />
      </div>

      <nav class="player-shell-tabs" aria-label="Player dashboard">
        <a
          routerLink="/player/dashboard"
          [queryParams]="{ tab: 'calculator' }"
          class="player-shell-tab"
          [class.player-shell-tab-active]="playerShellActiveTab() === 'calculator'"
          aria-label="Calculator"
          [attr.aria-selected]="playerShellActiveTab() === 'calculator'"
          title="Calculator"
        >
          <svg
            lucideCalculator
            class="pokertrack-nav-icon"
            [strokeWidth]="3"
            [absoluteStrokeWidth]="true"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">Calculator</span>
        </a>
        <a
          routerLink="/player/dashboard"
          [queryParams]="{ tab: 'overview' }"
          class="player-shell-tab"
          [class.player-shell-tab-active]="playerShellActiveTab() === 'overview'"
          aria-label="Home"
          [attr.aria-selected]="playerShellActiveTab() === 'overview'"
          title="Home"
        >
          <svg
            lucideHouse
            class="pokertrack-nav-icon"
            [strokeWidth]="3"
            [absoluteStrokeWidth]="true"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">Home</span>
        </a>
        <a
          routerLink="/player/dashboard"
          [queryParams]="{ tab: 'chat' }"
          class="player-shell-tab"
          [class.player-shell-tab-active]="playerShellActiveTab() === 'chat'"
          aria-label="Chat"
          [attr.aria-selected]="playerShellActiveTab() === 'chat'"
          title="Chat"
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
        <a
          routerLink="/player/dashboard"
          [queryParams]="{ tab: 'history' }"
          class="player-shell-tab"
          [class.player-shell-tab-active]="playerShellActiveTab() === 'history'"
          aria-label="History"
          [attr.aria-selected]="playerShellActiveTab() === 'history'"
          title="History"
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
      </nav>
    </main>
  `,
  styles: [
    `
      main {
        overflow-x: clip;
      }

      .player-shell-tabs {
        position: fixed;
        z-index: 30;
        right: 0;
        bottom: 0;
        left: 0;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.6rem;
        width: 100%;
        border-top: 1px solid rgb(255 255 255 / 0.1);
        background:
          linear-gradient(180deg, rgb(3 8 7 / 0.56), rgb(3 8 7 / 0.96)),
          rgb(3 8 7);
        box-shadow: 0 -18px 46px rgb(0 0 0 / 0.42);
        padding: 0.68rem 0.85rem calc(0.68rem + env(safe-area-inset-bottom, 0px));
        backdrop-filter: blur(20px);
        view-transition-name: pokertrack-bottom-nav;
      }

      .player-shell-tab {
        display: inline-grid;
        min-height: 3rem;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        border-radius: 0.95rem;
        color: rgb(212 212 216);
        background: rgb(255 255 255 / 0.035);
        transition: all 190ms ease;
      }

      .player-shell-tab:hover {
        background: rgb(255 255 255 / 0.055);
        color: white;
      }

      .player-shell-tab:active {
        transform: scale(0.985);
      }

      .player-shell-tab-active {
        border-color: rgb(34 197 94 / 0.55);
        background:
          linear-gradient(180deg, rgb(34 197 94 / 0.22), rgb(34 197 94 / 0.09)),
          rgb(255 255 255 / 0.045);
        box-shadow: 0 0 24px rgb(34 197 94 / 0.18);
        color: rgb(220 252 231);
      }

      @media (min-width: 640px) {
        .player-shell-tabs {
          display: none;
        }
      }
    `
  ]
})
export class PlayerShellComponent {
  protected readonly authState = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly accountMenuOpen = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly profileName = computed(
    () => this.authState.profile()?.displayName ?? 'Profile'
  );
  protected readonly profileInitials = computed(() => displayNameInitials(this.profileName()));

  protected playerShellBackTab(): 'history' | 'overview' {
    return this.isPlayerSessionDetailRoute() ? 'history' : 'overview';
  }

  protected playerShellBackLabel(): 'Back' | 'Back to Home' {
    return this.isPlayerSessionDetailRoute() ? 'Back' : 'Back to Home';
  }

  protected playerShellActiveTab(): 'calculator' | 'overview' | 'chat' | 'history' {
    const url = this.router.url;

    if (url.startsWith('/player/sessions/') || url.startsWith('/player/mini-games/')) {
      return 'history';
    }

    const tab = this.router.parseUrl(url).queryParams['tab'];
    if (tab === 'calculator' || tab === 'chat') {
      return tab;
    }

    return tab === 'history' || tab === 'sessions' ? 'history' : 'overview';
  }

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

  protected isPlayerSessionDetailRoute(): boolean {
    return this.router.url.startsWith('/player/sessions/');
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
