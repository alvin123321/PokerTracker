# Task 3 Report: Player Dashboard Live-State Selection

## RED

Command:

```powershell
npx -p node@22 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/features/player/dashboard/player-dashboard.logic.spec.ts"
```

Result: failed as expected during Angular compilation because `player-dashboard.logic.ts` did not export `unseatedPlayerActiveTables`. The compiler also reported the downstream implicit-`any` type for the test callback parameter.

## Implementation

Added the pure `unseatedPlayerActiveTables(activeTables, seatedTableIds)` selector. It filters seated table IDs and sorts the copied filtered array by descending `sessionDate`, ascending `sessionCreatedAt`, ascending `tableNumber`, then ascending `tableId`.

## GREEN

Command: the same focused logic-spec command shown above.

Result: passed, `22/22` tests successful.

## Full Suite

Command:

```powershell
npm.cmd run test:ci
```

Result: passed, `199/199` tests successful.

## Files Changed

- `src/app/features/player/dashboard/player-dashboard.logic.ts`
- `src/app/features/player/dashboard/player-dashboard.logic.spec.ts`
- `.superpowers/sdd/task-3-report.md`

## Checks

- Ordering test removes the seated table and expects `table-b-1`, then `table-b-2`.
- Mutation test verifies the input array retains its original order after selection.
- Empty-directory test expects `[]`.
- `git diff --check` passed.

## Self-Review

The implementation is limited to the requested pure selector and focused tests. `filter()` creates the array that `.sort()` mutates, so the caller-owned directory is not reordered. The comparator follows the brief's exact ordering and deterministic tie-breakers. No UI, service, or unrelated files were changed.

## Concerns

None identified. No production integration was requested for this task.
