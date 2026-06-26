import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PokerTransaction } from '../data/poker-store.service';

export interface EditBuyInDialogData {
  playerName: string;
  transaction: PokerTransaction;
}

export type EditBuyInDialogResult =
  | {
      action: 'save';
      amount: number;
      comment: string;
    }
  | {
      action: 'delete';
    };

@Component({
  selector: 'app-edit-buy-in-dialog',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule],
  template: `
    <section class="w-[min(94vw,28rem)] space-y-4 bg-neutral-950 p-4 text-neutral-50 sm:space-y-5 sm:p-5">
      <div>
        <h2 class="text-xl font-semibold">Edit buy-in</h2>
        <p class="mt-1 text-sm text-neutral-400">
          {{ data.playerName }} · {{ data.transaction.type }} ·
          {{ data.transaction.createdAt | date: 'short' }}
        </p>
        @if (data.transaction.deletedAt) {
          <p class="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-neutral-400">
            Deleted entry · comment can still be edited
          </p>
        }
      </div>

      <label class="block text-sm font-medium text-neutral-200" for="buyInAmount">Amount</label>
      <input
        id="buyInAmount"
        type="number"
        min="1"
        step="1"
        [formControl]="amount"
        class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-emerald-300"
      />

      <label class="block text-sm font-medium text-neutral-200" for="buyInComment">Comment</label>
      <textarea
        id="buyInComment"
        rows="3"
        [formControl]="comment"
        class="mt-2 w-full resize-none rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 outline-none transition focus:border-emerald-300"
        placeholder="Optional note"
      ></textarea>

      <p class="text-sm text-neutral-400">
        Current amount:
        <span class="font-semibold text-white">
          {{ data.transaction.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
        </span>
      </p>

      <div class="grid gap-3 sm:grid-cols-3">
        @if (!data.transaction.deletedAt) {
          <button
            type="button"
            class="rounded-lg border border-red-300/30 px-4 py-3 font-semibold text-red-100 transition hover:bg-red-400/10"
            (click)="deleteTransaction()"
          >
            Delete
          </button>
        }
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white/10"
          (click)="dialogRef.close()"
        >
          Cancel
        </button>
        <button
          type="button"
          [disabled]="amount.invalid"
          class="rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="submit()"
        >
          Save
        </button>
      </div>
    </section>
  `
})
export class EditBuyInDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<EditBuyInDialogComponent, EditBuyInDialogResult | undefined>
  );
  protected readonly data = inject<EditBuyInDialogData>(MAT_DIALOG_DATA);
  protected readonly amount = new FormControl(this.data.transaction.amount, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1)]
  });
  protected readonly comment = new FormControl(this.data.transaction.comment ?? '', {
    nonNullable: true
  });

  protected submit(): void {
    if (this.amount.valid) {
      this.dialogRef.close({
        action: 'save',
        amount: this.amount.value,
        comment: this.comment.value.trim()
      });
    }
  }

  protected deleteTransaction(): void {
    this.dialogRef.close({ action: 'delete' });
  }
}
