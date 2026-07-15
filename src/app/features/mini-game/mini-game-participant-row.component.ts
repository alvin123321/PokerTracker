import { Component, computed, input, output } from '@angular/core';
import { LucideTrophy, LucideUserMinus } from '@lucide/angular';

import { MiniGameParticipant } from './mini-game.models';
import { PlayingCardComponent } from './playing-card.component';

@Component({
  selector: 'app-mini-game-participant-row',
  imports: [LucideTrophy, LucideUserMinus, PlayingCardComponent],
  template: `
    <article
      class="participant-row"
      [class.participant-row-winner]="winner()"
      [class.participant-row-viewer]="viewer()"
    >
      <span class="participant-position">{{ participant().joinPosition }}</span>
      <span class="participant-avatar" aria-hidden="true">{{ initials() }}</span>
      <div class="participant-copy">
        <div class="participant-name-line">
          <strong>{{ participant().displayName }}</strong>
          @if (viewer()) {
            <span>You</span>
          }
          @if (winner()) {
            <svg lucideTrophy [strokeWidth]="2.2" aria-label="Winner"></svg>
          }
        </div>
        @if (participant().equity?.finalHandLabel; as handLabel) {
          <small>{{ handLabel }}</small>
        } @else {
          <small>Seat {{ participant().joinPosition }}</small>
        }
      </div>

      <div class="participant-cards" aria-label="Public hand">
        @for (card of participant().cards; track card.position) {
          <app-playing-card [card]="card" size="hole" />
        }
      </div>

      <div class="participant-equity">
        @if (participant().equity; as equity) {
          <strong>{{ equity.percentage.toFixed(1) }}%</strong>
        } @else {
          <strong>--</strong>
        }
        <span>Equity</span>
      </div>

      @if (removable()) {
        <button
          type="button"
          class="participant-remove"
          aria-label="Remove {{ participant().displayName }}"
          title="Remove player"
          (click)="remove.emit(participant())"
        >
          <svg lucideUserMinus [strokeWidth]="2.1" aria-hidden="true"></svg>
        </button>
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .participant-row {
        display: grid;
        grid-template-columns: 1rem 2.1rem minmax(0, 1fr) auto auto;
        min-height: 4.25rem;
        align-items: center;
        gap: 0.48rem;
        border: 1px solid rgb(255 255 255 / 0.075);
        border-left: 2px solid rgb(148 163 184 / 0.34);
        border-radius: 0.42rem;
        background: rgb(255 255 255 / 0.035);
        padding: 0.46rem 0.5rem;
      }

      .participant-row-viewer {
        border-left-color: rgb(52 211 153 / 0.8);
        background: rgb(16 185 129 / 0.055);
      }

      .participant-row-winner {
        border-color: rgb(251 191 36 / 0.38);
        border-left-color: rgb(251 191 36);
        background: rgb(245 158 11 / 0.09);
        box-shadow: inset 0 0 1.2rem rgb(245 158 11 / 0.055);
      }

      .participant-position {
        color: rgb(255 255 255 / 0.3);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.64rem;
        font-weight: 800;
        text-align: center;
      }

      .participant-avatar {
        display: grid;
        width: 2.1rem;
        height: 2.1rem;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 9999px;
        background: rgb(15 23 42 / 0.9);
        color: rgb(226 232 240);
        font-size: 0.68rem;
        font-weight: 850;
      }

      .participant-copy {
        min-width: 0;
      }

      .participant-name-line {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.32rem;
      }

      .participant-name-line strong {
        overflow: hidden;
        color: rgb(248 250 252);
        font-size: 0.78rem;
        line-height: 1.15;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .participant-name-line span {
        flex: 0 0 auto;
        color: rgb(110 231 183);
        font-size: 0.54rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .participant-name-line svg {
        width: 0.8rem;
        height: 0.8rem;
        flex: 0 0 auto;
        color: rgb(251 191 36);
      }

      .participant-copy small {
        display: block;
        overflow: hidden;
        margin-top: 0.18rem;
        color: rgb(148 163 184);
        font-size: 0.62rem;
        line-height: 1.15;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .participant-cards {
        display: flex;
        gap: 0.2rem;
      }

      .participant-equity {
        display: grid;
        min-width: 3.45rem;
        justify-items: end;
      }

      .participant-equity strong {
        color: rgb(167 243 208);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.82rem;
        line-height: 1;
      }

      .participant-row-winner .participant-equity strong {
        color: rgb(253 230 138);
      }

      .participant-equity span {
        margin-top: 0.18rem;
        color: rgb(255 255 255 / 0.34);
        font-size: 0.52rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .participant-remove {
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        border: 1px solid rgb(248 113 113 / 0.22);
        border-radius: 0.38rem;
        background: rgb(127 29 29 / 0.12);
        color: rgb(252 165 165);
      }

      .participant-remove svg {
        width: 0.92rem;
        height: 0.92rem;
      }

      @media (max-width: 370px) {
        .participant-row {
          grid-template-columns: 0.8rem 1.85rem minmax(0, 1fr) auto auto;
          gap: 0.35rem;
          padding-inline: 0.38rem;
        }

        .participant-avatar {
          width: 1.85rem;
          height: 1.85rem;
        }

        .participant-equity {
          min-width: 3.1rem;
        }
      }
    `,
  ],
})
export class MiniGameParticipantRowComponent {
  readonly participant = input.required<MiniGameParticipant>();
  readonly winner = input(false);
  readonly viewer = input(false);
  readonly removable = input(false);
  readonly remove = output<MiniGameParticipant>();
  protected readonly initials = computed(() =>
    this.participant()
      .displayName.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.slice(0, 1).toUpperCase())
      .join(''),
  );
}
