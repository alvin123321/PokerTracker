import { isValidPokerTrackUsername, usernameFromDisplayName } from './username.logic';

describe('PokerTrack username logic', () => {
  it('allows two-character player login names', () => {
    expect(usernameFromDisplayName('kw')).toBe('kw');
    expect(isValidPokerTrackUsername('kw')).toBeTrue();
  });

  it('keeps one-character names on a generated player login', () => {
    expect(usernameFromDisplayName('k')).toMatch(/^player-/);
    expect(isValidPokerTrackUsername(usernameFromDisplayName('k'))).toBeTrue();
  });
});
