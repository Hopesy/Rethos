# Scheduled CI stability

## Current state

Fix the failures in scheduled runs 44855720610 and 44660317128 on `d2983df4b`.
Worktree: `rethos-ci-stability`, branch `codex/ci-stability`. Preserve the existing desktop checkout. Use isolated fixtures; diagnostic scripts and logs belong under `.Rethos-temp/`.

## Work

- [x] Verify macOS cleanup order fix on the native runner: `use-my-mac` removed its directory before closing background sharing; ENOTEMPTY skipped close and left its process alive. The complete Electron suite and five extra runs of the affected file passed.
- [x] Make Windows CUA extraction reliable: tar.exe extracts the verified archive; clean runner startup, version check and embedded host smoke passed.
- [x] Isolate Openbox configuration and preserve startup diagnostics. Five X11 smoke runs passed on the updated native runner; the original early exit was not reproduced in the focused runs.
- [x] Fix extra CLI probes: background manifest updates refresh catalogs without invalidating CLI status; verification homes use the bundled manifest.
- [ ] Wait for positive native window measurements after clearing emulation and after new-tab navigation; cache successful viewport changes. The first frame-based approach passed one full CI but a later PR container run exposed a zero-size new tab. The refined implementation passed all 65 local real/fake Chrome tests; awaiting PR CI.
- [x] Replace file-event-only phone fixture waits with bounded real-time polling. Route and viewer tests passed (92 tests).
- [ ] Run affected regression tests and platform CI against the resulting commit.

## Evidence

Both scheduled runs tested the same commit. The macOS Electron test step timed out at five minutes in both. The November 21 run also failed Windows CUA version verification, Linux Openbox startup, engine status probe counts and browser viewport restoration. The November 20 run additionally timed out in the phone hold route test.

Native diagnostic runs: 44883267186, 44884120402, 44884522268, 44885043434. Detailed logs are under `.Rethos-temp/ci-stability/`. The native macOS process inspection exposed ENOTEMPTY in the saved-Off test teardown. Windows failure left only the ZIP after PowerShell extraction; tar.exe passed on a clean Windows runner. X11 and Linux browser checks passed across multiple clean runs. The X11 smoke now uses an isolated Openbox home and preserves startup errors.

Local: typecheck and lint passed; engine/registry/control fixture tests passed (43); browser/phone tests passed (92); real Chrome page and viewer suites passed. Source guards found core.ts crossed the 1000-line limit by one; removed an obsolete descriptive comment, then recheck.

Focused native verification: https://github.com/Hopesy/Rethos/actions/runs/44885535955 passed all macOS, Windows and Linux jobs. The temporary investigation workflow and script have been removed.

Complete CI: https://github.com/Hopesy/Rethos/actions/runs/44885537143 passed on 036ecbf58 (all required jobs, all three platforms).

PR https://github.com/Hopesy/Rethos/pull/1: the first PR run 44885955175 exposed a Google Android archive connection timeout, a zero-size new Chrome tab/container viewer frame failure, and a Windows VM fixture restart timeout. Those download and VM failures passed on the next run (44888052872), whose only failure was a Windows viewport size race.

The browser waits for positive measurements, fits new tabs after navigation and serializes native window fitting. A deterministic regression delayed the earlier CDP request: before serialization the final size was the old 1500x1000; after serialization it is the requested 1280x800. Local browser suite: 65 passed, one intermittent scroll-frame size failure; the complete viewer suite and regression then passed (11 tests). Typecheck/lint passed.

Run 44890703112 passed every job except Windows browser S4. The added inner<=outer guard was invalid for its Windows Chrome (inner width 1296, outer width 1280); removed that guard, retaining positive-size waiting and serialized fitting. Next: validate final PR CI, update review evidence, mark PR ready.
