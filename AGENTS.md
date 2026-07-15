# PokerTracker Agent Guide

## Core Principles

- Treat PokerTracker as a production application. Prefer the smallest focused change that fully solves the request.
- Read the relevant existing code first and follow established Angular, Supabase, styling, and testing patterns.
- Do not silently broaden the task into unrelated refactoring, redesign, documentation, or cleanup.
- Do not mark work complete until the requested behavior is implemented and meaningfully verified, or any blocker is stated plainly.
- Preserve user changes. Never revert, overwrite, or clean up unrelated work unless explicitly asked.

## Task Size and Model Guidance

- Scale the workflow to the task instead of applying the same ceremony to every request.
- **Tiny:** Copy changes, small CSS adjustments, logo sizing, removing text, checking ports, and basic command explanations. Use targeted inspection, make the direct change, and run one focused verification. Do not add optional planning documents, worktrees, broad repository scans, or full test suites.
- **Standard:** Contained bugs or features that affect a small number of files. Inspect the affected flow, use a short plan only when it adds clarity, run targeted tests first, and broaden verification only when justified.
- **High risk:** Database migrations, authentication, RLS, production data, security, complex cross-feature bugs, broad features, and go-live work. Use explicit planning, deeper reasoning, and comprehensive verification.
- If the user appears to be using a high/ultra reasoning model for a tiny task, briefly suggest a lighter model before proceeding. Keep this to one sentence and do not make it a blocker.
- Reserve high/ultra reasoning for work where deeper planning or risk analysis can materially improve the result.
- If the task grows materially beyond the original request, pause and explain the added scope before continuing.

## Skill Usage

- Check whether a relevant Codex skill applies before acting, and use the smallest set that directly helps the task.
- Use systematic debugging for actual bugs, failed tests, unexpected behavior, or an unclear root cause.
- Use Supabase guidance for database, Auth, RLS, RPC, Edge Functions, Realtime, Storage, or migration work.
- Use frontend design or Impeccable guidance for meaningful UI design, redesign, critique, or polish work. Do not add an optional design workflow to a fully specified tiny edit.
- Use planning workflows for ambiguous, multi-step, or high-risk work, not as default ceremony for tiny tasks.
- Use branch-finishing and verification skills when completing, merging, or publishing substantial work.
- Avoid invoking multiple overlapping skills when they do not improve the outcome.

## Speed and Scope Control

- Start with `git status`, the current branch, and targeted `rg` searches for the smallest likely file set.
- Read focused files and diffs before scanning the full repository.
- Avoid dumping large logs, generated files, DOM snapshots, screenshots, or full diffs unless they are needed to diagnose or verify the task.
- Run the narrowest meaningful test first. Save broader tests and builds for completion or higher-risk changes.
- Do not repeat the same failed command without changing the approach or learning something new.
- For long tasks, give concise progress updates and keep a short record of decisions, tests, blockers, and the next step.
- Report any development server or other long-running process that remains active.

## UI and Mobile Work

- For layout or UI fixes, default to mobile-first unless the user specifies another viewport.
- Verify the rendered app after UI changes. Check 360px and 390px mobile widths when practical for mobile-facing work.
- If browser automation or visual verification fails, say so directly instead of implying it happened.
- Keep UI changes consistent with the existing product unless a redesign is explicitly requested.
- When confirmation is required and a selection control is available, use a Yes/No choice instead of asking the user to type `confirm`.
- When local development uses the login shortcut, sign in with the full Supabase email when testing production data paths.

## Supabase and Production Safety

- For database-backed features, do not mark work complete until the required Supabase migration has been applied or the blocker is stated plainly.
- Test migrations, schema, RLS, RPC, and pgTAP changes locally with Supabase and Docker when available.
- When local Supabase is available, use `supabase db reset`, `supabase test db`, and `supabase db lint` as relevant.
- When the user says "sync data," treat it as copying production data into local/development for preview or testing only.
- Prefer read-only production access and local/development-only writes during data sync or testing.
- Never mutate or delete production data, expose secrets, use service-role credentials, or run destructive database operations unless explicitly authorized.

## Testing and Completion

- Match verification to risk: rendered checks for UI, focused tests for logic, Supabase checks for database work, and broader tests for shared or production-facing changes.
- Use `npm.cmd run test:ci`, `npm.cmd run build`, `npm.cmd run build:prod`, and `git diff --check` when relevant; do not run every command mechanically for tiny changes.
- Before finishing, review the diff for unrelated edits, risky behavior, missing migrations, and missing tests.
- Clearly report what was tested, what was not tested, and why. Never imply a check passed if it was not run.
- A task is done only when the requested result works, relevant checks pass, and remaining limitations or blockers are disclosed.

## Git and Go Live

- Keep feature work on a feature branch or worktree when isolation is useful. Do not create one automatically for a tiny edit unless requested or needed to protect existing work.
- Do not commit, merge, push, or open a pull request unless the user requests that action.
- When the user says "go live," finish the current feature branch, run relevant tests, resolve conflicts, merge it into `main`, verify the integrated result when needed, and push `main` to origin/GitHub unless explicitly told otherwise.
- Do not hide merge conflicts, failed checks, skipped migrations, or deployment blockers.

## New Tasks and Handoffs

- Recommend a new task for an independent feature when the current conversation has become large or the existing feature is complete.
- A completed, verified, and integrated feature does not require a handoff.
- When unfinished work moves to a new task, provide a concise handoff containing the goal, branch/worktree, changed files, decisions, tests run, blockers, and exact next step.
