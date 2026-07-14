import {
  globalChatClockTimeLabel,
  globalChatDateSeparatorLabel,
  globalChatInitials,
  globalChatRoleLabel,
  isGlobalChatSenderRunStart,
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
    expect(globalChatInitials('1010')).toBe('10');
    expect(globalChatInitials('')).toBe('PT');
  });

  it('labels roles for chat display', () => {
    expect(globalChatRoleLabel('HOST')).toBe('Host');
    expect(globalChatRoleLabel('MANAGER')).toBe('Manager');
    expect(globalChatRoleLabel('PLAYER')).toBe('Member');
  });

  it('formats message times with a 24-hour clock', () => {
    expect(globalChatClockTimeLabel('2026-07-10T16:23:00', 'en-GB')).toBe('16:23');
  });

  it('starts a new sender run only when the sender or local date changes', () => {
    const messages = [
      message('1', '2026-07-10T16:20:00', 'user-1'),
      message('2', '2026-07-10T16:21:00', 'user-1'),
      message('3', '2026-07-10T16:22:00', 'user-2'),
      message('4', '2026-07-11T00:01:00', 'user-2')
    ];

    expect(messages.map((_, index) => isGlobalChatSenderRunStart(messages, index))).toEqual([
      true,
      false,
      true,
      true
    ]);
  });

  it('shows date separators at local day boundaries', () => {
    const messages = [
      message('1', '2026-07-13T23:58:00'),
      message('2', '2026-07-14T00:02:00')
    ];
    const now = new Date('2026-07-14T12:00:00');

    expect(globalChatDateSeparatorLabel(messages, 0, now, 'en-US')).toBe('Yesterday');
    expect(globalChatDateSeparatorLabel(messages, 1, now, 'en-US')).toBe('Today');
  });
});

function message(id: string, createdAt: string, senderUserId = 'user-1'): GlobalChatMessage {
  return {
    id,
    senderUserId,
    senderDisplayName: 'Alvin Host',
    senderRole: 'HOST',
    message: 'Good hand',
    createdAt
  };
}
