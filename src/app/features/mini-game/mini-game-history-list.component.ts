import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import {
  LucideChevronRight,
  LucideEllipsis,
  LucideSpade,
  LucideTrash2,
  LucideTrophy,
  LucideUsersRound,
} from '@lucide/angular';

import { miniGameWinnerParticipants } from './mini-game.logic';
import { MiniGameSnapshot } from './mini-game.models';
import { PlayingCardComponent } from './playing-card.component';

@Component({
  selector: 'app-mini-game-history-list',
  imports: [
    DatePipe,
    LucideChevronRight,
    LucideEllipsis,
    LucideSpade,
    LucideTrash2,
    LucideTrophy,
    LucideUsersRound,
    MatMenuModule,
    PlayingCardComponent,
    RouterLink,
  ],
  template: `
    @if (loading()) {
      <div class="mini-history-state" aria-live="polite">Loading mini-game history...</div>
    } @else if (games().length === 0) {
      <div class="mini-history-state">
        <svg lucideSpade [strokeWidth]="1.8" aria-hidden="true"></svg>
        <strong>No completed mini-games</strong>
        <span>Finished games will appear here.</span>
      </div>
    } @else {
      <div class="mini-history-list">
        @for (game of games(); track game.id) {
          <article
            class="mini-history-card"
            [class.mini-history-card-admin]="canDelete()"
          >
            <a [routerLink]="detailBasePath() + '/' + game.id" class="mini-history-card-link">
              <div class="mini-history-topline">
                <div>
                  <h2>{{ game.name }}</h2>
                  <span>{{ game.completedAt ?? game.updatedAt | date: 'MMM d, y' }}</span>
                </div>
                @if (!canDelete()) {
                  <svg lucideChevronRight [strokeWidth]="2.1" aria-hidden="true"></svg>
                }
              </div>

              <div class="mini-history-board" aria-label="Final board">
                @for (card of game.board; track card.position) {
                  <app-playing-card [card]="card" size="hole" />
                }
              </div>

              <div class="mini-history-result">
                <span class="mini-history-winner">
                  <svg lucideTrophy [strokeWidth]="2" aria-hidden="true"></svg>
                  <strong>{{ winnerNames(game) }}</strong>
                </span>
                <span class="mini-history-count">
                  <svg lucideUsersRound [strokeWidth]="2" aria-hidden="true"></svg>
                  {{ game.activePlayerCount }}
                </span>
              </div>
            </a>

            @if (canDelete()) {
              <button
                type="button"
                class="mini-history-menu-button"
                [matMenuTriggerFor]="historyMenu"
                aria-label="Open actions for {{ game.name }}"
                title="Mini-game actions"
              >
                <svg lucideEllipsis [strokeWidth]="2.2" aria-hidden="true"></svg>
              </button>
              <mat-menu #historyMenu="matMenu" class="mini-game-menu" xPosition="before">
                <button
                  type="button"
                  mat-menu-item
                  class="mini-menu-danger"
                  (click)="deleteGame.emit(game)"
                >
                  <svg lucideTrash2 [strokeWidth]="2" aria-hidden="true"></svg>
                  <span>Delete mini-game</span>
                </button>
              </mat-menu>
            }
          </article>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .mini-history-list {
        display: grid;
        gap: 0.65rem;
      }

      .mini-history-card {
        position: relative;
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.09);
        border-left: 2px solid rgb(251 191 36 / 0.7);
        border-radius: 0.48rem;
        background: rgb(255 255 255 / 0.035);
        transition:
          border-color 160ms ease,
          background-color 160ms ease;
      }

      .mini-history-card-link {
        display: grid;
        min-width: 0;
        gap: 0.7rem;
        padding: 0.8rem;
        color: inherit;
        text-decoration: none;
      }

      .mini-history-card-admin .mini-history-card-link {
        padding-right: 3rem;
      }

      .mini-history-card:hover {
        border-color: rgb(251 191 36 / 0.36);
        background: rgb(255 255 255 / 0.055);
      }

      .mini-history-menu-button {
        position: absolute;
        z-index: 1;
        top: 0.65rem;
        right: 0.65rem;
        display: grid;
        width: 2rem;
        height: 2rem;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.38rem;
        background: rgb(255 255 255 / 0.04);
        color: rgb(161 161 170);
      }

      .mini-history-menu-button svg {
        width: 1rem;
        height: 1rem;
      }

      .mini-history-topline,
      .mini-history-result,
      .mini-history-winner,
      .mini-history-count {
        display: flex;
        align-items: center;
      }

      .mini-history-topline {
        justify-content: space-between;
        gap: 0.7rem;
      }

      .mini-history-topline > div {
        min-width: 0;
      }

      .mini-history-topline h2 {
        overflow: hidden;
        margin: 0;
        color: white;
        font-size: 0.92rem;
        font-weight: 760;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mini-history-topline span {
        display: block;
        margin-top: 0.18rem;
        color: rgb(113 113 122);
        font-size: 0.66rem;
      }

      .mini-history-topline > svg {
        width: 1rem;
        height: 1rem;
        flex: 0 0 auto;
        color: rgb(113 113 122);
      }

      .mini-history-board {
        display: flex;
        gap: 0.24rem;
      }

      .mini-history-result {
        justify-content: space-between;
        gap: 0.7rem;
        border-top: 1px solid rgb(255 255 255 / 0.07);
        padding-top: 0.62rem;
      }

      .mini-history-winner {
        min-width: 0;
        gap: 0.38rem;
        color: rgb(253 230 138);
        font-size: 0.72rem;
      }

      .mini-history-winner svg,
      .mini-history-count svg {
        width: 0.82rem;
        height: 0.82rem;
        flex: 0 0 auto;
      }

      .mini-history-winner strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mini-history-count {
        flex: 0 0 auto;
        gap: 0.3rem;
        color: rgb(161 161 170);
        font-size: 0.68rem;
        font-weight: 750;
      }

      .mini-history-state {
        display: grid;
        min-height: 9rem;
        place-items: center;
        align-content: center;
        gap: 0.42rem;
        border: 1px dashed rgb(255 255 255 / 0.12);
        border-radius: 0.48rem;
        background: rgb(255 255 255 / 0.025);
        padding: 1.5rem;
        color: rgb(161 161 170);
        text-align: center;
        font-size: 0.76rem;
      }

      .mini-history-state svg {
        width: 1.3rem;
        height: 1.3rem;
        color: rgb(251 191 36 / 0.72);
      }

      .mini-history-state strong {
        color: rgb(228 228 231);
        font-size: 0.88rem;
      }

      .mini-history-state span {
        color: rgb(113 113 122);
      }

      @media (prefers-reduced-motion: reduce) {
        .mini-history-card {
          transition: none;
        }
      }
    `,
  ],
})
export class MiniGameHistoryListComponent {
  readonly games = input.required<MiniGameSnapshot[]>();
  readonly detailBasePath = input.required<string>();
  readonly loading = input(false);
  readonly canDelete = input(false);
  readonly deleteGame = output<MiniGameSnapshot>();

  protected winnerNames(game: MiniGameSnapshot): string {
    const names = miniGameWinnerParticipants(game).map((participant) => participant.displayName);
    return names.length > 0 ? names.join(' & ') : 'Result pending';
  }
}
