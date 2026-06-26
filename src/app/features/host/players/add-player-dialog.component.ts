import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

export interface AddPlayerDialogResult {
  name: string;
  buyIn: number;
  comment: string;
}

@Component({
  selector: 'app-add-player-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <form
      class="w-[min(92vw,28rem)] space-y-5 bg-neutral-950 p-5 text-neutral-50"
      [formGroup]="form"
    >
      <div>
        <h2 class="text-xl font-semibold">Add player</h2>
        <p class="mt-1 text-sm text-neutral-400">Default buy-in is set to $200.</p>
      </div>

      <label class="block text-sm font-medium text-neutral-200" for="playerName">Player name</label>
      <input
        id="playerName"
        formControlName="name"
        class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
        placeholder="Player name"
      />

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
          [disabled]="form.invalid"
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
  protected readonly buyInPresets = [300, 400, 500, 600];

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    buyIn: new FormControl(200, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)]
    }),
    comment: new FormControl('', {
      nonNullable: true
    })
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      name: value.name.trim(),
      buyIn: value.buyIn,
      comment: value.comment.trim()
    } satisfies AddPlayerDialogResult);
  }

  protected setBuyIn(amount: number): void {
    this.form.controls.buyIn.setValue(amount);
  }
}
