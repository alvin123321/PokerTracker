import { CurrencyPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

interface PotPlayerInput {
  id: string;
  name: string;
  amount: number | null;
}

interface SidePotResult {
  label: string;
  amount: number;
  eligiblePlayerNames: string[];
}

@Component({
  selector: 'app-pot-calculator-page',
  imports: [CurrencyPipe],
  template: `
    <section class="pot-calculator-page space-y-5 sm:space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Poker tool</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Pot Calculator</h1>
        </div>
      </div>

      <section class="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.035]">
        <div class="border-b border-emerald-300/15 px-4 py-3 sm:px-5">
          <h2 class="text-base font-semibold text-white">Pot result</h2>
        </div>

        <div class="space-y-4 p-4 sm:p-5">
          <div class="rounded-lg border border-white/10 bg-neutral-950/80 p-4 text-center">
            <p class="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">Total Pot</p>
            <p class="mt-2 text-4xl font-semibold text-emerald-300">
              {{ totalPot() | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
          </div>

          <div class="grid gap-2 lg:grid-cols-2">
            @for (pot of sidePots(); track pot.label) {
              <article class="pot-result-row rounded-lg border border-white/10 bg-neutral-950/75 p-3">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="font-semibold text-white">{{ pot.label }}</h3>
                  <p class="text-xl font-semibold text-emerald-300">
                    {{ pot.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </p>
                </div>
                <p class="mt-2 text-sm text-neutral-400">
                  {{ pot.eligiblePlayerNames.join(', ') }}
                </p>
              </article>
            } @empty {
              <div class="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500 lg:col-span-2">
                Enter at least two all-in amounts to calculate pots.
              </div>
            }
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-white/10 bg-white/[0.035]">
        <div class="border-b border-white/10 px-4 py-3 sm:px-5">
          <h2 class="text-base font-semibold text-white">All-in amounts</h2>
        </div>

        <div class="p-3 sm:p-4">
          <div class="grid gap-2 sm:grid-cols-2">
            @for (player of players(); track player.id) {
              <div class="pot-player-row grid grid-cols-[minmax(0,1fr)_minmax(5rem,6rem)] items-end gap-2 rounded-lg border border-white/10 bg-neutral-950/75 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(5.75rem,7rem)]">
                <label class="grid min-w-0 gap-1.5">
                  <span class="text-xs font-semibold uppercase text-neutral-500">Player</span>
                  <input
                    type="text"
                    class="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300"
                    [value]="player.name"
                    (input)="updatePlayerName(player.id, $any($event.target).value)"
                  />
                </label>

                <label class="grid min-w-0 gap-1.5">
                  <span class="text-xs font-semibold uppercase text-neutral-500">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputmode="numeric"
                    class="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-3 text-right text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300 sm:px-3"
                    [value]="player.amount ?? ''"
                    (input)="updatePlayerAmount(player.id, $any($event.target).value)"
                  />
                </label>
              </div>
            }
          </div>

          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="inline-flex w-full items-center justify-center rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
              (click)="addPlayer()"
            >
              Add Player
            </button>
            <button
              type="button"
              class="inline-flex w-full items-center justify-center rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:border-emerald-300/40 hover:bg-white/[0.05]"
              (click)="resetPlayers()"
            >
              Reset
            </button>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      .pot-calculator-page {
        animation: pot-calculator-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
  private nextPlayerNumber = 4;

  protected readonly players = signal<PotPlayerInput[]>(this.defaultPlayers());

  protected readonly sidePots = computed<SidePotResult[]>(() => this.calculatePots(this.players()));
  protected readonly totalPot = computed(() =>
    this.sidePots().reduce((total, pot) => total + pot.amount, 0)
  );

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
    this.nextPlayerNumber = 4;
    this.players.set(this.defaultPlayers());
  }

  protected updatePlayerName(playerId: string, name: string): void {
    this.players.update((players) =>
      players.map((player) => (player.id === playerId ? { ...player, name } : player))
    );
  }

  protected updatePlayerAmount(playerId: string, rawAmount: string): void {
    const amount = rawAmount.trim() === '' ? null : this.normalizeAmount(rawAmount);

    this.players.update((players) =>
      players.map((player) => (player.id === playerId ? { ...player, amount } : player))
    );
  }

  private calculatePots(players: PotPlayerInput[]): SidePotResult[] {
    const activePlayers = players
      .map((player, index) => ({
        name: player.name.trim() || `Player${index + 1}`,
        amount: this.normalizeAmount(player.amount)
      }))
      .filter((player) => player.amount > 0);

    if (activePlayers.length < 2) {
      return [];
    }

    const levels = [...new Set(activePlayers.map((player) => player.amount))].sort((a, b) => a - b);
    let previousLevel = 0;

    return levels
      .map((level, index) => {
        const eligiblePlayers = activePlayers.filter((player) => player.amount >= level);
        const amount = (level - previousLevel) * eligiblePlayers.length;

        previousLevel = level;

        return {
          label: index === 0 ? 'Main Pot' : `Side Pot ${index}`,
          amount,
          eligiblePlayerNames: eligiblePlayers.map((player) => player.name)
        };
      })
      .filter((pot) => pot.amount > 0 && pot.eligiblePlayerNames.length > 1);
  }

  private normalizeAmount(value: number | string | null): number {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  private defaultPlayers(): PotPlayerInput[] {
    return [
      { id: this.createId(), name: 'Al', amount: null },
      { id: this.createId(), name: 'Bo', amount: null },
      { id: this.createId(), name: 'Cy', amount: null }
    ];
  }

  private createId(): string {
    return `pot-player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
