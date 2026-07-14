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

export function globalChatClockTimeLabel(createdAt: string, locale?: string): string {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(createdDate);
}

export function isGlobalChatSenderRunStart(
  messages: GlobalChatMessage[],
  index: number
): boolean {
  const currentMessage = messages[index];

  if (!currentMessage) {
    return false;
  }

  const previousMessage = messages[index - 1];

  if (!previousMessage) {
    return true;
  }

  return (
    globalChatSenderIdentity(currentMessage) !== globalChatSenderIdentity(previousMessage) ||
    globalChatLocalDateKey(currentMessage.createdAt) !==
      globalChatLocalDateKey(previousMessage.createdAt)
  );
}

export function globalChatDateSeparatorLabel(
  messages: GlobalChatMessage[],
  index: number,
  now = new Date(),
  locale?: string
): string | null {
  const currentMessage = messages[index];

  if (!currentMessage) {
    return null;
  }

  const currentDateKey = globalChatLocalDateKey(currentMessage.createdAt);
  const previousDateKey = globalChatLocalDateKey(messages[index - 1]?.createdAt ?? '');

  if (!currentDateKey || currentDateKey === previousDateKey) {
    return null;
  }

  const createdDate = new Date(currentMessage.createdAt);
  const todayKey = globalChatLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = globalChatLocalDateKey(yesterday);

  if (currentDateKey === todayKey) {
    return 'Today';
  }

  if (currentDateKey === yesterdayKey) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(createdDate.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
  }).format(createdDate);
}

function globalChatSenderIdentity(message: GlobalChatMessage): string {
  return (
    message.senderUserId.trim() ||
    normalizeChatMessageText(message.senderDisplayName).toLowerCase()
  );
}

function globalChatLocalDateKey(createdAt: string | Date): string {
  const parsedDate = createdAt instanceof Date ? createdAt : new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
