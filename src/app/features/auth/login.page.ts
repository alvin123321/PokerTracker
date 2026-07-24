import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <main
      class="login-shell min-h-dvh overflow-hidden bg-neutral-950 text-neutral-50"
      [class.login-shell-leaving]="isLeaving()"
    >
      <section
        class="login-stage mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-6 px-4 py-4 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[1.04fr_0.96fr]"
      >
        <div class="login-copy">
          <div class="login-brand-row">
            <div class="pokertrack-brand login-brand">
              <span class="pokertrack-brand-mark" aria-hidden="true">
                <span class="pokertrack-brand-suit">&spades;</span>
              </span>
              <span class="pokertrack-brand-name">
                <span>Poker</span><span>Tracker</span>
              </span>
            </div>
            <span class="login-version">
              v1.1
            </span>
          </div>
          <h1 class="login-title">
            Table control starts here.
          </h1>
          <p class="login-subtitle">
            Sign in to manage live sessions, member ledgers, rebuys, and cash-outs without slowing down the game.
          </p>
          <div class="login-proof-grid">
            <div class="login-proof-card" style="--motion-index: 0">
              <p class="font-semibold text-white">Fast</p>
              <p class="mt-1">One-tap table actions.</p>
            </div>
            <div class="login-proof-card" style="--motion-index: 1">
              <p class="font-semibold text-white">Private</p>
              <p class="mt-1">Player-only ledgers.</p>
            </div>
            <div class="login-proof-card" style="--motion-index: 2">
              <p class="font-semibold text-white">Live</p>
              <p class="mt-1">Synced session state.</p>
            </div>
          </div>
        </div>

        <form
          class="login-card"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          <div class="login-card-head">
            <p class="login-card-kicker">Table access</p>
            <h2>Sign in</h2>
          </div>

          @if (errorMessage()) {
            <div id="login-error" class="login-error" role="alert">
              {{ errorMessage() }}
            </div>
          }

          <div class="login-field">
            <label for="username">Login name</label>
            <input
              id="username"
              type="text"
              autocomplete="username"
              autocapitalize="none"
              formControlName="username"
              class="login-input"
              placeholder="admin1223"
              spellcheck="false"
              [attr.aria-invalid]="errorMessage() ? 'true' : null"
              [attr.aria-describedby]="errorMessage() ? 'login-error' : null"
            />
          </div>

          <div class="login-field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              formControlName="password"
              class="login-input"
              placeholder="Password"
              [attr.aria-invalid]="errorMessage() ? 'true' : null"
              [attr.aria-describedby]="errorMessage() ? 'login-error' : null"
            />
          </div>

          <button
            type="submit"
            [disabled]="form.invalid || authState.loading() || welcomeName() || isLeaving()"
            [class.login-submit-loading]="authState.loading() || welcomeName() || isLeaving()"
            class="login-submit"
          >
            @if (welcomeName()) {
              <span class="login-spinner border-neutral-400 border-t-transparent" aria-hidden="true"></span>
              <span class="login-submit-label">Welcome...</span>
            } @else if (isLeaving()) {
              <span class="login-spinner border-neutral-400 border-t-transparent" aria-hidden="true"></span>
              <span class="login-submit-label">Opening dashboard...</span>
            } @else if (authState.loading()) {
              <span class="login-spinner border-neutral-400 border-t-transparent" aria-hidden="true"></span>
              <span class="login-submit-label">Signing in...</span>
            } @else {
              <span class="login-submit-label">Sign in</span>
            }
          </button>
        </form>
      </section>

      @if (loginLoadingMessage(); as message) {
        <div
          class="pokertrack-sync-overlay fixed inset-0 z-50 grid place-items-center bg-neutral-950/70 px-6 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div class="login-loading-card">
            <div class="deck-shuffle mx-auto mb-4" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p class="text-base font-semibold text-white">{{ message }}</p>
            <p class="mt-1 text-sm text-neutral-400">Getting your seat ready.</p>
          </div>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .login-shell {
        position: relative;
        --login-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
        --login-ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
        background:
          linear-gradient(140deg, rgb(16 185 129 / 0.14), transparent 30rem),
          linear-gradient(180deg, #06100d 0%, #07100d 42%, #030504 100%);
        isolation: isolate;
        animation: login-shell-in 280ms var(--login-ease-out) both;
      }

      .login-shell::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background-image:
          linear-gradient(rgb(255 255 255 / 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgb(255 255 255 / 0.028) 1px, transparent 1px);
        background-size: 4rem 4rem;
        mask-image: linear-gradient(180deg, rgb(0 0 0 / 0.72), transparent 70%);
      }

      .login-stage {
        position: relative;
        align-content: center;
      }

      .login-copy {
        padding-block: 0.3rem;
        text-align: center;
        animation: login-copy-in 380ms 70ms var(--login-ease-out) both;
      }

      .login-brand-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.85rem;
        min-width: 0;
      }

      .login-brand {
        pointer-events: none;
      }

      .login-brand .pokertrack-brand-mark::before {
        transform-origin: 70% 80%;
        animation: login-card-settle-left 520ms 80ms var(--login-ease-expo) both;
      }

      .login-brand .pokertrack-brand-mark::after {
        transform-origin: 35% 80%;
        animation: login-card-settle-right 520ms 120ms var(--login-ease-expo) both;
      }

      .login-brand .pokertrack-brand-name {
        font-size: 1.55rem;
      }

      .login-version {
        display: inline-flex;
        align-items: center;
        min-height: 1.75rem;
        border: 1px solid rgb(110 231 183 / 0.28);
        border-radius: 9999px;
        background: rgb(6 78 59 / 0.18);
        padding: 0.22rem 0.62rem;
        color: rgb(209 250 229);
        font-size: 0.74rem;
      }

      .login-title {
        max-width: 11.4ch;
        margin: 1.9rem auto 0.35rem;
        font-size: 4.35rem;
        line-height: 1;
        letter-spacing: 0;
        text-wrap: balance;
        animation: login-title-in 430ms 120ms var(--login-ease-expo) both;
      }

      .login-subtitle {
        max-width: 34rem;
        margin: 1.05rem auto 0;
        color: rgb(229 229 229 / 0.86);
        font-size: 1.08rem;
        line-height: 1.58;
        letter-spacing: 0.01em;
        text-wrap: pretty;
        animation: login-panel-in 340ms 180ms var(--login-ease-out) both;
      }

      .login-proof-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.8rem;
        margin-top: 1.65rem;
      }

      .login-proof-card {
        min-height: 5.85rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.5rem;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025)),
          rgb(10 10 10 / 0.35);
        padding: 0.9rem;
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
        animation: login-proof-in 340ms calc(210ms + (var(--motion-index, 0) * 55ms))
          var(--login-ease-out) both;
        transition:
          border-color 180ms var(--login-ease-out),
          background-color 180ms var(--login-ease-out),
          transform 180ms var(--login-ease-out),
          box-shadow 180ms var(--login-ease-out);
      }

      .login-proof-card:hover {
        border-color: rgb(52 211 153 / 0.35);
        background-color: rgb(6 78 59 / 0.08);
        box-shadow:
          inset 0 1px 0 rgb(255 255 255 / 0.06),
          0 0.75rem 1.4rem rgb(0 0 0 / 0.16);
        transform: translateY(-1px);
      }

      .login-card {
        width: 100%;
        max-width: 30rem;
        justify-self: center;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.5rem;
        background:
          radial-gradient(circle at 50% 0%, rgb(52 211 153 / 0.14), transparent 15rem),
          linear-gradient(180deg, rgb(255 255 255 / 0.075), rgb(255 255 255 / 0.035)),
          rgb(13 17 16 / 0.86);
        box-shadow:
          0 1.5rem 4rem rgb(0 0 0 / 0.36),
          inset 0 1px 0 rgb(255 255 255 / 0.07);
        padding: 1.45rem;
        text-align: center;
        animation: login-card-in 420ms 120ms var(--login-ease-expo) both;
      }

      .login-card-head {
        text-align: center;
      }

      .login-card-kicker {
        margin: 0;
        color: rgb(110 231 183);
        text-transform: uppercase;
      }

      .login-card-head h2 {
        margin: 0.28rem 0 0;
        color: white;
      }

      .login-error {
        margin-top: 1rem;
        border-radius: 0.5rem;
        padding: 0.85rem 0.95rem;
        font-size: 0.875rem;
        line-height: 1.45;
        border: 1px solid rgb(248 113 113 / 0.34);
        background: rgb(127 29 29 / 0.28);
        color: rgb(254 226 226);
        animation: login-error-in 190ms var(--login-ease-out) both;
      }

      .login-field {
        display: grid;
        gap: 0.45rem;
        margin-top: 1rem;
      }

      .login-field label {
        color: rgb(229 229 229);
        text-align: center;
        transition:
          color 160ms var(--login-ease-out),
          transform 160ms var(--login-ease-out);
      }

      .login-field:focus-within label {
        color: rgb(167 243 208);
        transform: translateY(-1px);
      }

      .login-input {
        width: 100%;
        min-height: 3.1rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.5rem;
        background: rgb(4 6 7 / 0.74);
        color: white;
        padding: 0.82rem 0.95rem;
        text-align: center;
        outline: none;
        transition:
          border-color 170ms var(--login-ease-out),
          box-shadow 170ms var(--login-ease-out),
          background-color 170ms var(--login-ease-out),
          transform 170ms var(--login-ease-out);
      }

      .login-input::placeholder {
        color: rgb(163 163 163 / 0.62);
      }

      .login-input:hover {
        border-color: rgb(255 255 255 / 0.2);
        background: rgb(8 12 12 / 0.86);
      }

      .login-input:focus-visible {
        border-color: rgb(52 211 153);
        box-shadow:
          0 0 0 3px rgb(52 211 153 / 0.18),
          0 0 22px rgb(16 185 129 / 0.12);
        transform: translateY(-1px);
      }

      .login-input[aria-invalid='true'] {
        border-color: rgb(248 113 113 / 0.5);
        box-shadow: 0 0 0 1px rgb(248 113 113 / 0.12);
      }

      .login-submit {
        position: relative;
        display: flex;
        min-height: 3rem;
        width: 100%;
        align-items: center;
        justify-content: center;
        gap: 0.55rem;
        border: 1px solid rgb(110 231 183 / 0.42);
        border-radius: 0.5rem;
        background:
          linear-gradient(180deg, rgb(52 211 153), rgb(22 163 74)),
          rgb(52 211 153);
        color: rgb(5 15 12);
        margin-top: 1.2rem;
        padding: 0.82rem 1.2rem;
        isolation: isolate;
        overflow: hidden;
        box-shadow:
          0 0.9rem 2rem rgb(5 150 105 / 0.2),
          inset 0 1px 0 rgb(255 255 255 / 0.3);
        transition:
          transform 150ms var(--login-ease-out),
          box-shadow 180ms var(--login-ease-out),
          background 180ms var(--login-ease-out),
          border-color 180ms var(--login-ease-out),
          color 180ms var(--login-ease-out);
      }

      .login-submit:hover:not(:disabled) {
        transform: translateY(-1px);
        border-color: rgb(167 243 208 / 0.65);
        box-shadow:
          0 1.05rem 2.25rem rgb(5 150 105 / 0.28),
          0 0 0 3px rgb(52 211 153 / 0.12),
          inset 0 1px 0 rgb(255 255 255 / 0.36);
      }

      .login-submit:active:not(:disabled) {
        transform: translateY(0) scale(0.985);
      }

      .login-submit:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 3px rgb(10 10 10),
          0 0 0 6px rgb(52 211 153 / 0.72);
      }

      .login-submit:disabled {
        border-color: rgb(255 255 255 / 0.08);
        background: rgb(38 38 38);
        color: rgb(163 163 163);
        box-shadow: none;
      }

      .login-submit-loading {
        animation: login-submit-loading 980ms ease-in-out infinite;
      }

      .login-shell-leaving {
        animation: login-shell-out 240ms cubic-bezier(0.7, 0, 0.84, 0) both;
      }

      .login-spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border-width: 2px;
        border-style: solid;
        border-radius: 9999px;
        animation: login-spinner 700ms linear infinite;
      }

      .login-loading-card {
        border: 1px solid rgb(110 231 183 / 0.22);
        border-radius: 0.75rem;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025)),
          rgb(10 10 10 / 0.96);
        padding: 1.25rem 1.5rem;
        text-align: center;
        box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.5);
        animation: login-loading-card-in 260ms var(--login-ease-expo) both;
      }

      @media (min-width: 640px) {
        .login-card {
          padding: 1.55rem;
        }
      }

      @media (max-width: 639px) {
        .login-stage {
          gap: 1rem;
          padding-top: 0.8rem;
          padding-bottom: 0.8rem;
        }

        .login-brand .pokertrack-brand-name {
          font-size: 1.32rem;
        }

        .login-brand .pokertrack-brand-mark {
          width: 2.72rem;
          height: 2.3rem;
        }

        .login-title {
          max-width: 14ch;
          margin-top: 1.05rem;
          margin-bottom: 1.1rem;
          font-size: 2.2rem;
          line-height: 1.08;
        }

        .login-subtitle {
          display: none;
        }

        .login-proof-grid {
          display: none;
        }

        .login-card {
          max-width: 23rem;
          padding: 0.95rem;
        }

        .login-field {
          margin-top: 0.75rem;
        }

        .login-input,
        .login-submit {
          min-height: 2.75rem;
        }

        .login-submit {
          margin-top: 0.9rem;
        }
      }

      @media (max-width: 359px) {
        .login-stage {
          gap: 0.75rem;
          padding-left: 0.85rem;
          padding-right: 0.85rem;
        }

        .login-title {
          font-size: 1.95rem;
        }

        .login-subtitle {
          font-size: 0.88rem;
        }

        .login-card {
          padding: 0.82rem;
        }

        .login-input,
        .login-submit {
          min-height: 2.65rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .login-shell,
        .login-copy,
        .login-card,
        .login-shell-leaving,
        .login-title,
        .login-subtitle,
        .login-proof-card,
        .login-error,
        .login-submit,
        .login-submit-loading,
        .login-submit::after,
        .login-loading-card,
        .login-brand .pokertrack-brand-mark::before,
        .login-brand .pokertrack-brand-mark::after,
        .login-input {
          animation: none;
          transition: none;
        }

        .login-spinner,
        .deck-shuffle span {
          animation-duration: 1ms;
          animation-iteration-count: 1;
        }
      }

    `
  ]
})
export class LoginPage {
  protected readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly errorMessage = computed(() => this.authState.error());
  protected readonly isLeaving = signal(false);
  protected readonly welcomeName = signal<string | null>(null);
  protected readonly loginLoadingMessage = computed(() => {
    const name = this.welcomeName();

    if (name) {
      return `Welcome to join the game ${name}`;
    }

    return this.authState.loading() ? 'Joining the game...' : null;
  });

  protected readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();

    try {
      this.welcomeName.set(null);
      const profile = await this.authState.signIn(username, password);
      this.welcomeName.set(this.playerNameForWelcome(profile, username));
      await this.waitForWelcomeAnimation();
      this.isLeaving.set(true);
      await this.waitForExitAnimation();
      await this.router.navigateByUrl(this.destinationFor(profile));
    } catch {
      this.isLeaving.set(false);
      this.welcomeName.set(null);
      this.form.controls.password.reset();
    }
  }

  private destinationFor(profile: UserProfile): string {
    const fallback = this.authState.redirectPathForProfile(profile);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    if (!returnUrl?.startsWith('/')) {
      return fallback;
    }

    if ((profile.role === 'HOST' || profile.role === 'MANAGER') && returnUrl.startsWith('/host')) {
      return returnUrl;
    }

    if (
      (profile.role === 'PLAYER' || profile.role === 'MANAGER') &&
      returnUrl.startsWith('/player')
    ) {
      return returnUrl;
    }

    return fallback;
  }

  private playerNameForWelcome(profile: UserProfile, username: string): string {
    return profile.displayName?.trim() || username.trim() || 'Player';
  }

  private waitForExitAnimation(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 260));
  }

  private waitForWelcomeAnimation(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}
