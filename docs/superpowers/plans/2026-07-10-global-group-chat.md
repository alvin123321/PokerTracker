# Global Group Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a realtime global group chat where every signed-in PokerTracker member can read and send messages.

**Architecture:** Add a focused chat domain separate from `PokerStoreService`: chat types and pure logic live in `src/app/features/chat/global-chat.logic.ts`, realtime/local persistence lives in `src/app/features/chat/global-chat.service.ts`, and the UI lives in `src/app/features/chat/global-chat.page.ts`. Supabase stores production messages in `public.global_chat_messages`; development mode uses localStorage so local preview does not mutate production.

**Tech Stack:** Angular standalone components, Angular signals, Supabase Data API, Supabase Realtime, Postgres RLS, Lucide Angular icons, Jasmine/Karma tests.

**Mock UI Preview:** `C:/Users/Alvin/.codex/generated_images/019f062e-c6a0-7182-98fd-d02ec22d50aa/ig_0b9a18f1f777ede4016a516ba2dc708196b80fbd6146cbc9e5.png`

## Global Constraints

- Global chat is app-wide, not tied to a session or table.
- Every authenticated PokerTracker user can read global chat messages.
- Every authenticated PokerTracker user can send messages as themselves.
- Users cannot choose another sender name or sender role.
- V1 supports text messages only. No images, reactions, editing, replies, pinning, or private messages.
- Message text is trimmed, single-spaced, and limited to 500 characters.
- Empty messages cannot be sent.
- Local development chat uses localStorage only; production data must not be changed by local/dev preview.
- The UI must match PokerTracker's dark, emerald, compact product style.
- Mobile must keep the composer fixed above the bottom navigation/safe area.
- Use the existing deck loading animation style for loading states.
- Run `npm.cmd run build` and `npm.cmd run test:ci` before claiming completion.

---

## File Structure

- Create: `supabase/migrations/20260710161000_global_group_chat.sql`
  - Creates `public.global_chat_messages`, RLS policies, indexes, grants, and Realtime publication membership.
- Create: `src/app/features/chat/global-chat.logic.ts`
  - Pure chat formatting, validation, sorting, grouping, initials, role labels, and message ownership helpers.
- Create: `src/app/features/chat/global-chat.logic.spec.ts`
  - Unit tests for the pure chat logic.
- Create: `src/app/features/chat/global-chat.service.ts`
  - Loads messages, sends messages, subscribes to realtime changes, and handles localStorage fallback.
- Create: `src/app/features/chat/global-chat.page.ts`
  - Shared UI page/component for host and player chat surfaces.
- Modify: `src/app/app.routes.ts`
  - Add `/host/chat` route. Player uses the dashboard tab in V1 to preserve the existing player mobile nav pattern.
- Modify: `src/app/core/layout/host-shell.component.ts`
  - Add Chat to desktop host nav and mobile host bottom nav.
- Modify: `src/app/features/player/dashboard/player-dashboard.page.ts`
  - Add `chat` tab and render `<app-global-chat-page [compact]="true" />`.
- Modify: `src/styles.css`
  - Add only shared shell/nav styles if needed. Prefer component-local styles in `global-chat.page.ts`.

---

### Task 1: Add Chat Schema And Realtime Access

**Files:**
- Create: `supabase/migrations/20260710161000_global_group_chat.sql`

**Interfaces:**
- Produces table: `public.global_chat_messages`
- Produces realtime table membership: `public.global_chat_messages` in `supabase_realtime`
- Consumed by `GlobalChatService` through `.from('global_chat_messages')`

- [ ] **Step 1: Add migration SQL**

Create `supabase/migrations/20260710161000_global_group_chat.sql`:

```sql
create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.users(id) on delete cascade,
  sender_display_name text not null,
  sender_role text not null check (sender_role in ('HOST', 'MANAGER', 'PLAYER')),
  message text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint global_chat_messages_message_not_blank check (length(btrim(message)) > 0),
  constraint global_chat_messages_message_length check (char_length(message) <= 500)
);

create index if not exists global_chat_messages_created_at_idx
on public.global_chat_messages(created_at desc);

create index if not exists global_chat_messages_sender_user_id_idx
on public.global_chat_messages(sender_user_id);

alter table public.global_chat_messages enable row level security;

drop policy if exists "Authenticated users can read global chat" on public.global_chat_messages;
create policy "Authenticated users can read global chat"
on public.global_chat_messages
for select
to authenticated
using (deleted_at is null);

drop policy if exists "Authenticated users can send their own global chat messages" on public.global_chat_messages;
create policy "Authenticated users can send their own global chat messages"
on public.global_chat_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and deleted_at is null
  and sender_display_name = (
    select coalesce(nullif(btrim(display_name), ''), 'Member')
    from public.users
    where id = (select auth.uid())
  )
  and sender_role = (
    select role::text
    from public.users
    where id = (select auth.uid())
  )
);

grant select, insert on public.global_chat_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'global_chat_messages'
    ) then
      alter publication supabase_realtime add table public.global_chat_messages;
    end if;
  end if;
end $$;
```

- [ ] **Step 2: Review policy assumptions**

Confirm the `public.users.role` values are text-compatible with `HOST`, `MANAGER`, and `PLAYER`. If `role` is an enum, the `role::text` comparison in the policy remains valid.

- [ ] **Step 3: Commit schema**

```bash
git add supabase/migrations/20260710161000_global_group_chat.sql
git commit -m "feat: add global chat schema"
```

---

### Task 2: Add Pure Chat Logic

**Files:**
- Create: `src/app/features/chat/global-chat.logic.ts`
- Create: `src/app/features/chat/global-chat.logic.spec.ts`

**Interfaces:**
- Produces:
  - `GlobalChatRole = 'HOST' | 'MANAGER' | 'PLAYER'`
  - `GlobalChatMessage`
  - `GlobalChatValidationResult`
  - `normalizeChatMessageText(text: string): string`
  - `validateChatMessageText(text: string): GlobalChatValidationResult`
  - `sortGlobalChatMessages(messages: GlobalChatMessage[]): GlobalChatMessage[]`
  - `isOwnGlobalChatMessage(message: GlobalChatMessage, currentUserId: string | null): boolean`
  - `globalChatInitials(name: string): string`
  - `globalChatRoleLabel(role: GlobalChatRole): string`

- [ ] **Step 1: Write failing logic tests**

Create `src/app/features/chat/global-chat.logic.spec.ts`:

```ts
import {
  globalChatInitials,
  globalChatRoleLabel,
  isOwnGlobalChatMessage,
  normalizeChatMessageText,
  sortGlobalChatMessages,
  validateChatMessageText,
  type GlobalChatMessage
} from './global-chat.logic';

describe('global chat logic', () => {
  it('normalizes message text', () => {
    expect(normalizeChatMessageText('  hello    table  ')).toBe('hello table');
  });

  it('rejects empty messages', () => {
    expect(validateChatMessageText('   ')).toEqual({
      valid: false,
      message: 'Type a message first.'
    });
  });

  it('rejects messages longer than 500 characters', () => {
    expect(validateChatMessageText('a'.repeat(501))).toEqual({
      valid: false,
      message: 'Keep messages under 500 characters.'
    });
  });

  it('accepts valid messages', () => {
    expect(validateChatMessageText('Good hand')).toEqual({
      valid: true,
      message: null
    });
  });

  it('sorts messages oldest first', () => {
    const messages: GlobalChatMessage[] = [
      message('2', '2026-07-10T12:02:00.000Z'),
      message('1', '2026-07-10T12:01:00.000Z')
    ];

    expect(sortGlobalChatMessages(messages).map((item) => item.id)).toEqual(['1', '2']);
  });

  it('detects current user messages', () => {
    expect(isOwnGlobalChatMessage(message('1', '2026-07-10T12:01:00.000Z'), 'user-1')).toBeTrue();
    expect(isOwnGlobalChatMessage(message('1', '2026-07-10T12:01:00.000Z'), 'other')).toBeFalse();
  });

  it('creates initials from display name', () => {
    expect(globalChatInitials('Alvin Host')).toBe('AH');
    expect(globalChatInitials('kw')).toBe('K');
    expect(globalChatInitials('')).toBe('?');
  });

  it('formats role labels', () => {
    expect(globalChatRoleLabel('HOST')).toBe('Host');
    expect(globalChatRoleLabel('MANAGER')).toBe('Manager');
    expect(globalChatRoleLabel('PLAYER')).toBe('Player');
  });
});

function message(id: string, createdAt: string): GlobalChatMessage {
  return {
    id,
    senderUserId: 'user-1',
    senderDisplayName: 'Alvin',
    senderRole: 'HOST',
    message: 'hello',
    createdAt
  };
}
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm.cmd run test:ci
```

Expected: compile failure because `global-chat.logic.ts` does not exist.

- [ ] **Step 3: Implement pure logic**

Create `src/app/features/chat/global-chat.logic.ts`:

```ts
export type GlobalChatRole = 'HOST' | 'MANAGER' | 'PLAYER';

export interface GlobalChatMessage {
  id: string;
  senderUserId: string;
  senderDisplayName: string;
  senderRole: GlobalChatRole;
  message: string;
  createdAt: string;
}

export interface GlobalChatValidationResult {
  valid: boolean;
  message: string | null;
}

export const globalChatMessageMaxLength = 500;

export function normalizeChatMessageText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function validateChatMessageText(text: string): GlobalChatValidationResult {
  const normalized = normalizeChatMessageText(text);

  if (!normalized) {
    return { valid: false, message: 'Type a message first.' };
  }

  if (normalized.length > globalChatMessageMaxLength) {
    return { valid: false, message: 'Keep messages under 500 characters.' };
  }

  return { valid: true, message: null };
}

export function sortGlobalChatMessages(messages: GlobalChatMessage[]): GlobalChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function isOwnGlobalChatMessage(
  message: GlobalChatMessage,
  currentUserId: string | null
): boolean {
  return Boolean(currentUserId && message.senderUserId === currentUserId);
}

export function globalChatInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0][0]?.toUpperCase() ?? '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function globalChatRoleLabel(role: GlobalChatRole): string {
  switch (role) {
    case 'HOST':
      return 'Host';
    case 'MANAGER':
      return 'Manager';
    case 'PLAYER':
      return 'Player';
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm.cmd run test:ci
```

Expected: all tests pass.

- [ ] **Step 5: Commit logic**

```bash
git add src/app/features/chat/global-chat.logic.ts src/app/features/chat/global-chat.logic.spec.ts
git commit -m "feat: add global chat logic"
```

---

### Task 3: Add Global Chat Data Service

**Files:**
- Create: `src/app/features/chat/global-chat.service.ts`

**Interfaces:**
- Consumes:
  - `AuthStateService.user()`
  - `AuthStateService.profile()`
  - `SupabaseService.requireClient()`
  - `normalizeChatMessageText`
  - `sortGlobalChatMessages`
- Produces:
  - `messages: Signal<GlobalChatMessage[]>`
  - `loading: Signal<boolean>`
  - `sending: Signal<boolean>`
  - `error: Signal<string | null>`
  - `loadMessages(): Promise<void>`
  - `sendMessage(text: string): Promise<boolean>`

- [ ] **Step 1: Create service**

Create `src/app/features/chat/global-chat.service.ts`:

```ts
import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  GlobalChatMessage,
  GlobalChatRole,
  normalizeChatMessageText,
  sortGlobalChatMessages
} from './global-chat.logic';

interface GlobalChatMessageRow {
  id: string;
  sender_user_id: string;
  sender_display_name: string;
  sender_role: GlobalChatRole;
  message: string;
  created_at: string;
  deleted_at: string | null;
}

const localGlobalChatStorageKey = 'pokertrack.globalChatMessages.v1';

@Injectable({
  providedIn: 'root'
})
export class GlobalChatService implements OnDestroy {
  private readonly authState = inject(AuthStateService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly messagesSignal = signal<GlobalChatMessage[]>(this.loadLocalMessages());
  private readonly loadingSignal = signal(false);
  private readonly sendingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private realtimeChannel: RealtimeChannel | null = null;

  readonly messages = computed(() => sortGlobalChatMessages(this.messagesSignal()));
  readonly loading = this.loadingSignal.asReadonly();
  readonly sending = this.sendingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  ngOnDestroy(): void {
    this.teardownRealtime();
  }

  async loadMessages(): Promise<void> {
    this.errorSignal.set(null);
    this.loadingSignal.set(true);

    try {
      if (!this.shouldUseSupabase()) {
        this.messagesSignal.set(this.loadLocalMessages());
        return;
      }

      const { data, error } = await this.supabaseService
        .requireClient()
        .from('global_chat_messages')
        .select('id, sender_user_id, sender_display_name, sender_role, message, created_at, deleted_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(150);

      if (error) {
        throw error;
      }

      this.messagesSignal.set(((data ?? []) as GlobalChatMessageRow[]).map(mapGlobalChatMessage));
      this.setupRealtime();
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Unable to load chat.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async sendMessage(text: string): Promise<boolean> {
    const message = normalizeChatMessageText(text);
    const user = this.authState.user();
    const profile = this.authState.profile();

    if (!user || !profile || !message) {
      return false;
    }

    this.errorSignal.set(null);
    this.sendingSignal.set(true);

    try {
      if (!this.shouldUseSupabase()) {
        const localMessage: GlobalChatMessage = {
          id: this.createLocalId(),
          senderUserId: user.id,
          senderDisplayName: profile.displayName || 'Member',
          senderRole: profile.role,
          message,
          createdAt: new Date().toISOString()
        };

        this.messagesSignal.set([...this.messagesSignal(), localMessage]);
        this.saveLocalMessages(this.messagesSignal());
        return true;
      }

      const { error } = await this.supabaseService.requireClient().from('global_chat_messages').insert({
        sender_user_id: user.id,
        sender_display_name: profile.displayName || 'Member',
        sender_role: profile.role,
        message
      });

      if (error) {
        throw error;
      }

      await this.loadMessages();
      return true;
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Unable to send message.');
      return false;
    } finally {
      this.sendingSignal.set(false);
    }
  }

  private setupRealtime(): void {
    if (!this.shouldUseSupabase() || this.realtimeChannel) {
      return;
    }

    this.realtimeChannel = this.supabaseService
      .requireClient()
      .channel('global-chat')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_chat_messages' },
        () => {
          void this.loadMessages();
        }
      )
      .subscribe();
  }

  private teardownRealtime(): void {
    if (this.realtimeChannel) {
      void this.supabaseService.client?.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  private shouldUseSupabase(): boolean {
    const userId = this.authState.user()?.id ?? null;

    return Boolean(
      this.supabaseService.isConfigured &&
        userId &&
        !userId.startsWith('mock-') &&
        !userId.startsWith('dev-')
    );
  }

  private loadLocalMessages(): GlobalChatMessage[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(localGlobalChatStorageKey);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as GlobalChatMessage[];
    } catch {
      localStorage.removeItem(localGlobalChatStorageKey);
      return [];
    }
  }

  private saveLocalMessages(messages: GlobalChatMessage[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(localGlobalChatStorageKey, JSON.stringify(messages.slice(-150)));
  }

  private createLocalId(): string {
    return `global-chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function mapGlobalChatMessage(row: GlobalChatMessageRow): GlobalChatMessage {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderDisplayName: row.sender_display_name,
    senderRole: row.sender_role,
    message: row.message,
    createdAt: row.created_at
  };
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm.cmd run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit service**

```bash
git add src/app/features/chat/global-chat.service.ts
git commit -m "feat: add global chat service"
```

---

### Task 4: Build Shared Global Chat UI

**Files:**
- Create: `src/app/features/chat/global-chat.page.ts`

**Interfaces:**
- Consumes:
  - `GlobalChatService.messages`
  - `GlobalChatService.loadMessages()`
  - `GlobalChatService.sendMessage(text)`
  - `AuthStateService.user()`
  - `isOwnGlobalChatMessage`
  - `globalChatInitials`
  - `globalChatRoleLabel`
- Produces:
  - Standalone component `GlobalChatPage`
  - Input: `compact = input(false)`

- [ ] **Step 1: Create component**

Create `src/app/features/chat/global-chat.page.ts` with:

```ts
import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideLoaderCircle,
  LucideMessageCircle,
  LucideSendHorizontal,
  LucideUsersRound,
  LucideWifi
} from '@lucide/angular';

import { AuthStateService } from '../../core/auth/auth-state.service';
import {
  globalChatInitials,
  globalChatMessageMaxLength,
  globalChatRoleLabel,
  isOwnGlobalChatMessage,
  validateChatMessageText
} from './global-chat.logic';
import { GlobalChatService } from './global-chat.service';

@Component({
  selector: 'app-global-chat-page',
  imports: [
    DatePipe,
    FormsModule,
    LucideLoaderCircle,
    LucideMessageCircle,
    LucideSendHorizontal,
    LucideUsersRound,
    LucideWifi
  ],
  template: `
    <section class="global-chat-page" [class.global-chat-page-compact]="compact()">
      <header class="global-chat-header">
        <div>
          <span class="global-chat-kicker">
            <svg lucideWifi [strokeWidth]="2.4" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
            Live room
          </span>
          <h1>Global Chat</h1>
        </div>
        <div class="global-chat-presence">
          <svg lucideUsersRound [strokeWidth]="2.4" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
          <span>All Members</span>
        </div>
      </header>

      @if (chat.error()) {
        <div class="global-chat-alert">{{ chat.error() }}</div>
      }

      <div class="global-chat-shell">
        <aside class="global-chat-side-panel global-chat-side-panel-left" aria-label="Chat status">
          <h2>Room</h2>
          <p>Everyone signed in can see this chat.</p>
          <div class="global-chat-room-stat">
            <strong>{{ chat.messages().length }}</strong>
            <span>messages</span>
          </div>
        </aside>

        <article class="global-chat-main">
          <div class="global-chat-stream" #messageStream>
            @if (chat.loading()) {
              <div class="global-chat-loading">
                <div class="deck-shuffle" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p>Loading chat</p>
              </div>
            } @else {
              @for (message of chat.messages(); track message.id) {
                @let own = isOwnMessage(message);
                <div class="global-chat-message-row" [class.global-chat-message-row-own]="own">
                  @if (!own) {
                    <span class="global-chat-avatar">{{ initials(message.senderDisplayName) }}</span>
                  }
                  <div class="global-chat-bubble" [class.global-chat-bubble-own]="own">
                    <div class="global-chat-message-meta">
                      <strong>{{ message.senderDisplayName }}</strong>
                      <span>{{ roleLabel(message.senderRole) }}</span>
                      <time>{{ message.createdAt | date: 'shortTime' }}</time>
                    </div>
                    <p>{{ message.message }}</p>
                  </div>
                </div>
              } @empty {
                <div class="global-chat-empty">
                  <svg lucideMessageCircle [strokeWidth]="2.6" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
                  <h2>No messages yet</h2>
                  <p>Start the room with a quick update.</p>
                </div>
              }
            }
          </div>

          <form class="global-chat-composer" (ngSubmit)="sendMessage()">
            <label class="sr-only" for="globalChatMessage">Message everyone</label>
            <input
              id="globalChatMessage"
              name="globalChatMessage"
              [(ngModel)]="draft"
              [attr.maxlength]="messageMaxLength"
              autocomplete="off"
              placeholder="Message everyone..."
            />
            <button type="submit" [disabled]="chat.sending() || !canSend()">
              @if (chat.sending()) {
                <svg lucideLoaderCircle class="global-chat-spin" [strokeWidth]="2.6" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
              } @else {
                <svg lucideSendHorizontal [strokeWidth]="2.6" [absoluteStrokeWidth]="true" aria-hidden="true"></svg>
              }
              <span class="sr-only">Send</span>
            </button>
          </form>
        </article>

        <aside class="global-chat-side-panel global-chat-side-panel-right" aria-label="Room notes">
          <h2>Tonight</h2>
          <p>Keep messages short. Game updates, table moves, and quick reminders belong here.</p>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .global-chat-page {
        min-height: calc(100dvh - 9rem);
        animation: global-chat-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .global-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .global-chat-kicker,
      .global-chat-presence {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        color: rgb(110 231 183);
        font-size: 0.84rem;
        font-weight: 700;
      }

      .global-chat-header h1 {
        margin: 0.25rem 0 0;
        font-size: 1.9rem;
        line-height: 1.05;
        font-weight: 800;
        color: white;
      }

      .global-chat-shell {
        display: grid;
        grid-template-columns: minmax(10rem, 15rem) minmax(0, 1fr) minmax(10rem, 16rem);
        gap: 1rem;
        min-height: 36rem;
      }

      .global-chat-main,
      .global-chat-side-panel {
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        background: rgba(10, 10, 10, 0.72);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.26);
      }

      .global-chat-main {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        overflow: hidden;
      }

      .global-chat-stream {
        min-height: 26rem;
        overflow: auto;
        padding: 1rem;
      }

      .global-chat-message-row {
        display: flex;
        align-items: flex-end;
        gap: 0.65rem;
        margin-top: 0.8rem;
      }

      .global-chat-message-row-own {
        justify-content: flex-end;
      }

      .global-chat-avatar {
        display: grid;
        width: 2.2rem;
        height: 2.2rem;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 999px;
        border: 1px solid rgba(110, 231, 183, 0.34);
        background: rgba(16, 185, 129, 0.12);
        color: rgb(209 250 229);
        font-size: 0.78rem;
        font-weight: 800;
      }

      .global-chat-bubble {
        max-width: min(34rem, 78%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px 14px 14px 6px;
        background: rgba(255, 255, 255, 0.055);
        padding: 0.72rem 0.82rem;
      }

      .global-chat-bubble-own {
        border-color: rgba(52, 211, 153, 0.38);
        border-radius: 14px 14px 6px 14px;
        background: rgba(16, 185, 129, 0.14);
      }

      .global-chat-message-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
        color: rgb(163 163 163);
        font-size: 0.72rem;
      }

      .global-chat-message-meta strong {
        color: white;
      }

      .global-chat-message-meta span {
        color: rgb(110 231 183);
      }

      .global-chat-bubble p {
        margin: 0.28rem 0 0;
        color: rgb(245 245 245);
        line-height: 1.45;
      }

      .global-chat-composer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 3rem;
        gap: 0.65rem;
        border-top: 1px solid rgba(255, 255, 255, 0.09);
        padding: 0.85rem;
        background: rgba(10, 10, 10, 0.88);
      }

      .global-chat-composer input {
        min-width: 0;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 9px;
        background: rgba(15, 23, 42, 0.72);
        color: white;
        outline: none;
        padding: 0.85rem 1rem;
      }

      .global-chat-composer input:focus {
        border-color: rgba(110, 231, 183, 0.72);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14);
      }

      .global-chat-composer button {
        display: grid;
        place-items: center;
        border: 1px solid rgba(110, 231, 183, 0.38);
        border-radius: 9px;
        background: rgb(34 197 94);
        color: rgb(5 46 22);
      }

      .global-chat-composer button:disabled {
        background: rgba(64, 64, 64, 0.7);
        color: rgb(163 163 163);
      }

      .global-chat-side-panel {
        padding: 1rem;
      }

      .global-chat-side-panel h2 {
        margin: 0;
        color: white;
        font-size: 1rem;
      }

      .global-chat-side-panel p {
        margin: 0.55rem 0 0;
        color: rgb(212 212 212);
        font-size: 0.9rem;
        line-height: 1.45;
      }

      .global-chat-room-stat {
        margin-top: 1rem;
        border-radius: 8px;
        border: 1px solid rgba(110, 231, 183, 0.22);
        padding: 0.85rem;
      }

      .global-chat-room-stat strong {
        display: block;
        color: rgb(110 231 183);
        font-size: 1.5rem;
      }

      .global-chat-empty,
      .global-chat-loading {
        display: grid;
        min-height: 22rem;
        place-items: center;
        align-content: center;
        gap: 0.6rem;
        text-align: center;
        color: rgb(212 212 212);
      }

      .global-chat-empty svg {
        color: rgb(110 231 183);
      }

      .global-chat-alert {
        margin-bottom: 1rem;
        border: 1px solid rgba(248, 113, 113, 0.28);
        border-radius: 9px;
        background: rgba(248, 113, 113, 0.1);
        padding: 0.85rem 1rem;
        color: rgb(254 202 202);
      }

      .global-chat-spin {
        animation: global-chat-spin 850ms linear infinite;
      }

      @keyframes global-chat-in {
        from {
          opacity: 0;
          transform: translateY(0.35rem);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes global-chat-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 767px) {
        .global-chat-page {
          min-height: calc(100dvh - 7rem);
          padding-bottom: calc(4.75rem + env(safe-area-inset-bottom));
        }

        .global-chat-header {
          align-items: flex-start;
        }

        .global-chat-header h1 {
          font-size: 1.55rem;
        }

        .global-chat-presence {
          font-size: 0.78rem;
        }

        .global-chat-shell {
          display: block;
          min-height: 0;
        }

        .global-chat-side-panel {
          display: none;
        }

        .global-chat-main {
          min-height: calc(100dvh - 13.5rem);
        }

        .global-chat-stream {
          min-height: 0;
          padding: 0.75rem;
        }

        .global-chat-bubble {
          max-width: 82%;
        }

        .global-chat-composer {
          position: sticky;
          bottom: calc(4.75rem + env(safe-area-inset-bottom));
          padding: 0.72rem;
        }
      }
    `
  ]
})
export class GlobalChatPage implements OnInit {
  protected readonly compact = input(false);
  protected readonly chat = inject(GlobalChatService);
  private readonly authState = inject(AuthStateService);
  protected readonly messageMaxLength = globalChatMessageMaxLength;
  protected draft = '';

  @ViewChild('messageStream') private messageStream?: ElementRef<HTMLElement>;

  protected readonly canSend = computed(() => validateChatMessageText(this.draft).valid);

  async ngOnInit(): Promise<void> {
    await this.chat.loadMessages();
    this.scrollToBottom();
  }

  protected async sendMessage(): Promise<void> {
    if (!this.canSend()) {
      return;
    }

    const sent = await this.chat.sendMessage(this.draft);

    if (sent) {
      this.draft = '';
      this.scrollToBottom();
    }
  }

  protected isOwnMessage(message: { senderUserId: string }): boolean {
    return isOwnGlobalChatMessage(message as never, this.authState.user()?.id ?? null);
  }

  protected initials(name: string): string {
    return globalChatInitials(name);
  }

  protected roleLabel(role: 'HOST' | 'MANAGER' | 'PLAYER'): string {
    return globalChatRoleLabel(role);
  }

  private scrollToBottom(): void {
    window.setTimeout(() => {
      const element = this.messageStream?.nativeElement;

      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }
}
```

- [ ] **Step 2: Run build and correct strict typing**

Run:

```bash
npm.cmd run build
```

Expected: build succeeds. If TypeScript rejects the `isOwnMessage` helper cast, replace the method parameter with `GlobalChatMessage` imported from `global-chat.logic`.

- [ ] **Step 3: Commit UI component**

```bash
git add src/app/features/chat/global-chat.page.ts
git commit -m "feat: build global chat page"
```

---

### Task 5: Wire Navigation For Host And Player

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/core/layout/host-shell.component.ts`
- Modify: `src/app/features/player/dashboard/player-dashboard.page.ts`

**Interfaces:**
- Consumes: `GlobalChatPage`
- Produces:
  - Host route `/host/chat`
  - Host desktop nav item `Chat`
  - Host mobile chat icon
  - Player dashboard tab `chat`

- [ ] **Step 1: Add host chat route**

Modify `src/app/app.routes.ts` inside host children after `pot-calculator`:

```ts
{
  path: 'chat',
  loadComponent: () => import('./features/chat/global-chat.page').then((m) => m.GlobalChatPage)
},
```

- [ ] **Step 2: Add host nav icon and item**

Modify `src/app/core/layout/host-shell.component.ts`:

```ts
import {
  LucideAlarmClock,
  LucideCalculator,
  LucideHistory,
  LucideHouse,
  LucideMessageCircle,
  LucideUsersRound
} from '@lucide/angular';
```

Add `LucideMessageCircle` to `imports`.

Add desktop nav link after Calculator:

```html
<a
  routerLink="/host/chat"
  routerLinkActive="pokertrack-nav-link-active"
  class="pokertrack-nav-link min-w-0 rounded-md px-2 py-2 text-center text-neutral-300 sm:shrink-0 sm:px-3"
>
  Chat
</a>
```

Add mobile nav item after Calculator:

```html
<a
  routerLink="/host/chat"
  routerLinkActive="host-mobile-tab-active"
  class="host-mobile-tab"
  aria-label="Chat"
>
  <svg
    lucideMessageCircle
    class="pokertrack-nav-icon"
    [strokeWidth]="3"
    [absoluteStrokeWidth]="true"
    aria-hidden="true"
  ></svg>
  <span class="sr-only">Chat</span>
</a>
```

- [ ] **Step 3: Add player dashboard chat tab**

Modify `src/app/features/player/dashboard/player-dashboard.page.ts`:

```ts
import { GlobalChatPage } from '../../chat/global-chat.page';
```

Add `GlobalChatPage` and `LucideMessageCircle` to component imports.

Change:

```ts
type PlayerDashboardTab = 'overview' | 'sessions' | 'calculator';
```

to:

```ts
type PlayerDashboardTab = 'overview' | 'sessions' | 'calculator' | 'chat';
```

Add to the tabs array:

```ts
{ id: 'chat', label: 'Chat' }
```

Add icon switch case:

```html
@case ('chat') {
  <svg
    lucideMessageCircle
    class="pokertrack-nav-icon"
    [strokeWidth]="3"
    [absoluteStrokeWidth]="true"
    aria-hidden="true"
  ></svg>
}
```

Add view switch case:

```html
@case ('chat') {
  <section class="player-view player-view-chat">
    <app-global-chat-page [compact]="true" />
  </section>
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm.cmd run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit navigation**

```bash
git add src/app/app.routes.ts src/app/core/layout/host-shell.component.ts src/app/features/player/dashboard/player-dashboard.page.ts
git commit -m "feat: wire global chat navigation"
```

---

### Task 6: Browser Verification And Polish

**Files:**
- Modify if needed:
  - `src/app/features/chat/global-chat.page.ts`
  - `src/app/core/layout/host-shell.component.ts`
  - `src/app/features/player/dashboard/player-dashboard.page.ts`

**Interfaces:**
- Verifies all prior tasks.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm.cmd run build
npm.cmd run test:ci
```

Expected:
- Build exits 0.
- Tests report `TOTAL: 36 SUCCESS` or higher if new tests were added.

- [ ] **Step 2: Verify host desktop**

Open:

```text
http://127.0.0.1:4201/host/chat
```

Check:
- Chat nav item is visible on desktop.
- Header reads `Global Chat`.
- Message composer is visible.
- Sending a local dev message adds a bubble.
- No horizontal overflow at 1280px.

- [ ] **Step 3: Verify host mobile**

Set viewport to 390x844 and open:

```text
http://127.0.0.1:4201/host/chat
```

Check:
- Chat icon appears in bottom nav.
- Composer sits above the bottom nav.
- Message stream scrolls independently.
- Text does not overlap or clip.

- [ ] **Step 4: Verify player mobile**

Set viewport to 390x844 and open:

```text
http://127.0.0.1:4201/player/dashboard
```

Check:
- Chat tab appears in player dashboard nav.
- Chat view opens without leaving dashboard.
- Composer is visible above the bottom nav.
- A player can send a message in dev mode.

- [ ] **Step 5: Verify global behavior in local mode**

Open one host login and one player login in separate browsers or after logout/login.

Check:
- Both users can see the same local messages when the same browser localStorage is shared.
- Sender display name and role label are correct.
- Own messages align right.
- Other messages align left.

- [ ] **Step 6: Commit polish fixes**

Only if browser verification required style or layout adjustments:

```bash
git add src/app/features/chat/global-chat.page.ts src/app/core/layout/host-shell.component.ts src/app/features/player/dashboard/player-dashboard.page.ts
git commit -m "polish: refine global chat responsive layout"
```

---

## Final Completion Checklist

- [ ] `git status --short --branch` is clean on `feature/session-group-chat`.
- [ ] `npm.cmd run build` exits 0.
- [ ] `npm.cmd run test:ci` exits 0.
- [ ] Host desktop chat route works.
- [ ] Host mobile chat route works.
- [ ] Player dashboard chat tab works.
- [ ] Supabase migration exists and is committed.
- [ ] Production deployment note includes: apply `supabase/migrations/20260710161000_global_group_chat.sql` before relying on production chat.
