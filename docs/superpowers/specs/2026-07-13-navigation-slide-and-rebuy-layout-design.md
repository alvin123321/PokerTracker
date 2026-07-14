# Navigation Slide And Rebuy Layout

## Scope

Fix mobile navigation between session history and session detail so the two page snapshots do not visibly overlap. Reorder the rebuy dialog so its optional comment is the final field.

## Design

- Keep shell tab navigation unanimated.
- Keep the top and bottom navigation stationary during detail navigation.
- Animate history and detail snapshots as adjacent full-width pages: forward moves the old page from `0` to `-100%` while the new page moves from `100%` to `0`; back uses the exact reverse.
- Clip the route transition group so neither snapshot can paint outside the content viewport.
- Order the rebuy dialog as preset amounts, custom amount, then comment.

## Verification

- Add regression coverage for the transition CSS contract and rebuy field order.
- Run the complete unit test suite and production build.
- Verify the mobile flow in the running app when browser automation is available.
