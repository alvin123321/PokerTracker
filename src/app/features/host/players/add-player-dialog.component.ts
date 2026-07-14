import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { RegisteredPlayerOption } from '../data/poker-store.service';
import {
  isRegisteredPlayerInSession,
  resolveAddPlayerSearch,
  sortRegisteredPlayerOptions
} from './add-player-dialog.logic';

export interface AddPlayerDialogData {
  registeredPlayers: RegisteredPlayerOption[];
  sessionMemberUserIds: readonly string[];
  sessionMemberNames: readonly string[];
}

export interface AddPlayerDialogResult {
  name: string;
  buyIn: number;
  comment: string;
  playerUserId: string | null;
  createRegisteredPlayer: boolean;
}

@Component({
  selector: 'app-add-player-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <form
      class="add-player-dialog w-[min(96vw,30rem)] bg-neutral-950 text-neutral-50"
      [formGroup]="form"
      (ngSubmit)="submit()"
    >
      <div class="add-player-header">
        <h2 class="text-xl font-semibold">Add Player</h2>
      </div>

      <div class="add-player-body">
        @let searchState = searchResult();
        <label class="block text-sm font-medium text-neutral-200" for="playerSearch">Player</label>
        <input
          id="playerSearch"
          [formControl]="searchControl"
          class="mt-2 w-full min-w-0 rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
          placeholder="Search or enter a new player"
        />
        <div
          id="registeredPlayer"
          class="registered-player-list mt-2 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900 p-2"
        >
          @for (player of filteredRegisteredPlayers(); track player.id) {
            <button
              type="button"
              class="member-option flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-neutral-100 transition hover:border-emerald-300/60 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.015] disabled:text-neutral-600"
              [class.member-option-selected]="searchState.kind === 'existing' && searchState.player.id === player.id"
              [disabled]="isSessionMember(player)"
              (click)="selectRegisteredPlayer(player)"
            >
              <span>
                <span class="block text-base font-semibold">{{ playerLabel(player) }}</span>
              </span>
              @if (searchState.kind === 'existing' && searchState.player.id === player.id) {
                <span class="selected-dot" aria-hidden="true"></span>
              } @else if (isSessionMember(player)) {
                <span class="text-xs font-semibold uppercase text-neutral-600">Already in game</span>
              }
            </button>
          } @empty {
            @if (searchState.kind === 'new') {
              <p class="new-signup-notice">
                <strong>New signup: {{ searchState.name }}</strong>
                <span>Click Add Player to add this player.</span>
              </p>
            } @else {
              <p class="rounded-lg border border-dashed border-white/10 p-4 text-sm text-neutral-500">
                Start typing a player name to add a new signup.
              </p>
            }
          }
        </div>

        <label class="block text-sm font-medium text-neutral-200" for="buyIn">Buy-in</label>
        <input
          id="buyIn"
          type="number"
          min="1"
          step="1"
          formControlName="buyIn"
          class="mt-2 w-full min-w-0 rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
        />

        <div class="buy-in-presets grid grid-cols-2 gap-2 sm:grid-cols-4">
          @for (amount of buyInPresets; track amount) {
            <button
              type="button"
              class="min-w-0 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300 hover:text-neutral-950"
              (click)="setBuyIn(amount)"
            >
              {{ amount | currency: 'USD' : 'symbol' : '1.0-0' }}
            </button>
          }
        </div>

        <label class="block text-sm font-medium text-neutral-200" for="buyInComment">Note</label>
        <textarea
          id="buyInComment"
          rows="4"
          formControlName="comment"
          class="note-textarea mt-2 w-full min-w-0 resize-none rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
          placeholder="Optional note"
        ></textarea>
      </div>

      <div class="add-player-footer grid grid-cols-2 gap-3">
        <button
          type="button"
          class="w-full min-w-0 rounded-lg border border-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
          (click)="closeDialog()"
        >
          Close
        </button>
        <button
          type="submit"
          [disabled]="!canSubmit()"
          class="w-full min-w-0 rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          Add Player
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .add-player-dialog {
        box-sizing: border-box;
        display: flex;
        max-height: min(92dvh, 42rem);
        flex-direction: column;
        overflow: hidden;
      }

      .add-player-dialog *,
      .add-player-dialog *::before,
      .add-player-dialog *::after {
        box-sizing: border-box;
      }

      .add-player-header,
      .add-player-footer {
        flex: 0 0 auto;
        background: rgb(10 10 10);
      }

      .add-player-header {
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        padding: 0.95rem 1rem 0.8rem;
      }

      .add-player-body {
        display: grid;
        gap: 0.85rem;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0.95rem 1rem;
        -webkit-overflow-scrolling: touch;
      }

      .add-player-footer {
        border-top: 1px solid rgb(255 255 255 / 0.1);
        padding: 0.8rem 1rem max(0.95rem, env(safe-area-inset-bottom));
      }

      .registered-player-list {
        min-height: 10rem;
        max-height: min(18rem, 38dvh);
      }

      .member-option {
        min-height: 3.25rem;
        min-width: 0;
      }

      .note-textarea {
        min-height: 7rem;
      }

      .member-option-selected {
        border-color: rgb(110 231 183);
        background: rgb(110 231 183);
        color: rgb(10 10 10);
      }

      .member-option-selected .member-option-meta {
        color: rgb(38 38 38);
      }

      .new-signup-notice {
        display: grid;
        gap: 0.2rem;
        border: 1px solid rgb(110 231 183 / 0.35);
        border-radius: 0.5rem;
        background: rgb(110 231 183 / 0.1);
        padding: 0.85rem;
        color: rgb(209 250 229);
        font-size: 0.875rem;
      }

      .new-signup-notice span {
        color: rgb(167 243 208);
      }

      .selected-dot {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 9999px;
        background: rgb(10 10 10);
        box-shadow: 0 0 0 0.2rem rgb(10 10 10 / 0.16);
      }

      @media (max-width: 640px) {
        .add-player-dialog {
          width: 96vw;
          max-height: 88dvh;
        }

        .add-player-header {
          padding: 0.9rem 0.85rem 0.75rem;
        }

        .add-player-body {
          gap: 0.7rem;
          padding: 0.85rem;
        }

        .add-player-footer {
          padding: 0.75rem 0.85rem max(1rem, env(safe-area-inset-bottom));
        }

        .registered-player-list {
          min-height: 8rem;
          max-height: 30dvh;
        }
      }
    `
  ]
})
export class AddPlayerDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<AddPlayerDialogComponent>);
  private readonly data = inject<AddPlayerDialogData>(MAT_DIALOG_DATA);
  protected readonly registeredPlayers = this.data.registeredPlayers;
  protected readonly buyInPresets = [300, 400, 500, 600];
  protected readonly searchControl = new FormControl('', {
    nonNullable: true
  });

  protected readonly form = new FormGroup({
    buyIn: new FormControl(200, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)]
    }),
    comment: new FormControl('', {
      nonNullable: true
    })
  });

  protected submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const result = this.searchResult();

    if (result.kind === 'existing') {
      this.dialogRef.close({
        name: result.player.displayName ?? result.player.username,
        buyIn: value.buyIn,
        comment: value.comment.trim(),
        playerUserId: result.player.id,
        createRegisteredPlayer: false
      } satisfies AddPlayerDialogResult);
      return;
    }

    if (result.kind === 'new') {
      this.dialogRef.close({
        name: result.name,
        buyIn: value.buyIn,
        comment: value.comment.trim(),
        playerUserId: null,
        createRegisteredPlayer: true
      } satisfies AddPlayerDialogResult);
    }
  }

  protected closeDialog(): void {
    this.dialogRef.close();
  }

  protected selectRegisteredPlayer(player: RegisteredPlayerOption): void {
    if (this.isSessionMember(player)) {
      return;
    }

    this.searchControl.setValue(this.playerLabel(player));
  }

  protected setBuyIn(amount: number): void {
    this.form.controls.buyIn.setValue(amount);
  }

  protected canSubmit(): boolean {
    if (this.form.controls.buyIn.invalid) {
      return false;
    }

    const result = this.searchResult();
    return result.kind === 'existing' || result.kind === 'new';
  }

  protected filteredRegisteredPlayers(): RegisteredPlayerOption[] {
    const search = this.searchControl.value.trim().toLocaleLowerCase();

    if (!search) {
      return sortRegisteredPlayerOptions(
        this.registeredPlayers,
        this.data.sessionMemberUserIds,
        this.data.sessionMemberNames
      );
    }

    return sortRegisteredPlayerOptions(
      this.registeredPlayers.filter((player) =>
        this.playerLabel(player).toLocaleLowerCase().includes(search)
      ),
      this.data.sessionMemberUserIds,
      this.data.sessionMemberNames
    );
  }

  protected isSessionMember(player: RegisteredPlayerOption): boolean {
    return isRegisteredPlayerInSession(
      player,
      this.data.sessionMemberUserIds,
      this.data.sessionMemberNames
    );
  }

  protected searchResult() {
    return resolveAddPlayerSearch(
      this.registeredPlayers,
      this.searchControl.value,
      this.data.sessionMemberUserIds,
      this.data.sessionMemberNames
    );
  }

  protected playerLabel(player: RegisteredPlayerOption): string {
    return this.titleCaseName(player.displayName ?? player.username);
  }

  private titleCaseName(name: string): string {
    return name
      .trim()
      .toLocaleLowerCase()
      .replace(/\b[\p{L}\p{N}]/gu, (letter) => letter.toLocaleUpperCase());
  }
}
