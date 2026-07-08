import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import {
  displayNameInitials,
  normalizeDisplayName,
  validatePasswordChange
} from './profile.logic';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (profile(); as currentProfile) {
      <section class="profile-page">
        <a [routerLink]="backLink()" class="profile-back-link">&larr; Back</a>

        <header class="profile-hero">
          <div class="profile-avatar-large" aria-hidden="true">{{ initials() }}</div>
          <div class="profile-hero-copy">
            <p class="profile-role">{{ roleLabel() }}</p>
            <h1>{{ currentProfile.displayName ?? 'PokerTrack Member' }}</h1>
            <p>Keep your table name and password current.</p>
          </div>
        </header>

        @if (statusMessage()) {
          <div class="profile-alert profile-alert-success">{{ statusMessage() }}</div>
        }

        @if (errorMessage()) {
          <div class="profile-alert profile-alert-error">{{ errorMessage() }}</div>
        }

        <div class="profile-grid">
          <form class="profile-panel" [formGroup]="nameForm" (ngSubmit)="saveName()">
            <div>
              <h2>Display name</h2>
              <p>This is the name shown around the table.</p>
            </div>

            <label class="profile-field">
              <span>Name</span>
              <input
                type="text"
                autocomplete="name"
                formControlName="displayName"
                maxlength="80"
              />
            </label>

            <button type="submit" class="profile-primary-button" [disabled]="authState.loading()">
              {{ authState.loading() ? 'Saving...' : 'Save name' }}
            </button>
          </form>

          <form class="profile-panel" [formGroup]="passwordForm" (ngSubmit)="savePassword()">
            <div>
              <h2>Password</h2>
              <p>Use at least 6 characters. The app will not store readable passwords.</p>
            </div>

            <label class="profile-field">
              <span>New password</span>
              <input
                type="password"
                autocomplete="new-password"
                formControlName="password"
              />
            </label>

            <label class="profile-field">
              <span>Confirm password</span>
              <input
                type="password"
                autocomplete="new-password"
                formControlName="confirmPassword"
              />
            </label>

            <button type="submit" class="profile-primary-button" [disabled]="authState.loading()">
              {{ authState.loading() ? 'Updating...' : 'Change password' }}
            </button>
          </form>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .profile-page {
        display: grid;
        gap: 1rem;
        animation: profile-page-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .profile-back-link {
        width: fit-content;
        color: rgb(110 231 183);
        font-size: 0.92rem;
        font-weight: 750;
      }

      .profile-hero,
      .profile-panel {
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 1rem;
        background:
          linear-gradient(145deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025)),
          rgb(3 8 7 / 0.72);
      }

      .profile-hero {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
      }

      .profile-avatar-large {
        display: grid;
        height: 4.5rem;
        width: 4.5rem;
        flex: 0 0 auto;
        place-items: center;
        border: 1px solid rgb(52 211 153 / 0.42);
        border-radius: 1.3rem;
        background:
          radial-gradient(circle at 30% 20%, rgb(74 222 128 / 0.34), transparent 42%),
          linear-gradient(160deg, rgb(16 185 129 / 0.24), rgb(255 255 255 / 0.035));
        box-shadow: 0 0 28px rgb(16 185 129 / 0.16);
        color: rgb(220 252 231);
        font-size: 1.35rem;
        font-weight: 850;
      }

      .profile-hero-copy {
        min-width: 0;
      }

      .profile-role {
        margin: 0 0 0.35rem;
        color: rgb(52 211 153);
        font-size: 0.78rem;
        font-weight: 850;
      }

      .profile-hero h1,
      .profile-panel h2 {
        margin: 0;
        color: white;
        font-weight: 780;
        letter-spacing: 0;
      }

      .profile-hero h1 {
        font-size: 1.55rem;
        line-height: 1.08;
      }

      .profile-hero p,
      .profile-panel p {
        margin: 0.35rem 0 0;
        color: rgb(161 161 170);
      }

      .profile-grid {
        display: grid;
        gap: 1rem;
      }

      .profile-panel {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .profile-panel h2 {
        font-size: 1.12rem;
      }

      .profile-field {
        display: grid;
        gap: 0.45rem;
      }

      .profile-field span {
        color: rgb(212 212 216);
        font-size: 0.88rem;
        font-weight: 720;
      }

      .profile-field input {
        width: 100%;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.85rem;
        background: rgb(0 0 0 / 0.24);
        color: white;
        font-size: 1rem;
        outline: none;
        padding: 0.86rem 0.95rem;
        transition:
          border-color 180ms ease,
          box-shadow 180ms ease,
          background-color 180ms ease;
      }

      .profile-field input:focus {
        border-color: rgb(52 211 153 / 0.55);
        background: rgb(0 0 0 / 0.34);
        box-shadow: 0 0 0 3px rgb(52 211 153 / 0.12);
      }

      .profile-primary-button {
        min-height: 3rem;
        border: 1px solid rgb(34 197 94 / 0.42);
        border-radius: 0.9rem;
        background:
          linear-gradient(180deg, rgb(34 197 94 / 0.98), rgb(22 163 74 / 0.92)),
          rgb(34 197 94);
        color: rgb(3 7 18);
        font-weight: 820;
        transition:
          transform 180ms ease,
          filter 180ms ease,
          opacity 180ms ease;
      }

      .profile-primary-button:hover {
        filter: brightness(1.06);
      }

      .profile-primary-button:active {
        transform: scale(0.99);
      }

      .profile-primary-button:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }

      .profile-alert {
        border-radius: 0.9rem;
        padding: 0.85rem 1rem;
        font-size: 0.92rem;
        font-weight: 720;
      }

      .profile-alert-success {
        border: 1px solid rgb(34 197 94 / 0.28);
        background: rgb(34 197 94 / 0.1);
        color: rgb(220 252 231);
      }

      .profile-alert-error {
        border: 1px solid rgb(248 113 113 / 0.3);
        background: rgb(248 113 113 / 0.1);
        color: rgb(254 202 202);
      }

      @media (min-width: 760px) {
        .profile-page {
          gap: 1.25rem;
        }

        .profile-hero {
          padding: 1.25rem;
        }

        .profile-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .profile-page,
        .profile-field input,
        .profile-primary-button {
          animation: none;
          transition: none;
        }
      }

      @keyframes profile-page-enter {
        from {
          opacity: 0;
          transform: translateY(0.3rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `
  ]
})
export class ProfilePage {
  protected readonly authState = inject(AuthStateService);
  protected readonly profile = this.authState.profile;
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly initials = computed(() => displayNameInitials(this.profile()?.displayName));
  protected readonly roleLabel = computed(() => {
    const role = this.profile()?.role;

    if (role === 'HOST') {
      return 'Admin profile';
    }

    if (role === 'MANAGER') {
      return 'Manager profile';
    }

    return 'Player profile';
  });
  protected readonly backLink = computed(() =>
    this.profile()?.role === 'PLAYER' ? '/player/dashboard' : '/host/dashboard'
  );

  protected readonly nameForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    })
  });

  protected readonly passwordForm = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)]
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  constructor() {
    this.nameForm.controls.displayName.setValue(this.profile()?.displayName ?? '');
  }

  protected async saveName(): Promise<void> {
    this.statusMessage.set(null);
    this.errorMessage.set(null);

    const displayName = normalizeDisplayName(this.nameForm.controls.displayName.value);

    try {
      await this.authState.updateDisplayName(displayName);
      this.nameForm.controls.displayName.setValue(displayName);
      this.statusMessage.set('Name updated.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to update name.');
    }
  }

  protected async savePassword(): Promise<void> {
    this.statusMessage.set(null);
    this.errorMessage.set(null);

    const { password, confirmPassword } = this.passwordForm.getRawValue();
    const validationMessage = validatePasswordChange(password, confirmPassword);

    if (validationMessage) {
      this.errorMessage.set(validationMessage);
      return;
    }

    try {
      await this.authState.updatePassword(password);
      this.passwordForm.reset({ password: '', confirmPassword: '' });
      this.statusMessage.set('Password changed.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to change password.');
    }
  }
}
