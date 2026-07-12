import { formatSignedMoney, netResultTone } from './session-player-display.logic';

describe('session player display helpers', () => {
  it('adds a plus sign for positive net values', () => {
    expect(formatSignedMoney(125)).toBe('+$125');
  });

  it('keeps the minus sign for negative net values', () => {
    expect(formatSignedMoney(-80)).toBe('-$80');
  });

  it('does not add a sign for zero net values', () => {
    expect(formatSignedMoney(0)).toBe('$0');
  });

  it('uses the positive tone for a profitable cash out', () => {
    expect(netResultTone(125)).toBe('positive');
  });

  it('uses the negative tone for a losing cash out', () => {
    expect(netResultTone(-80)).toBe('negative');
  });

  it('uses the neutral tone for an even cash out', () => {
    expect(netResultTone(0)).toBe('neutral');
  });
});
