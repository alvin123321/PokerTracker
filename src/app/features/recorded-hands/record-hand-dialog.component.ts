import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  PokerSession,
  RecordedHandActionType,
  RecordedHandBoardCard,
  RecordedHandStatus,
  RecordedHandStreet,
  SaveRecordedHandInput
} from '../host/data/poker-store.service';

export interface RecordHandDialogData {
  session: PokerSession;
  accent?: 'emerald' | 'sky';
}

type DraftAction = SaveRecordedHandInput['actions'][number] & {
  id: string;
  playerName: string;
};

const tags = ['Huge Bluff', 'Bad Beat', 'Hero Call', 'Funny Moment', 'Big Pot', 'Sick River'];
const streets: RecordedHandStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
const actionTypes: RecordedHandActionType[] = ['RAISE', 'CALL', 'CHECK', 'FOLD', 'BET', 'ALL_IN'];
const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const suits: RecordedHandBoardCard['suit'][] = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
const chipAmounts = [25, 50, 100, 200, 500, 1000];

@Component({
  selector: 'app-record-hand-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <section class="record-hand w-[min(96vw,58rem)] bg-neutral-950 p-4 text-neutral-50 sm:p-5">
      <header class="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {{ data.session.name }}
          </p>
          <h2 class="mt-1 text-2xl font-semibold text-white">Record Hand</h2>
          <p class="mt-1 text-sm text-neutral-400">
            Session members can see saved hands. Drafts stay tied to this table.
          </p>
        </div>
        <div class="flex gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          @for (label of stepLabels; track label; let index = $index) {
            <span
              class="rounded-md px-3 py-2 text-xs font-bold"
              [class.bg-emerald-400]="step() === index + 1 && accent() === 'emerald'"
              [class.bg-sky-300]="step() === index + 1 && accent() === 'sky'"
              [class.text-neutral-950]="step() === index + 1"
              [class.text-neutral-500]="step() !== index + 1"
            >
              {{ index + 1 }} {{ label }}
            </span>
          }
        </div>
      </header>

      @if (step() === 1) {
        <div class="grid gap-5 py-5 lg:grid-cols-[1fr_1.1fr]">
          <div class="space-y-4">
            <div>
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Tags</h3>
              <div class="mt-3 flex flex-wrap gap-2">
                @for (tag of tagOptions; track tag) {
                  <button
                    type="button"
                    class="rounded-full border px-3 py-2 text-sm font-semibold transition"
                    [class.border-emerald-300]="tagSelected(tag) && accent() === 'emerald'"
                    [class.bg-emerald-300]="tagSelected(tag) && accent() === 'emerald'"
                    [class.border-sky-300]="tagSelected(tag) && accent() === 'sky'"
                    [class.bg-sky-300]="tagSelected(tag) && accent() === 'sky'"
                    [class.text-neutral-950]="tagSelected(tag)"
                    [class.border-white/10]="!tagSelected(tag)"
                    [class.text-neutral-200]="!tagSelected(tag)"
                    [class.hover:bg-white/10]="!tagSelected(tag)"
                    (click)="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                }
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold uppercase text-neutral-500" for="handComment">
                Comment
              </label>
              <textarea
                id="handComment"
                rows="5"
                [formControl]="comment"
                class="mt-3 w-full resize-none rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
                placeholder="Only typing box: add the story, read, or table joke."
              ></textarea>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-semibold uppercase text-neutral-500">Players in the hand</h3>
            <div class="mt-3 grid max-h-[22rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              @for (player of data.session.players; track player.id) {
                <button
                  type="button"
                  class="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition"
                  [class.border-emerald-300]="playerSelected(player.id) && accent() === 'emerald'"
                  [class.bg-emerald-300]="playerSelected(player.id) && accent() === 'emerald'"
                  [class.border-sky-300]="playerSelected(player.id) && accent() === 'sky'"
                  [class.bg-sky-300]="playerSelected(player.id) && accent() === 'sky'"
                  [class.text-neutral-950]="playerSelected(player.id)"
                  [class.border-white/10]="!playerSelected(player.id)"
                  [class.bg-white/[0.03]]="!playerSelected(player.id)"
                  [class.text-neutral-100]="!playerSelected(player.id)"
                  (click)="togglePlayer(player.id)"
                >
                  <span>
                    <span class="block font-semibold">{{ player.name }}</span>
                    <span class="text-xs opacity-70">{{ player.status }}</span>
                  </span>
                  <span class="text-xs font-black uppercase">
                    {{ playerSelected(player.id) ? 'In' : 'Add' }}
                  </span>
                </button>
              }
            </div>
          </div>
        </div>
      }

      @if (step() === 2) {
        <div class="grid gap-5 py-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Board</h3>
              <div class="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div class="mb-3 flex flex-wrap gap-2">
                  @for (card of boardCards(); track card.rank + card.suit) {
                    <span class="playing-card">
                      {{ card.rank }}{{ suitSymbol(card.suit) }}
                    </span>
                  } @empty {
                    <span class="text-sm text-neutral-500">No board cards yet</span>
                  }
                </div>
                <div class="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
                  @for (rank of rankOptions; track rank) {
                    <button
                      type="button"
                      class="rounded-md border px-2 py-2 text-sm font-bold transition"
                      [class.border-white]="selectedRank() === rank"
                      [class.bg-white]="selectedRank() === rank"
                      [class.text-neutral-950]="selectedRank() === rank"
                      [class.border-white/10]="selectedRank() !== rank"
                      [class.text-neutral-200]="selectedRank() !== rank"
                      (click)="selectedRank.set(rank)"
                    >
                      {{ rank }}
                    </button>
                  }
                </div>
                <div class="mt-2 grid grid-cols-4 gap-2">
                  @for (suit of suitOptions; track suit) {
                    <button
                      type="button"
                      class="rounded-md border px-3 py-2 text-lg font-black transition"
                      [class.border-white]="selectedSuit() === suit"
                      [class.bg-white]="selectedSuit() === suit"
                      [class.text-neutral-950]="selectedSuit() === suit"
                      [class.border-white/10]="selectedSuit() !== suit"
                      [class.text-red-300]="selectedSuit() !== suit && isRedSuit(suit)"
                      [class.text-neutral-200]="selectedSuit() !== suit && !isRedSuit(suit)"
                      (click)="selectedSuit.set(suit)"
                    >
                      {{ suitSymbol(suit) }}
                    </button>
                  }
                </div>
                <button
                  type="button"
                  [disabled]="boardCards().length >= 5"
                  class="mt-3 w-full rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-600"
                  (click)="addBoardCard()"
                >
                  Add Board Card
                </button>
              </div>
            </div>

            <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Action Builder</h3>
              <div class="mt-3 grid grid-cols-4 gap-2">
                @for (street of streetOptions; track street) {
                  <button
                    type="button"
                    class="rounded-md px-2 py-2 text-xs font-bold transition"
                    [class.bg-emerald-400]="selectedStreet() === street && accent() === 'emerald'"
                    [class.bg-sky-300]="selectedStreet() === street && accent() === 'sky'"
                    [class.text-neutral-950]="selectedStreet() === street"
                    [class.bg-neutral-900]="selectedStreet() !== street"
                    [class.text-neutral-300]="selectedStreet() !== street"
                    (click)="selectedStreet.set(street)"
                  >
                    {{ streetLabel(street) }}
                  </button>
                }
              </div>

              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                @for (player of selectedPlayers(); track player.id) {
                  <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-left text-sm font-semibold transition"
                    [class.border-emerald-300]="selectedActionPlayerId() === player.id && accent() === 'emerald'"
                    [class.bg-emerald-300]="selectedActionPlayerId() === player.id && accent() === 'emerald'"
                    [class.border-sky-300]="selectedActionPlayerId() === player.id && accent() === 'sky'"
                    [class.bg-sky-300]="selectedActionPlayerId() === player.id && accent() === 'sky'"
                    [class.text-neutral-950]="selectedActionPlayerId() === player.id"
                    [class.border-white/10]="selectedActionPlayerId() !== player.id"
                    [class.text-neutral-200]="selectedActionPlayerId() !== player.id"
                    (click)="selectedActionPlayerId.set(player.id)"
                  >
                    {{ player.name }}
                  </button>
                } @empty {
                  <p class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50">
                    Select players in step 1 first.
                  </p>
                }
              </div>

              <div class="mt-3 grid grid-cols-3 gap-2">
                @for (action of actionOptions; track action) {
                  <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-xs font-black uppercase transition"
                    [class.border-emerald-300]="selectedActionType() === action && accent() === 'emerald'"
                    [class.bg-emerald-300]="selectedActionType() === action && accent() === 'emerald'"
                    [class.border-sky-300]="selectedActionType() === action && accent() === 'sky'"
                    [class.bg-sky-300]="selectedActionType() === action && accent() === 'sky'"
                    [class.text-neutral-950]="selectedActionType() === action"
                    [class.border-white/10]="selectedActionType() !== action"
                    [class.text-neutral-200]="selectedActionType() !== action"
                    (click)="selectedActionType.set(action)"
                  >
                    {{ actionLabel(action) }}
                  </button>
                }
              </div>

              @if (actionNeedsAmount()) {
                <div class="mt-3">
                  <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    @for (amount of chips; track amount) {
                      <button
                        type="button"
                        class="rounded-md bg-neutral-900 px-2 py-2 text-sm font-bold text-neutral-100 transition hover:bg-white hover:text-neutral-950"
                        (click)="setAmount(amount)"
                      >
                        {{ amount }}
                      </button>
                    }
                  </div>
                  <div class="mt-2 flex gap-2">
                    <button type="button" class="amount-stepper" (click)="stepAmount(-25)">-</button>
                    <input
                      type="number"
                      min="0"
                      step="25"
                      inputmode="decimal"
                      [formControl]="amount"
                      class="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 text-center text-lg font-bold outline-none focus:border-emerald-300"
                      (focus)="clearAmount()"
                    />
                    <button type="button" class="amount-stepper" (click)="stepAmount(25)">+</button>
                  </div>
                </div>
              }

              <button
                type="button"
                [disabled]="!canAddAction()"
                class="mt-3 w-full rounded-lg bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                (click)="addAction()"
              >
                Add Action
              </button>
            </div>
          </div>

          <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold uppercase text-neutral-500">Live Timeline</h3>
              <button
                type="button"
                [disabled]="actions().length === 0"
                class="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-neutral-600"
                (click)="undoAction()"
              >
                Undo Last
              </button>
            </div>
            <div class="mt-3 space-y-3">
              @for (street of streetOptions; track street) {
                <div>
                  <p class="mb-2 text-xs font-bold uppercase text-neutral-500">{{ streetLabel(street) }}</p>
                  <div class="space-y-2">
                    @for (action of actionsForStreet(street); track action.id) {
                      <div class="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-white/10 bg-neutral-950 p-3">
                        <span>
                          <span class="font-semibold text-white">{{ action.playerName }}</span>
                          <span class="ml-2 text-sm text-neutral-400">{{ actionLabel(action.actionType) }}</span>
                        </span>
                        @if (action.amount !== null) {
                          <span class="font-bold text-white">
                            {{ action.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                          </span>
                        }
                      </div>
                    } @empty {
                      <p class="rounded-lg border border-dashed border-white/10 p-3 text-sm text-neutral-600">
                        No action
                      </p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      @if (step() === 3) {
        <div class="grid gap-4 py-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div class="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 class="text-sm font-semibold uppercase text-neutral-500">Recap</h3>
            <div class="flex flex-wrap gap-2">
              @for (tag of selectedTags(); track tag) {
                <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-950">{{ tag }}</span>
              } @empty {
                <span class="text-sm text-neutral-500">No tags selected</span>
              }
            </div>
            <p class="text-sm text-neutral-300">
              Players:
              <span class="font-semibold text-white">{{ selectedPlayersLabel() }}</span>
            </p>
            <p class="text-sm text-neutral-300">
              Board:
              <span class="font-semibold text-white">{{ boardLabel() }}</span>
            </p>
            @if (comment.value.trim()) {
              <p class="rounded-lg border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-300">
                {{ comment.value.trim() }}
              </p>
            }
          </div>

          <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 class="text-sm font-semibold uppercase text-neutral-500">Actions</h3>
            <div class="mt-3 space-y-2">
              @for (action of actions(); track action.id) {
                <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-neutral-950 p-3">
                  <span class="rounded-md bg-white/[0.08] px-2 py-1 text-xs font-bold text-neutral-300">
                    {{ streetLabel(action.street) }}
                  </span>
                  <span>
                    <span class="font-semibold text-white">{{ action.playerName }}</span>
                    <span class="ml-2 text-sm text-neutral-400">{{ actionLabel(action.actionType) }}</span>
                  </span>
                  @if (action.amount !== null) {
                    <span class="font-bold text-white">{{ action.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
                  }
                </div>
              } @empty {
                <p class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50">
                  No actions yet. Saved hands can be light, but adding actions makes history easier to replay.
                </p>
              }
            </div>
          </div>
        </div>
      }

      <footer class="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-xs text-neutral-500">
          Visible to table operators and players in this session.
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          @if (step() > 1) {
              <button type="button" class="footer-button" (click)="goBack()">
              Back
            </button>
          }
          <button type="button" class="footer-button" (click)="save('DRAFT')">Save Draft</button>
          @if (step() < 3) {
            <button
              type="button"
              class="rounded-lg px-5 py-3 text-sm font-black text-neutral-950 transition hover:opacity-90"
              [class.bg-emerald-400]="accent() === 'emerald'"
              [class.bg-sky-300]="accent() === 'sky'"
              [disabled]="step() === 1 && selectedPlayerIds().length === 0"
              (click)="goNext()"
            >
              Next
            </button>
          } @else {
            <button
              type="button"
              class="rounded-lg bg-white px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200"
              (click)="save('SAVED')"
            >
              Save Hand
            </button>
          }
        </div>
      </footer>
    </section>
  `,
  styles: [
    `
      .record-hand {
        border: 1px solid rgb(255 255 255 / 0.1);
      }

      .playing-card {
        display: inline-grid;
        min-width: 2.35rem;
        height: 3rem;
        place-items: center;
        border-radius: 0.45rem;
        background: white;
        color: rgb(10 10 10);
        font-weight: 900;
        box-shadow: 0 0.7rem 1.25rem rgb(0 0 0 / 0.25);
      }

      .amount-stepper,
      .footer-button {
        border-radius: 0.5rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        color: white;
        font-weight: 800;
        transition:
          background-color 180ms ease,
          border-color 180ms ease;
      }

      .amount-stepper {
        width: 3rem;
        background: rgb(23 23 23);
        font-size: 1.25rem;
      }

      .footer-button {
        padding: 0.75rem 1rem;
        background: transparent;
        font-size: 0.875rem;
      }

      .amount-stepper:hover,
      .footer-button:hover {
        background: rgb(255 255 255 / 0.1);
      }
    `
  ]
})
export class RecordHandDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<RecordHandDialogComponent>);
  protected readonly data = inject<RecordHandDialogData>(MAT_DIALOG_DATA);
  protected readonly tagOptions = tags;
  protected readonly streetOptions = streets;
  protected readonly actionOptions = actionTypes;
  protected readonly rankOptions = ranks;
  protected readonly suitOptions = suits;
  protected readonly chips = chipAmounts;
  protected readonly stepLabels = ['Setup', 'Action', 'Review'];
  protected readonly comment = new FormControl('', { nonNullable: true });
  protected readonly amount = new FormControl<number | null>(0);
  protected readonly step = signal(1);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly selectedPlayerIds = signal<string[]>([]);
  protected readonly boardCards = signal<RecordedHandBoardCard[]>([]);
  protected readonly selectedRank = signal('A');
  protected readonly selectedSuit = signal<RecordedHandBoardCard['suit']>('SPADE');
  protected readonly selectedStreet = signal<RecordedHandStreet>('PREFLOP');
  protected readonly selectedActionPlayerId = signal<string | null>(null);
  protected readonly selectedActionType = signal<RecordedHandActionType>('RAISE');
  protected readonly actions = signal<DraftAction[]>([]);
  protected readonly accent = computed(() => this.data.accent ?? 'emerald');
  protected readonly selectedPlayers = computed(() =>
    this.data.session.players.filter((player) => this.selectedPlayerIds().includes(player.id))
  );

  protected toggleTag(tag: string): void {
    this.selectedTags.update((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  protected tagSelected(tag: string): boolean {
    return this.selectedTags().includes(tag);
  }

  protected togglePlayer(playerId: string): void {
    this.selectedPlayerIds.update((current) => {
      const next = current.includes(playerId)
        ? current.filter((item) => item !== playerId)
        : [...current, playerId];
      this.selectedActionPlayerId.set(next[0] ?? null);
      return next;
    });
  }

  protected playerSelected(playerId: string): boolean {
    return this.selectedPlayerIds().includes(playerId);
  }

  protected addBoardCard(): void {
    const card = { rank: this.selectedRank(), suit: this.selectedSuit() };
    this.boardCards.update((cards) => {
      if (
        cards.length >= 5 ||
        cards.some((item) => item.rank === card.rank && item.suit === card.suit)
      ) {
        return cards;
      }

      return [...cards, card];
    });
  }

  protected actionNeedsAmount(action = this.selectedActionType()): boolean {
    return action === 'RAISE' || action === 'BET' || action === 'ALL_IN';
  }

  protected canAddAction(): boolean {
    if (!this.selectedActionPlayerId()) {
      return false;
    }

    return !this.actionNeedsAmount() || (Number(this.amount.value) || 0) > 0;
  }

  protected addAction(): void {
    const player = this.selectedPlayers().find(
      (item) => item.id === this.selectedActionPlayerId()
    );

    if (!player || !this.canAddAction()) {
      return;
    }

    const amount = this.actionNeedsAmount() ? Math.max(0, Number(this.amount.value) || 0) : null;

    this.actions.update((current) => [
      ...current,
      {
        id: `draft-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        street: this.selectedStreet(),
        sessionPlayerId: player.id,
        playerName: player.name,
        actionType: this.selectedActionType(),
        amount
      }
    ]);
  }

  protected undoAction(): void {
    this.actions.update((current) => current.slice(0, -1));
  }

  protected actionsForStreet(street: RecordedHandStreet): DraftAction[] {
    return this.actions().filter((action) => action.street === street);
  }

  protected setAmount(value: number): void {
    this.amount.setValue(value);
  }

  protected stepAmount(delta: number): void {
    this.amount.setValue(Math.max(0, (Number(this.amount.value) || 0) + delta));
  }

  protected clearAmount(): void {
    if (this.amount.value === 0) {
      this.amount.setValue(null);
    }
  }

  protected goBack(): void {
    this.step.update((value) => Math.max(1, value - 1));
  }

  protected goNext(): void {
    if (this.step() === 1 && this.selectedPlayerIds().length === 0) {
      return;
    }

    this.step.update((value) => Math.min(3, value + 1));
  }

  protected save(status: RecordedHandStatus): void {
    this.dialogRef.close({
      sessionId: this.data.session.id,
      title: this.selectedTags()[0] ?? 'Recorded hand',
      comment: this.comment.value.trim(),
      tags: this.selectedTags(),
      playerIds: this.selectedPlayerIds(),
      board: this.boardCards(),
      status,
      actions: this.actions().map((action) => ({
        street: action.street,
        sessionPlayerId: action.sessionPlayerId,
        actionType: action.actionType,
        amount: action.amount
      }))
    } satisfies SaveRecordedHandInput);
  }

  protected selectedPlayersLabel(): string {
    return this.selectedPlayers()
      .map((player) => player.name)
      .join(', ') || 'No players selected';
  }

  protected boardLabel(): string {
    return (
      this.boardCards()
        .map((card) => `${card.rank}${this.suitSymbol(card.suit)}`)
        .join(' ') || 'No board cards'
    );
  }

  protected streetLabel(street: RecordedHandStreet): string {
    return street.charAt(0) + street.slice(1).toLowerCase();
  }

  protected actionLabel(action: RecordedHandActionType): string {
    return action === 'ALL_IN' ? 'All In' : action.charAt(0) + action.slice(1).toLowerCase();
  }

  protected suitSymbol(suit: RecordedHandBoardCard['suit']): string {
    return {
      HEART: '♥',
      DIAMOND: '♦',
      CLUB: '♣',
      SPADE: '♠'
    }[suit];
  }

  protected isRedSuit(suit: RecordedHandBoardCard['suit']): boolean {
    return suit === 'HEART' || suit === 'DIAMOND';
  }
}
