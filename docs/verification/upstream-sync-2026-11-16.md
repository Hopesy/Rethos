# Upstream integration — 2026-11-16

Integrated `milind-soni/OpenMausBot` through
`70e386ade941a3c0be6270cf2be17d9bf02765f9` on top of the computer-card
restoration in `9e75f735e`.

The follow-up integration brings in `acecd9bced972caf1677aef8e0d92940fddd9b56`
(89 additional upstream commits, including merged branch history). It follows
`21cc913b5`, which records project-bot file coordination, result collection,
memory updates, and continuous solo/team goals without the 13-turn ceiling.

## Follow-up scope

- Retained cross-server bot coordination, bidirectional handoff files, result
  delivery and requester continuation. Pairing uses the owner of a self-hosted
  server, with a dedicated token restricted to the bot-link routes. The
  commercial My Cloud account adapter and its combined sidebar/create-bot UI
  are excluded. Self-hosted pairing is available through the server API;
  automatic pairing through the desktop UI is not part of this integration.
- Retained persistent Always allow checks, schedule conversation reuse, bulk
  title regeneration, custom OpenAI-compatible Live endpoints, per-bot voices,
  Fish language selection, decision-model chat protocol and OpenRouter caching.
- Retained Antigravity quota reporting and runtime compatibility, OpenCode
  free-model reset handling, macOS system proxy discovery, desktop paste,
  Gmail pagination, browser startup diagnostics, credential-card visibility,
  and caller hints for user-managed MCP servers.
- Existing commercial removals remain in place. Deleted the unused ModelGo
  sponsorship card and telemetry helper, removed its sponsored settings note,
  and changed its provider link to the ordinary site URL. User-configured
  providers and API keys remain available.
- Extended `check:oss` to reject reintroduction of the removed account-bound
  bot-link adapter, combined-place UI, and promotional helper.

## Follow-up verification

Evidence is under `.Rethos-temp/main-integration/`.

- Changed-module run: 1,505 tests, initially 1,498 passed, five failed and two
  skipped. All five failures were resolved and rerun: stable device credentials
  across re-pairing, retired poll rejection, test-time timezone isolation,
  pairing error translations, and server-only smoke environment classification.
- Core regression run: 164 tests; 162 passed initially. The two catalog golden
  mismatches were refreshed for the new schedule description (10 extra bytes,
  unchanged size budget). A normal run of both catalogs and shared-computer
  regressions then passed all 139 tests.
- Seven real-server workflow tests passed, including two self-hosted servers
  handing work and files in both directions, default-bot project setup and
  memory collection, and conversation title regeneration.
- Twenty-four Electron connector/MCP tests passed. All 369 top-level Electron
  modules passed syntax checks; changed runtime modules passed undefined-name
  checks with Node/browser globals configured.
- Connected-computer integration passed discovery, session tail reads, Full
  access, directory approvals and denial, Stop, work targets, device isolation,
  pause/resume, and revocation surviving connector restart.
- TypeScript, lint, all 16 locale catalogs, OSS checks, renderer build, server
  bundle, and packaged-server smoke passed. Packaged smoke covered startup
  without repository dependencies, all 14 proxy paths, MCP, doctor/bots,
  encrypted backup, loopback trust and desktop compile-cache startup.
- Ego browser against an isolated fake-engine server: onboarding, Simple and
  Advanced navigation, new-bot menu and AI settings rendered; commercial
  account/purchase entries were absent. Screenshot: `settings-ai.png`.
- The browser test server was stopped. Automatic command review refused removal
  of its disposable directory with `blocked by policy`; the directory remains
  at `C:/Users/zhouh/AppData/Local/Temp/openmausbot-verify-data-tn160U`.

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

## Release 0.1.163 follow-up

The full CI run on `2858a5d55` exposed integration failures beyond the initial
focused checks. Release preparation repaired the shared transfer fixtures,
renderer preview imports, bot and department pause guards, desktop-control
transition guards, settings focus and phone deep links, and completed the
Simplified Chinese catalog. Official paid-cloud migration fixtures were removed;
self-hosted transfer, sharing, permissions and private-desktop coverage remain.

Local evidence is under `.Rethos-temp/release-0.1.163/`. The broad affected-module
run passed 1,394 tests; its three remaining assertions were repaired and checked
in their individual modules. The 66 shared-VM control cases, secret-card flow,
tool-group isolation and relayed conversation continuation were exercised against
disposable servers. Source guards, type checks, lint and locale validation were
also run. Ego verified the real preview entry, chat, Settings, custom model
connections and private-desktop hover help in Daylight and Midnight.

Public release acceptance requires CI, Docker and both client packages to pass
on the final source commit, followed by public asset and deployment verification.
The release history records that final outcome.
