import { Component, computed, input } from '@angular/core';
import { LucideRadio } from '@lucide/angular';

import { miniGameBoardSlots } from './mini-game.logic';
import { MiniGameSnapshot } from './mini-game.models';
import { PlayingCardComponent } from './playing-card.component';

@Component({
  selector: 'app-mini-game-board',
  imports: [LucideRadio, PlayingCardComponent],
  template: `
    <section class="mini-board" aria-label="Community cards">
      <div class="mini-board-heading">
        <span class="mini-board-live">
          <svg lucideRadio [strokeWidth]="2.2" aria-hidden="true"></svg>
          {{ streetLabel() }}
        </span>
      </div>

      <div class="mini-board-cards">
        @for (slot of slots(); track slot.position) {
          <app-playing-card [card]="slot.card" />
        }
      </div>

      <div class="mini-board-streets" aria-hidden="true">
        <span class="mini-board-street-flop">FLOP</span>
        <span>TURN</span>
        <span>RIVER</span>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .mini-board {
        position: relative;
        overflow: hidden;
        border-block: 1px solid rgb(255 255 255 / 0.08);
        background: rgb(8 31 25 / 0.92);
        padding: 0.85rem 0.75rem 0.72rem;
      }

      .mini-board::before {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgb(255 255 255 / 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgb(255 255 255 / 0.025) 1px, transparent 1px);
        background-size: 1.4rem 1.4rem;
        content: '';
        mask-image: linear-gradient(to bottom, transparent, black 35%, black);
        pointer-events: none;
      }

      .mini-board-heading,
      .mini-board-cards,
      .mini-board-streets {
        position: relative;
        z-index: 1;
      }

      .mini-board-heading {
        display: flex;
        min-height: 1.3rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.65rem;
      }

      .mini-board-live {
        display: inline-flex;
        align-items: center;
        gap: 0.32rem;
        color: rgb(167 243 208);
        font-size: 0.64rem;
        font-weight: 800;
        line-height: 1;
        text-transform: uppercase;
      }

      .mini-board-live svg {
        width: 0.78rem;
        height: 0.78rem;
      }

      .mini-board-cards {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, auto));
        justify-content: center;
        gap: clamp(0.28rem, 1.8vw, 0.48rem);
        margin-top: 0.72rem;
      }

      .mini-board-streets {
        display: grid;
        grid-template-columns: 3fr 1fr 1fr;
        gap: clamp(0.28rem, 1.8vw, 0.48rem);
        margin: 0.45rem auto 0;
        width: min(100%, 22.5rem);
        color: rgb(255 255 255 / 0.32);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.54rem;
        font-weight: 700;
        text-align: center;
      }
    `,
  ],
})
export class MiniGameBoardComponent {
  readonly snapshot = input.required<MiniGameSnapshot>();
  protected readonly slots = computed(() => miniGameBoardSlots(this.snapshot()));
  protected readonly streetLabel = computed(() => {
    const labels: Record<MiniGameSnapshot['status'], string> = {
      OPEN: 'Waiting room',
      FLOP: 'Flop live',
      TURN: 'Turn live',
      COMPLETE: 'Final board',
    };

    return labels[this.snapshot().status];
  });
}
