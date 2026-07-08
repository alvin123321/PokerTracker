export interface PotPlayerInput {
  id: string;
  name: string;
  amount: number | null;
}

export interface SidePotResult {
  label: string;
  amount: number;
  eligiblePlayerNames: string[];
}

export function calculateSidePots(players: PotPlayerInput[]): SidePotResult[] {
  const activePlayers = players
    .map((player, index) => ({
      name: player.name.trim() || `Player${index + 1}`,
      amount: normalizePotAmount(player.amount)
    }))
    .filter((player) => player.amount > 0);

  if (activePlayers.length < 2) {
    return [];
  }

  const levels = [...new Set(activePlayers.map((player) => player.amount))].sort((a, b) => a - b);
  let previousLevel = 0;

  return levels
    .map((level, index) => {
      const eligiblePlayers = activePlayers.filter((player) => player.amount >= level);
      const amount = (level - previousLevel) * eligiblePlayers.length;

      previousLevel = level;

      return {
        label: index === 0 ? 'Main Pot' : `Side Pot ${index}`,
        amount,
        eligiblePlayerNames: eligiblePlayers.map((player) => player.name)
      };
    })
    .filter((pot) => pot.amount > 0 && pot.eligiblePlayerNames.length > 1);
}

export function defaultPotPlayers(): PotPlayerInput[] {
  return [
    { id: createPotPlayerId(), name: 'Al', amount: null },
    { id: createPotPlayerId(), name: 'Bo', amount: null },
    { id: createPotPlayerId(), name: 'Cy', amount: null },
    { id: createPotPlayerId(), name: 'Di', amount: null }
  ];
}

export function calculateTotalPot(players: PotPlayerInput[]): number {
  return players.reduce((total, player) => total + normalizePotAmount(player.amount), 0);
}

export function normalizePotAmount(value: number | string | null): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function createPotPlayerId(): string {
  return `pot-player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
