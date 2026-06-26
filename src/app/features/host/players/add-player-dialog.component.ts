import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { RegisteredPlayerOption } from '../data/mock-poker-store.service';

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
      class="w-[min(92vw,30rem)] space-y-5 bg-neutral-950 p-5 text-neutral-50"
      [formGroup]="form"
    >
      <div>
        <h2 class="text-xl font-semibold">Add player</h2>
        <p class="mt-1 text-sm text-neutral-400">Select a login or create one with password 123456.</p>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-neutral-900 p-1">
        <button
          type="button"
          class="rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
          class="rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
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
        <select
          id="registeredPlayer"
          formControlName="playerUserId"
          class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
        >
          @for (player of registeredPlayers; track player.id) {
            <option [value]="player.id">
              {{ playerLabel(player) }}
            </option>
          }
        </select>
      } @else {
        <label class="block text-sm font-medium text-neutral-200" for="playerName">
          New player login
        </label>
        <input
          id="playerName"
          formControlName="name"
          class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
          placeholder="player123"
        />
        <p class="mt-2 text-xs text-neutral-500">
          3-32 characters. Use letters, numbers, underscore, or hyphen.
        </p>
        @if (duplicateName()) {
          <p class="mt-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">
            This player login already exists. Select it from Existing instead.
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

      <div class="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-3 font-semibold text-neutral-200 hover:bg-white/10"
          (click)="dialogRef.close()"
        >
          Cancel
        </button>
        <button
          type="button"
          [disabled]="!canSubmit()"
          class="rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="submit()"
        >
          Add player
        </button>
      </div>
    </form>
  `
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
      validators: [Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/)]
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
      name: value.name.trim().toLowerCase(),
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

    const username = this.form.controls.name.value.trim().toLowerCase();

    return this.registeredPlayers.some((player) => player.username.toLowerCase() === username);
  }

  protected playerLabel(player: RegisteredPlayerOption): string {
    const displayName = player.displayName ?? player.username;

    return `${displayName} (${player.username})`;
  }
}
