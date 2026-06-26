import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MockPokerStoreService } from '../data/mock-poker-store.service';

@Component({
  selector: 'app-new-session-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-2xl space-y-6">
      <a routerLink="/host/dashboard" class="text-sm font-semibold text-emerald-300">Back</a>

      <div>
        <p class="text-sm font-medium uppercase text-emerald-300">Session</p>
        <h1 class="mt-2 text-3xl font-semibold text-white">New Session</h1>
      </div>

      <form
        class="rounded-lg border border-white/10 bg-white/[0.04] p-5"
        [formGroup]="form"
      >
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
          [disabled]="form.invalid"
          class="mt-6 w-full rounded-lg bg-emerald-400 px-5 py-4 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:bg-neutral-700 disabled:text-neutral-400"
          (click)="createSession()"
        >
          Start session
        </button>
      </form>
    </section>
  `
})
export class NewSessionPage {
  private readonly store = inject(MockPokerStoreService);
  private readonly router = inject(Router);

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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const session = await this.store.createSession(value.name, value.sessionDate);

    await this.router.navigate(['/host/sessions', session.id]);
  }

  private today(): string {
    const date = new Date();
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

    return offsetDate.toISOString().slice(0, 10);
  }
}
