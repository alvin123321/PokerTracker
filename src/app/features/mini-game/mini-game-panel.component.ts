import { Component, computed, input, output } from '@angular/core';
import {
  LucideChevronRight,
  LucideEye,
  LucidePencil,
  LucidePlay,
  LucideRotateCcw,
  LucideTrash2,
  LucideUserPlus,
  LucideUsersRound,
} from '@lucide/angular';

import { MiniGameBoardComponent } from './mini-game-board.component';
import { MiniGameParticipantRowComponent } from './mini-game-participant-row.component';
import { MiniGameParticipant, MiniGameSnapshot } from './mini-game.models';

@Component({
  selector: 'app-mini-game-panel',
  imports: [
    LucideChevronRight,
    LucideEye,
    LucidePencil,
    LucidePlay,
    LucideRotateCcw,
    LucideTrash2,
    LucideUserPlus,
    LucideUsersRound,
    MiniGameBoardComponent,
    MiniGameParticipantRowComponent,
  ],
  template: `
    <section class="mini-game-panel" [class.mini-game-complete]="snapshot().status === 'COMPLETE'">
      <header class="mini-game-header">
        <div class="mini-game-title">
          <span class="mini-game-kicker">Hold'em mini-game</span>
          <h2>{{ snapshot().name }}</h2>
        </div>
        <div class="mini-game-header-actions">
          <span class="mini-game-status mini-game-status-{{ snapshot().status.toLowerCase() }}">
            <span aria-hidden="true"></span>
            {{ statusLabel() }}
          </span>
          @if (showDetailButton()) {
            <button
              type="button"
              class="mini-icon-button"
              aria-label="Open mini-game detail"
              title="Open game"
              (click)="openDetail.emit()"
            >
              <svg lucideEye [strokeWidth]="2.1" aria-hidden="true"></svg>
            </button>
          }
        </div>
      </header>

      <app-mini-game-board [snapshot]="snapshot()" />

      @if (!readOnly()) {
        <div class="mini-game-actions">
          @if (canJoin()) {
            <button type="button" class="mini-primary-action" (click)="join.emit()">
              <svg lucideUserPlus [strokeWidth]="2.2" aria-hidden="true"></svg>
              Join game
            </button>
          } @else if (snapshot().viewerParticipantId && snapshot().status === 'OPEN') {
            <span class="mini-joined-state">Your cards are live</span>
          }

          @if (canManage()) {
            @switch (snapshot().status) {
              @case ('OPEN') {
                <button
                  type="button"
                  class="mini-primary-action"
                  [disabled]="snapshot().activePlayerCount < snapshot().minPlayers || busy()"
                  (click)="start.emit()"
                >
                  <svg lucidePlay [strokeWidth]="2.2" aria-hidden="true"></svg>
                  Start game
                </button>
                <div class="mini-tool-row" aria-label="Open game controls">
                  <button
                    type="button"
                    title="Edit game"
                    aria-label="Edit game"
                    (click)="edit.emit()"
                  >
                    <svg lucidePencil [strokeWidth]="2" aria-hidden="true"></svg>
                  </button>
                  <button
                    type="button"
                    title="Reshuffle cards"
                    aria-label="Reshuffle cards"
                    (click)="reshuffle.emit()"
                  >
                    <svg lucideRotateCcw [strokeWidth]="2" aria-hidden="true"></svg>
                  </button>
                  <button
                    type="button"
                    class="mini-tool-danger"
                    title="Delete game"
                    aria-label="Delete game"
                    (click)="deleteGame.emit()"
                  >
                    <svg lucideTrash2 [strokeWidth]="2" aria-hidden="true"></svg>
                  </button>
                </div>
              }
              @case ('FLOP') {
                <button type="button" class="mini-primary-action" (click)="revealTurn.emit()">
                  Deal turn
                  <svg lucideChevronRight [strokeWidth]="2.2" aria-hidden="true"></svg>
                </button>
              }
              @case ('TURN') {
                <button type="button" class="mini-river-action" (click)="revealRiver.emit()">
                  Deal river
                  <svg lucideChevronRight [strokeWidth]="2.2" aria-hidden="true"></svg>
                </button>
              }
              @case ('COMPLETE') {
                <button
                  type="button"
                  class="mini-secondary-action mini-secondary-danger"
                  (click)="deleteGame.emit()"
                >
                  <svg lucideTrash2 [strokeWidth]="2" aria-hidden="true"></svg>
                  Delete result
                </button>
              }
            }
          }
        </div>
      }

      <div class="mini-game-roster-heading">
        <span>
          <svg lucideUsersRound [strokeWidth]="2.1" aria-hidden="true"></svg>
          Players
        </span>
        <strong>{{ snapshot().activePlayerCount }}/{{ snapshot().maxPlayers }}</strong>
      </div>

      <div class="mini-game-roster">
        @for (participant of snapshot().participants; track participant.id) {
          <app-mini-game-participant-row
            [participant]="participant"
            [winner]="isWinner(participant)"
            [viewer]="participant.id === snapshot().viewerParticipantId"
            [removable]="canManage() && snapshot().status === 'OPEN' && !readOnly()"
            (remove)="removePlayer.emit($event)"
          />
        } @empty {
          <div class="mini-game-empty-roster">
            <svg lucideUsersRound [strokeWidth]="1.9" aria-hidden="true"></svg>
            <span>Waiting for players</span>
          </div>
        }
      </div>

      <footer class="mini-game-footer">
        <span>Minimum {{ snapshot().minPlayers }}</span>
        <span>{{ snapshot().activePlayerCount }} joined</span>
      </footer>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .mini-game-panel {
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.5rem;
        background: rgb(9 12 15);
        color: rgb(248 250 252);
        box-shadow: 0 1.2rem 2.8rem rgb(0 0 0 / 0.26);
      }

      .mini-game-complete {
        border-color: rgb(251 191 36 / 0.25);
      }

      .mini-game-header {
        display: flex;
        min-height: 4.2rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      .mini-game-title {
        min-width: 0;
      }

      .mini-game-kicker {
        display: block;
        color: rgb(110 231 183);
        font-size: 0.58rem;
        font-weight: 850;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .mini-game-title h2 {
        display: -webkit-box;
        overflow: hidden;
        margin: 0.22rem 0 0;
        color: white;
        font-size: 1rem;
        font-weight: 780;
        line-height: 1.15;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      .mini-game-header-actions {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 0.42rem;
      }

      .mini-game-status {
        display: inline-flex;
        align-items: center;
        gap: 0.34rem;
        border: 1px solid rgb(52 211 153 / 0.2);
        border-radius: 9999px;
        background: rgb(16 185 129 / 0.08);
        padding: 0.36rem 0.52rem;
        color: rgb(167 243 208);
        font-size: 0.58rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .mini-game-status > span {
        width: 0.38rem;
        height: 0.38rem;
        border-radius: 9999px;
        background: rgb(52 211 153);
        box-shadow: 0 0 0.62rem rgb(52 211 153 / 0.8);
      }

      .mini-game-status-complete {
        border-color: rgb(251 191 36 / 0.24);
        background: rgb(245 158 11 / 0.08);
        color: rgb(253 230 138);
      }

      .mini-game-status-complete > span {
        background: rgb(251 191 36);
        box-shadow: 0 0 0.62rem rgb(251 191 36 / 0.72);
      }

      .mini-icon-button,
      .mini-tool-row button {
        display: grid;
        width: 2.2rem;
        height: 2.2rem;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.4rem;
        background: rgb(255 255 255 / 0.045);
        color: rgb(203 213 225);
      }

      .mini-icon-button svg,
      .mini-tool-row svg {
        width: 0.95rem;
        height: 0.95rem;
      }

      .mini-game-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.5rem;
        padding: 0.65rem 0.75rem 0;
      }

      .mini-primary-action,
      .mini-river-action,
      .mini-secondary-action,
      .mini-joined-state {
        display: inline-flex;
        min-height: 2.65rem;
        align-items: center;
        justify-content: center;
        gap: 0.48rem;
        border: 0;
        border-radius: 0.42rem;
        padding: 0.62rem 0.82rem;
        font-size: 0.76rem;
        font-weight: 800;
      }

      .mini-primary-action {
        background: rgb(52 211 153);
        color: rgb(3 18 14);
      }

      .mini-primary-action:disabled {
        cursor: not-allowed;
        opacity: 0.38;
      }

      .mini-river-action {
        background: rgb(251 191 36);
        color: rgb(31 20 3);
      }

      .mini-secondary-action,
      .mini-joined-state {
        border: 1px solid rgb(255 255 255 / 0.1);
        background: rgb(255 255 255 / 0.045);
        color: rgb(203 213 225);
      }

      .mini-secondary-danger {
        border-color: rgb(248 113 113 / 0.2);
        color: rgb(252 165 165);
      }

      .mini-primary-action svg,
      .mini-river-action svg,
      .mini-secondary-action svg {
        width: 0.98rem;
        height: 0.98rem;
      }

      .mini-tool-row {
        display: flex;
        gap: 0.38rem;
      }

      .mini-tool-row .mini-tool-danger {
        border-color: rgb(248 113 113 / 0.2);
        color: rgb(252 165 165);
      }

      .mini-game-roster-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.8rem 0.75rem 0.48rem;
        color: rgb(148 163 184);
        font-size: 0.65rem;
        font-weight: 780;
        text-transform: uppercase;
      }

      .mini-game-roster-heading span {
        display: inline-flex;
        align-items: center;
        gap: 0.38rem;
      }

      .mini-game-roster-heading svg {
        width: 0.85rem;
        height: 0.85rem;
      }

      .mini-game-roster-heading strong {
        color: rgb(226 232 240);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.68rem;
      }

      .mini-game-roster {
        display: grid;
        gap: 0.42rem;
        padding-inline: 0.75rem;
      }

      .mini-game-empty-roster {
        display: flex;
        min-height: 4.25rem;
        align-items: center;
        justify-content: center;
        gap: 0.48rem;
        border: 1px dashed rgb(255 255 255 / 0.11);
        border-radius: 0.42rem;
        color: rgb(148 163 184);
        font-size: 0.72rem;
      }

      .mini-game-empty-roster svg {
        width: 1rem;
        height: 1rem;
      }

      .mini-game-footer {
        display: flex;
        justify-content: space-between;
        padding: 0.7rem 0.75rem 0.78rem;
        color: rgb(255 255 255 / 0.3);
        font-size: 0.56rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      @media (max-width: 370px) {
        .mini-game-header {
          padding-inline: 0.62rem;
        }

        .mini-game-actions,
        .mini-game-roster {
          padding-inline: 0.62rem;
        }

        .mini-game-roster-heading,
        .mini-game-footer {
          padding-inline: 0.62rem;
        }

        .mini-game-status {
          display: none;
        }
      }
    `,
  ],
})
export class MiniGamePanelComponent {
  readonly snapshot = input.required<MiniGameSnapshot>();
  readonly canManage = input(false);
  readonly readOnly = input(false);
  readonly showDetailButton = input(true);
  readonly busy = input(false);
  readonly join = output<void>();
  readonly edit = output<void>();
  readonly reshuffle = output<void>();
  readonly start = output<void>();
  readonly revealTurn = output<void>();
  readonly revealRiver = output<void>();
  readonly deleteGame = output<void>();
  readonly removePlayer = output<MiniGameParticipant>();
  readonly openDetail = output<void>();
  protected readonly canJoin = computed(
    () =>
      !this.readOnly() &&
      this.snapshot().status === 'OPEN' &&
      !this.snapshot().viewerParticipantId &&
      this.snapshot().activePlayerCount < this.snapshot().maxPlayers &&
      !this.busy(),
  );
  protected readonly statusLabel = computed(() => {
    const labels: Record<MiniGameSnapshot['status'], string> = {
      OPEN: 'Open',
      FLOP: 'Flop',
      TURN: 'Turn',
      COMPLETE: 'Complete',
    };

    return labels[this.snapshot().status];
  });

  protected isWinner(participant: MiniGameParticipant): boolean {
    return this.snapshot().winnerParticipantIds.includes(participant.id);
  }
}
