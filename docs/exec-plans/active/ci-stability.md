# Scheduled CI stability

## Current state

Fix the failures in scheduled runs 44855720610 and 44660317128 on `d2983df4b`.
Worktree: `rethos-ci-stability`, branch `codex/ci-stability`. Preserve the existing desktop checkout. Use isolated fixtures; diagnostic scripts and logs belong under `.Rethos-temp/`.

## Work

- [x] Verify macOS cleanup order fix on the native runner: `use-my-mac` removed its directory before closing background sharing; ENOTEMPTY skipped close and left its process alive. The complete Electron suite and five extra runs of the affected file passed.
- [x] Make Windows CUA extraction reliable: tar.exe extracts the verified archive; clean runner startup, version check and embedded host smoke passed.
- [x] Isolate Openbox configuration and preserve startup diagnostics. Five X11 smoke runs passed on the updated native runner; the original early exit was not reproduced in the focused runs.
- [x] Fix extra CLI probes: background manifest updates refresh catalogs without invalidating CLI status; verification homes use the bundled manifest.
- [x] Synchronize browser window measurement with layout frames and cache successful viewport changes. Real Chrome suites passed locally and on Linux.
- [x] Replace file-event-only phone fixture waits with bounded real-time polling. Route and viewer tests passed (92 tests).
- [ ] Run affected regression tests and platform CI against the resulting commit.

## Evidence

Both scheduled runs tested the same commit. The macOS Electron test step timed out at five minutes in both. The November 21 run also failed Windows CUA version verification, Linux Openbox startup, engine status probe counts and browser viewport restoration. The November 20 run additionally timed out in the phone hold route test.

Native diagnostic runs: 44883267186, 44884120402, 44884522268, 44885043434. Detailed logs are under `.Rethos-temp/ci-stability/`. The native macOS process inspection exposed ENOTEMPTY in the saved-Off test teardown. Windows failure left only the ZIP after PowerShell extraction; tar.exe passed on a clean Windows runner. X11 and Linux browser checks passed across multiple clean runs. The X11 smoke now uses an isolated Openbox home and preserves startup errors.

Local: typecheck and lint passed; engine/registry/control fixture tests passed (43); browser/phone tests passed (92); real Chrome page and viewer suites passed. Source guards found core.ts crossed the 1000-line limit by one; removed an obsolete descriptive comment, then recheck.

Focused native verification: https://github.com/Hopesy/Rethos/actions/runs/44885535955 passed all macOS, Windows and Linux jobs. The temporary investigation workflow and script have been removed.

Complete CI: https://github.com/Hopesy/Rethos/actions/runs/44885537143 is running against 036ecbf58. The remaining changes only remove diagnostic files and update this record. Next: inspect all results, resolve any regressions, and record final evidence.
