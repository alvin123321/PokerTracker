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
        }
      </div>

      <div class="participant-cards" aria-label="Public hand">
        @for (card of participant().cards; track card.position) {
          <app-playing-card [card]="card" size="hole" />
        }
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
        grid-template-columns: 2.1rem minmax(0, 1fr) auto auto;
        min-height: 4.15rem;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid rgb(255 255 255 / 0.095);
        border-radius: 0.42rem;
        background: rgb(255 255 255 / 0.04);
        padding: 0.5rem 0.55rem;
        box-shadow: 0 0.3rem 0.8rem rgb(0 0 0 / 0.12);
      }

      .participant-row-viewer {
        border-color: rgb(52 211 153 / 0.34);
        background: rgb(16 185 129 / 0.065);
      }

      .participant-row-winner {
        border-color: rgb(251 191 36 / 0.48);
        background: rgb(245 158 11 / 0.105);
        box-shadow:
          inset 0 0 1.3rem rgb(245 158 11 / 0.06),
          0 0.32rem 0.9rem rgb(0 0 0 / 0.16);
      }

      .participant-avatar {
        display: grid;
        width: 2.1rem;
        height: 2.1rem;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.13);
        border-radius: 9999px;
        background: rgb(15 23 42 / 0.9);
        color: rgb(226 232 240);
        font-size: 0.68rem;
        font-weight: 850;
      }

      .participant-row-winner .participant-avatar {
        border-color: rgb(251 191 36 / 0.5);
        color: rgb(253 230 138);
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
        margin-top: 0.2rem;
        color: rgb(253 230 138);
        font-size: 0.62rem;
        line-height: 1.15;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .participant-cards {
        display: flex;
        gap: 0.22rem;
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
          grid-template-columns: 1.85rem minmax(0, 1fr) auto auto;
          gap: 0.36rem;
          padding-inline: 0.4rem;
        }

        .participant-avatar {
          width: 1.85rem;
          height: 1.85rem;
          font-size: 0.61rem;
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
