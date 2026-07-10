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
  const normalizedText = normalizeChatMessageText(text);

  if (!normalizedText) {
    return {
      valid: false,
      message: 'Type a message first.'
    };
  }

  if (normalizedText.length > globalChatMessageMaxLength) {
    return {
      valid: false,
      message: 'Keep messages under 500 characters.'
    };
  }

  return {
    valid: true,
    message: null
  };
}

export function sortGlobalChatMessages(messages: GlobalChatMessage[]): GlobalChatMessage[] {
  return [...messages].sort((left, right) => {
    const createdDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

export function isOwnGlobalChatMessage(
  message: GlobalChatMessage,
  currentUserId: string | null
): boolean {
  return currentUserId !== null && message.senderUserId === currentUserId;
}

export function globalChatInitials(name: string): string {
  const cleanName = normalizeChatMessageText(name);

  if (!cleanName) {
    return 'PT';
  }

  if (/^\d+$/.test(cleanName)) {
    return cleanName.slice(0, 2);
  }

  const parts = cleanName.split(' ').filter(Boolean);
  const initials =
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`;

  return initials.toUpperCase();
}

export function globalChatRoleLabel(role: GlobalChatRole): string {
  switch (role) {
    case 'HOST':
      return 'Host';
    case 'MANAGER':
      return 'Manager';
    case 'PLAYER':
      return 'Member';
  }
}

export function relativeChatTimeLabel(createdAt: string, now = new Date()): string {
  const deltaMs = Math.max(0, now.getTime() - Date.parse(createdAt));
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes < 1) {
    return 'now';
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);

  if (deltaHours < 24) {
    return `${deltaHours}h`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d`;
}
