import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideLoaderCircle,
  LucideMessageCircle,
  LucideRadio,
  LucideSendHorizontal,
  LucideShieldCheck,
  LucideUsersRound
} from '@lucide/angular';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { PokerStoreService } from '../host/data/poker-store.service';
import { GlobalChatService } from './global-chat.service';
import {
  globalChatClockTimeLabel,
  globalChatDateSeparatorLabel,
  isGlobalChatSenderRunStart,
  isOwnGlobalChatMessage,
  validateChatMessageText,
  type GlobalChatMessage
} from './global-chat.logic';

const chatSenderPalette = [
  { accent: 'rgb(192 82 242)', surface: 'rgb(192 82 242 / 0.12)' },
  { accent: 'rgb(34 197 94)', surface: 'rgb(34 197 94 / 0.12)' },
  { accent: 'rgb(56 189 248)', surface: 'rgb(56 189 248 / 0.12)' },
  { accent: 'rgb(250 204 21)', surface: 'rgb(250 204 21 / 0.12)' },
  { accent: 'rgb(251 113 133)', surface: 'rgb(251 113 133 / 0.12)' },
  { accent: 'rgb(45 212 191)', surface: 'rgb(45 212 191 / 0.12)' },
  { accent: 'rgb(251 146 60)', surface: 'rgb(251 146 60 / 0.12)' },
  { accent: 'rgb(129 140 248)', surface: 'rgb(129 140 248 / 0.12)' }
];

function chatSenderPaletteIndex(message: GlobalChatMessage): number {
  const seed = `${message.senderUserId || message.senderDisplayName}:${message.senderDisplayName}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % chatSenderPalette.length;
}

interface GlobalChatDayGroup {
  key: string;
  label: string | null;
  createdAt: string;
  entries: Array<{ message: GlobalChatMessage; index: number }>;
}

function groupGlobalChatMessagesByDay(messages: GlobalChatMessage[]): GlobalChatDayGroup[] {
  const groups: GlobalChatDayGroup[] = [];

  messages.forEach((message, index) => {
    const label = globalChatDateSeparatorLabel(messages, index);

    if (label !== null || groups.length === 0) {
      groups.push({
        key: message.id,
        label,
        createdAt: message.createdAt,
        entries: []
      });
    }

    groups[groups.length - 1].entries.push({ message, index });
  });

  return groups;
}

@Component({
  selector: 'app-global-chat-page',
  host: {
    '[class.global-chat-route]': '!compact()'
  },
  imports: [
    FormsModule,
    LucideLoaderCircle,
    LucideMessageCircle,
    LucideRadio,
    LucideSendHorizontal,
    LucideShieldCheck,
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

        <main
          class="chat-panel"
          [class.chat-panel-no-game]="!activeGame()"
          aria-label="Global group chat"
        >
          @if (!compact()) {
            <div class="chat-table-decor" aria-hidden="true">
              <span class="chat-table-suit chat-table-spade">&spades;</span>
              <span class="chat-table-suit chat-table-heart">&hearts;</span>
              <span class="chat-table-suit chat-table-diamond">&diams;</span>
              <span class="chat-table-suit chat-table-club">&clubs;</span>
              <span class="chat-table-chip chat-table-chip-one"><span></span></span>
              <span class="chat-table-chip chat-table-chip-two"><span></span></span>
            </div>
          }

          @if (activeGame(); as game) {
            <header class="chat-game-banner">
              <span class="chat-live-pulse" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <div class="chat-game-copy">
                <span class="chat-game-live">
                  <span class="chat-game-live-dot" aria-hidden="true"></span>
                  Live game
                </span>
                <h2>{{ game.name }}</h2>
              </div>
              <div
                class="chat-active-count"
                [attr.aria-label]="game.activePlayers + ' of ' + game.totalPlayers + ' players active'"
              >
                <strong>{{ game.activePlayers }}/{{ game.totalPlayers }}</strong>
                <span class="chat-active-count-label">Active</span>
              </div>
            </header>
          }

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
              @for (dayGroup of messageDayGroups(); track dayGroup.key) {
                <section class="chat-day-group">
                  @if (dayGroup.label; as dateLabel) {
                    <div class="chat-date-separator">
                      <time [attr.datetime]="dayGroup.createdAt">{{ dateLabel }}</time>
                    </div>
                  }
                  @for (entry of dayGroup.entries; track entry.message.id) {
                    <article
                      class="chat-message"
                      [class.chat-message-own]="isOwn(entry.message)"
                      [class.chat-message-group-start]="isSenderRunStart(chat.messages(), entry.index)"
                      [style.--message-index]="entry.index"
                      [style.--sender-accent]="senderAccent(entry.message)"
                      [style.--sender-surface]="senderSurface(entry.message)"
                    >
                      <div class="chat-message-content">
                        <div class="chat-bubble">
                          @if (isSenderRunStart(chat.messages(), entry.index)) {
                            <strong class="chat-sender-name">
                              {{ entry.message.senderDisplayName }}
                            </strong>
                          }
                          <p>{{ entry.message.message }}</p>
                          <time class="chat-message-time" [attr.datetime]="entry.message.createdAt">
                            {{ timeLabel(entry.message.createdAt) }}
                          </time>
                        </div>
                      </div>
                    </article>
                  }
                </section>
              }
            }
          </div>

          <form class="chat-composer" (submit)="sendMessage($event)">
            <label class="sr-only" for="global-chat-message">Message</label>
            <div class="chat-composer-field">
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
              <button
                type="submit"
                aria-label="Send message"
                title="Send message"
                [disabled]="chat.sending() || !canSend()"
              >
                @if (chat.sending()) {
                  <svg lucideLoaderCircle class="chat-send-loading" [strokeWidth]="2.4" aria-hidden="true"></svg>
                } @else {
                  <svg lucideSendHorizontal [strokeWidth]="2.4" aria-hidden="true"></svg>
                }
              </button>
            </div>
            @if (chat.error() || validationMessage()) {
              <p class="chat-error-text" role="alert">
                {{ chat.error() || validationMessage() }}
              </p>
            }
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
        font-family:
          'Saira', Aptos, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          'Segoe UI', sans-serif;
        font-kerning: normal;
        font-optical-sizing: auto;
        letter-spacing: 0;
      }

      .chat-hero {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.2rem 0.1rem;
      }

      .chat-kicker {
        display: inline-flex;
        align-items: center;
        gap: 0.42rem;
        color: var(--chat-green-bright);
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0;
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
        letter-spacing: 0;
        text-shadow: 0 0 1.5rem rgb(34 197 94 / 0.2);
      }

      .chat-hero p,
      .chat-room-panel small,
      .chat-safety-panel p {
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

      .chat-hero-status span {
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
      .chat-safety-panel h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 860;
        letter-spacing: 0;
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

      .chat-panel-no-game {
        grid-template-rows: minmax(17rem, 1fr) auto;
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

      .chat-stream {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        overflow-y: auto;
        padding: 1rem;
        scrollbar-color: rgb(34 197 94 / 0.45) transparent;
      }

      .chat-day-group {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 0.2rem;
      }

      .chat-message {
        --sender-accent: rgb(168 85 247);
        --sender-surface: rgb(168 85 247 / 0.12);
        display: flex;
        width: fit-content;
        max-width: min(88%, 36rem);
        animation: chat-message-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        animation-delay: min(calc(var(--message-index, 0) * 25ms), 180ms);
      }

      .chat-message-own {
        align-self: end;
      }

      .chat-message-group-start {
        margin-top: 0.62rem;
      }

      .chat-message-content {
        display: grid;
        min-width: 0;
        max-width: 100%;
      }

      .chat-message-own .chat-message-content {
        justify-items: end;
      }

      .chat-date-separator {
        position: sticky;
        top: 0.35rem;
        z-index: 3;
        align-self: center;
        margin: 0.5rem 0 0.32rem;
        pointer-events: none;
      }

      .chat-date-separator time {
        display: block;
        border: 1px solid rgb(148 163 184 / 0.16);
        border-radius: 999px;
        padding: 0.28rem 0.58rem;
        background: rgb(8 18 29 / 0.92);
        box-shadow: 0 0.32rem 1rem rgb(0 0 0 / 0.2);
        color: rgb(203 213 225 / 0.78);
        font-size: 0.68rem;
        font-weight: 650;
        line-height: 1;
        backdrop-filter: blur(0.7rem);
      }

      .chat-date-separator + .chat-message {
        margin-top: 0;
      }

      .chat-bubble {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 0.2rem 0.72rem;
        min-width: 0;
        border: 1px solid var(--sender-surface);
        border-radius: 0.42rem 1rem 1rem;
        margin-bottom: 8px;
        padding: 0.32rem 0.68rem;
        background: linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.02)), var(--sender-surface);
      }

      .chat-message:not(.chat-message-group-start) .chat-bubble {
        border-radius: 0.58rem 1rem 1rem 0.58rem;
      }

      .chat-message-own .chat-bubble {
        border-color: rgb(34 197 94 / 0.28);
        border-radius: 1rem 0.42rem 1rem 1rem;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 0.045), transparent),
          rgb(20 83 45 / 0.66);
      }

      .chat-message-own:not(.chat-message-group-start) .chat-bubble {
        border-radius: 1rem 0.58rem 0.58rem 1rem;
      }

      .chat-sender-name {
        grid-column: 1 / -1;
        color: var(--sender-accent);
        font-size: 0.78rem;
        font-weight: 750;
        line-height: 1.2;
      }

      .chat-message-own .chat-sender-name {
        color: rgb(134 239 172);
      }

      .chat-message-time {
        grid-column: 2;
        align-self: end;
        color: rgb(203 213 225 / 0.78);
        font-size: 0.64rem;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
      }

      .chat-bubble p {
        grid-column: 1;
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

      .chat-composer-field {
        position: relative;
      }

      .chat-composer textarea {
        width: 100%;
        min-height: 4.2rem;
        resize: none;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 1rem;
        outline: none;
        padding: 0.82rem 3.8rem 0.82rem 0.92rem;
        background: rgb(2 6 23 / 0.82);
        color: white;
        font-family: inherit;
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

      .chat-error-text {
        margin: 0;
        padding-inline: 0.2rem;
        color: #fca5a5;
        font-size: 0.78rem;
      }

      .chat-composer-field button {
        position: absolute;
        top: 50%;
        right: 0.62rem;
        display: grid;
        width: 2.75rem;
        height: 2.75rem;
        place-items: center;
        border: 1px solid rgb(34 197 94 / 0.45);
        border-radius: 50%;
        padding: 0;
        background: linear-gradient(135deg, #16a34a, #22c55e);
        color: white;
        box-shadow: 0 0.85rem 1.8rem rgb(34 197 94 / 0.22);
        transform: translateY(-50%);
      }

      .chat-composer-field button:hover:not(:disabled) {
        transform: translateY(-50%) scale(1.04);
        box-shadow: 0 1rem 2.2rem rgb(34 197 94 / 0.3);
      }

      .chat-composer-field button:active:not(:disabled) {
        transform: translateY(-50%) scale(0.96);
      }

      .chat-composer-field button:disabled {
        opacity: 0.48;
      }

      .chat-composer-field svg {
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
          grid-template-rows: auto minmax(0, 1fr) auto;
          overflow: visible;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .global-chat-compact .chat-panel::before {
          display: none;
        }

        .chat-game-banner {
          min-height: 4.35rem;
          padding: 0.7rem 0.85rem;
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
          justify-content: flex-start;
        }

        .global-chat-compact .chat-message-own {
          align-self: stretch;
          flex-direction: row-reverse;
          justify-content: flex-start;
        }

        .global-chat-compact .chat-message-content {
          width: min(100%, 16rem);
          gap: 0.32rem;
          justify-items: stretch;
        }

        .global-chat-compact .chat-message-own .chat-message-content {
          justify-items: stretch;
        }

        .global-chat-compact .chat-bubble,
        .global-chat-compact .chat-message-own .chat-bubble {
          width: 100%;
          border: 1px solid var(--sender-surface);
          border-radius: 0.95rem;
          background:
            linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.025)),
            var(--sender-surface),
            rgb(17 24 39 / 0.72);
          padding: 0.32rem 0.68rem;
        }

        .global-chat-compact .chat-bubble p {
          color: rgb(241 245 249);
          font-size: 1rem;
          line-height: 1.52;
          font-weight: 520;
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
          min-height: 3.6rem;
          padding: 0.66rem 3.55rem 0.66rem 0.75rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .chat-message,
        .room-orbit span,
        .pulse-rings span,
        .chat-live-pulse,
        .chat-live-pulse > span,
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
  private readonly store = inject(PokerStoreService);
  private hasScrolledToInitialMessages = false;
  protected readonly draft = signal('');
  protected draftText = '';
  protected readonly validationMessage = computed(() => {
    if (!this.draft()) {
      return null;
    }

    return validateChatMessageText(this.draft()).message;
  });
  protected readonly activeGame = computed(() => {
    const session = this.store.activeSessions()[0];

    if (!session) {
      return null;
    }

    const publicRoster = this.store
      .playerPublicTableRoster()
      .filter((player) => player.sessionId === session.id);
    const players = publicRoster.length > 0 ? publicRoster : session.players;

    return {
      name: session.name,
      activePlayers: players.filter((player) => player.status === 'ACTIVE').length,
      totalPlayers: players.length
    };
  });
  protected readonly onlineLabel = computed(() => {
    const role = this.authState.profile()?.role;
    return role === 'HOST' ? 'Host' : role === 'MANAGER' ? 'Manager' : 'Member';
  });
  protected readonly messageDayGroups = computed(() =>
    groupGlobalChatMessagesByDay(this.chat.messages())
  );

  @ViewChild('messageStream') private readonly messageStream?: ElementRef<HTMLElement>;
  private readonly initialMessageScroll = afterRenderEffect(() => {
    if (this.hasScrolledToInitialMessages || this.chat.messages().length === 0) {
      return;
    }

    const stream = this.messageStream?.nativeElement;

    if (!stream) {
      return;
    }

    stream.scrollTo({ top: stream.scrollHeight, behavior: 'auto' });
    this.hasScrolledToInitialMessages = true;
  });

  protected draftChanged(value: string): void {
    this.draft.set(value);
  }

  protected canSend(): boolean {
    return validateChatMessageText(this.draftText).valid;
  }

  protected isOwn(message: GlobalChatMessage): boolean {
    return isOwnGlobalChatMessage(message, this.authState.user()?.id ?? null);
  }

  protected senderAccent(message: GlobalChatMessage): string {
    return chatSenderPalette[chatSenderPaletteIndex(message)].accent;
  }

  protected senderSurface(message: GlobalChatMessage): string {
    return chatSenderPalette[chatSenderPaletteIndex(message)].surface;
  }

  protected timeLabel(createdAt: string): string {
    return globalChatClockTimeLabel(createdAt);
  }

  protected isSenderRunStart(messages: GlobalChatMessage[], index: number): boolean {
    return isGlobalChatSenderRunStart(messages, index);
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
