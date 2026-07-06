import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PokerStoreService } from '../data/poker-store.service';

@Component({
  selector: 'app-new-session-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">&larr; Dashboard</a>

      <div>
        <p class="text-sm font-medium uppercase text-emerald-300">Session</p>
        <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">New Session</h1>
      </div>

      <form
        class="rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:p-5"
        [formGroup]="form"
      >
        @if (errorMessage()) {
          <div class="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {{ errorMessage() }}
          </div>
        }

        <label class="block text-sm font-medium text-neutral-200" for="sessionName">Session name</label>
        <input
          id="sessionName"
          formControlName="name"
          class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-emerald-300"
          placeholder="Friday Night Poker"
        />

        <label class="mt-5 block text-sm font-medium text-neutral-200" for="sessionDate">Date</label>
        <input
          id="sessionDate"
          type="date"
          formControlName="sessionDate"
          class="mt-2 w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-emerald-300"
        />

        <button
          type="button"
          [disabled]="form.invalid || saving()"
          class="mt-6 w-full rounded-lg bg-emerald-400 px-5 py-4 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="createSession()"
        >
          @if (saving()) {
            Starting...
          } @else {
            Start session
          }
        </button>
      </form>
    </section>
  `
})
export class NewSessionPage {
  private readonly store = inject(PokerStoreService);
  private readonly router = inject(Router);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('Friday Night Poker', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    sessionDate: new FormControl(this.today(), {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  protected async createSession(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const value = this.form.getRawValue();
      const session = await this.store.createSession(value.name, value.sessionDate);

      await this.router.navigate(['/host/sessions', session.id]);
    } catch (error) {
      this.errorMessage.set(this.toMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private today(): string {
    const date = new Date();
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

    return offsetDate.toISOString().slice(0, 10);
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to create session.';
  }
}
