# Navigation Slide And Rebuy Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove visible overlap from session history/detail transitions and keep the rebuy comment field at the bottom.

**Architecture:** Retain Angular View Transitions and the existing route-direction logic. Correct only the snapshot geometry and clipping in global CSS, then reorder the standalone rebuy dialog template with a DOM-order regression test.

**Tech Stack:** Angular 20, TypeScript, Jasmine/Karma, CSS View Transitions

## Global Constraints

- Mobile is the primary layout and verification target.
- Shell tab switching remains unanimated.
- Top and bottom navigation remain stationary.
- No database or Supabase changes are required.

---

### Task 1: Rebuy Dialog Field Order

**Files:**
- Create: `src/app/features/host/transactions/rebuy-dialog.component.spec.ts`
- Modify: `src/app/features/host/transactions/rebuy-dialog.component.ts`

**Interfaces:**
- Consumes: `RebuyDialogComponent`, `MAT_DIALOG_DATA`, and `MatDialogRef`
- Produces: DOM order `customRebuy` before `rebuyComment`

- [ ] **Step 1: Write the failing DOM-order test**

Create the component with dialog providers, render it, collect `label[for]` values, and expect `customRebuy` to appear before `rebuyComment`.

- [ ] **Step 2: Run the suite and verify the new test fails**

Run: `npm.cmd run test:ci`

Expected: FAIL because the current order is `rebuyComment`, then `customRebuy`.

- [ ] **Step 3: Move the comment block below the custom amount block**

Keep all controls and behavior unchanged; only reorder the two template blocks.

- [ ] **Step 4: Run the suite and verify the test passes**

Run: `npm.cmd run test:ci`

Expected: all tests pass.

### Task 2: Full-Width Route Slide

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `data-route-transition="forward|back"` and `pokertrack-route-content`
- Produces: adjacent full-width forward and backward snapshot motion

- [ ] **Step 1: Correct the transition geometry**

Set the route transition group to clip overflow. Change outgoing forward motion from `-20%` to `-100%` and incoming backward motion from `-20%` to `-100%`; retain the existing `100%` entry/exit values on the opposite side.

- [ ] **Step 2: Verify code quality and the production build**

Run: `npm.cmd run test:ci`, `npm.cmd run build`, and `git diff --check`.

Expected: all tests pass, build exits zero with only established budget warnings, and diff check is clean.

- [ ] **Step 3: Verify the running mobile app**

Open session history, enter a session, return to history, and confirm the snapshots move side-by-side without overlap while both navigation bars stay fixed. Open Rebuy and confirm Comment is below Custom amount.
