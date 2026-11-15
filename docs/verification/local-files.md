# Local session files over MCP

The Rethos deployment has since migrated to the [native connected computer](connected-computer.md).
The standalone read-only MCP is retained as an optional fixed-root client entry.

The standalone server in `deploy/local-files/` shares explicitly configured
directories over stdio. It reuses the desktop file containment and descriptor
checks, with bounded reads for large session logs.

## Regressions

```powershell
pnpm exec vitest run scripts/local-files.test.mjs
node --test electron/shared-computer-access.node-test.mjs
node --test electron/lending-guards.node-test.mjs electron/lent-mcp.node-test.mjs
pnpm exec oxlint --deny-warnings electron/shared-file-path.mjs electron/shared-computer-access.mjs deploy/local-files scripts/local-files.test.mjs
```

The file tests create and remove their own directories inside
`.Rethos-temp/local-files/unit/`. They cover paginated metadata, files larger
than 2 MiB, head/tail reads, appended records, replacement/truncation errors,
UTF-8 byte boundaries, path traversal, sibling credentials, junctions,
hard links and stdio discovery. Mutation names are refused.

## Isolated conversation recipe

Build the bundle into `.Rethos-temp/local-files/local-files.mjs`. Set the
verification process's `TEMP`, `TMP` and `TMPDIR` to an owned directory under
`.Rethos-temp/local-files/`, then use `launchVerificationServer()`.

1. Create a synthetic session directory and a JSONL fixture larger than
   2 MiB inside the fixture data directory, with distinct project and status
   markers at its head and tail. Write a roots configuration for that directory.
2. Start a loopback OpenAI-compatible provider that requests `list_roots`,
   `list_files`, `read_file` at offset zero, and `read_file` with `tail: true`.
   Check each result before requesting the next operation.
3. Register the bundled MCP through `POST /api/mcp/servers`, run its `/test`
   route, and enable it through `PATCH`. Configure the fixture bot's model
   through `control-omb set-model`.
4. Run `control-omb send`, `wait` and `messages` with the explicit fixture
   URL and task. Require the settled state, all four successful tool results,
   both markers in the provider results, and the final bot reply. Compare
   the synthetic file with its original bytes.
5. Preserve command results and the fixture log path, then close the fixture.

The 2026-11-15 run passed all four tool calls through a real Rethos conversation
using a synthetic provider. Evidence is in
`.Rethos-temp/local-files/verification.json`, with the exact driver in
`.Rethos-temp/local-files/verify.mjs`. The fixture log lives under
`.Rethos-temp/local-files/integration/openmausbot-verification-evidence/`.
The standalone regressions passed 4 tests; desktop file access passed
31 tests with 2 platform skips; lending compatibility passed 24 tests.

## Deployment acceptance

After isolated validation, the authorized deployment added `zhouh-local-files`
to the existing Rethos 0.1.160 server. The local installation is
`C:\Users\zhouh\agent\rethos-local-files`; the VPS fixed proxy is
`/home/zhouhl/rethos-local-files/files-proxy`. Container credentials and SSH
configuration live in `/data/.ssh/rethos-local-files/` on its persistent volume.

Read-only checks exercised the complete container → VPS → Windows connection:

- Three configured roots were listed: Codex sessions, Codex archived sessions,
  and Claude Code projects.
- A Codex session larger than 3 MiB and a Claude session were each read at the
  head and tail. Evidence retains byte counts and hashes, without session text.
- Rethos's MCP discovery returned all three tools. The server is enabled and
  visible to Rethos, Zelos, XDTerminal, XDTag, XDForge and XDTrace under their
  existing tool settings.
- The existing CUA MCP entry was preserved. No production chat was sent for
  verification, and no monitoring routine was created or resumed.

Local evidence: `.Rethos-temp/local-files/remote-probe.json` and
`.Rethos-temp/local-files/production-verification.json`. Deployment backups
are retained locally and at
`/home/zhouhl/rethos-local-files/backup-20261115T051946Z/`.

The machine and its existing SSH tunnel must remain online for reads. On a
subsequent bot turn, request `zhouh-local-files` by name or use its tool search
entry if the provider catalog is deferred.
