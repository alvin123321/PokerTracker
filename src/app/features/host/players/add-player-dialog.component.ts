import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { RegisteredPlayerOption } from '../data/poker-store.service';

type AddPlayerMode = 'existing' | 'new';

export interface AddPlayerDialogData {
  registeredPlayers: RegisteredPlayerOption[];
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
      class="add-player-dialog w-[min(94vw,30rem)] bg-neutral-950 text-neutral-50"
      [formGroup]="form"
      (ngSubmit)="submit()"
    >
      <div class="add-player-header">
        <h2 class="text-xl font-semibold">Add New Member</h2>
        <p class="mt-1 text-sm text-neutral-400">Select a player or create a login with password 123456.</p>
      </div>

      <div class="add-player-body">
        <div class="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-neutral-900 p-1.5">
          <button
            type="button"
            class="rounded-md px-3 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            [class.bg-emerald-400]="mode.value === 'existing'"
            [class.text-neutral-950]="mode.value === 'existing'"
            [class.text-neutral-300]="mode.value !== 'existing'"
            [disabled]="registeredPlayers.length === 0"
            (click)="setMode('existing')"
          >
            Existing
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-2.5 text-sm font-semibold transition hover:bg-white/10"
            [class.bg-emerald-400]="mode.value === 'new'"
            [class.text-neutral-950]="mode.value === 'new'"
            [class.text-neutral-300]="mode.value !== 'new'"
            (click)="setMode('new')"
          >
            New login
          </button>
        </div>

        @if (mode.value === 'existing') {
          <label class="block text-sm font-medium text-neutral-200" for="registeredPlayer">
            Registered player
          </label>
          <div
            id="registeredPlayer"
            class="registered-player-list mt-2 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900 p-2"
          >
            @for (player of registeredPlayers; track player.id) {
              <button
                type="button"
                class="member-option flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-neutral-100 transition hover:border-emerald-300/60 hover:bg-emerald-300/10"
                [class.member-option-selected]="form.controls.playerUserId.value === player.id"
                (click)="selectRegisteredPlayer(player.id)"
              >
                <span>
                  <span class="block text-base font-semibold">{{ playerLabel(player) }}</span>
                  <span class="member-option-meta mt-1 block text-xs text-neutral-500">
                    Registered member
                  </span>
                </span>
                @if (form.controls.playerUserId.value === player.id) {
                  <span class="text-xs font-black uppercase" aria-hidden="true">Selected</span>
                }
              </button>
            }
          </div>
        } @else {
          <label class="block text-sm font-medium text-neutral-200" for="playerName">
            New player name
          </label>
          <input
            id="playerName"
            formControlName="name"
            class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
            placeholder="Player A"
          />
          @if (duplicateName()) {
            <p class="mt-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">
              This player already exists. Select it from Existing instead.
            </p>
          }
        }

        <label class="block text-sm font-medium text-neutral-200" for="buyIn">Buy-in amount</label>
        <input
          id="buyIn"
          type="number"
          min="1"
          step="1"
          formControlName="buyIn"
          class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
        />

        <div class="grid grid-cols-4 gap-2">
          @for (amount of buyInPresets; track amount) {
            <button
              type="button"
              class="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300 hover:text-neutral-950"
              (click)="setBuyIn(amount)"
            >
              {{ amount | currency: 'USD' : 'symbol' : '1.0-0' }}
            </button>
          }
        </div>

        <label class="block text-sm font-medium text-neutral-200" for="buyInComment">Comment</label>
        <textarea
          id="buyInComment"
          rows="2"
          formControlName="comment"
          class="mt-2 w-full resize-none rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
          placeholder="Optional note"
        ></textarea>
      </div>

      <div class="add-player-footer">
        <button
          type="submit"
          [disabled]="!canSubmit()"
          class="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          Add New Member
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .add-player-dialog {
        display: flex;
        max-height: min(90vh, 44rem);
        flex-direction: column;
        overflow: hidden;
      }

      .add-player-header,
      .add-player-footer {
        flex: 0 0 auto;
        background: rgb(10 10 10);
      }

      .add-player-header {
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        padding: 1rem 1rem 0.9rem;
      }

      .add-player-body {
        display: grid;
        gap: 1rem;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1rem;
        -webkit-overflow-scrolling: touch;
      }

      .add-player-footer {
        border-top: 1px solid rgb(255 255 255 / 0.1);
        padding: 0.85rem 1rem max(0.85rem, env(safe-area-inset-bottom));
      }

      .registered-player-list {
        max-height: min(14rem, 34vh);
      }

      .member-option-selected {
        border-color: rgb(110 231 183);
        background: rgb(110 231 183);
        color: rgb(10 10 10);
      }

      .member-option-selected .member-option-meta {
        color: rgb(38 38 38);
      }

      @media (max-width: 640px) {
        .add-player-dialog {
          width: 94vw;
          max-height: 86vh;
        }

        .add-player-header {
          padding: 0.9rem 0.85rem 0.75rem;
        }

        .add-player-body {
          gap: 0.8rem;
          padding: 0.85rem;
        }

        .add-player-footer {
          padding: 0.75rem 0.85rem max(0.75rem, env(safe-area-inset-bottom));
        }

        .registered-player-list {
          max-height: min(12rem, 30vh);
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

  protected readonly form = new FormGroup({
    mode: new FormControl<AddPlayerMode>(this.registeredPlayers.length > 0 ? 'existing' : 'new', {
      nonNullable: true
    }),
    playerUserId: new FormControl(this.registeredPlayers[0]?.id ?? '', {
      nonNullable: true
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    buyIn: new FormControl(200, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)]
    }),
    comment: new FormControl('', {
      nonNullable: true
    })
  });

  protected get mode(): FormControl<AddPlayerMode> {
    return this.form.controls.mode;
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.mode === 'existing') {
      const selectedPlayer = this.registeredPlayers.find((player) => player.id === value.playerUserId);

      if (!selectedPlayer) {
        return;
      }

      this.dialogRef.close({
        name: selectedPlayer.displayName ?? selectedPlayer.username,
        buyIn: value.buyIn,
        comment: value.comment.trim(),
        playerUserId: selectedPlayer.id,
        createRegisteredPlayer: false
      } satisfies AddPlayerDialogResult);
      return;
    }

    this.dialogRef.close({
      name: value.name.trim(),
      buyIn: value.buyIn,
      comment: value.comment.trim(),
      playerUserId: null,
      createRegisteredPlayer: true
    } satisfies AddPlayerDialogResult);
  }

  protected setMode(mode: AddPlayerMode): void {
    if (mode === 'existing' && this.registeredPlayers.length === 0) {
      return;
    }

    this.mode.setValue(mode);
  }

  protected selectRegisteredPlayer(playerId: string): void {
    this.form.controls.playerUserId.setValue(playerId);
  }

  protected setBuyIn(amount: number): void {
    this.form.controls.buyIn.setValue(amount);
  }

  protected canSubmit(): boolean {
    if (this.form.controls.buyIn.invalid) {
      return false;
    }

    if (this.mode.value === 'existing') {
      return Boolean(this.form.controls.playerUserId.value);
    }

    return this.form.controls.name.valid && this.form.controls.name.value.trim().length > 0 && !this.duplicateName();
  }

  protected duplicateName(): boolean {
    if (this.mode.value !== 'new') {
      return false;
    }

    const name = this.form.controls.name.value.trim().toLowerCase();

    return this.registeredPlayers.some((player) => {
      const displayName = player.displayName?.trim().toLowerCase();
      return displayName === name || player.username.toLowerCase() === name;
    });
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
