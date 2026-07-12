import { formatSignedMoney } from './active-session-display.logic';

describe('active session display helpers', () => {
  it('adds a plus sign for positive net values', () => {
    expect(formatSignedMoney(125)).toBe('+$125');
  });

  it('keeps the minus sign for negative net values', () => {
    expect(formatSignedMoney(-80)).toBe('-$80');
  });

  it('does not add a sign for zero net values', () => {
    expect(formatSignedMoney(0)).toBe('$0');
  });
});
