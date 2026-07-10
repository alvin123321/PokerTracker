import { Component, computed, ElementRef, input, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideLoaderCircle,
  LucideMessageCircle,
  LucideRadio,
  LucideSendHorizontal,
  LucideShieldCheck,
  LucideSparkles,
  LucideUsersRound
} from '@lucide/angular';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { GlobalChatService } from './global-chat.service';
import {
  globalChatInitials,
  isOwnGlobalChatMessage,
  relativeChatTimeLabel,
  validateChatMessageText,
  type GlobalChatMessage
} from './global-chat.logic';

@Component({
  selector: 'app-global-chat-page',
  imports: [
    FormsModule,
    LucideLoaderCircle,
    LucideMessageCircle,
    LucideRadio,
    LucideSendHorizontal,
    LucideShieldCheck,
    LucideSparkles,
    LucideUsersRound
  ],
  template: `
    <section class="global-chat" [class.global-chat-compact]="compact()">
      @if (!compact()) {
        <header class="chat-hero">
          <div>
            <span class="chat-kicker">
              <svg lucideRadio [strokeWidth]="2.3" aria-hidden="true"></svg>
              Live global room
            </span>
            <h1>Global Chat</h1>
            <p>Fast table talk for every signed-in member.</p>
          </div>
          <div class="chat-hero-status" aria-label="Realtime chat status">
            <span></span>
            <strong>{{ chat.messages().length }}</strong>
            <small>messages</small>
          </div>
        </header>
      }

      <div class="chat-layout">
        @if (!compact()) {
          <aside class="chat-room-panel" aria-label="Chat room information">
            <div class="room-orbit" aria-hidden="true">
              <span></span>
              <span></span>
              <svg lucideMessageCircle [strokeWidth]="2.3"></svg>
            </div>
            <div>
              <p>Room</p>
              <h2>PokerTracker Lounge</h2>
              <small>Host, manager, and player messages in one place.</small>
            </div>
            <div class="room-stat-grid">
              <span>
                <strong>{{ onlineLabel() }}</strong>
                <small>signed in</small>
              </span>
              <span>
                <strong>500</strong>
                <small>max chars</small>
              </span>
            </div>
          </aside>
        }

        <main class="chat-panel" aria-label="Global group chat">
          <div class="chat-panel-head">
            <div>
              <span class="chat-panel-icon">
                <svg lucideSparkles [strokeWidth]="2.2" aria-hidden="true"></svg>
              </span>
              <div>
                <h2>Table Talk</h2>
                <p>{{ subtitle() }}</p>
              </div>
            </div>
            <span class="chat-live-pill">
              <span></span>
              Live
            </span>
          </div>

          <div #messageStream class="chat-stream" aria-live="polite">
            @if (chat.loading() && chat.messages().length === 0) {
              <div class="chat-loading">
                <div class="deck-shuffle" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p>Loading chat</p>
              </div>
            } @else if (chat.messages().length === 0) {
              <div class="chat-empty">
                <svg lucideMessageCircle [strokeWidth]="2.2" aria-hidden="true"></svg>
                <h3>No messages yet</h3>
                <p>Send the first table note.</p>
              </div>
            } @else {
              @for (message of chat.messages(); track message.id; let index = $index) {
                <article
                  class="chat-message"
                  [class.chat-message-own]="isOwn(message)"
                  [style.--message-index]="index"
                >
                  <span class="chat-avatar">{{ initials(message.senderDisplayName) }}</span>
                  <div class="chat-message-content">
                    <div class="chat-message-meta">
                      <strong>{{ message.senderDisplayName }}</strong>
                      <span>{{ message.senderRole === 'PLAYER' ? 'Member' : message.senderRole }}</span>
                      <time [attr.datetime]="message.createdAt">{{ timeLabel(message.createdAt) }}</time>
                    </div>
                    <div class="chat-bubble">
                      <p>{{ message.message }}</p>
                    </div>
                  </div>
                </article>
              }
            }
          </div>

          <form class="chat-composer" (submit)="sendMessage($event)">
            <label class="sr-only" for="global-chat-message">Message</label>
            <textarea
              id="global-chat-message"
              name="global-chat-message"
              rows="2"
              maxlength="500"
              autocomplete="off"
              placeholder="Message the group..."
              [(ngModel)]="draftText"
              (ngModelChange)="draftChanged($event)"
            ></textarea>
            <div class="composer-footer">
              <span [class.chat-error-text]="chat.error() || validationMessage()">
                {{ chat.error() || validationMessage() || characterCountLabel() }}
              </span>
              <button type="submit" [disabled]="chat.sending() || !canSend()">
                @if (chat.sending()) {
                  <svg lucideLoaderCircle class="chat-send-loading" [strokeWidth]="2.4" aria-hidden="true"></svg>
                } @else {
                  <svg lucideSendHorizontal [strokeWidth]="2.4" aria-hidden="true"></svg>
                }
                <span>Send</span>
              </button>
            </div>
          </form>
        </main>

        @if (!compact()) {
          <aside class="chat-safety-panel" aria-label="Chat rules">
            <div class="pulse-card">
              <div class="pulse-rings" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <svg lucideUsersRound [strokeWidth]="2.1" aria-hidden="true"></svg>
              <h2>Everyone Sees It</h2>
              <p>Global messages are visible to all signed-in PokerTracker members.</p>
            </div>
            <div class="chat-rule-row">
              <svg lucideShieldCheck [strokeWidth]="2.2" aria-hidden="true"></svg>
              <span>Messages send as your profile name.</span>
            </div>
            <div class="chat-rule-row">
              <svg lucideMessageCircle [strokeWidth]="2.2" aria-hidden="true"></svg>
              <span>Text only for V1. No private messages.</span>
            </div>
          </aside>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .global-chat {
        --chat-green: #22c55e;
        --chat-green-bright: #4ade80;
        --chat-cyan: #67e8f9;
        --chat-gold: #facc15;
        --chat-ink: #f8fafc;
        --chat-muted: #b7c2c9;
        --chat-border: rgb(148 163 184 / 0.2);
        display: grid;
        gap: 1.1rem;
        color: var(--chat-ink);
      }

      .chat-hero {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.2rem 0.1rem;
      }

      .chat-kicker,
      .chat-live-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.42rem;
        color: var(--chat-green-bright);
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.01em;
      }

      .chat-kicker svg {
        width: 1rem;
        height: 1rem;
      }

      .chat-hero h1 {
        margin: 0.25rem 0 0;
        font-size: 2.35rem;
        line-height: 1;
        font-weight: 860;
        letter-spacing: -0.025em;
        text-shadow: 0 0 1.5rem rgb(34 197 94 / 0.2);
      }

      .chat-hero p,
      .chat-room-panel small,
      .chat-safety-panel p,
      .chat-panel-head p {
        margin: 0;
        color: var(--chat-muted);
      }

      .chat-hero-status {
        display: grid;
        grid-template-columns: auto auto;
        align-items: center;
        gap: 0.15rem 0.55rem;
        min-width: 8rem;
        border: 1px solid rgb(34 197 94 / 0.28);
        border-radius: 1rem;
        padding: 0.72rem 0.85rem;
        background:
          radial-gradient(circle at 25% 20%, rgb(74 222 128 / 0.2), transparent 55%),
          rgb(15 23 42 / 0.72);
        box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.28);
      }

      .chat-hero-status span,
      .chat-live-pill span {
        width: 0.62rem;
        height: 0.62rem;
        border-radius: 999px;
        background: var(--chat-green-bright);
        box-shadow: 0 0 1rem rgb(74 222 128 / 0.85);
      }

      .chat-hero-status strong {
        font-size: 1.42rem;
        font-variant-numeric: tabular-nums;
      }

      .chat-hero-status small {
        grid-column: 2;
        color: var(--chat-muted);
        font-size: 0.72rem;
        font-weight: 760;
      }

      .chat-layout {
        display: grid;
        grid-template-columns: minmax(13rem, 0.68fr) minmax(0, 1.5fr) minmax(14rem, 0.78fr);
        gap: 1rem;
        align-items: stretch;
      }

      .chat-room-panel,
      .chat-panel,
      .chat-safety-panel {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--chat-border);
        border-radius: 1.25rem;
        background:
          radial-gradient(circle at 15% 0%, rgb(34 197 94 / 0.11), transparent 38%),
          linear-gradient(150deg, rgb(15 23 42 / 0.86), rgb(2 6 23 / 0.94));
        box-shadow:
          inset 0 1px 0 rgb(255 255 255 / 0.08),
          0 1.5rem 4rem rgb(0 0 0 / 0.28);
      }

      .chat-room-panel,
      .chat-safety-panel {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
        padding: 1rem;
      }

      .room-orbit {
        position: relative;
        display: grid;
        width: 7.4rem;
        aspect-ratio: 1;
        place-items: center;
        margin-inline: auto;
      }

      .room-orbit span,
      .pulse-rings span {
        position: absolute;
        inset: 0;
        border: 1px solid rgb(34 197 94 / 0.28);
        border-radius: 999px;
        animation: chat-pulse-ring 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
      }

      .room-orbit span:nth-child(2),
      .pulse-rings span:nth-child(2) {
        animation-delay: 900ms;
      }

      .room-orbit svg {
        width: 3.25rem;
        height: 3.25rem;
        color: var(--chat-green-bright);
        filter: drop-shadow(0 0 1.1rem rgb(34 197 94 / 0.45));
      }

      .chat-room-panel p {
        margin: 0 0 0.25rem;
        color: var(--chat-green-bright);
        font-weight: 850;
      }

      .chat-room-panel h2,
      .chat-safety-panel h2,
      .chat-panel-head h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 860;
        letter-spacing: -0.01em;
      }

      .room-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
        margin-top: auto;
      }

      .room-stat-grid span {
        display: grid;
        gap: 0.1rem;
        border: 1px solid rgb(255 255 255 / 0.09);
        border-radius: 0.9rem;
        padding: 0.7rem;
        background: rgb(255 255 255 / 0.045);
      }

      .room-stat-grid strong {
        color: white;
        font-size: 1.1rem;
        font-variant-numeric: tabular-nums;
      }

      .room-stat-grid small {
        font-size: 0.7rem;
      }

      .chat-panel {
        display: grid;
        min-height: min(68vh, 43rem);
        grid-template-rows: auto minmax(17rem, 1fr) auto;
      }

      .chat-panel::before {
        content: '';
        position: absolute;
        inset: -35% 8% auto;
        height: 18rem;
        border-radius: 999px;
        background: radial-gradient(circle, rgb(34 197 94 / 0.2), transparent 70%);
        filter: blur(1.5rem);
        pointer-events: none;
      }

      .chat-panel-head {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.09);
        padding: 0.95rem 1rem;
      }

      .chat-panel-head > div {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.72rem;
      }

      .chat-panel-icon {
        display: grid;
        width: 2.55rem;
        height: 2.55rem;
        flex: 0 0 auto;
        place-items: center;
        border: 1px solid rgb(34 197 94 / 0.35);
        border-radius: 0.85rem;
        background: rgb(34 197 94 / 0.12);
        color: var(--chat-green-bright);
      }

      .chat-panel-icon svg {
        width: 1.25rem;
        height: 1.25rem;
      }

      .chat-live-pill {
        flex: 0 0 auto;
        border: 1px solid rgb(34 197 94 / 0.25);
        border-radius: 999px;
        padding: 0.38rem 0.58rem;
        background: rgb(34 197 94 / 0.09);
        color: var(--chat-green-bright);
      }

      .chat-stream {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 0.82rem;
        overflow-y: auto;
        padding: 1rem;
        scrollbar-color: rgb(34 197 94 / 0.45) transparent;
      }

      .chat-message {
        display: flex;
        align-items: end;
        gap: 0.6rem;
        max-width: min(88%, 36rem);
        animation: chat-message-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        animation-delay: min(calc(var(--message-index, 0) * 25ms), 180ms);
      }

      .chat-message-own {
        align-self: end;
        flex-direction: row-reverse;
      }

      .chat-message-content {
        display: grid;
        min-width: 0;
        gap: 0.28rem;
      }

      .chat-message-own .chat-message-content {
        justify-items: end;
      }

      .chat-avatar {
        display: grid;
        width: 2.25rem;
        height: 2.25rem;
        flex: 0 0 auto;
        place-items: center;
        border: 1px solid rgb(255 255 255 / 0.16);
        border-radius: 999px;
        background:
          radial-gradient(circle at 30% 20%, rgb(255 255 255 / 0.24), transparent 44%),
          rgb(15 23 42);
        color: white;
        font-size: 0.76rem;
        font-weight: 850;
      }

      .chat-message-own .chat-avatar {
        border-color: rgb(34 197 94 / 0.45);
        background:
          radial-gradient(circle at 30% 20%, rgb(255 255 255 / 0.2), transparent 44%),
          linear-gradient(145deg, rgb(21 128 61), rgb(6 95 70));
      }

      .chat-bubble {
        min-width: 0;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 1rem 1rem 1rem 0.28rem;
        padding: 0.72rem 0.78rem;
        background: rgb(255 255 255 / 0.07);
      }

      .chat-message-own .chat-bubble {
        border-color: rgb(34 197 94 / 0.34);
        border-radius: 1rem 1rem 0.28rem;
        background:
          linear-gradient(145deg, rgb(34 197 94 / 0.22), rgb(20 184 166 / 0.12)),
          rgb(255 255 255 / 0.05);
        box-shadow: 0 0 1.8rem rgb(34 197 94 / 0.11);
      }

      .chat-message-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.32rem 0.5rem;
        margin-bottom: 0.25rem;
        color: var(--chat-muted);
        font-size: 0.72rem;
      }

      .chat-message-meta strong {
        color: white;
        font-size: 0.78rem;
      }

      .chat-message-meta span {
        color: var(--chat-green-bright);
      }

      .chat-message-meta time {
        margin-left: auto;
        color: rgb(203 213 225 / 0.78);
        font-variant-numeric: tabular-nums;
      }

      .chat-bubble p {
        margin: 0;
        color: rgb(248 250 252 / 0.94);
        line-height: 1.42;
        overflow-wrap: anywhere;
      }

      .chat-loading,
      .chat-empty {
        display: grid;
        min-height: 16rem;
        place-items: center;
        align-content: center;
        gap: 0.7rem;
        color: var(--chat-muted);
        text-align: center;
      }

      .chat-empty svg {
        width: 3rem;
        height: 3rem;
        color: var(--chat-green-bright);
        filter: drop-shadow(0 0 1rem rgb(34 197 94 / 0.38));
      }

      .chat-empty h3,
      .chat-loading p {
        margin: 0;
        color: white;
        font-weight: 820;
      }

      .chat-empty p {
        margin: 0;
      }

      .chat-composer {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 0.62rem;
        border-top: 1px solid rgb(255 255 255 / 0.09);
        padding: 0.9rem 1rem 1rem;
        background: linear-gradient(180deg, rgb(2 6 23 / 0.74), rgb(2 6 23 / 0.96));
      }

      .chat-composer textarea {
        width: 100%;
        min-height: 4.2rem;
        resize: vertical;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 1rem;
        outline: none;
        padding: 0.82rem 0.92rem;
        background: rgb(2 6 23 / 0.82);
        color: white;
        font-size: 1rem;
        line-height: 1.35;
      }

      .chat-composer textarea::placeholder {
        color: rgb(203 213 225 / 0.72);
      }

      .chat-composer textarea:focus {
        border-color: rgb(34 197 94 / 0.58);
        box-shadow:
          0 0 0 3px rgb(34 197 94 / 0.12),
          0 0 1.4rem rgb(34 197 94 / 0.12);
      }

      .composer-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .composer-footer > span {
        min-width: 0;
        color: var(--chat-muted);
        font-size: 0.78rem;
      }

      .chat-error-text {
        color: #fca5a5 !important;
      }

      .composer-footer button {
        display: inline-flex;
        min-height: 2.75rem;
        align-items: center;
        justify-content: center;
        gap: 0.48rem;
        border: 1px solid rgb(34 197 94 / 0.45);
        border-radius: 0.9rem;
        padding: 0 1.05rem;
        background: linear-gradient(135deg, #16a34a, #22c55e);
        color: white;
        font-weight: 850;
        box-shadow: 0 0.85rem 1.8rem rgb(34 197 94 / 0.22);
      }

      .composer-footer button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 1rem 2.2rem rgb(34 197 94 / 0.3);
      }

      .composer-footer button:active:not(:disabled) {
        transform: scale(0.985);
      }

      .composer-footer button:disabled {
        opacity: 0.48;
      }

      .composer-footer svg {
        width: 1.15rem;
        height: 1.15rem;
      }

      .chat-send-loading {
        animation: chat-spin 780ms linear infinite;
      }

      .pulse-card {
        position: relative;
        display: grid;
        min-height: 15rem;
        place-items: center;
        align-content: center;
        gap: 0.65rem;
        overflow: hidden;
        border: 1px solid rgb(34 197 94 / 0.25);
        border-radius: 1.1rem;
        padding: 1rem;
        background:
          radial-gradient(circle at 50% 40%, rgb(34 197 94 / 0.18), transparent 52%),
          rgb(255 255 255 / 0.035);
        text-align: center;
      }

      .pulse-rings {
        position: absolute;
        inset: 2.4rem;
      }

      .pulse-card > svg {
        position: relative;
        z-index: 1;
        width: 3.8rem;
        height: 3.8rem;
        color: white;
        filter: drop-shadow(0 0 1.1rem rgb(34 197 94 / 0.4));
      }

      .pulse-card h2,
      .pulse-card p {
        position: relative;
        z-index: 1;
      }

      .chat-rule-row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        border: 1px solid rgb(255 255 255 / 0.09);
        border-radius: 0.9rem;
        padding: 0.75rem;
        background: rgb(255 255 255 / 0.045);
        color: rgb(226 232 240 / 0.92);
        font-size: 0.88rem;
      }

      .chat-rule-row svg {
        width: 1.25rem;
        height: 1.25rem;
        flex: 0 0 auto;
        color: var(--chat-green-bright);
      }

      .global-chat-compact {
        min-height: calc(100dvh - 11rem);
      }

      .global-chat-compact .chat-layout {
        display: block;
      }

      .global-chat-compact .chat-panel {
        min-height: calc(100dvh - 10rem);
        border-radius: 1rem;
      }

      @keyframes chat-pulse-ring {
        0% {
          opacity: 0.78;
          transform: scale(0.72);
        }

        100% {
          opacity: 0;
          transform: scale(1.2);
        }
      }

      @keyframes chat-message-in {
        from {
          opacity: 0;
          transform: translateY(0.35rem) scale(0.98);
          filter: blur(3px);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
      }

      @keyframes chat-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 980px) {
        .chat-layout {
          grid-template-columns: minmax(0, 1fr);
        }

        .chat-room-panel,
        .chat-safety-panel {
          display: none;
        }
      }

      @media (max-width: 639px) {
        .global-chat {
          gap: 0;
        }

        .chat-hero {
          display: none;
        }

        .chat-panel {
          min-height: calc(100dvh - 10.5rem);
          border-radius: 1rem;
        }

        .global-chat-compact .chat-panel {
          min-height: calc(100dvh - 9.4rem);
          grid-template-rows: minmax(0, 1fr) auto;
          overflow: visible;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .global-chat-compact .chat-panel::before,
        .global-chat-compact .chat-panel-head {
          display: none;
        }

        .chat-panel-head {
          padding: 0.78rem;
        }

        .chat-panel-head h2 {
          font-size: 1rem;
        }

        .chat-panel-head p {
          font-size: 0.78rem;
        }

        .chat-panel-icon {
          width: 2.25rem;
          height: 2.25rem;
        }

        .chat-stream {
          gap: 0.68rem;
          padding: 0.78rem;
        }

        .global-chat-compact .chat-stream {
          min-height: 0;
          padding: 0.1rem 0.75rem 0.75rem;
        }

        .chat-message {
          max-width: 94%;
          gap: 0.48rem;
        }

        .global-chat-compact .chat-message {
          align-items: start;
          width: 100%;
          max-width: none;
          gap: 0.64rem;
        }

        .global-chat-compact .chat-message-own {
          align-self: stretch;
          flex-direction: row;
        }

        .global-chat-compact .chat-message-content {
          width: min(100%, 16rem);
          gap: 0.32rem;
          justify-items: stretch;
        }

        .global-chat-compact .chat-message-own .chat-message-content {
          justify-items: stretch;
        }

        .chat-avatar {
          width: 2rem;
          height: 2rem;
          font-size: 0.7rem;
        }

        .global-chat-compact .chat-avatar,
        .global-chat-compact .chat-message-own .chat-avatar {
          width: 2.75rem;
          height: 2.75rem;
          border: 1.5px solid rgb(168 85 247 / 0.88);
          background: rgb(12 7 18 / 0.54);
          color: rgb(217 70 239);
          font-size: 0.98rem;
          font-weight: 680;
        }

        .chat-bubble {
          padding: 0.64rem 0.68rem;
        }

        .global-chat-compact .chat-bubble,
        .global-chat-compact .chat-message-own .chat-bubble {
          width: 100%;
          border: 1px solid rgb(148 163 184 / 0.18);
          border-radius: 0.95rem;
          background:
            linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025)),
            rgb(17 24 39 / 0.72);
          padding: 0.72rem 0.88rem;
        }

        .global-chat-compact .chat-bubble p {
          color: rgb(241 245 249);
          font-size: 1rem;
          line-height: 1.52;
          font-weight: 520;
        }

        .global-chat-compact .chat-message-meta {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.5rem;
          margin: 0 0 0 0.1rem;
          color: rgb(203 213 225 / 0.78);
          font-size: 0.8rem;
        }

        .global-chat-compact .chat-message-meta strong {
          color: rgb(192 82 242);
          font-size: 0.88rem;
          font-weight: 720;
          letter-spacing: -0.01em;
        }

        .global-chat-compact .chat-message-meta span {
          display: none;
        }

        .global-chat-compact .chat-message-meta time {
          margin-left: 0;
          color: rgb(203 213 225 / 0.72);
          font-size: 0.8rem;
          font-weight: 540;
        }

        .chat-composer {
          position: sticky;
          bottom: calc(4.35rem + env(safe-area-inset-bottom));
          margin-inline: -0.12rem;
          padding: 0.72rem;
          border: 1px solid rgb(255 255 255 / 0.1);
          border-radius: 1rem;
          background: rgb(2 6 23 / 0.96);
          box-shadow: 0 -1rem 2.6rem rgb(0 0 0 / 0.28);
        }

        .global-chat-compact .chat-composer {
          margin-inline: 0;
          padding: 0.5rem;
          gap: 0.42rem;
          border-radius: 0.9rem;
        }

        .chat-composer textarea {
          min-height: 3.75rem;
          font-size: 1rem;
        }

        .global-chat-compact .chat-composer textarea {
          min-height: 2.85rem;
          padding: 0.66rem 0.75rem;
        }

        .global-chat-compact .composer-footer button {
          min-height: 2.28rem;
        }

        .composer-footer button {
          min-width: 5.6rem;
          min-height: 2.55rem;
          padding-inline: 0.82rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .chat-message,
        .room-orbit span,
        .pulse-rings span,
        .chat-send-loading {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    `
  ]
})
export class GlobalChatPage {
  readonly compact = input(false);
  protected readonly chat = inject(GlobalChatService);
  private readonly authState = inject(AuthStateService);
  protected readonly draft = signal('');
  protected draftText = '';
  protected readonly validationMessage = computed(() => {
    if (!this.draft()) {
      return null;
    }

    return validateChatMessageText(this.draft()).message;
  });
  protected readonly subtitle = computed(() => {
    const profileName = this.authState.profile()?.displayName?.trim() || 'Member';
    return `Signed in as ${profileName}`;
  });
  protected readonly onlineLabel = computed(() => {
    const role = this.authState.profile()?.role;
    return role === 'HOST' ? 'Host' : role === 'MANAGER' ? 'Manager' : 'Member';
  });

  @ViewChild('messageStream') private readonly messageStream?: ElementRef<HTMLElement>;

  protected draftChanged(value: string): void {
    this.draft.set(value);
  }

  protected canSend(): boolean {
    return validateChatMessageText(this.draftText).valid;
  }

  protected characterCountLabel(): string {
    return `${this.draftText.length}/500`;
  }

  protected initials(name: string): string {
    return globalChatInitials(name);
  }

  protected isOwn(message: GlobalChatMessage): boolean {
    return isOwnGlobalChatMessage(message, this.authState.user()?.id ?? null);
  }

  protected timeLabel(createdAt: string): string {
    return relativeChatTimeLabel(createdAt);
  }

  protected async sendMessage(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (this.chat.sending() || !this.canSend()) {
      return;
    }

    const sent = await this.chat.sendMessage(this.draftText);

    if (sent) {
      this.draftText = '';
      this.draft.set('');
      this.scrollToLatest();
    }
  }

  private scrollToLatest(): void {
    setTimeout(() => {
      const stream = this.messageStream?.nativeElement;

      if (stream) {
        stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
      }
    });
  }
}
