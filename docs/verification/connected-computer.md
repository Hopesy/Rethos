# Connected computer permissions

The native shared-computer connection carries files, commands and desktop
tools. An owner connection may opt in to `botPermissions`; older grants keep
their existing behavior. The server derives each file scope from the current
bot/conversation, and the desktop rechecks its locally saved opt-in.

## Regression commands

```powershell
pnpm exec vitest run server/computer-permissions.test.ts server/shared-computers.test.ts server/your-computer-consent.test.ts server/environment.test.ts server/token-login.test.ts scripts/local-files.test.mjs
pnpm exec vitest run server/shared-computers.e2e.test.ts server/drivers/agents-catalog-wire.test.ts server/drivers/agents-bridge-wire.test.ts
node --experimental-strip-types scripts/verify-connected-computer.mjs
node --test electron/shared-computer-access.node-test.mjs electron/computer-sharing-races.node-test.mjs electron/lending-dialogs.node-test.mjs
pnpm typecheck
pnpm build
```

Generate catalog goldens sequentially before checking them; a writer and a
reader running together can compare against different versions of the files.

## Isolated end-to-end recipe

The maintained driver is `scripts/verify-connected-computer.mjs`, also run by
the Windows release workflow. It builds the standalone connector, keeps all
temporary files under `.Rethos-temp/connected-computer/`, and launches with
`launchVerificationServer({ FAKE_CLAUDE_MODE: "hang" })`.

Pair an owner session; create synthetic session and project directories;
connect through `createComputerSharing().lendOwn()` with `botPermissions`;
start fixture bot turns with `control-omb send`. Drive the real injected agents
MCP while the synthetic provider holds the turn. The bundled variant starts
the distributable connector as a separate process, with a synthetic CUA stdio
server. Approvals are answered through the normal authenticated `/respond`
route, and cancellation uses `control-omb interrupt`.

Required observations:

- `list_shared_computers` returns one computer with its capabilities.
- Full access reads a multi-megabyte session tail, writes in another directory,
  and runs a command without an authorization card.
- Ask reads a preset folder directly. A new directory raises a permission
  card; Allow covers that directory for that bot's current request. A write
  upgrade raises a new card; Deny leaves the file unchanged.
- A forged `file_scope` in model arguments fails schema validation.
- Stop cancels a pending request before any command executes.
- In the bundled run, desktop tool discovery and execution go through that
  same computer's native CUA adapter.
- Restarting the bundled connector preserves locally revoked access.

Both variants passed on 2026-11-15. Evidence is in
`.Rethos-temp/local-files/native/verification.json` and
`.Rethos-temp/local-files/native/bundled-verification.json`, including control
commands and the isolated server log paths. Additional regressions cover
bot/request grant separation, Full-to-Ask dispatch invalidation, a desktop
grant changed during approval, and shared ownership between a token and its
browser login.

The scheduled-monitor regression in `server/shared-computers.e2e.test.ts`
re-registers the same owner's desktop as it leases a file read. The scheduled
bot must receive the actual file contents; its delegated bot must lose access
when the monitor is paused or the owner's token is revoked.

The fixtures prove the server/desktop permission and card-answer workflow.
Their deterministic providers and synthetic desktop use no production chat or
live screen mutations. Live deployment checks inspect computer registration
and discover CUA tools read-only; file-write acceptance stays in the fixtures.

## Deployment record, 2026-11-16

Version 0.1.162 runs from source `e0f01c55a7b17e370a84951aeee1ca29f91ec7ee`, pinned to `ghcr.io/hopesy/rethos@sha256:4ff2de694a954136c282a322a77383659d08d34ebb78e3e585c15941aee4da70`. The complete pre-upgrade configuration and stopped data volume are backed up at `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.162-20261115-185434`. Server and Caddy were recreated together, and public health, version and UI assets were checked afterward.

The installed Windows connector was backed up and replaced from the same source. Computer `zhouh` kept its ID, secret, config and three read-only session folders. It reconnected with terminal, screen and per-bot permissions intact. All six bots can select that device through their work-target API. Original token access, six bot configurations, two routine schedules and enabled states, and seven memory/role file hashes matched the pre-upgrade snapshots. The old CUA/file MCP entries remain removed.

Evidence: `.Rethos-temp/release-0.1.162/` contains `deployment.log`, `connector-upgrade.json`, `preservation-after.json`, `memory-after.json`, `computer-production.json`, `targets-production.json` and `web-production.json`. See the [release history](../histories/client-releases.md) for fixed-source CI and public-download verification.

## Deployment record, 2026-11-15

The VPS runs the official 0.1.161 image from source
`e3d2b1b714c4a2c84612ca0e5d2829af7a19e0c6`, pinned to multi-platform digest
`sha256:54fa5c6a610abcf14d582b6d495fe51ac4a1bd2bf1010e6438da98172e1cd9b7`.
Both the environment and Compose override select that image. The previous
configuration and complete data volume are backed up in
`/home/zhouhl/rethos-backups/rethos-before-clients-0.1.161-20261115-091930`.
Caddy shares the server's network namespace: recreating the server requires
recreating Caddy as well. The public health endpoint returned 200 afterward.

The Windows connector is installed in
`C:\Users\zhouh\agent\rethos-connected-computer`, started hidden through the
existing `BackgroundLauncher.exe`, and registered in the current user's Startup
folder. Its saved computer ID is `7a99cb9d-e93a-413b-805e-2d0a3154c726`, named
`zhouh`. Server registration confirms online file, terminal and screen access.
The installed CUA adapter discovered 33 desktop tools without performing a
screen action. Existing session folders are the ordinary-mode read grants;
Full access is evaluated for each requesting conversation.

The old `zhouh-desktop-cua` and `zhouh-local-files` MCP entries have been removed
after native connection verification.
Their prior configurations are retained in
`.Rethos-temp/local-files/native/mcp-before-migration.json`. Read-only online
evidence is in `native/production-verification.json` and `native/cua-probe.json`
under the same evidence directory. The six existing bots reported Full access.
Removal verification is recorded in `native/mcp-removal.json`: neither old
entry remains, and the same native computer remains online with its three
default folders, terminal and screen capabilities.

The official release retained the same computer ID and reconnected it
automatically after the server restart. Post-deployment checks confirmed
version 0.1.161, all six bot configurations, both routine schedules and enabled
states, the original access token, three read-only folders and the removal of
both old MCP entries. Evidence is in
`.Rethos-temp/release-0.1.161/computer-production.json`,
`preservation-after.json`, `web-production.json` and `deployment.log`.

Regression results: 66 file/permission/session/environment tests, 103 catalog
and native-connection tests, and 46 desktop tests passed, with 2 platform skips.
Type checks, server/UI builds, scoped lint and locale validation passed.

## Self-hosted scheduled computer access

On a personal self-hosted server, saving a routine from an authenticated owner
session records its author, instructions, target, attachments, schedule and
enabled decision in `computer-routines.json`. An authorized bot creating or
editing a routine records that same requester. Existing routines acquire this
record when their owner opens the editor and saves the instructions.

Each computer call checks the current run and turn generation, the live owner
session and the unchanged authorization record. A project bot obtains the
routine's authority through the coordinator's live parent chain. Pause, Stop,
changed instructions, token revocation, a foreign message or a completed
delegation invalidates it. Pending desktop operations also recheck the
principal before continuing. The scheduler remains unchanged.

An access token and the browser sessions derived from it retain the same
lending identity. Separate tokens stay separate; unrelated paired devices
continue to use the existing personal-server ownership rules.

Verification on 2026-11-17:

- `server/shared-computers.e2e.test.ts` launches the existing isolated server,
  logs a browser in with a synthetic owner token, connects a native sharing
  client, and waits for a real interval occurrence. The coordinator and a
  delegated project bot both read a planted session file through their injected
  agents MCP. Pausing the routine and revoking the token deny both callers.
- `server/host/computer-routine-access.test.ts` covers persisted author records,
  changed run snapshots, stale generations, one-time schedule consumption,
  explicit pause, manual initiators, Webhook/API exclusion and foreign messages.
- The related seven-file run passed 82 tests. One existing cloud-lending test
  requires Windows file-symlink privileges unavailable on this host; it was
  explicitly excluded after its `EPERM` result. The subsequent operation-lease
  test, type checks, scoped lint, OSS check and server build passed.

Run the new path with:

```powershell
pnpm exec vitest run server/shared-computers.e2e.test.ts server/person-key.test.ts server/host/computer-routine-access.test.ts server/host/shared-computer-turn.test.ts
```

Evidence is under `.Rethos-temp/computer-routine-access/runtime/`.
The complete native run's retained receipt is
`openmausbot-verification-evidence/server-1794894419725-45200.log.computer-sharing.json`.

## Work target selection

Bot defaults and conversation pins use the owner-scoped work-target API. A connected target carries a stable computer ID and optional working folder; Windows folders are validated with Windows path rules. Clearing a conversation pin follows the bot again. Off applies to files, terminal and desktop operations.

The native fixture also covers target selection, a second device, offline refusal, pause/resume and persisted revocation. The browser verification exercises the real WorkTargetPicker, AccessSection, ComputerPanel and ConnectedComputers against an isolated server. Check persistence after reload, simple/advanced transitions, the conversation Off/follow flow, server-scoped pause/resume, keyboard-accessible help and a 390px viewport. Evidence for 0.1.162 is stored in .Rethos-temp/work-location/browser-verification.json and target-mobile.png.

The work-location picker keeps named connected computers, inherited bot defaults
and managed locations in the same card grid. Its visible panel refreshes after
connection changes and on focus; leaving the panel stops its polling. The
regressions in `src/components/WorkTargetPicker.test.ts` cover late connection,
pause status, inherited automatic selection and saved folders. A disposable
server and native sharing client exercised those operations through the real
renderer, including reload, both interface modes, Daylight/Midnight and a 390px
viewport. Evidence is under `.Rethos-temp/work-target-picker/`.

## Connected computer panel regression, 2026-11-17

Selecting a connected computer retains the shared computer-panel shell: Screen,
Browser, Data and Files in Simple mode, with the existing Routines and connected
phone tabs in Advanced mode. The device changes the Screen contents; the other
views, close button, resizing and keyboard navigation keep their normal behavior.
Managed desktop discovery, provisioning and preview polling stay inactive for a
connected target, including conversation pins over a private-desktop default.

Named devices appear once in the work-location card grid. Bot access settings,
the Where page and the Screen panel omit the duplicate connected-device list.
Global computer settings retain pause, resume and revoke controls. The Simple
mode Screen shortcut opens the bot's schedule through the normal routines page.

The 14-file regression run passed 123 tests; the final tab cases cover both bot
defaults and conversation pins, all retained tabs, a single named-device card,
the schedule shortcut and absence of managed-desktop requests. Type checks,
scoped lint and the source-size ratchet passed. An isolated server with a native
sharing client exercised the real renderer through ego-browser: browser settings,
all panel tabs, both modes, directory persistence through reload, keyboard
navigation, close/reopen, pause/resume, Daylight/Midnight and a 390px viewport.
Evidence and screenshots are in `.Rethos-temp/computer-panel-repair/`, including
`browser-verification.json`. The fixture uses synthetic data and has no live
browser engine installed; it verifies the browser settings and installation entry.
