# Session Detail Cash-Out and Player Sorting

## Scope

Improve the mobile host session workflow without duplicating behavior between the active-session detail and dashboard.

## Session Detail

- The first table is expanded when the session detail loads. Other tables retain their current collapsed state.
- Every player timeline includes buy-ins, rebuys, and cash-outs in chronological order.
- A cash-out timeline entry is editable through the existing cash-out edit flow. Saving recalculates the player cash-out and net through the store's existing production RPC path.

## Add Player

- The add-player dialog receives the user IDs already seated in the session, regardless of whether their state is active or cashed out.
- Existing players already in the session are displayed after selectable players, styled as muted, and disabled. They remain visible so the host understands why they cannot be selected.

## Player Ordering

- Active players remain ahead of cashed-out players.
- Cashed-out players sort by net descending, highest result first.
- Ties use the existing stable alphabetical and join-time ordering.
- The shared ordering helper is used by both host dashboard and active-session detail.

## Verification

- Unit tests cover cash-out inclusion in timelines, net-based completed-player ordering, and disabled player-search options.
- Local mobile browser verification confirms the first table is open, completed players appear in descending net order, cash-out timeline entries open the editor, and existing session members cannot be selected.
