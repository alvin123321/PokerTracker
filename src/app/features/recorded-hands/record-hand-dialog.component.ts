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
  actionOrder: number;
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

        <div class="setup-page step-panel">
          <div class="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
            <div class="xl:col-span-2">
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

              <div class="setup-tag-grid mt-6 grid gap-3 sm:grid-cols-2">
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

              <div class="setup-player-tools mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
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

            <article class="setup-comment-card xl:col-span-2">
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
        <header class="flow-topbar">
          <div class="min-w-0">
            <div class="flex min-w-0 items-center gap-3">
              <span class="brand-spade flow-brand" aria-hidden="true">â™ </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  {{ data.session.name }}
                </p>
                <h2 class="mt-0.5 text-2xl font-black text-white">Record Hand</h2>
              </div>
            </div>
          </div>

          <div class="flow-stepper" aria-label="Record hand steps">
            @for (label of stepLabels; track label; let index = $index) {
              <button
                type="button"
                class="flow-step"
                [class.flow-step-active]="step() === index + 1"
                [class.flow-step-complete]="step() > index + 1"
                [disabled]="index + 1 > step()"
                (click)="goToStep(index + 1)"
              >
                <span>{{ step() > index + 1 ? '✓' : index + 1 }}</span>
                <strong>{{ label }}</strong>
              </button>
              @if (index < stepLabels.length - 1) {
                <span class="flow-step-line" [class.flow-step-line-active]="step() > index + 1"></span>
              }
            }
          </div>

          <div class="flow-actions">
            <button type="button" class="setup-cancel-button" (click)="closeDialog()">Cancel</button>
            @if (step() < 3) {
              <button type="button" class="setup-next-button" (click)="goNext()">
                Next: {{ stepLabels[step()] }}
                <span aria-hidden="true">-&gt;</span>
              </button>
            }
          </div>
        </header>
      }

      @if (step() === 2) {
        <div class="build-page step-panel">
          <nav class="street-tabs" aria-label="Hand streets">
            @for (street of streetOptions; track street) {
              <button
                type="button"
                class="street-tab"
                [class.street-tab-active]="selectedStreet() === street"
                (click)="selectedStreet.set(street)"
              >
                <span class="street-tab-name">{{ streetLabel(street) }}</span>
                <span class="street-tab-count">{{ streetActionCount(street) }} actions</span>
              </button>
            }
          </nav>

          <div class="build-clean-grid">
            <section class="build-card build-board-card board-workbench-card">
              <div class="build-section-heading">
                <div>
                  <p class="build-kicker">Cards</p>
                  <h3>Board Overview</h3>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="build-small-button"
                    [disabled]="boardCards().length === 0"
                    (click)="removeLastBoardCard()"
                  >
                    Undo Card
                  </button>
                  <button
                    type="button"
                    class="build-small-button"
                    [disabled]="boardCards().length === 0"
                    (click)="clearBoard()"
                  >
                    Clear Board
                  </button>
                </div>
              </div>

              <div class="board-stage">
                <div class="board-stage-felt">
                  @for (card of boardCards(); track card.rank + card.suit) {
                    <span class="build-playing-card" [class.card-red]="isRedSuit(card.suit)">
                      <span>{{ card.rank }}</span>
                      <span>{{ suitSymbol(card.suit) }}</span>
                    </span>
                  }
                  @for (slot of emptyBoardSlots(); track slot) {
                    <span class="board-empty-slot">
                      {{ slot <= 3 ? 'Flop' : slot === 4 ? 'Turn' : 'River' }}
                    </span>
                  }
                </div>
                <div class="board-street-helper">
                  <span>Flop</span>
                  <span>Turn</span>
                  <span>River</span>
                </div>
              </div>

              <div class="board-picker">
                <div class="suit-picker-panel">
                  <p class="build-kicker">Suit</p>
                  <div class="suit-grid">
                    @for (suit of suitOptions; track suit) {
                      <button
                        type="button"
                        class="suit-button"
                        [class.suit-button-active]="selectedSuit() === suit"
                        [class.suit-button-red]="isRedSuit(suit)"
                        (click)="selectedSuit.set(suit)"
                      >
                        {{ suitSymbol(suit) }}
                      </button>
                    }
                  </div>
                </div>
                <div class="rank-picker-panel">
                  <p class="build-kicker">Card Value</p>
                  <div class="rank-grid">
                    @for (rank of rankOptions; track rank) {
                      <button
                        type="button"
                        class="rank-button"
                        [class.rank-button-active]="selectedRank() === rank"
                        (click)="selectedRank.set(rank)"
                      >
                        {{ rank }}
                      </button>
                    }
                  </div>
                </div>
              </div>

              <button
                type="button"
                [disabled]="boardCards().length >= 5"
                class="build-primary-button board-add-button"
                (click)="addBoardCard()"
              >
                Add {{ selectedRank() }}{{ suitSymbol(selectedSuit()) }} to Board
              </button>
            </section>

            <section class="build-card action-workbench">
              <div class="build-section-heading">
                <div>
                  <p class="build-kicker">Build Action</p>
                  <h3>{{ streetLabel(selectedStreet()) }}</h3>
                </div>
                <span class="street-badge">{{ selectedActionPlayerName() || 'Choose player' }}</span>
              </div>

              <div class="action-panel-section">
                <p class="build-kicker">Select Player</p>
                <div class="action-player-grid">
                  @for (player of selectedPlayers(); track player.id) {
                    <button
                      type="button"
                      class="action-player-button"
                      [class.action-player-button-active]="selectedActionPlayerId() === player.id"
                      (click)="selectedActionPlayerId.set(player.id)"
                    >
                      <span>{{ playerInitials(player.name) }}</span>
                      <strong>{{ player.name }}</strong>
                    </button>
                  } @empty {
                    <p class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-base text-amber-50">
                      Go back and select at least one player.
                    </p>
                  }
                </div>
              </div>

              <div class="action-panel-section">
                <p class="build-kicker">Select Action</p>
                <div class="action-type-grid">
                  @for (action of actionOptions; track action) {
                    <button
                      type="button"
                      class="action-type-button"
                      [class.action-type-button-active]="selectedActionType() === action"
                      [attr.data-action]="action"
                      (click)="selectActionType(action)"
                    >
                      <span>{{ actionIcon(action) }}</span>
                      <strong>{{ actionLabel(action) }}</strong>
                    </button>
                  }
                </div>
              </div>

              @if (actionNeedsAmount()) {
                <div class="action-panel-section amount-panel">
                  <div class="flex items-center justify-between gap-3">
                    <p class="build-kicker">Amount</p>
                    <span class="amount-hint">Required for {{ actionLabel(selectedActionType()) }}</span>
                  </div>
                  <div class="amount-row">
                    <button type="button" class="amount-stepper build-stepper" (click)="stepAmount(-25)">-</button>
                    <input
                      type="number"
                      min="0"
                      step="25"
                      inputmode="decimal"
                      [formControl]="amount"
                      class="build-amount-input"
                      (focus)="clearAmount()"
                    />
                    <button type="button" class="amount-stepper build-stepper" (click)="stepAmount(25)">+</button>
                  </div>
                  <div class="chip-grid">
                    @for (chip of chips; track chip) {
                      <button
                        type="button"
                        class="chip-button"
                        [class.chip-button-active]="amount.value === chip"
                        (click)="setAmount(chip)"
                      >
                        {{ chip | currency: 'USD' : 'symbol' : '1.0-0' }}
                      </button>
                    }
                  </div>
                </div>
              }

              <button
                type="button"
                [disabled]="!canAddAction()"
                class="build-primary-button action-add-row"
                (click)="addAction()"
              >
                Add {{ actionLabel(selectedActionType()) }} to {{ streetLabel(selectedStreet()) }}
              </button>
            </section>

            <section class="build-card timeline-card">
              <div class="build-section-heading">
                <div>
                  <p class="build-kicker">Action Timeline</p>
                  <h3>{{ streetLabel(selectedStreet()) }}</h3>
                </div>
                <button
                  type="button"
                  [disabled]="actions().length === 0"
                  class="build-small-button"
                  (click)="undoAction()"
                >
                  Undo Last
                </button>
              </div>

              <div class="timeline-list">
                @for (action of activeStreetActions(); track action.id) {
                  <article class="timeline-action" [attr.data-action]="action.actionType">
                    <span class="timeline-order">{{ action.actionOrder }}</span>
                    <span class="timeline-player">{{ action.playerName }}</span>
                    <span class="timeline-action-text">
                      {{ actionLabel(action.actionType) }}
                      @if (action.amount !== null) {
                        <strong>{{ action.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                      }
                    </span>
                  </article>
                } @empty {
                  <div class="timeline-empty">
                    No {{ streetLabel(selectedStreet()).toLowerCase() }} action yet.
                  </div>
                }
              </div>

              <div class="street-summary-grid">
                @for (street of streetOptions; track street) {
                  <button
                    type="button"
                    class="street-summary-button"
                    [class.street-summary-button-active]="selectedStreet() === street"
                    (click)="selectedStreet.set(street)"
                  >
                    <span>{{ streetLabel(street) }}</span>
                    <strong>{{ streetActionCount(street) }}</strong>
                  </button>
                }
              </div>
            </section>
          </div>
        </div>
      }

      @if (step() === 3) {
        <div class="review-page step-panel">
          <section class="review-board-card">
            <div class="review-board-meta">
              <div>
                <p class="build-kicker">Recorded Hand</p>
                <h3>{{ selectedTags()[0] || 'Hand Review' }}</h3>
              </div>
              <div class="review-tags">
                @for (tag of selectedTags(); track tag) {
                  <span>{{ tag }}</span>
                } @empty {
                  <span>Recorded hand</span>
                }
              </div>
            </div>

            <div class="review-board-diagram">
              <div class="review-table">
                <div class="review-board-row">
                  @for (card of boardCards(); track card.rank + card.suit) {
                    <span class="build-playing-card review-card" [class.card-red]="isRedSuit(card.suit)">
                      <span>{{ card.rank }}</span>
                      <span>{{ suitSymbol(card.suit) }}</span>
                    </span>
                  }
                  @for (slot of emptyBoardSlots(); track slot) {
                    <span class="board-empty-slot review-empty-card">
                      {{ slot <= 3 ? 'Flop' : slot === 4 ? 'Turn' : 'River' }}
                    </span>
                  }
                </div>
                <div class="review-table-footer">
                  <span>{{ selectedPlayers().length }} players</span>
                  <span>{{ actions().length }} actions</span>
                  <span>{{ boardCards().length }} cards</span>
                </div>
              </div>
            </div>

            @if (comment.value.trim()) {
              <p class="review-comment">{{ comment.value.trim() }}</p>
            }
          </section>

          <section class="review-action-board">
            @for (street of streetOptions; track street) {
              <article class="review-street-column">
                <div class="review-street-heading">
                  <span>{{ streetLabel(street) }}</span>
                  <strong>{{ streetActionCount(street) }}</strong>
                </div>
                <div class="review-action-list">
                  @for (action of actionsForStreet(street); track action.id) {
                    <div class="review-action-row" [attr.data-action]="action.actionType">
                      <span class="review-action-icon">{{ actionIcon(action.actionType) }}</span>
                      <span class="review-action-copy">
                        <strong>{{ action.playerName }}</strong>
                        <small>{{ actionLabel(action.actionType) }}</small>
                      </span>
                      @if (action.amount !== null) {
                        <span class="review-action-amount">
                          {{ action.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </span>
                      }
                    </div>
                  } @empty {
                    <p class="review-empty-action">No action recorded</p>
                  }
                </div>
              </article>
            }
          </section>
        </div>
      }

      <footer class="record-flow-footer">
          <div class="text-xs text-neutral-500">
            Visible to table operators and players in this session.
          </div>
          <div class="footer-actions">
            @if (step() === 1) {
              <button type="button" class="footer-button" (click)="closeDialog()">
                Cancel
              </button>
            } @else {
              <button type="button" class="footer-button" (click)="goBack()">
                Back
              </button>
              <button type="button" class="footer-button" (click)="save('DRAFT')">Save Draft</button>
            }
            @if (step() < 3) {
              <button
                type="button"
                class="footer-primary-button"
                [class.bg-emerald-400]="accent() === 'emerald'"
                [class.bg-sky-300]="accent() === 'sky'"
                [disabled]="step() === 1 && selectedPlayerIds().length === 0"
                (click)="goNext()"
              >
                Next: {{ stepLabels[step()] }}
              </button>
            } @else {
              <button
                type="button"
                class="footer-primary-button bg-white"
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
        border-radius: 0.85rem;
        background:
          radial-gradient(circle at 78% 88%, rgb(34 197 94 / 0.12), transparent 22rem),
          linear-gradient(135deg, rgb(2 6 8), rgb(10 13 15) 52%, rgb(3 7 9));
        box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.55);
      }

      .step-panel {
        animation: step-fade-rise 260ms ease-out both;
      }

      @keyframes step-fade-rise {
        from {
          opacity: 0;
          transform: translateY(0.75rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes selected-glow {
        0%,
        100% {
          box-shadow:
            0 0 0 1px rgb(34 197 94 / 0.18),
            0 0 0.75rem rgb(34 197 94 / 0.14);
        }

        50% {
          box-shadow:
            0 0 0 1px rgb(34 197 94 / 0.38),
            0 0 1.45rem rgb(34 197 94 / 0.36);
        }
      }

      @keyframes card-pop-in {
        from {
          opacity: 0;
          transform: translateY(0.45rem) scale(0.92);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes action-slide-in {
        from {
          opacity: 0;
          transform: translateX(-0.55rem);
        }

        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .record-flow-footer {
        position: sticky;
        bottom: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        border-top: 1px solid rgb(255 255 255 / 0.1);
        background:
          linear-gradient(180deg, rgb(10 10 10 / 0.92), rgb(10 10 10 / 0.98)),
          rgb(10 10 10);
        padding: 0.85rem 1rem;
        backdrop-filter: blur(1rem);
      }

      .footer-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.55rem;
      }

      .footer-primary-button {
        min-height: 3.1rem;
        border-radius: 0.5rem;
        padding: 0 1.1rem;
        color: rgb(10 10 10);
        font-size: 0.9rem;
        font-weight: 950;
        transition:
          opacity 180ms ease,
          transform 180ms ease;
      }

      .footer-primary-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
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

      .setup-next-button:not(:disabled),
      .footer-primary-button:not(:disabled) {
        box-shadow:
          0 0 0 1px rgb(34 197 94 / 0.18),
          0 0.85rem 1.5rem rgb(34 197 94 / 0.2);
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
        transform: translateY(-1px);
      }

      .setup-tag-card-selected {
        animation: selected-glow 1.8s ease-in-out infinite;
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
        transform: translateY(-1px);
      }

      .setup-player-token-selected .setup-player-avatar {
        animation: selected-glow 1.8s ease-in-out infinite;
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

      .build-page {
        padding: 1.35rem;
      }

      .street-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .street-tab {
        display: flex;
        min-height: 4.35rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.7rem;
        background: rgb(255 255 255 / 0.035);
        padding: 0.85rem 1rem;
        color: rgb(229 229 229);
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          transform 180ms ease;
      }

      .street-tab:hover,
      .street-tab-active {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.14);
        transform: translateY(-1px);
      }

      .street-tab-active {
        animation: selected-glow 1.9s ease-in-out infinite;
      }

      .street-tab-name {
        font-size: 1.2rem;
        font-weight: 900;
      }

      .street-tab-count {
        border-radius: 9999px;
        background: rgb(0 0 0 / 0.28);
        padding: 0.35rem 0.65rem;
        color: rgb(163 163 163);
        font-size: 0.8rem;
        font-weight: 800;
      }

      .build-overview,
      .build-bottom {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(22rem, 0.92fr);
        gap: 1rem;
      }

      .build-bottom {
        margin-top: 1rem;
        align-items: start;
      }

      .build-card {
        border: 1px solid rgb(255 255 255 / 0.13);
        border-radius: 0.75rem;
        background:
          radial-gradient(circle at 90% 5%, rgb(34 197 94 / 0.08), transparent 15rem),
          rgb(255 255 255 / 0.04);
        padding: 1.1rem;
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
      }

      .build-section-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .build-section-heading h3 {
        color: white;
        font-size: 1.45rem;
        font-weight: 900;
      }

      .build-kicker {
        margin-bottom: 0.25rem;
        color: rgb(34 197 94);
        font-size: 0.78rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .build-small-button {
        min-height: 2.45rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.55rem;
        background: rgb(255 255 255 / 0.04);
        padding: 0 0.85rem;
        color: rgb(229 229 229);
        font-size: 0.9rem;
        font-weight: 800;
        transition:
          background-color 180ms ease,
          border-color 180ms ease;
      }

      .build-small-button:hover:not(:disabled) {
        border-color: rgb(34 197 94 / 0.6);
        background: rgb(34 197 94 / 0.1);
      }

      .build-small-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      .board-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        margin-top: 1.1rem;
      }

      .build-playing-card,
      .board-empty-slot {
        display: grid;
        width: 4.9rem;
        height: 6.7rem;
        place-items: center;
        border-radius: 0.55rem;
        font-weight: 900;
      }

      .build-playing-card {
        grid-template-rows: 1fr 1fr;
        background: linear-gradient(150deg, white, rgb(229 229 229));
        color: rgb(23 23 23);
        font-size: 2rem;
        box-shadow: 0 1rem 1.75rem rgb(0 0 0 / 0.28);
        animation: card-pop-in 200ms ease-out both;
      }

      .build-playing-card.card-red {
        color: rgb(220 38 38);
      }

      .board-empty-slot {
        border: 1px dashed rgb(255 255 255 / 0.24);
        background: rgb(0 0 0 / 0.2);
        color: rgb(115 115 115);
        font-size: 0.85rem;
      }

      .rank-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .rank-button,
      .suit-button {
        min-height: 3.2rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.55rem;
        background: rgb(255 255 255 / 0.04);
        color: white;
        font-size: 1.25rem;
        font-weight: 900;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          transform 180ms ease;
      }

      .rank-button:hover,
      .rank-button-active,
      .suit-button:hover,
      .suit-button-active {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.15);
        transform: translateY(-1px);
      }

      .rank-button-active,
      .suit-button-active {
        animation: selected-glow 1.8s ease-in-out infinite;
      }

      .suit-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.55rem;
      }

      .suit-button {
        min-height: 4rem;
        font-size: 2rem;
      }

      .suit-button-red {
        color: rgb(248 113 113);
      }

      .build-primary-button {
        min-height: 3.8rem;
        border-radius: 0.65rem;
        background: linear-gradient(135deg, rgb(34 197 94), rgb(21 128 61));
        color: white;
        font-size: 1.15rem;
        font-weight: 900;
        transition:
          opacity 180ms ease,
          transform 180ms ease;
      }

      .build-primary-button:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      .build-primary-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      .street-badge {
        border-radius: 9999px;
        background: rgb(34 197 94 / 0.14);
        padding: 0.55rem 0.85rem;
        color: rgb(134 239 172);
        font-size: 0.9rem;
        font-weight: 900;
      }

      .overview-board-strip,
      .overview-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        margin-top: 1.15rem;
      }

      .overview-board-strip span {
        border-radius: 0.5rem;
        background: rgb(255 255 255 / 0.08);
        padding: 0.65rem 0.8rem;
        color: white;
        font-size: 1.2rem;
        font-weight: 900;
      }

      .selected-player-strip,
      .action-player-grid,
      .action-type-grid,
      .chip-grid {
        display: grid;
        gap: 0.65rem;
      }

      .selected-player-strip {
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      }

      .overview-player-pill,
      .action-player-button {
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.6rem;
        background: rgb(255 255 255 / 0.04);
        color: white;
        transition:
          border-color 180ms ease,
          background-color 180ms ease;
      }

      .overview-player-pill {
        display: flex;
        min-height: 3.3rem;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.7rem;
        font-weight: 800;
      }

      .overview-player-pill span,
      .action-player-button span {
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        border-radius: 9999px;
        border: 1px solid rgb(34 197 94 / 0.55);
        color: rgb(134 239 172);
        font-size: 0.8rem;
        font-weight: 900;
      }

      .overview-player-pill-active,
      .action-player-button-active {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.13);
        animation: selected-glow 1.8s ease-in-out infinite;
      }

      .overview-stats span {
        display: grid;
        min-width: 7rem;
        border-radius: 0.6rem;
        background: rgb(0 0 0 / 0.2);
        padding: 0.85rem;
        color: rgb(163 163 163);
        font-size: 0.9rem;
      }

      .overview-stats strong {
        color: white;
        font-size: 1.55rem;
      }

      .action-player-grid {
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }

      .action-player-button {
        display: flex;
        min-height: 4.2rem;
        align-items: center;
        gap: 0.75rem;
        padding: 0.8rem;
        text-align: left;
      }

      .action-type-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .action-type-button {
        display: grid;
        min-height: 5rem;
        place-items: center;
        gap: 0.3rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.65rem;
        background: rgb(255 255 255 / 0.04);
        color: white;
        font-size: 1.05rem;
        font-weight: 900;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          transform 180ms ease;
      }

      .action-type-button span {
        color: rgb(34 197 94);
        font-size: 1.6rem;
      }

      .action-type-button:hover,
      .action-type-button-active {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.13);
        transform: translateY(-1px);
      }

      .chip-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }

      .chip-button {
        min-height: 3.2rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.55rem;
        background: rgb(255 255 255 / 0.04);
        color: white;
        font-size: 1rem;
        font-weight: 900;
      }

      .chip-button-active,
      .chip-button:hover {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.15);
      }

      .chip-button-active {
        animation: selected-glow 1.8s ease-in-out infinite;
      }

      .amount-row {
        display: grid;
        grid-template-columns: 4rem 1fr 4rem;
        gap: 0.65rem;
        margin-top: 0.7rem;
      }

      .build-stepper {
        width: 100%;
        height: 3.65rem;
      }

      .build-amount-input {
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.55rem;
        background: rgb(0 0 0 / 0.25);
        color: white;
        text-align: center;
        font-size: 1.45rem;
        font-weight: 900;
        outline: none;
      }

      .timeline-list {
        display: grid;
        gap: 0.65rem;
        margin-top: 1rem;
        min-height: 12rem;
      }

      .timeline-action {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.8rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.65rem;
        background: rgb(0 0 0 / 0.22);
        padding: 0.8rem;
        animation: action-slide-in 200ms ease-out both;
      }

      .timeline-order {
        display: grid;
        width: 2.1rem;
        height: 2.1rem;
        place-items: center;
        border-radius: 9999px;
        border: 1px solid rgb(34 197 94 / 0.55);
        color: rgb(134 239 172);
        font-weight: 900;
      }

      .timeline-player,
      .timeline-action-text {
        color: white;
        font-size: 1rem;
        font-weight: 800;
      }

      .timeline-action-text {
        color: rgb(212 212 212);
        text-align: right;
      }

      .timeline-action-text strong {
        color: rgb(134 239 172);
      }

      .timeline-empty {
        display: grid;
        min-height: 10rem;
        place-items: center;
        border: 1px dashed rgb(255 255 255 / 0.16);
        border-radius: 0.7rem;
        color: rgb(115 115 115);
        font-size: 1rem;
        font-weight: 700;
      }

      .street-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.55rem;
        margin-top: 1rem;
      }

      .street-summary-button {
        display: flex;
        min-height: 3rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.55rem;
        background: rgb(255 255 255 / 0.04);
        padding: 0 0.7rem;
        color: rgb(212 212 212);
        font-size: 0.9rem;
        font-weight: 800;
      }

      .street-summary-button-active {
        border-color: rgb(34 197 94);
        color: rgb(134 239 172);
      }

      @media (max-width: 1100px) {
        .build-overview,
        .build-bottom {
          grid-template-columns: 1fr;
        }

        .chip-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
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

      .flow-topbar {
        display: grid;
        grid-template-columns: minmax(14rem, 1fr) minmax(24rem, 1.25fr) auto;
        align-items: center;
        gap: 1.25rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        background: rgb(0 0 0 / 0.34);
        padding: 1rem 1.35rem;
      }

      .flow-brand {
        width: 2.35rem;
        height: 2.35rem;
        font-size: 2rem;
      }

      .flow-stepper {
        display: grid;
        grid-template-columns: auto minmax(2.5rem, 1fr) auto minmax(2.5rem, 1fr) auto;
        align-items: center;
        gap: 0.65rem;
      }

      .flow-step {
        display: grid;
        justify-items: center;
        gap: 0.35rem;
        border: 0;
        background: transparent;
        color: rgb(163 163 163);
        transition:
          color 240ms ease-in-out,
          transform 240ms ease-in-out,
          opacity 240ms ease-in-out;
      }

      .flow-step:not(:disabled):hover {
        color: rgb(229 229 229);
        transform: translateY(-1px);
      }

      .flow-step span {
        display: grid;
        width: 2.55rem;
        height: 2.55rem;
        place-items: center;
        border: 2px solid rgb(82 82 82);
        border-radius: 9999px;
        background: rgb(23 23 23);
        font-size: 1rem;
        font-weight: 900;
        transition:
          border-color 240ms ease-in-out,
          background-color 240ms ease-in-out,
          box-shadow 240ms ease-in-out,
          transform 240ms ease-in-out;
      }

      .flow-step strong {
        font-size: 0.85rem;
      }

      .flow-step-active,
      .flow-step-complete {
        color: rgb(134 239 172);
      }

      .flow-step-active span,
      .flow-step-complete span {
        border-color: rgb(34 197 94);
        background: rgb(34 197 94 / 0.22);
        color: white;
        box-shadow: 0 0 1.25rem rgb(34 197 94 / 0.2);
      }

      .flow-step-active span {
        transform: scale(1.06);
        animation: selected-glow 1.9s ease-in-out infinite;
      }

      .flow-step-line {
        height: 2px;
        border-radius: 9999px;
        background: rgb(255 255 255 / 0.14);
        transition: background-color 240ms ease-in-out;
      }

      .flow-step-line-active {
        background: rgb(34 197 94 / 0.75);
      }

      .flow-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.65rem;
      }

      button,
      .setup-tag-card,
      .setup-player-token,
      .street-tab,
      .rank-button,
      .suit-button,
      .chip-button,
      .action-player-button,
      .action-type-button,
      .street-summary-button {
        transition:
          background-color 240ms ease-in-out,
          border-color 240ms ease-in-out,
          color 240ms ease-in-out,
          box-shadow 240ms ease-in-out,
          transform 240ms ease-in-out,
          opacity 240ms ease-in-out;
      }

      button:active:not(:disabled),
      .setup-tag-card:active,
      .setup-player-token:active,
      .street-tab:active,
      .rank-button:active,
      .suit-button:active,
      .chip-button:active,
      .action-player-button:active,
      .action-type-button:active {
        transform: translateY(0) scale(0.985);
      }

      .build-clean-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
        gap: 1rem;
        align-items: start;
      }

      .timeline-card {
        grid-column: 1 / -1;
      }

      .board-workbench-card {
        overflow: hidden;
      }

      .board-stage {
        margin-top: 1rem;
        border: 1px solid rgb(34 197 94 / 0.18);
        border-radius: 0.9rem;
        background:
          radial-gradient(circle at 50% 35%, rgb(34 197 94 / 0.12), transparent 17rem),
          rgb(0 0 0 / 0.22);
        padding: 1rem;
      }

      .board-stage-felt {
        display: flex;
        align-items: stretch;
        gap: 0.65rem;
      }

      .board-stage-felt .build-playing-card,
      .board-stage-felt .board-empty-slot {
        width: calc((100% - 3.9rem) / 5);
        min-width: 0;
        height: 7.4rem;
      }

      .board-stage-felt > :nth-child(4),
      .review-board-row > :nth-child(4) {
        margin-left: 0.7rem;
      }

      .board-stage-felt > :nth-child(5),
      .review-board-row > :nth-child(5) {
        margin-left: 0.35rem;
      }

      .board-street-helper {
        display: grid;
        grid-template-columns: 3fr 1fr 1fr;
        gap: 0.8rem;
        margin-top: 0.75rem;
        color: rgb(115 115 115);
        font-size: 0.8rem;
        font-weight: 900;
        text-align: center;
        text-transform: uppercase;
      }

      .board-picker {
        display: grid;
        grid-template-columns: minmax(10rem, 0.34fr) minmax(0, 1fr);
        gap: 1rem;
        margin-top: 1rem;
      }

      .rank-picker-panel,
      .suit-picker-panel,
      .action-panel-section {
        border: 1px solid rgb(255 255 255 / 0.08);
        border-radius: 0.75rem;
        background: rgb(0 0 0 / 0.16);
        padding: 0.85rem;
      }

      .rank-grid {
        grid-template-columns: repeat(7, minmax(0, 1fr));
      }

      .rank-button {
        min-height: 3.45rem;
      }

      .suit-button {
        min-height: 3.45rem;
        font-size: 2.15rem;
      }

      .board-add-button,
      .action-add-row {
        width: 100%;
        margin-top: 1rem;
      }

      .action-panel-section {
        margin-top: 1rem;
      }

      .action-workbench .action-panel-section:first-of-type {
        margin-top: 1.1rem;
      }

      .amount-panel {
        border-color: rgb(34 197 94 / 0.18);
        background: rgb(34 197 94 / 0.045);
      }

      .amount-hint {
        color: rgb(163 163 163);
        font-size: 0.8rem;
        font-weight: 700;
      }

      .amount-row {
        grid-template-columns: 3.5rem 1fr 3.5rem;
        margin-top: 0.35rem;
      }

      .build-amount-input {
        height: 4rem;
        font-size: 1.7rem;
      }

      .chip-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 0.65rem;
      }

      .action-type-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .action-type-button {
        min-height: 5.65rem;
        align-content: center;
        gap: 0.45rem;
        font-size: 1.15rem;
      }

      .action-type-button span,
      .review-action-icon {
        font-size: 2.05rem;
        line-height: 1;
      }

      .action-type-button[data-action='RAISE'],
      .timeline-action[data-action='RAISE'],
      .review-action-row[data-action='RAISE'] {
        --action-color: 34 197 94;
      }

      .action-type-button[data-action='CALL'],
      .timeline-action[data-action='CALL'],
      .review-action-row[data-action='CALL'] {
        --action-color: 59 130 246;
      }

      .action-type-button[data-action='CHECK'],
      .timeline-action[data-action='CHECK'],
      .review-action-row[data-action='CHECK'] {
        --action-color: 20 184 166;
      }

      .action-type-button[data-action='FOLD'],
      .timeline-action[data-action='FOLD'],
      .review-action-row[data-action='FOLD'] {
        --action-color: 239 68 68;
      }

      .action-type-button[data-action='BET'],
      .timeline-action[data-action='BET'],
      .review-action-row[data-action='BET'] {
        --action-color: 234 179 8;
      }

      .action-type-button[data-action='ALL_IN'],
      .timeline-action[data-action='ALL_IN'],
      .review-action-row[data-action='ALL_IN'] {
        --action-color: 168 85 247;
      }

      .action-type-button {
        border-color: rgb(var(--action-color, 255 255 255) / 0.22);
        background:
          linear-gradient(145deg, rgb(var(--action-color, 34 197 94) / 0.08), transparent),
          rgb(255 255 255 / 0.035);
      }

      .action-type-button span {
        color: rgb(var(--action-color, 34 197 94));
      }

      .action-type-button:hover,
      .action-type-button-active {
        border-color: rgb(var(--action-color, 34 197 94) / 0.75);
        background: rgb(var(--action-color, 34 197 94) / 0.16);
        box-shadow: 0 0 0 1px rgb(var(--action-color, 34 197 94) / 0.16);
      }

      .action-type-button-active {
        animation: selected-glow 1.8s ease-in-out infinite;
      }

      .timeline-list {
        grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
        min-height: 0;
      }

      .timeline-action {
        border-color: rgb(var(--action-color, 34 197 94) / 0.24);
        background: rgb(var(--action-color, 34 197 94) / 0.075);
      }

      .timeline-order {
        border-color: rgb(var(--action-color, 34 197 94) / 0.68);
        color: rgb(var(--action-color, 34 197 94));
      }

      .timeline-action-text strong {
        color: rgb(var(--action-color, 34 197 94));
      }

      .review-page {
        display: grid;
        gap: 1rem;
        padding: 1.2rem;
      }

      .review-board-card,
      .review-action-board {
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.85rem;
        background: rgb(255 255 255 / 0.04);
        padding: 1rem;
      }

      .review-board-meta {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .review-board-meta h3 {
        color: white;
        font-size: 1.8rem;
        font-weight: 950;
      }

      .review-tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .review-tags span {
        border-radius: 9999px;
        background: rgb(34 197 94 / 0.16);
        padding: 0.5rem 0.75rem;
        color: rgb(134 239 172);
        font-size: 0.8rem;
        font-weight: 900;
      }

      .review-board-diagram {
        margin-top: 1rem;
        border-radius: 1rem;
        background:
          radial-gradient(ellipse at center, rgb(34 197 94 / 0.18), transparent 65%),
          linear-gradient(135deg, rgb(2 6 8), rgb(10 20 16));
        padding: 1rem;
      }

      .review-table {
        border: 1px solid rgb(34 197 94 / 0.24);
        border-radius: 1.25rem;
        background: rgb(0 0 0 / 0.22);
        padding: 1rem;
      }

      .review-board-row {
        display: flex;
        align-items: stretch;
        gap: 0.65rem;
      }

      .review-card,
      .review-empty-card {
        width: calc((100% - 3.9rem) / 5);
        height: 7.6rem;
      }

      .review-table-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        justify-content: center;
        margin-top: 1rem;
      }

      .review-table-footer span {
        border-radius: 9999px;
        background: rgb(255 255 255 / 0.08);
        padding: 0.5rem 0.75rem;
        color: rgb(212 212 212);
        font-size: 0.85rem;
        font-weight: 800;
      }

      .review-comment {
        margin-top: 1rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.75rem;
        background: rgb(0 0 0 / 0.2);
        padding: 0.9rem 1rem;
        color: rgb(229 229 229);
      }

      .review-action-board {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.8rem;
      }

      .review-street-column {
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.75rem;
        background: rgb(0 0 0 / 0.18);
        padding: 0.8rem;
      }

      .review-street-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.08);
        padding-bottom: 0.65rem;
        color: rgb(134 239 172);
        font-size: 1rem;
        font-weight: 950;
        text-transform: uppercase;
      }

      .review-street-heading strong {
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        border-radius: 9999px;
        background: rgb(34 197 94 / 0.14);
      }

      .review-action-list {
        display: grid;
        gap: 0.6rem;
        margin-top: 0.7rem;
      }

      .review-action-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.65rem;
        border: 1px solid rgb(var(--action-color, 255 255 255) / 0.18);
        border-radius: 0.65rem;
        background: rgb(var(--action-color, 34 197 94) / 0.075);
        padding: 0.7rem;
        animation: action-slide-in 200ms ease-out both;
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 1ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 1ms !important;
        }
      }

      .review-action-icon {
        color: rgb(var(--action-color, 34 197 94));
      }

      .review-action-copy {
        display: grid;
        min-width: 0;
      }

      .review-action-copy strong {
        overflow: hidden;
        color: white;
        font-size: 0.95rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .review-action-copy small {
        color: rgb(163 163 163);
        font-weight: 800;
      }

      .review-action-amount {
        color: rgb(var(--action-color, 34 197 94));
        font-size: 0.95rem;
        font-weight: 950;
      }

      .review-empty-action {
        border: 1px dashed rgb(255 255 255 / 0.12);
        border-radius: 0.65rem;
        padding: 1rem;
        color: rgb(115 115 115);
        font-size: 0.9rem;
        font-weight: 800;
        text-align: center;
      }

      @media (max-width: 1180px) {
        .flow-topbar,
        .build-clean-grid {
          grid-template-columns: 1fr;
        }

        .flow-actions {
          justify-content: stretch;
        }

        .flow-actions > * {
          flex: 1;
        }

        .review-action-board {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .record-hand {
          width: 100vw;
          max-height: 100vh;
          border-radius: 0;
        }

        .setup-topbar,
        .flow-actions {
          display: none;
        }

        .setup-page,
        .build-page,
        .review-page {
          padding: 0.75rem;
        }

        .setup-page .grid {
          gap: 0.75rem;
        }

        .setup-card,
        .setup-comment-card {
          padding: 0.85rem;
        }

        .setup-card-heading {
          gap: 0.55rem;
        }

        .setup-card-heading .text-xl {
          font-size: 1rem;
          line-height: 1.25rem;
        }

        .setup-card-heading .text-sm {
          display: none;
        }

        .setup-card-icon {
          font-size: 1.25rem;
        }

        .setup-tag-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .setup-tag-card {
          min-height: 3.25rem;
          gap: 0.45rem;
          border-radius: 0.5rem;
          padding: 0.55rem;
        }

        .setup-tag-card .font-semibold {
          font-size: 0.78rem;
          line-height: 1rem;
        }

        .setup-tag-icon {
          width: 1.45rem;
          height: 1.45rem;
          font-size: 1.05rem;
        }

        .setup-check {
          width: 1rem;
          height: 1rem;
          font-size: 0.62rem;
        }

        .setup-player-tools {
          display: none;
        }

        .setup-comment-card {
          display: block;
        }

        .setup-comment-input {
          min-height: 6.25rem;
          border-radius: 0.5rem;
          padding: 0.85rem 3.8rem 0.85rem 0.85rem;
        }

        .setup-card-art {
          display: none;
        }

        .flow-topbar {
          position: sticky;
          top: 0;
          z-index: 10;
          gap: 0.65rem;
          padding: 0.75rem;
        }

        .flow-stepper {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .flow-step {
          min-height: 2.65rem;
          border: 1px solid rgb(255 255 255 / 0.12);
          border-radius: 0.55rem;
          background: rgb(255 255 255 / 0.04);
          padding: 0.3rem;
        }

        .flow-step span {
          width: 1.45rem;
          height: 1.45rem;
          border-width: 1px;
          font-size: 0.72rem;
        }

        .flow-step strong {
          font-size: 0.72rem;
        }

        .street-tabs {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.35rem;
          margin-bottom: 0.65rem;
        }

        .street-tab {
          min-height: 3.1rem;
          flex-direction: column;
          justify-content: center;
          gap: 0.2rem;
          border-radius: 0.5rem;
          padding: 0.35rem 0.25rem;
        }

        .street-tab-name {
          font-size: clamp(0.72rem, 2.8vw, 0.86rem);
          line-height: 1;
        }

        .street-tab-count {
          padding: 0.15rem 0.35rem;
          font-size: 0.62rem;
        }

        .build-card,
        .review-board-card,
        .review-action-board {
          border-radius: 0.55rem;
          padding: 0.75rem;
        }

        .build-section-heading {
          align-items: center;
          gap: 0.65rem;
        }

        .build-section-heading h3 {
          font-size: 1.05rem;
        }

        .build-kicker {
          font-size: 0.66rem;
        }

        .board-stage {
          margin-top: 0.65rem;
          border-radius: 0.65rem;
          padding: 0.55rem;
        }

        .board-stage-felt,
        .review-board-row {
          gap: 0.28rem;
        }

        .board-stage-felt .build-playing-card,
        .board-stage-felt .board-empty-slot,
        .review-card,
        .review-empty-card {
          width: calc((100% - 2.1rem) / 5);
          height: clamp(3.9rem, 17vw, 5.2rem);
          border-radius: 0.38rem;
          font-size: clamp(0.68rem, 3vw, 1.2rem);
        }

        .build-playing-card {
          font-size: clamp(1.7rem, 8vw, 2.25rem);
          line-height: 0.95;
        }

        .build-playing-card span {
          display: grid;
          place-items: center;
        }

        .board-stage-felt > :nth-child(4),
        .review-board-row > :nth-child(4) {
          margin-left: 0.5rem;
        }

        .board-stage-felt > :nth-child(5),
        .review-board-row > :nth-child(5) {
          margin-left: 0.25rem;
        }

        .board-street-helper {
          display: grid;
          gap: 0.28rem;
          margin-top: 0.35rem;
          font-size: 0.62rem;
        }

        .board-picker {
          grid-template-columns: 1fr;
          gap: 0.55rem;
          margin-top: 0.65rem;
        }

        .suit-picker-panel {
          order: 1;
        }

        .rank-picker-panel {
          order: 2;
        }

        .rank-picker-panel,
        .suit-picker-panel,
        .action-panel-section {
          border-radius: 0.55rem;
          padding: 0.55rem;
        }

        .suit-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .suit-button {
          min-height: 2.85rem;
          font-size: 1.65rem;
        }

        .rank-grid {
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.32rem;
        }

        .rank-button {
          min-height: 2.45rem;
          border-radius: 0.42rem;
          font-size: 0.96rem;
        }

        .board-add-button,
        .action-add-row {
          min-height: 3.1rem;
          margin-top: 0.65rem;
          font-size: 0.95rem;
        }

        .action-player-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .action-player-button {
          display: grid;
          width: 3.45rem;
          min-height: 3.45rem;
          place-items: center;
          border-radius: 9999px;
          padding: 0;
        }

        .action-player-button span {
          width: 100%;
          height: 100%;
          border: 0;
          font-size: 0.9rem;
        }

        .action-player-button strong {
          display: none;
        }

        .action-type-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .action-type-button {
          min-height: 3.65rem;
          border-radius: 0.5rem;
          gap: 0.2rem;
          font-size: 0.72rem;
        }

        .action-type-button span,
        .review-action-icon {
          font-size: 1.35rem;
        }

        .chip-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .chip-button {
          min-height: 2.55rem;
          font-size: 0.82rem;
        }

        .amount-row {
          grid-template-columns: 2.8rem 1fr 2.8rem;
          gap: 0.4rem;
        }

        .build-stepper,
        .build-amount-input {
          height: 3.1rem;
        }

        .build-amount-input {
          font-size: 1.15rem;
        }

        .timeline-card {
          display: none;
        }

        .review-action-board {
          grid-template-columns: 1fr;
        }

        .flow-step-line {
          display: none;
        }

        .record-flow-footer {
          padding-bottom: max(0.85rem, env(safe-area-inset-bottom));
        }

        .footer-actions {
          display: grid;
          grid-template-columns: 1fr 1.35fr;
          width: 100%;
        }

        .footer-button,
        .footer-primary-button {
          min-height: 3.2rem;
          justify-content: center;
          padding: 0 0.75rem;
          font-size: 0.85rem;
        }

        .footer-actions .footer-button:nth-child(2) {
          display: none;
        }
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
  protected readonly activeStreetActions = computed(() =>
    this.actionsForStreet(this.selectedStreet())
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

  protected removeLastBoardCard(): void {
    this.boardCards.update((cards) => cards.slice(0, -1));
  }

  protected clearBoard(): void {
    this.boardCards.set([]);
  }

  protected emptyBoardSlots(): number[] {
    return Array.from({ length: Math.max(0, 5 - this.boardCards().length) }, (_, index) =>
      this.boardCards().length + index + 1
    );
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

    this.actions.update((current) => {
      const nextAction: DraftAction = {
        id: `draft-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        street: this.selectedStreet(),
        sessionPlayerId: player.id,
        playerName: player.name,
        actionType: this.selectedActionType(),
        amount,
        actionOrder: current.length + 1
      };

      return [...current, nextAction];
    });

    this.amount.setValue(0);
  }

  protected undoAction(): void {
    this.actions.update((current) => current.slice(0, -1));
  }

  protected actionsForStreet(street: RecordedHandStreet): DraftAction[] {
    return this.actions().filter((action) => action.street === street);
  }

  protected streetActionCount(street: RecordedHandStreet): number {
    return this.actionsForStreet(street).length;
  }

  protected selectedActionPlayerName(): string {
    const playerId = this.selectedActionPlayerId();

    return this.selectedPlayers().find((player) => player.id === playerId)?.name ?? '';
  }

  protected selectActionType(action: RecordedHandActionType): void {
    this.selectedActionType.set(action);

    if (!this.actionNeedsAmount(action)) {
      this.amount.setValue(0);
    }
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

  protected goToStep(step: number): void {
    if (step > this.step()) {
      return;
    }

    this.step.set(Math.max(1, Math.min(3, step)));
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

  protected actionIcon(action: RecordedHandActionType): string {
    return {
      RAISE: '↑',
      CALL: '↪',
      CHECK: '✓',
      FOLD: '⚑',
      BET: '●',
      ALL_IN: '!'
    }[action];
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
