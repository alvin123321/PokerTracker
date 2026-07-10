import { effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { environment } from '../../../environments/environment';
import {
  GlobalChatMessage,
  GlobalChatRole,
  normalizeChatMessageText,
  sortGlobalChatMessages,
  validateChatMessageText
} from './global-chat.logic';

interface GlobalChatMessageRow {
  id: string;
  sender_user_id: string;
  sender_display_name: string;
  sender_role: GlobalChatRole;
  message: string;
  created_at: string;
}

const localChatStorageKey = 'pokertrack.globalChatMessages.v1';
const maxLoadedMessages = 80;

@Injectable({
  providedIn: 'root'
})
export class GlobalChatService implements OnDestroy {
  private readonly authState = inject(AuthStateService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly messagesSignal = signal<GlobalChatMessage[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly sendingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeUserId: string | null = null;
  private readonly storageListener = (event: StorageEvent) => {
    if (event.key === localChatStorageKey) {
      this.messagesSignal.set(this.loadLocalMessages());
    }
  };

  readonly messages = this.messagesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly sending = this.sendingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly isConfigured = this.supabaseService.isConfigured;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.storageListener);
    }

    effect(() => {
      const userId = this.authState.user()?.id ?? null;

      queueMicrotask(() => {
        if (!userId) {
          this.messagesSignal.set([]);
          this.disconnectRealtime();
          return;
        }

        void this.loadMessages();
        this.connectRealtime(userId);
      });
    });
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener);
    }

    this.disconnectRealtime();
  }

  async loadMessages(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (this.shouldUseSupabase()) {
        const { data, error } = await this.supabaseService
          .requireClient()
          .from('global_chat_messages')
          .select('id,sender_user_id,sender_display_name,sender_role,message,created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(maxLoadedMessages)
          .returns<GlobalChatMessageRow[]>();

        if (error) {
          throw error;
        }

        this.messagesSignal.set(sortGlobalChatMessages((data ?? []).map(this.mapRow)));
        return;
      }

      this.messagesSignal.set(this.loadLocalMessages());
    } catch (error) {
      this.errorSignal.set(this.toMessage(error, 'Unable to load chat.'));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async sendMessage(text: string): Promise<boolean> {
    const validation = validateChatMessageText(text);
    const profile = this.authState.profile();
    const user = this.authState.user();

    if (!validation.valid) {
      this.errorSignal.set(validation.message);
      return false;
    }

    if (!profile || !user) {
      this.errorSignal.set('Sign in before sending a message.');
      return false;
    }

    const normalizedText = normalizeChatMessageText(text);
    this.sendingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (this.shouldUseSupabase()) {
        const { error } = await this.supabaseService.requireClient().from('global_chat_messages').insert({
          sender_user_id: user.id,
          sender_display_name: profile.displayName?.trim() || 'Member',
          sender_role: profile.role,
          message: normalizedText
        });

        if (error) {
          throw error;
        }

        await this.loadMessages();
        return true;
      }

      const message: GlobalChatMessage = {
        id: this.createLocalMessageId(),
        senderUserId: user.id,
        senderDisplayName: profile.displayName?.trim() || 'Member',
        senderRole: profile.role,
        message: normalizedText,
        createdAt: new Date().toISOString()
      };
      const messages = [...this.loadLocalMessages(), message].slice(-maxLoadedMessages);

      this.saveLocalMessages(messages);
      this.messagesSignal.set(sortGlobalChatMessages(messages));
      this.dispatchLocalChatEvent();
      return true;
    } catch (error) {
      this.errorSignal.set(this.toMessage(error, 'Unable to send message.'));
      return false;
    } finally {
      this.sendingSignal.set(false);
    }
  }

  private connectRealtime(userId: string): void {
    if (!this.shouldUseSupabase() || this.realtimeUserId === userId) {
      return;
    }

    this.disconnectRealtime();

    const channel = this.supabaseService
      .requireClient()
      .channel('pokertrack-global-chat')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_chat_messages'
        },
        () => {
          void this.loadMessages();
        }
      )
      .subscribe();

    this.realtimeChannel = channel;
    this.realtimeUserId = userId;
  }

  private disconnectRealtime(): void {
    if (this.realtimeChannel) {
      void this.supabaseService.client?.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = null;
    this.realtimeUserId = null;
  }

  private shouldUseSupabase(): boolean {
    return environment.production && this.supabaseService.isConfigured;
  }

  private mapRow(row: GlobalChatMessageRow): GlobalChatMessage {
    return {
      id: row.id,
      senderUserId: row.sender_user_id,
      senderDisplayName: row.sender_display_name,
      senderRole: row.sender_role,
      message: row.message,
      createdAt: row.created_at
    };
  }

  private loadLocalMessages(): GlobalChatMessage[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const rawMessages = localStorage.getItem(localChatStorageKey);

    if (!rawMessages) {
      return [];
    }

    try {
      const messages = JSON.parse(rawMessages) as GlobalChatMessage[];
      return sortGlobalChatMessages(
        messages.filter(
          (message) =>
            message.id &&
            message.senderUserId &&
            message.senderDisplayName &&
            message.senderRole &&
            message.message &&
            message.createdAt
        )
      ).slice(-maxLoadedMessages);
    } catch {
      localStorage.removeItem(localChatStorageKey);
      return [];
    }
  }

  private saveLocalMessages(messages: GlobalChatMessage[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(localChatStorageKey, JSON.stringify(sortGlobalChatMessages(messages)));
  }

  private dispatchLocalChatEvent(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(new StorageEvent('storage', { key: localChatStorageKey }));
  }

  private createLocalMessageId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `local-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
