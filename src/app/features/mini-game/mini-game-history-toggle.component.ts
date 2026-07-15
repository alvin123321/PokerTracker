import { Component, input, output } from '@angular/core';
import { LucideSpade, LucideTable2 } from '@lucide/angular';

import { MiniGameHistoryView } from './mini-game.models';

@Component({
  selector: 'app-mini-game-history-toggle',
  imports: [LucideSpade, LucideTable2],
  template: `
    <div class="history-toggle" role="group" aria-label="History type">
      <button
        type="button"
        [class.history-toggle-active]="view() === 'tables'"
        [attr.aria-pressed]="view() === 'tables'"
        aria-label="Table game history"
        title="Table games"
        (click)="viewChange.emit('tables')"
      >
        <svg lucideTable2 [strokeWidth]="2.1" aria-hidden="true"></svg>
      </button>
      <button
        type="button"
        [class.history-toggle-active]="view() === 'mini-games'"
        [attr.aria-pressed]="view() === 'mini-games'"
        aria-label="Mini-game history"
        title="Mini-games"
        (click)="viewChange.emit('mini-games')"
      >
        <svg lucideSpade [strokeWidth]="2.1" aria-hidden="true"></svg>
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .history-toggle {
        display: grid;
        width: 6.4rem;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.25rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.48rem;
        background: rgb(255 255 255 / 0.035);
        padding: 0.25rem;
      }

      button {
        display: grid;
        min-height: 2.5rem;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 0.36rem;
        background: transparent;
        color: rgb(113 113 122);
        transition:
          border-color 160ms ease,
          background-color 160ms ease,
          color 160ms ease;
      }

      button svg {
        width: 1.05rem;
        height: 1.05rem;
      }

      button.history-toggle-active {
        border-color: rgb(52 211 153 / 0.32);
        background: rgb(16 185 129 / 0.13);
        color: rgb(167 243 208);
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
      }

      @media (prefers-reduced-motion: reduce) {
        button {
          transition: none;
        }
      }
    `,
  ],
})
export class MiniGameHistoryToggleComponent {
  readonly view = input.required<MiniGameHistoryView>();
  readonly viewChange = output<MiniGameHistoryView>();
}
