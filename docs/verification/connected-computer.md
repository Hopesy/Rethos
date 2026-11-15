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

The fixtures prove the server/desktop permission and card-answer workflow.
Their deterministic providers and synthetic desktop use no production chat or
live screen mutations. Live deployment checks inspect computer registration
and discover CUA tools read-only; file-write acceptance stays in the fixtures.

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
