import { calculateSidePots, calculateTotalPot, defaultPotPlayers } from './pot-calculator.logic';

describe('pot calculator logic', () => {
  it('starts with four compact preset players', () => {
    const players = defaultPotPlayers();

    expect(players.map((player) => player.name)).toEqual(['Al', 'Bo', 'Cy', 'Di']);
    expect(players.every((player) => player.amount === null)).toBeTrue();
  });

  it('does not show a pot level when only one player is eligible', () => {
    const results = calculateSidePots([
      { id: 'a', name: 'Al', amount: 100 },
      { id: 'b', name: 'Bo', amount: 200 },
      { id: 'c', name: 'Cy', amount: 500 }
    ]);

    expect(results).toEqual([
      { label: 'Main Pot', amount: 300, eligiblePlayerNames: ['Al', 'Bo', 'Cy'] },
      { label: 'Side Pot 1', amount: 200, eligiblePlayerNames: ['Bo', 'Cy'] }
    ]);
  });

  it('keeps the total pot as all positive committed amounts', () => {
    const total = calculateTotalPot([
      { id: 'a', name: 'Al', amount: 100 },
      { id: 'b', name: 'Bo', amount: 200 },
      { id: 'c', name: 'Cy', amount: 500 },
      { id: 'd', name: 'Di', amount: null }
    ]);

    expect(total).toBe(800);
  });
});
