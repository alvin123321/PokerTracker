# Completed Session Deletion and Feedback Positioning Design

## Scope

This change adds permanent deletion for completed poker sessions from the host-admin history detail, fixes shared action-feedback messages that are currently covered by the top navigation, and corrects several mini-game presentation and player-history behaviors.

The deletion affects only the selected session and its game records. Registered member and player accounts remain intact.

## Completed Session Actions

The completed-session summary header receives a compact ellipsis button aligned to the far right of the session title row. It is visible only when:

- the session status is `COMPLETED`; and
- the signed-in operator is the host administrator.

Opening the menu reveals one destructive action, **Delete session**, styled in red. Managers and players never receive this control.

Selecting the action opens the existing confirmation dialog with explicit choices:

- **No, keep session** closes the dialog without changing data.
- **Yes, delete** permanently removes the session.

The confirmation explains that deletion cannot be undone and lists the session name, player count, and total buy-in so the administrator can verify the target before proceeding.

## Deletion Data Flow

The frontend reuses `PokerStoreService.deleteSession`, which calls the existing host-owned `delete_session` RPC. The RPC performs the deletion in one database transaction and removes:

- transactions, including buy-ins, rebuys, and cash-outs;
- session-player participation rows;
- session tables;
- time-call records through existing cascading foreign keys; and
- the session itself.

Rows in the registered `players` table and authentication accounts are preserved.

The current RPC is preferred over a new completed-only RPC because it already enforces host ownership and performs the required dependency-ordered deletion atomically. Direct client-side table deletion is rejected because it could leave partial data.

After success, the store removes the session from local state and the router replaces the summary URL with `/host/sessions/history`. During deletion, the menu is disabled and a centered loading treatment prevents duplicate submissions. If the RPC fails, the summary stays open and a red action-feedback toast displays the parsed database error.

## Shared Feedback Positioning

`ActionFeedbackToastComponent` remains a fixed overlay so messages never change document flow. Its top position changes from a viewport-edge offset to a shell-aware CSS custom property.

The host and player shells define stable mobile and desktop offsets matching their rendered header heights. The toast adds a small visual gap beneath that offset and includes the safe-area inset. Its stacking level sits above navigation and account menus but below modal dialogs.

This shared rule applies automatically to rebuy, cash-out, add-player, delete, and other existing actions that use the component. Per-page margins or placeholder space are not added because they would duplicate layout logic and cause page movement.

## Mini-Game Control Menu

The mini-game overflow menu keeps its existing four actions and icons, but its Angular Material overlay receives explicit application typography and row layout. Each generated menu item and its inner text wrapper use the PokerTracker Aptos/Inter font stack.

Each icon and option label remain on one vertically centered row with a stable icon column and consistent spacing. The delete option remains red, disabled actions retain their muted treatment, and no custom digital or monospace font is used inside this menu.

## Host Mini-Game Empty State

When no current mini-game exists, host admins see a dedicated unframed section instead of the current compressed horizontal status band.

The section has a clear **Mini game** heading paired with the dice icon. A primary **Create mini game** button is centered beneath the heading with a stable touch target. The redundant **No game running** status is removed because the empty state and create action already communicate that condition.

Managers and players continue to see no mini-game section when there is no current game.

## Player Mini-Game History

The player history view derives a participant-only list from completed mini-game snapshots. A game is included only when its `viewerParticipantId` identifies the signed-in player as one of that game's participants.

Unjoined mini-games do not appear in the player's history list. When the player has no joined completed mini-games, the mini-game history icon is hidden and table-game history remains selected. A stale direct query such as `view=mini-games` falls back to table history once history loading establishes that there are no eligible results.

Host mini-game history remains global and unchanged. The current live mini-game also remains globally visible to authenticated users as previously designed.

## Player Completed-Game Detail Order

When the player dashboard has no active table session and displays the latest completed table game, **Game timeline** moves above **Game players**. This makes the completed result's transaction sequence the first detail shown.

Active table games keep the existing order: **Game players** first, followed by **Game timeline**. The two sections are rendered from shared templates so their contents and spacing do not become duplicated.

## Mobile Layout

- The session ellipsis control has a stable 44-by-44-pixel touch target.
- It stays on the session-name row at the far right without squeezing the title or status.
- The action menu aligns to the right edge and remains within the viewport.
- Feedback cards remain centered with the existing responsive maximum width.
- Showing or hiding feedback does not change the position of any page content.
- Mini-game menu icons and labels remain on one row at narrow widths.
- The host empty-state create action is centered and does not introduce a nested card.

## Accessibility

- The ellipsis button exposes `aria-label="Session actions"` and `aria-expanded`.
- The menu uses `role="menu"` and its destructive command uses `role="menuitem"`.
- Escape and outside-click behavior close the menu.
- The confirmation remains keyboard accessible through Angular Material.
- Feedback keeps the current polite status or assertive error live-region behavior.
- Existing reduced-motion behavior remains unchanged.

## Verification

Frontend tests will cover:

- host-admin visibility only for completed sessions;
- manager and non-completed-session exclusion;
- menu open and close behavior;
- cancellation without deletion;
- confirmed deletion, loading state, and history redirect;
- failed deletion with visible error feedback; and
- shell-aware feedback positioning without layout-flow participation;
- application typography and single-row mini-game menu options;
- the centered host mini-game empty state;
- player history filtering and history-toggle fallback; and
- completed-only timeline/player ordering while active ordering remains unchanged.

The database regression test will verify that deleting a completed session removes its tables, participation, transactions, and time calls while retaining the registered player record. Existing Angular, Edge Function, database, and production build checks will run before completion.

The UI will be rendered and checked at mobile widths first, with a desktop sanity pass. No new migration is expected because the required production RPC and cascading relationships already exist; this will be revalidated before completion.
