import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AuthStateService } from '../../core/auth/auth-state.service';
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
const tagIcons: Record<string, string> = {
  'Huge Bluff': '☆',
  'Bad Beat': '♥',
  'Hero Call': '♠',
  'Funny Moment': '☺',
  'Big Pot': '♛',
  'Sick River': '↗'
};
const streets: RecordedHandStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
const actionTypes: RecordedHandActionType[] = ['RAISE', 'CALL', 'CHECK', 'FOLD', 'BET', 'ALL_IN'];
const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const suits: RecordedHandBoardCard['suit'][] = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
const chipAmounts = [25, 50, 100, 200, 500, 1000];

@Component({
  selector: 'app-record-hand-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <section class="record-hand max-h-[94vh] w-[min(98vw,96rem)] overflow-y-auto bg-neutral-950 text-neutral-50">
      @if (step() === 1) {
        <header class="setup-topbar">
          <div class="flex min-w-0 flex-wrap items-center gap-4">
            <div class="flex items-center gap-3">
              <span class="brand-spade" aria-hidden="true">♠</span>
              <span class="text-2xl font-black text-white sm:text-3xl">
                Poker<span class="text-emerald-400">Track</span>
              </span>
            </div>
            <span class="hidden h-12 w-px bg-white/15 md:block"></span>
            <div class="session-pill">
              <span class="session-chip-icon" aria-hidden="true">◉</span>
              <span class="min-w-0">
                <span class="block truncate text-lg font-bold text-white">{{ data.session.name }}</span>
                <span class="mt-0.5 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                  {{ data.session.status === 'ACTIVE' ? 'Active Session' : 'Completed Session' }}
                </span>
              </span>
            </div>
          </div>
          <div class="flex shrink-0 gap-3">
            <button type="button" class="setup-cancel-button" (click)="closeDialog()">
              <span class="text-2xl leading-none text-neutral-400" aria-hidden="true">×</span>
              Cancel
            </button>
            <button
              type="button"
              [disabled]="selectedPlayerIds().length === 0"
              class="setup-next-button"
              (click)="goNext()"
            >
              Next: Build Hand
              <span class="text-2xl leading-none" aria-hidden="true">→</span>
            </button>
          </div>
        </header>

        <div class="setup-page">
          <div class="grid gap-5 xl:grid-cols-[0.9fr_1.05fr_0.9fr]">
            <div class="xl:col-span-3">
              <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div class="flex items-center gap-4">
                    <h2 class="text-4xl font-black tracking-tight text-white sm:text-5xl">Record Hand</h2>
                    <span class="text-3xl text-emerald-400" aria-hidden="true">▦</span>
                  </div>
                  <p class="mt-2 text-lg text-neutral-400">
                    Capture and share the best hands from your session.
                  </p>
                </div>

                <div class="setup-stepper">
                  @for (label of stepLabels; track label; let index = $index) {
                    <div class="setup-step" [class.setup-step-active]="step() === index + 1">
                      <span class="setup-step-number">{{ index + 1 }}</span>
                      <span>{{ label }}</span>
                    </div>
                    @if (index < stepLabels.length - 1) {
                      <span class="setup-step-line" aria-hidden="true"></span>
                    }
                  }
                </div>
              </div>
            </div>

            <article class="setup-card">
              <div class="setup-card-heading">
                <span class="setup-card-icon" aria-hidden="true">◇</span>
                <span>
                  <span class="block text-xl font-bold text-white">Hand Info</span>
                  <span class="mt-1 block text-sm text-neutral-400">Add tags to describe this hand.</span>
                </span>
              </div>

              <div class="mt-6 grid gap-3 sm:grid-cols-2">
                @for (tag of tagOptions; track tag) {
                  <button
                    type="button"
                    class="setup-tag-card"
                    [class.setup-tag-card-selected]="tagSelected(tag)"
                    (click)="toggleTag(tag)"
                  >
                    <span class="setup-tag-icon" [attr.data-tag]="tag" aria-hidden="true">{{ tagIcon(tag) }}</span>
                    <span class="font-semibold">{{ tag }}</span>
                    @if (tagSelected(tag)) {
                      <span class="setup-check" aria-hidden="true">✓</span>
                    }
                  </button>
                }
              </div>

              <p class="mt-8 flex items-center gap-2 text-sm text-neutral-400">
                You can add multiple tags.
                <span class="grid h-5 w-5 place-items-center rounded-full border border-white/20 text-xs">i</span>
              </p>
            </article>

            <article class="setup-card">
              <div class="setup-card-heading">
                <span class="setup-card-icon" aria-hidden="true">♙</span>
                <span>
                  <span class="block text-xl font-bold text-white">Players In This Hand</span>
                  <span class="mt-1 block text-sm text-neutral-400">Select all players involved.</span>
                </span>
              </div>

              <div class="mt-6 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
                @for (player of data.session.players; track player.id) {
                  <button
                    type="button"
                    class="setup-player-token"
                    [class.setup-player-token-selected]="playerSelected(player.id)"
                    (click)="togglePlayer(player.id)"
                  >
                    <span class="setup-player-avatar">
                      {{ playerInitials(player.name) }}
                      @if (playerSelected(player.id)) {
                        <span class="setup-avatar-check" aria-hidden="true">✓</span>
                      }
                    </span>
                    <span class="mt-2 block truncate font-semibold text-white">{{ player.name }}</span>
                    <span
                      class="mt-1 rounded-md px-2 py-0.5 text-xs font-semibold"
                      [class.bg-emerald-400/15]="player.status === 'ACTIVE'"
                      [class.text-emerald-300]="player.status === 'ACTIVE'"
                      [class.bg-white/10]="player.status === 'COMPLETED'"
                      [class.text-neutral-400]="player.status === 'COMPLETED'"
                    >
                      {{ player.status === 'ACTIVE' ? 'Active' : 'Cashed' }}
                    </span>
                  </button>
                }
              </div>

              <div class="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-sm text-neutral-400">
                  <span class="font-bold text-emerald-300">{{ selectedPlayerIds().length }}</span>
                  of {{ data.session.players.length }} players selected
                </p>
                <div class="flex gap-2">
                  <button type="button" class="setup-small-button setup-small-button-primary" (click)="selectAllPlayers()">
                    ♙ Select All
                  </button>
                  <button type="button" class="setup-small-button" (click)="clearPlayers()">
                    ⊖ Clear
                  </button>
                </div>
              </div>
            </article>

            <article class="setup-card">
              <div class="setup-card-heading">
                <span class="setup-card-icon" aria-hidden="true">▣</span>
                <span>
                  <span class="block text-xl font-bold text-white">Privacy & Session</span>
                  <span class="mt-1 block text-sm text-neutral-400">
                    This hand will be linked to the current session.
                  </span>
                </span>
              </div>

              <div class="mt-6 overflow-hidden rounded-xl border border-white/10">
                <div class="setup-info-row">
                  <span class="setup-info-icon">◉</span>
                  <span>Session</span>
                  <strong>{{ data.session.name }}</strong>
                </div>
                <div class="setup-info-row">
                  <span class="setup-info-icon">♙</span>
                  <span>Created by</span>
                  <strong>{{ creatorName() }}</strong>
                </div>
                <div class="setup-info-row">
                  <span class="setup-info-icon">♧</span>
                  <span>Visibility</span>
                  <strong>Session Members</strong>
                </div>
                <div class="setup-info-row">
                  <span class="setup-info-icon">▣</span>
                  <span>Privacy</span>
                  <strong>Public in Session</strong>
                </div>
              </div>

              <div class="mt-4 flex gap-3 rounded-xl border border-white/10 bg-emerald-400/10 p-4">
                <span class="text-3xl text-emerald-300" aria-hidden="true">◎</span>
                <p class="text-sm leading-6 text-neutral-300">
                  This hand and its details will be visible to all members of this session.
                </p>
              </div>
            </article>

            <article class="setup-comment-card xl:col-span-3">
              <div class="min-w-0 flex-1">
                <div class="setup-card-heading">
                  <span class="setup-card-icon" aria-hidden="true">☵</span>
                  <span>
                    <span class="block text-xl font-bold text-white">Comment</span>
                    <span class="mt-1 block text-sm text-neutral-400">Add an optional note about this hand.</span>
                  </span>
                </div>
                <div class="relative mt-4">
                  <textarea
                    id="handComment"
                    rows="3"
                    maxlength="200"
                    [formControl]="comment"
                    class="setup-comment-input"
                    placeholder="Why is this hand interesting?"
                  ></textarea>
                  <span class="absolute bottom-3 right-4 text-xs font-semibold text-neutral-500">
                    {{ commentLength() }} / 200
                  </span>
                </div>
              </div>
              <div class="setup-card-art" aria-hidden="true">
                <span class="art-card art-card-left">A♠</span>
                <span class="art-chip">♠</span>
                <span class="art-card art-card-right">A♥</span>
              </div>
            </article>
          </div>
        </div>
      } @else {
        <header class="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
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

      @if (step() > 1) {
        <footer class="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div class="text-xs text-neutral-500">
            Visible to table operators and players in this session.
          </div>
          <div class="flex flex-wrap justify-end gap-2">
              <button type="button" class="footer-button" (click)="goBack()">
              Back
            </button>
            <button type="button" class="footer-button" (click)="save('DRAFT')">Save Draft</button>
            @if (step() < 3) {
              <button
                type="button"
                class="rounded-lg px-5 py-3 text-sm font-black text-neutral-950 transition hover:opacity-90"
                [class.bg-emerald-400]="accent() === 'emerald'"
                [class.bg-sky-300]="accent() === 'sky'"
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
      }
    </section>
  `,
  styles: [
    `
      .record-hand {
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.85rem;
        background:
          radial-gradient(circle at 78% 88%, rgb(34 197 94 / 0.12), transparent 22rem),
          linear-gradient(135deg, rgb(2 6 8), rgb(10 13 15) 52%, rgb(3 7 9));
        box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.55);
      }

      .setup-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        background: rgb(0 0 0 / 0.34);
      }

      .brand-spade {
        display: grid;
        width: 2.85rem;
        height: 2.85rem;
        place-items: center;
        color: rgb(34 197 94);
        font-size: 2.45rem;
        line-height: 1;
        filter: drop-shadow(0 0 0.75rem rgb(34 197 94 / 0.25));
      }

      .session-pill {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.85rem;
      }

      .session-chip-icon {
        display: grid;
        width: 3.1rem;
        height: 3.1rem;
        flex: 0 0 auto;
        place-items: center;
        border: 0.18rem solid rgb(34 197 94);
        border-radius: 9999px;
        color: white;
        font-size: 1.5rem;
        box-shadow: 0 0 1.5rem rgb(34 197 94 / 0.25);
      }

      .setup-cancel-button,
      .setup-next-button,
      .setup-small-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.55rem;
        min-height: 3.3rem;
        border-radius: 0.45rem;
        font-weight: 800;
        transition:
          transform 180ms ease,
          border-color 180ms ease,
          background-color 180ms ease,
          opacity 180ms ease;
      }

      .setup-cancel-button {
        border: 1px solid rgb(255 255 255 / 0.16);
        background: rgb(255 255 255 / 0.04);
        padding: 0 1.25rem;
        color: rgb(229 229 229);
      }

      .setup-next-button {
        border: 1px solid rgb(74 222 128 / 0.45);
        background: linear-gradient(135deg, rgb(34 197 94), rgb(21 128 61));
        padding: 0 1.4rem;
        color: white;
        box-shadow: 0 1rem 2rem rgb(34 197 94 / 0.18);
      }

      .setup-next-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      .setup-cancel-button:hover,
      .setup-next-button:hover:not(:disabled),
      .setup-small-button:hover {
        transform: translateY(-1px);
      }

      .setup-page {
        padding: 1.8rem;
      }

      .setup-stepper {
        display: grid;
        grid-template-columns: auto minmax(4rem, 12rem) auto minmax(4rem, 12rem) auto;
        align-items: center;
        gap: 0.8rem;
        width: min(100%, 52rem);
      }

      .setup-step {
        display: grid;
        justify-items: center;
        gap: 0.45rem;
        color: rgb(163 163 163);
        font-size: 0.95rem;
        font-weight: 700;
      }

      .setup-step-active {
        color: rgb(34 197 94);
      }

      .setup-step-number {
        display: grid;
        width: 2.75rem;
        height: 2.75rem;
        place-items: center;
        border: 2px solid rgb(82 82 82);
        border-radius: 9999px;
        background: rgb(23 23 23);
        color: rgb(212 212 212);
        font-size: 1.2rem;
      }

      .setup-step-active .setup-step-number {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.28);
        color: white;
        box-shadow: 0 0 1.25rem rgb(34 197 94 / 0.24);
      }

      .setup-step-line {
        height: 2px;
        background: linear-gradient(90deg, rgb(34 197 94), rgb(255 255 255 / 0.16));
      }

      .setup-card,
      .setup-comment-card {
        border: 1px solid rgb(255 255 255 / 0.14);
        border-radius: 0.65rem;
        background:
          radial-gradient(circle at 85% 10%, rgb(34 197 94 / 0.08), transparent 12rem),
          linear-gradient(145deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025));
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
      }

      .setup-card {
        padding: 1.35rem;
      }

      .setup-comment-card {
        display: flex;
        align-items: flex-end;
        gap: 2rem;
        overflow: hidden;
        padding: 1.25rem 1.35rem;
      }

      .setup-card-heading {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
      }

      .setup-card-icon {
        color: rgb(34 197 94);
        font-size: 1.8rem;
        line-height: 1;
      }

      .setup-tag-card {
        position: relative;
        display: flex;
        min-height: 4.2rem;
        align-items: center;
        gap: 1rem;
        border: 1px solid rgb(255 255 255 / 0.14);
        border-radius: 0.65rem;
        background: rgb(255 255 255 / 0.035);
        padding: 0.9rem 1rem;
        color: rgb(245 245 245);
        text-align: left;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          transform 180ms ease,
          box-shadow 180ms ease;
      }

      .setup-tag-card:hover,
      .setup-tag-card-selected {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.1);
        box-shadow: 0 0 0 1px rgb(34 197 94 / 0.22);
        transform: translateY(-1px);
      }

      .setup-tag-icon {
        display: grid;
        width: 2.1rem;
        height: 2.1rem;
        flex: 0 0 auto;
        place-items: center;
        color: rgb(250 204 21);
        font-size: 1.5rem;
        font-weight: 900;
      }

      .setup-tag-icon[data-tag='Bad Beat'] {
        color: rgb(248 113 113);
      }

      .setup-tag-icon[data-tag='Hero Call'] {
        color: rgb(96 165 250);
      }

      .setup-tag-icon[data-tag='Funny Moment'] {
        color: rgb(192 132 252);
      }

      .setup-tag-icon[data-tag='Sick River'] {
        color: rgb(34 197 94);
      }

      .setup-check,
      .setup-avatar-check {
        display: grid;
        place-items: center;
        border-radius: 9999px;
        background: rgb(34 197 94);
        color: white;
        font-weight: 900;
      }

      .setup-check {
        margin-left: auto;
        width: 1.35rem;
        height: 1.35rem;
        font-size: 0.8rem;
      }

      .setup-player-token {
        min-width: 0;
        text-align: center;
        color: rgb(229 229 229);
      }

      .setup-player-avatar {
        position: relative;
        display: grid;
        width: 4.5rem;
        height: 4.5rem;
        margin: 0 auto;
        place-items: center;
        border: 3px solid rgb(82 82 82);
        border-radius: 9999px;
        background: rgb(23 23 23);
        color: rgb(229 229 229);
        font-size: 1.45rem;
        font-weight: 900;
        transition:
          border-color 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }

      .setup-player-token:hover .setup-player-avatar,
      .setup-player-token-selected .setup-player-avatar {
        border-color: rgb(34 197 94);
        box-shadow: 0 0 1.5rem rgb(34 197 94 / 0.18);
        transform: translateY(-1px);
      }

      .setup-avatar-check {
        position: absolute;
        right: -0.15rem;
        top: -0.35rem;
        width: 1.55rem;
        height: 1.55rem;
        font-size: 0.9rem;
      }

      .setup-small-button {
        min-height: 2.55rem;
        border: 1px solid rgb(255 255 255 / 0.14);
        background: transparent;
        padding: 0 0.85rem;
        color: rgb(245 245 245);
        font-size: 0.9rem;
      }

      .setup-small-button-primary {
        border-color: rgb(34 197 94 / 0.55);
        color: rgb(134 239 172);
      }

      .setup-info-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.8rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.08);
        padding: 0.9rem 1rem;
        color: rgb(212 212 212);
      }

      .setup-info-row:last-child {
        border-bottom: 0;
      }

      .setup-info-row strong {
        color: white;
        text-align: right;
      }

      .setup-info-icon {
        color: rgb(34 197 94);
        font-size: 1.35rem;
      }

      .setup-comment-input {
        min-height: 5.7rem;
        width: 100%;
        resize: none;
        border: 1px solid rgb(255 255 255 / 0.14);
        border-radius: 0.55rem;
        background: rgb(0 0 0 / 0.22);
        padding: 1rem 4.5rem 1rem 1rem;
        color: white;
        outline: none;
        transition: border-color 180ms ease;
      }

      .setup-comment-input:focus {
        border-color: rgb(34 197 94);
      }

      .setup-card-art {
        position: relative;
        display: grid;
        width: min(22rem, 30vw);
        min-height: 8rem;
        place-items: end center;
      }

      .art-card {
        position: absolute;
        display: grid;
        width: 4.4rem;
        height: 6rem;
        place-items: center;
        border-radius: 0.45rem;
        background: linear-gradient(150deg, white, rgb(212 212 212));
        color: rgb(23 23 23);
        font-size: 1.5rem;
        font-weight: 900;
        box-shadow: 0 1rem 1.5rem rgb(0 0 0 / 0.35);
      }

      .art-card-left {
        right: 5.3rem;
        bottom: 0.4rem;
        transform: rotate(-13deg);
      }

      .art-card-right {
        right: 1.5rem;
        bottom: 0;
        color: rgb(220 38 38);
        transform: rotate(11deg);
      }

      .art-chip {
        position: absolute;
        right: 6.4rem;
        bottom: 0.25rem;
        display: grid;
        width: 5.4rem;
        height: 2.5rem;
        place-items: center;
        border: 0.55rem dashed white;
        border-radius: 9999px;
        background: rgb(22 101 52);
        color: white;
        font-size: 1.1rem;
        font-weight: 900;
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
  private readonly authState = inject(AuthStateService);
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
  protected readonly creatorName = computed(() => {
    const profile = this.authState.profile();
    const role = profile?.role ? ` (${profile.role === 'HOST' ? 'Host' : profile.role})` : '';

    return `${profile?.displayName ?? 'Current user'}${role}`;
  });
  protected readonly selectedPlayers = computed(() =>
    this.data.session.players.filter((player) => this.selectedPlayerIds().includes(player.id))
  );

  protected closeDialog(): void {
    this.dialogRef.close();
  }

  protected tagIcon(tag: string): string {
    return tagIcons[tag] ?? '*';
  }

  protected playerInitials(name: string): string {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) {
      return 'P';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toLocaleUpperCase();
    }

    return parts.map((part) => part.charAt(0)).join('').toLocaleUpperCase();
  }

  protected selectAllPlayers(): void {
    const playerIds = this.data.session.players.map((player) => player.id);
    this.selectedPlayerIds.set(playerIds);
    this.selectedActionPlayerId.set(playerIds[0] ?? null);
  }

  protected clearPlayers(): void {
    this.selectedPlayerIds.set([]);
    this.selectedActionPlayerId.set(null);
  }

  protected commentLength(): number {
    return this.comment.value.length;
  }

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
