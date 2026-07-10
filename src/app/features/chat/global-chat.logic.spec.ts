import {
  globalChatInitials,
  globalChatRoleLabel,
  isOwnGlobalChatMessage,
  normalizeChatMessageText,
  relativeChatTimeLabel,
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

  it('uses compact relative time labels', () => {
    const now = new Date('2026-07-10T12:10:00.000Z');

    expect(relativeChatTimeLabel('2026-07-10T12:10:00.000Z', now)).toBe('now');
    expect(relativeChatTimeLabel('2026-07-10T12:07:00.000Z', now)).toBe('3m');
    expect(relativeChatTimeLabel('2026-07-10T10:10:00.000Z', now)).toBe('2h');
  });
});

function message(id: string, createdAt: string): GlobalChatMessage {
  return {
    id,
    senderUserId: 'user-1',
    senderDisplayName: 'Alvin Host',
    senderRole: 'HOST',
    message: 'Good hand',
    createdAt
  };
}
