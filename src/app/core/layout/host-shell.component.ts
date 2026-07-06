import { Component, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LucideHistory,
  LucideHouse,
  LucideLogOut,
  LucideUsersRound
} from '@lucide/angular';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../../features/host/shared/confirmation-dialog.component';

@Component({
  selector: 'app-host-shell',
  imports: [
    LucideHistory,
    LucideHouse,
    LucideLogOut,
    LucideUsersRound,
    MatDialogModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  template: `
    <main class="min-h-dvh bg-neutral-950 text-neutral-100">
      <header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <nav class="host-shell-nav mx-auto grid max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            class="pokertrack-mobile-signout sm:hidden"
            aria-label="Sign out"
            (click)="signOut()"
          >
            <svg
              lucideLogOut
              class="pokertrack-nav-icon pokertrack-signout-left-icon"
              [strokeWidth]="3"
              [absoluteStrokeWidth]="true"
              aria-hidden="true"
            ></svg>
          </button>
          <span aria-hidden="true" class="hidden sm:block"></span>
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
          <div class="host-shell-desktop-nav hidden min-w-0 items-center gap-2 text-sm sm:flex sm:justify-self-end">
            <a
              routerLink="/host/dashboard"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
            >
              Dashboard
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
            <button
              type="button"
              class="pokertrack-nav-link min-w-0 rounded-md border border-white/10 px-2 py-2 text-neutral-300 sm:shrink-0 sm:px-3"
              (click)="signOut()"
            >
              Sign out
            </button>
          </div>
          <div class="pokertrack-mobile-tabs col-span-full grid grid-flow-col auto-cols-fr items-center gap-2 sm:hidden">
            <a
              routerLink="/host/dashboard"
              routerLinkActive="pokertrack-nav-link-active"
              class="pokertrack-nav-link pokertrack-mobile-tab"
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
            @if (authState.isHostAdmin()) {
              <a
                routerLink="/host/players"
                routerLinkActive="pokertrack-nav-link-active"
                class="pokertrack-nav-link pokertrack-mobile-tab"
                aria-label="Member"
              >
                <svg
                  lucideUsersRound
                  class="pokertrack-nav-icon"
                  [strokeWidth]="3"
                  [absoluteStrokeWidth]="true"
                  aria-hidden="true"
                ></svg>
                <span class="sr-only">Member</span>
              </a>
              <a
                routerLink="/host/sessions/history"
                routerLinkActive="pokertrack-nav-link-active"
                class="pokertrack-nav-link pokertrack-mobile-tab"
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
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected signOut(): void {
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        data: {
          title: 'Sign out?',
          message: 'You will need to sign in again before managing the table.',
          confirmLabel: 'Sign out',
          cancelLabel: 'Stay',
          tone: 'primary'
        },
        panelClass: 'pokertrack-dialog-panel'
      }
    );

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) {
        return;
      }

      await this.authState.signOut();
      await this.router.navigateByUrl('/login');
    });
  }
}
