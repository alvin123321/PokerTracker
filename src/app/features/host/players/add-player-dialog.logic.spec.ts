import { sortRegisteredPlayerOptions } from './add-player-dialog.logic';

describe('add player dialog registered player ordering', () => {
  it('moves players already in the session below selectable players', () => {
    const sorted = sortRegisteredPlayerOptions(
      [{ id: 'existing' }, { id: 'available' }],
      ['existing']
    );

    expect(sorted.map((player) => player.id)).toEqual(['available', 'existing']);
  });
});
