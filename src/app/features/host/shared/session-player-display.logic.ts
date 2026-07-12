export function formatSignedMoney(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  if (amount > 0) {
    return `+${formatted}`;
  }

  if (amount < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

export type NetResultTone = 'positive' | 'negative' | 'neutral';

export function netResultTone(amount: number): NetResultTone {
  if (amount > 0) {
    return 'positive';
  }

  if (amount < 0) {
    return 'negative';
  }

  return 'neutral';
}
