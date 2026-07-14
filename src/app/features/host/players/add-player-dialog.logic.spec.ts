import { sortRegisteredPlayerOptions } from './add-player-dialog.logic';

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
});
