import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { LucideRefreshCcw } from '@lucide/angular';

import {
  calculateSidePots,
  calculateTotalPot,
  createPotPlayerId,
  defaultPotPlayers,
  normalizePotAmount,
  PotPlayerInput,
  SidePotResult
} from './pot-calculator.logic';

@Component({
  selector: 'app-pot-calculator-page',
  imports: [CurrencyPipe, LucideRefreshCcw],
  template: `
    <section class="pot-calculator-page" [class.pot-calculator-compact]="compact()">
      @if (!compact()) {
        <div class="pot-calculator-heading">
          <div>
            <p>Poker tool</p>
            <h1>Pot Calculator</h1>
          </div>
        </div>
      }

      <section class="pot-panel pot-result-panel">
        <div class="pot-section-heading">
          <h2>Pot result</h2>
        </div>

        <div class="pot-panel-body">
          <div class="total-pot-card">
            <p>Total Pot</p>
            <strong>
              {{ totalPot() | currency: 'USD' : 'symbol' : '1.0-0' }}
            </strong>
          </div>

          <div class="pot-results-grid">
            @for (pot of sidePots(); track pot.label) {
              <article class="pot-result-row">
                <div class="pot-result-row-top">
                  <h3>{{ pot.label }}</h3>
                  <p>
                    {{ pot.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </p>
                </div>
                <p class="pot-result-players">
                  {{ pot.eligiblePlayerNames.join(', ') }}
                </p>
              </article>
            } @empty {
              <div class="pot-empty">
                Add two amounts.
              </div>
            }
          </div>
        </div>
      </section>

      <section class="pot-panel pot-input-panel">
        <div class="pot-section-heading">
          <h2>All-in amounts</h2>
        </div>

        <div class="pot-panel-body">
          <div class="pot-player-grid">
            @for (player of players(); track player.id) {
              <div class="pot-player-row">
                <label class="pot-player-field">
                  <span>Name</span>
                  <input
                    type="text"
                    class="pot-player-name-input"
                    [value]="player.name"
                    aria-label="Player name"
                    (input)="updatePlayerName(player.id, $any($event.target).value)"
                  />
                </label>

                <label class="pot-player-field">
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputmode="numeric"
                    class="pot-player-amount-input"
                    [value]="player.amount ?? ''"
                    aria-label="Committed amount"
                    (input)="updatePlayerAmount(player.id, $any($event.target).value)"
                  />
                </label>
              </div>
            }
          </div>

          <div class="pot-actions">
            <button
              type="button"
              class="pot-action-primary"
              (click)="addPlayer()"
            >
              Add Player
            </button>
            <button
              type="button"
              class="pot-action-secondary"
              aria-label="Reset"
              title="Reset"
              (click)="resetPlayers()"
            >
              <svg
                lucideRefreshCcw
                class="pot-reset-icon"
                [strokeWidth]="3"
                [absoluteStrokeWidth]="true"
                aria-hidden="true"
              ></svg>
            </button>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      .pot-calculator-page {
        display: grid;
        gap: 1rem;
        animation: pot-calculator-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .pot-calculator-compact {
        gap: 0.62rem;
        animation: none;
      }

      .pot-calculator-heading p {
        margin: 0;
        color: rgb(110 231 183);
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .pot-calculator-heading h1 {
        margin: 0.45rem 0 0;
        color: white;
        font-size: 1.9rem;
        font-weight: 760;
        line-height: 1.08;
      }

      .pot-panel {
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 1rem;
        background:
          linear-gradient(145deg, rgb(255 255 255 / 0.052), rgb(255 255 255 / 0.025)),
          rgb(3 8 7 / 0.72);
      }

      .pot-result-panel {
        border-color: rgb(52 211 153 / 0.22);
        background:
          radial-gradient(circle at top right, rgb(34 197 94 / 0.12), transparent 55%),
          linear-gradient(145deg, rgb(255 255 255 / 0.052), rgb(255 255 255 / 0.025)),
          rgb(3 8 7 / 0.76);
      }

      .pot-section-heading {
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        padding: 0.78rem 1rem;
      }

      .pot-section-heading h2 {
        margin: 0;
        color: white;
        font-size: 1rem;
        font-weight: 760;
      }

      .pot-panel-body {
        display: grid;
        gap: 0.75rem;
        padding: 0.85rem;
      }

      .total-pot-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border: 1px solid rgb(52 211 153 / 0.18);
        border-radius: 0.9rem;
        background: rgb(0 0 0 / 0.3);
        padding: 0.85rem 0.95rem;
      }

      .total-pot-card p {
        margin: 0;
        color: rgb(161 161 170);
        font-size: 0.72rem;
        font-weight: 820;
        letter-spacing: 0.11em;
        text-transform: uppercase;
      }

      .total-pot-card strong {
        color: rgb(110 231 183);
        font-size: 2.25rem;
        font-weight: 720;
        line-height: 1;
        white-space: nowrap;
      }

      .pot-results-grid {
        display: grid;
        gap: 0.5rem;
      }

      .pot-result-row {
        border: 1px solid rgb(255 255 255 / 0.09);
        border-radius: 0.8rem;
        background: rgb(0 0 0 / 0.24);
        padding: 0.65rem 0.75rem;
      }

      .pot-result-row-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
      }

      .pot-result-row h3,
      .pot-result-row p {
        margin: 0;
      }

      .pot-result-row h3 {
        color: white;
        font-size: 0.95rem;
        font-weight: 760;
      }

      .pot-result-row-top p {
        color: rgb(110 231 183);
        font-size: 1.15rem;
        font-weight: 700;
        white-space: nowrap;
      }

      .pot-result-players {
        overflow: hidden;
        margin-top: 0.28rem !important;
        color: rgb(161 161 170);
        font-size: 0.82rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pot-empty {
        border: 1px dashed rgb(255 255 255 / 0.1);
        border-radius: 0.8rem;
        color: rgb(161 161 170);
        font-size: 0.84rem;
        font-weight: 650;
        padding: 0.7rem;
        text-align: center;
      }

      .pot-player-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
      }

      .pot-player-row {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 0.82fr) minmax(4.55rem, 5.35rem);
        align-items: end;
        gap: 0.4rem;
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.09);
        border-radius: 0.82rem;
        background: rgb(0 0 0 / 0.24);
        padding: 0.58rem;
      }

      .pot-player-row:nth-child(4n + 1) {
        border-color: rgb(56 189 248 / 0.32);
        background:
          linear-gradient(145deg, rgb(56 189 248 / 0.09), rgb(0 0 0 / 0.08)),
          rgb(0 0 0 / 0.24);
      }

      .pot-player-row:nth-child(4n + 2) {
        border-color: rgb(52 211 153 / 0.34);
        background:
          linear-gradient(145deg, rgb(52 211 153 / 0.1), rgb(0 0 0 / 0.08)),
          rgb(0 0 0 / 0.24);
      }

      .pot-player-row:nth-child(4n + 3) {
        border-color: rgb(251 191 36 / 0.32);
        background:
          linear-gradient(145deg, rgb(251 191 36 / 0.09), rgb(0 0 0 / 0.08)),
          rgb(0 0 0 / 0.24);
      }

      .pot-player-row:nth-child(4n + 4) {
        border-color: rgb(168 85 247 / 0.32);
        background:
          linear-gradient(145deg, rgb(168 85 247 / 0.09), rgb(0 0 0 / 0.08)),
          rgb(0 0 0 / 0.24);
      }

      .pot-player-field {
        display: grid;
        min-width: 0;
        gap: 0.25rem;
      }

      .pot-player-field span {
        color: rgb(161 161 170);
        font-size: 0.64rem;
        font-weight: 820;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .pot-player-row input {
        width: 100%;
        min-width: 0;
        height: 2.35rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.66rem;
        background: rgb(0 0 0 / 0.35);
        color: white;
        font-size: 1rem;
        font-weight: 720;
        outline: none;
        padding: 0.45rem 0.55rem;
        transition:
          border-color 170ms ease,
          box-shadow 170ms ease,
          background-color 170ms ease;
      }

      .pot-player-row input:focus {
        border-color: rgb(52 211 153 / 0.75);
        background: rgb(0 0 0 / 0.48);
        box-shadow: 0 0 0 3px rgb(52 211 153 / 0.12);
      }

      .pot-player-amount-input {
        text-align: right;
      }

      .pot-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .pot-actions button {
        display: inline-flex;
        min-width: 0;
        min-height: 2.55rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.76rem;
        font-size: 0.88rem;
        font-weight: 780;
        line-height: 1;
        transition:
          background-color 180ms ease,
          border-color 180ms ease,
          color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }

      .pot-actions button:active {
        transform: scale(0.985);
      }

      .pot-reset-icon {
        display: block;
        width: 1.16rem;
        height: 1.16rem;
      }

      .pot-action-primary {
        border: 1px solid rgb(52 211 153 / 0.7);
        background: linear-gradient(180deg, rgb(52 211 153), rgb(22 163 74));
        color: rgb(3 8 7);
        box-shadow: 0 0 20px rgb(34 197 94 / 0.14);
      }

      .pot-action-secondary {
        border: 1px solid rgb(255 255 255 / 0.12);
        background: rgb(255 255 255 / 0.035);
        color: rgb(245 245 245);
      }

      .pot-action-secondary:hover {
        border-color: rgb(52 211 153 / 0.38);
        background: rgb(255 255 255 / 0.06);
      }

      .pot-player-row,
      .pot-result-row {
        animation: pot-calculator-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }

      .pot-player-row:hover,
      .pot-result-row:hover {
        border-color: rgb(52 211 153 / 0.32);
      }

      .pot-calculator-compact .pot-section-heading {
        display: none;
      }

      .pot-calculator-compact .pot-panel-body {
        gap: 0.62rem;
        padding: 0.58rem;
      }

      .pot-calculator-compact .total-pot-card {
        padding: 0.6rem 0.68rem;
      }

      .pot-calculator-compact .total-pot-card strong {
        font-size: 1.78rem;
      }

      .pot-calculator-compact .pot-result-row {
        padding: 0.5rem 0.58rem;
      }

      .pot-calculator-compact .pot-result-row h3 {
        font-size: 0.86rem;
      }

      .pot-calculator-compact .pot-result-row-top p {
        font-size: 1rem;
      }

      .pot-calculator-compact .pot-result-players {
        font-size: 0.76rem;
      }

      .pot-calculator-compact .pot-player-row {
        grid-template-columns: minmax(0, 0.72fr) minmax(4.72rem, 5rem);
        gap: 0.36rem;
        padding: 0.5rem 0.42rem;
      }

      .pot-calculator-compact .pot-player-field {
        gap: 0.18rem;
      }

      .pot-calculator-compact .pot-player-field span {
        display: block;
        color: rgb(190 190 198);
        font-size: 0.56rem;
        letter-spacing: 0.06em;
      }

      .pot-calculator-compact .pot-player-row input {
        height: 2.32rem;
        border-radius: 0.58rem;
        font-size: 1rem;
        padding: 0.42rem 0.48rem;
      }

      .pot-calculator-compact .pot-actions button {
        min-height: 2.32rem;
        font-size: 0.82rem;
      }

      @media (min-width: 720px) {
        .pot-results-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 639px) {
        .pot-calculator-heading {
          display: none;
        }
      }

      @media (max-width: 360px) {
        .pot-player-grid {
          gap: 0.5rem;
        }

        .pot-calculator-compact .pot-panel-body {
          padding: 0.5rem;
        }

        .pot-calculator-compact .pot-player-row {
          grid-template-columns: minmax(0, 0.72fr) 4.18rem;
          gap: 0.25rem;
          padding: 0.44rem 0.34rem;
        }

        .pot-calculator-compact .pot-player-row input {
          height: 2.22rem;
          font-size: 1rem;
          padding-inline: 0.34rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .pot-calculator-page,
        .pot-player-row,
        .pot-result-row {
          animation: none;
        }
      }

      @keyframes pot-calculator-enter {
        from {
          opacity: 0;
          transform: translateY(0.35rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `
  ]
})
export class PotCalculatorPage {
  readonly compact = input(false);

  private nextPlayerNumber = 5;

  protected readonly players = signal<PotPlayerInput[]>(defaultPotPlayers());

  protected readonly sidePots = computed<SidePotResult[]>(() => calculateSidePots(this.players()));
  protected readonly totalPot = computed(() => calculateTotalPot(this.players()));

  protected addPlayer(): void {
    const playerNumber = this.nextPlayerNumber++;

    this.players.update((players) => [
      ...players,
      {
        id: this.createId(),
        name: `P${playerNumber}`,
        amount: null
      }
    ]);
  }

  protected resetPlayers(): void {
    this.nextPlayerNumber = 5;
    this.players.set(defaultPotPlayers());
  }

  protected updatePlayerName(playerId: string, name: string): void {
    this.players.update((players) =>
      players.map((player) => (player.id === playerId ? { ...player, name } : player))
    );
  }

  protected updatePlayerAmount(playerId: string, rawAmount: string): void {
    const amount = rawAmount.trim() === '' ? null : normalizePotAmount(rawAmount);

    this.players.update((players) =>
      players.map((player) => (player.id === playerId ? { ...player, amount } : player))
    );
  }

  private createId(): string {
    return createPotPlayerId();
  }
}
