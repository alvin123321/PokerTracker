import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { LucideArrowLeft, LucideLogOut, LucideUserRound } from '@lucide/angular';
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
    LucideLogOut,
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
            [queryParams]="{ tab: 'overview' }"
            class="chat-shell-back"
            aria-label="Back to Home"
            title="Back to Home"
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
