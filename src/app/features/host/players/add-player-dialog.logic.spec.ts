import {
  filterRegisteredPlayerOptions,
  resolveAddPlayerSearch,
  sortRegisteredPlayerOptions
} from './add-player-dialog.logic';

describe('add player dialog registered player search', () => {
  const players = [
    { id: 'alvin', username: 'alvin88', displayName: 'Alvin' },
    { id: 'alan', username: 'alanpoker', displayName: 'Alan' },
    { id: 'alex', username: 'riverking', displayName: 'Alex' },
    { id: 'vincent', username: 'vinny', displayName: 'Vincent' }
  ];

  it('matches display names only from the beginning', () => {
    const filtered = filterRegisteredPlayerOptions(players, 'al', [], []);

    expect(filtered.map((player) => player.id)).toEqual(['alvin', 'alan', 'alex']);
  });

  it('matches usernames from the beginning independently of display names', () => {
    const filtered = filterRegisteredPlayerOptions(players, 'river', [], []);

    expect(filtered.map((player) => player.id)).toEqual(['alex']);
  });

  it('does not match text from the middle of a name', () => {
    const filtered = filterRegisteredPlayerOptions(players, 'lvi', [], []);

    expect(filtered).toEqual([]);
  });
});

describe('add player dialog registered player ordering', () => {
  it('moves players already in the session below selectable players', () => {
    const sorted = sortRegisteredPlayerOptions(
      [{ id: 'existing' }, { id: 'available' }],
      ['existing']
    );

    expect(sorted.map((player) => player.id)).toEqual(['available', 'existing']);
  });

  it('moves an unlinked cashed-out player below selectable players by name', () => {
    const sorted = sortRegisteredPlayerOptions(
      [
        { id: 'available', username: 'newplayer', displayName: 'New Player' },
        { id: 'cashed-out', username: 'maxi', displayName: 'Maxi' }
      ],
      [],
      ['Maxi']
    );

    expect(sorted.map((player) => player.id)).toEqual(['available', 'cashed-out']);
  });

  it('creates a signup result for an unmatched typed name', () => {
    const result = resolveAddPlayerSearch(
      [{ id: 'existing', username: 'playerone', displayName: 'Player One' }],
      'New Player',
      [],
      []
    );

    expect(result).toEqual({ kind: 'new', name: 'New Player' });
  });
});
