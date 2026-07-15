import { Component, computed, input, output } from '@angular/core';
import { LucideTrophy, LucideX } from '@lucide/angular';

import { miniGameWinnerParticipants } from './mini-game.logic';
import { MiniGameSnapshot } from './mini-game.models';

@Component({
  selector: 'app-mini-game-winner-celebration',
  imports: [LucideTrophy, LucideX],
  template: `
    <div class="winner-celebration" role="status" aria-live="polite">
      <span class="winner-sweep winner-sweep-one" aria-hidden="true"></span>
      <span class="winner-sweep winner-sweep-two" aria-hidden="true"></span>
      <button type="button" aria-label="Close winner result" (click)="dismiss.emit()">
        <svg lucideX [strokeWidth]="2.1"></svg>
      </button>
      <div class="winner-mark" aria-hidden="true">
        <svg lucideTrophy [strokeWidth]="1.8"></svg>
      </div>
      <span class="winner-kicker">{{ winners().length > 1 ? 'Split pot' : 'Winner' }}</span>
      <h2>{{ winnerNames() }}</h2>
      @if (winnerLabel(); as label) {
        <p>{{ label }}</p>
      }
      <small>{{ snapshot().name }}</small>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: grid;
        place-items: center;
        pointer-events: none;
      }

      .winner-celebration {
        position: relative;
        width: min(calc(100vw - 2rem), 23rem);
        overflow: hidden;
        border: 1px solid rgb(251 191 36 / 0.42);
        border-radius: 0.5rem;
        background: rgb(15 12 7 / 0.98);
        padding: 1.4rem 1rem 1.2rem;
        color: white;
        text-align: center;
        box-shadow:
          0 1.8rem 5rem rgb(0 0 0 / 0.72),
          0 0 2rem rgb(245 158 11 / 0.16);
        animation: winner-enter 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        pointer-events: auto;
      }

      button {
        position: absolute;
        top: 0.55rem;
        right: 0.55rem;
        z-index: 2;
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.38rem;
        background: rgb(255 255 255 / 0.04);
        color: rgb(203 213 225);
      }

      button svg {
        width: 0.9rem;
        height: 0.9rem;
      }

      .winner-mark {
        display: grid;
        width: 3.6rem;
        height: 3.6rem;
        margin: 0 auto 0.72rem;
        place-items: center;
        border: 1px solid rgb(251 191 36 / 0.44);
        border-radius: 9999px;
        background: rgb(245 158 11 / 0.12);
        color: rgb(251 191 36);
        box-shadow: 0 0 1.5rem rgb(245 158 11 / 0.2);
      }

      .winner-mark svg {
        width: 1.65rem;
        height: 1.65rem;
      }

      .winner-kicker {
        color: rgb(251 191 36);
        font-size: 0.62rem;
        font-weight: 850;
        text-transform: uppercase;
      }

      h2 {
        margin: 0.35rem 0 0;
        font-size: 1.45rem;
        line-height: 1.1;
        text-wrap: balance;
      }

      p {
        margin: 0.45rem 0 0;
        color: rgb(253 230 138);
        font-size: 0.78rem;
        font-weight: 700;
      }

      small {
        display: block;
        margin-top: 0.68rem;
        color: rgb(255 255 255 / 0.38);
        font-size: 0.62rem;
      }

      .winner-sweep {
        position: absolute;
        left: -35%;
        width: 170%;
        height: 1px;
        background: rgb(251 191 36 / 0.5);
        box-shadow: 0 0 0.8rem rgb(245 158 11 / 0.5);
        animation: winner-sweep 1.6s ease-in-out both;
      }

      .winner-sweep-one {
        top: 28%;
        transform: rotate(8deg);
      }

      .winner-sweep-two {
        bottom: 22%;
        transform: rotate(-7deg);
        animation-delay: 120ms;
      }

      @keyframes winner-enter {
        from {
          opacity: 0;
          transform: translateY(0.8rem) scale(0.95);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes winner-sweep {
        from {
          opacity: 0;
          translate: -35% 0;
        }

        45% {
          opacity: 1;
        }

        to {
          opacity: 0;
          translate: 35% 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .winner-celebration,
        .winner-sweep {
          animation: none;
        }

        .winner-sweep {
          display: none;
        }
      }
    `,
  ],
})
export class MiniGameWinnerCelebrationComponent {
  readonly snapshot = input.required<MiniGameSnapshot>();
  readonly dismiss = output<void>();
  protected readonly winners = computed(() => miniGameWinnerParticipants(this.snapshot()));
  protected readonly winnerNames = computed(() =>
    this.winners()
      .map((winner) => winner.displayName)
      .join(' & '),
  );
  protected readonly winnerLabel = computed(
    () => this.winners()[0]?.equity?.finalHandLabel ?? null,
  );
}
