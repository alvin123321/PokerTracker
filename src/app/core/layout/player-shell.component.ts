import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthStateService } from '../auth/auth-state.service';

@Component({
  selector: 'app-player-shell',
  imports: [RouterLink, RouterOutlet],
  template: `
    <main class="player-shell min-h-dvh text-neutral-100">
      <header class="player-shell-header">
        <nav class="player-shell-nav mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-3 py-3 sm:px-5 sm:py-4">
          <span aria-hidden="true"></span>
          <a routerLink="/player/dashboard" class="player-shell-brand" aria-label="PokerTracker player dashboard">
            <span class="player-shell-brand-mark">&spades;</span>
            <span class="player-shell-brand-text">Poker<span>Tracker</span></span>
          </a>
          <button type="button" class="player-shell-signout justify-self-end" (click)="signOut()">
            Sign out
          </button>
        </nav>
      </header>

      <div class="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-8">
        <router-outlet />
      </div>
    </main>
  `,
  styles: [
    `
      .player-shell {
        background:
          radial-gradient(circle at 50% 0%, rgb(34 197 94 / 0.16), transparent 34rem),
          radial-gradient(circle at 12% 18%, rgb(16 185 129 / 0.1), transparent 20rem),
          #030807;
      }

      .player-shell-header {
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        background: rgb(3 8 7 / 0.86);
        backdrop-filter: blur(18px);
      }

      .player-shell-brand {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        color: white;
        text-decoration: none;
        transform-origin: center;
        transition:
          transform 180ms ease,
          filter 180ms ease;
      }

      .player-shell-brand:hover {
        filter: drop-shadow(0 0 18px rgb(34 197 94 / 0.32));
        transform: translateY(-1px);
      }

      .player-shell-brand-mark {
        display: inline-grid;
        height: 2.35rem;
        width: 2.35rem;
        place-items: center;
        border: 1px solid rgb(34 197 94 / 0.48);
        border-radius: 0.7rem;
        background:
          linear-gradient(145deg, rgb(34 197 94 / 0.28), rgb(3 8 7 / 0.9)),
          rgb(3 8 7 / 0.92);
        box-shadow: 0 0 22px rgb(34 197 94 / 0.18);
        color: rgb(74 222 128);
        font-size: 1.75rem;
        line-height: 1;
      }

      .player-shell-brand-text {
        font-size: clamp(1.45rem, 5vw, 2rem);
        font-weight: 800;
        letter-spacing: 0;
        text-shadow: 0 8px 24px rgb(0 0 0 / 0.48);
      }

      .player-shell-brand-text span {
        color: rgb(34 197 94);
      }

      .player-shell-signout {
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 999px;
        background: rgb(255 255 255 / 0.04);
        color: rgb(212 212 216);
        font-size: 0.82rem;
        font-weight: 700;
        padding: 0.58rem 0.78rem;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          color 180ms ease,
          transform 180ms ease;
      }

      .player-shell-signout:hover {
        border-color: rgb(34 197 94 / 0.45);
        background: rgb(34 197 94 / 0.1);
        color: white;
        transform: translateY(-1px);
      }

      .player-shell-signout:active {
        transform: translateY(0) scale(0.98);
      }

      @media (max-width: 430px) {
        .player-shell-signout {
          font-size: 0;
          height: 2.2rem;
          width: 2.2rem;
          padding: 0;
          position: relative;
        }

        .player-shell-signout::before {
          content: '<';
          font-size: 1rem;
          line-height: 1;
        }
      }
    `
  ]
})
export class PlayerShellComponent {
  protected readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.authState.signOut();
    await this.router.navigateByUrl('/login');
  }
}
