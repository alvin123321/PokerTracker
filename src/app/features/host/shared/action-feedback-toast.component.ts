import { Component, Input } from '@angular/core';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideInfo,
  LucideLoaderCircle,
} from '@lucide/angular';

export type ActionFeedbackToastTone = 'success' | 'error' | 'info' | 'saving';

@Component({
  selector: 'app-action-feedback-toast',
  imports: [LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideLoaderCircle],
  template: `
    <div
      class="action-feedback-toast action-feedback-toast-{{ tone }}"
      [attr.role]="tone === 'error' ? 'alert' : 'status'"
      [attr.aria-live]="tone === 'error' ? 'assertive' : 'polite'"
    >
      <div class="action-feedback-card">
        <span class="action-feedback-icon" aria-hidden="true">
          @switch (tone) {
            @case ('error') {
              <svg lucideCircleAlert [strokeWidth]="2.3" [absoluteStrokeWidth]="true"></svg>
            }
            @case ('saving') {
              <svg
                class="action-feedback-spin"
                lucideLoaderCircle
                [strokeWidth]="2.2"
                [absoluteStrokeWidth]="true"
              ></svg>
            }
            @case ('info') {
              <svg lucideInfo [strokeWidth]="2.3" [absoluteStrokeWidth]="true"></svg>
            }
            @default {
              <svg lucideCircleCheck [strokeWidth]="2.3" [absoluteStrokeWidth]="true"></svg>
            }
          }
        </span>
        <p class="action-feedback-message">{{ message }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        pointer-events: none;
        position: fixed;
        inset: 0;
        z-index: 60;
      }

      .action-feedback-toast {
        --action-feedback-accent: rgb(52, 211, 153);
        --action-feedback-bg: rgba(6, 78, 59, 0.96);
        --action-feedback-border: rgba(110, 231, 183, 0.34);
        --action-feedback-shadow: rgba(16, 185, 129, 0.22);
        --action-feedback-exit-delay: 2.65s;

        position: absolute;
        top: calc(max(1rem, env(safe-area-inset-top)) + 4.75rem);
        left: 50%;
        width: min(calc(100vw - 2rem), 23rem);
        transform: translateX(-50%);
        animation:
          action-feedback-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both,
          action-feedback-out 420ms ease-in forwards var(--action-feedback-exit-delay);
      }

      .action-feedback-toast-error {
        --action-feedback-accent: rgb(248, 113, 113);
        --action-feedback-bg: rgba(127, 29, 29, 0.96);
        --action-feedback-border: rgba(252, 165, 165, 0.42);
        --action-feedback-shadow: rgba(239, 68, 68, 0.25);
        --action-feedback-exit-delay: 4.25s;
      }

      .action-feedback-toast-info,
      .action-feedback-toast-saving {
        --action-feedback-accent: rgb(125, 211, 252);
        --action-feedback-bg: rgba(12, 74, 110, 0.96);
        --action-feedback-border: rgba(125, 211, 252, 0.36);
        --action-feedback-shadow: rgba(14, 165, 233, 0.24);
      }

      .action-feedback-card {
        display: flex;
        min-height: 4.25rem;
        align-items: center;
        gap: 0.85rem;
        overflow: hidden;
        border: 1px solid var(--action-feedback-border);
        border-radius: 0.9rem;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 58%),
          var(--action-feedback-bg);
        padding: 0.95rem 1rem;
        color: white;
        box-shadow:
          0 1.35rem 3rem rgba(0, 0, 0, 0.42),
          0 0 0 0.35rem var(--action-feedback-shadow);
      }

      .action-feedback-icon {
        display: inline-grid;
        width: 2.45rem;
        height: 2.45rem;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.11);
        color: var(--action-feedback-accent);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      }

      .action-feedback-icon svg {
        width: 1.45rem;
        height: 1.45rem;
      }

      .action-feedback-message {
        margin: 0;
        color: white;
        font-size: 0.95rem;
        font-weight: 750;
        line-height: 1.25;
        text-wrap: pretty;
      }

      .action-feedback-spin {
        animation: action-feedback-spin 850ms linear infinite;
      }

      @keyframes action-feedback-in {
        from {
          opacity: 0;
          transform: translate(-50%, -0.45rem) scale(0.96);
        }

        to {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }
      }

      @keyframes action-feedback-out {
        to {
          opacity: 0;
          transform: translate(-50%, -0.45rem) scale(0.98);
        }
      }

      @keyframes action-feedback-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (min-width: 640px) {
        .action-feedback-toast {
          top: calc(max(1.25rem, env(safe-area-inset-top)) + 4.25rem);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .action-feedback-toast {
          animation: action-feedback-reduced 160ms ease-out both;
        }

        .action-feedback-spin {
          animation: none;
        }
      }

      @keyframes action-feedback-reduced {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ],
})
export class ActionFeedbackToastComponent {
  @Input({ required: true }) message = '';
  @Input() tone: ActionFeedbackToastTone = 'success';
}
