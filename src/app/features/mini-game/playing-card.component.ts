import { Component, computed, input } from '@angular/core';

import { MiniGameCard } from './mini-game.models';

const suitSymbols: Record<string, string> = {
  c: '♣',
  d: '♦',
  h: '♥',
  s: '♠',
};

const suitNames: Record<string, string> = {
  c: 'clubs',
  d: 'diamonds',
  h: 'hearts',
  s: 'spades',
};

@Component({
  selector: 'app-playing-card',
  template: `
    <div
      class="playing-card"
      [class.playing-card-hole]="size() === 'hole'"
      [class.playing-card-red]="isRed()"
      [class.playing-card-empty]="!card()"
      [attr.aria-label]="ariaLabel()"
    >
      @if (card()) {
        <span class="playing-card-rank">{{ rank() }}</span>
        <span class="playing-card-suit" aria-hidden="true">{{ suit() }}</span>
        @if (size() === 'board') {
          <span class="playing-card-corner" aria-hidden="true">{{ rank() }}</span>
        }
      } @else {
        <span class="playing-card-placeholder" aria-hidden="true">♠</span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        flex: 0 0 auto;
      }

      .playing-card {
        position: relative;
        width: clamp(3rem, 15vw, 4.2rem);
        aspect-ratio: 0.714;
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 0.72);
        border-radius: 0.42rem;
        background: rgb(248 250 252);
        color: rgb(17 24 39);
        box-shadow:
          0 0.45rem 0.9rem rgb(0 0 0 / 0.28),
          inset 0 0 0 1px rgb(15 23 42 / 0.08);
      }

      .playing-card-hole {
        width: 2.35rem;
        border-radius: 0.36rem;
      }

      .playing-card-red {
        color: rgb(190 24 24);
      }

      .playing-card-rank {
        position: absolute;
        top: 0.28rem;
        left: 0.34rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 1.1rem;
        font-weight: 900;
        line-height: 1;
      }

      .playing-card-hole .playing-card-rank {
        top: 0.22rem;
        left: 0.25rem;
        font-size: 0.78rem;
      }

      .playing-card-suit {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 1.8rem;
        line-height: 1;
      }

      .playing-card-hole .playing-card-suit {
        font-size: 1.2rem;
      }

      .playing-card-corner {
        position: absolute;
        right: 0.28rem;
        bottom: 0.2rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 1.1rem;
        font-weight: 900;
        line-height: 1;
        transform: rotate(180deg);
      }

      .playing-card-empty {
        border-color: rgb(255 255 255 / 0.13);
        background: rgb(8 20 18 / 0.76);
        box-shadow:
          inset 0 0 0 2px rgb(255 255 255 / 0.035),
          inset 0 0 0 5px rgb(0 0 0 / 0.16);
      }

      .playing-card-placeholder {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: rgb(255 255 255 / 0.11);
        font-size: 1.55rem;
      }
    `,
  ],
})
export class PlayingCardComponent {
  readonly card = input<MiniGameCard | null>(null);
  readonly size = input<'board' | 'hole'>('board');
  protected readonly rank = computed(() => this.card()?.code.slice(0, 1) ?? '');
  protected readonly suitCode = computed(() => this.card()?.code.slice(1) ?? '');
  protected readonly suit = computed(() => suitSymbols[this.suitCode()] ?? '');
  protected readonly isRed = computed(() => ['d', 'h'].includes(this.suitCode()));
  protected readonly ariaLabel = computed(() => {
    const card = this.card();

    return card ? `${this.rank()} of ${suitNames[this.suitCode()]}` : 'Unrevealed card';
  });
}
