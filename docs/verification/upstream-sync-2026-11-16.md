# Upstream integration — 2026-11-16

Integrated `milind-soni/OpenMausBot` through
`70e386ade941a3c0be6270cf2be17d9bf02765f9` on top of the computer-card
restoration in `9e75f735e`.

## Product behavior retained

- The original three-column Simple and two-column Advanced computer cards.
  Selecting the current computer and switching modes preserve its working
  directory.
- Rethos identity, release source, Android download, and token sign-in.
- The workspace's default bot keeps its tools and memory enabled, including
  the upstream `toolsOff` groups. Restricted ordinary bots keep their scopes.
- Connected computers use the same owner identity for registration, polling,
  visibility, work targets, and per-bot directory permissions.
- Long tasks retain per-request MCP response-frame budgets.
- Retired commercial hosting and purchase pages remain removed. Published
  apps use the person's own Netlify account.
- Cancelled/disabled routines retain their state during configuration migration.

## Verification

All server mutations used disposable fake-engine fixtures. No live workspace
or user credentials were used. Working evidence is under
`.Rethos-temp/upstream-merge/` and `.Rethos-temp/connected-computer/`.

Passed checks:

- TypeScript checks for the renderer, server, and phone protocol; lint; locale
  validation; OSS product checks; Electron syntax and undefined-reference checks
  on the modified runtime modules.
- Production renderer build and bundled server build.
- Packaged server smoke: startup without repository dependencies, all spawned
  proxy paths, MCP frames, doctor/bot commands, encrypted backup, trust gate,
  and desktop entry startup with compile cache.
- Actual Electron main startup in an isolated profile: renderer loaded with
  title `Rethos`, with no uncaught exceptions or unhandled rejections.
- Default-bot migration and API behavior, team creation, work-target selection,
  computer access and permissions, token login, continuation, MCP budgets,
  retired configuration, routine persistence, bot holds, desktop control leases,
  settings navigation, translations, and Netlify app management regressions.
- Catalog and bridge wire goldens, including the retired-hosting flags and
  tool-group profiles; wire-size baselines reflect the integrated catalog.
- `scripts/verify-connected-computer.mjs`: device discovery and tool execution,
  reading a large session tail, Full-access writes/commands, directory approval
  and denial, Stop cancellation, device isolation, offline refusal, server
  pause/resume, and revocation surviving connector restart.
- Ego browser: Simple/Advanced layouts, selected icons, dark/light themes,
  390px layout without horizontal overflow, retained working directory, and
  pause/resume status.

The broad Electron unit run reached 1,246 tests. Integration failures were
repaired and rerun in the affected modules. Three upstream cases require file
symlink creation that this Windows process lacks: `cloud-sync-scan`,
`elevated-install`, and `lent-staged`. Their original run stopped with `EPERM`
at fixture setup. The complete repository suite was not run.
