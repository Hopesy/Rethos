# Bot coordination across self-hosted servers

The bot-link service joins bots on this computer with bots on a server owned by
the same person. It provides `list_bots` discovery, `coordinate_bots` dispatch,
file delivery, result files and continuation of the requesting conversation.
No official cloud account, plan or purchase service is used.

The current desktop UI retains its saved-server navigation. Bot-link setup is
an operator API workflow:

1. Read the computer's environment ID from
   `GET /.well-known/openmausbot/environment`.
2. With the owner's authenticated session on the self-hosted server, call
   `POST /api/bot-link/pair` with
   `{ computer: { id, name }, name: "My server" }`.
3. The response contains `token` and `place`. From the trusted local desktop
   connection, call `PUT /api/bot-link` with
   `{ on: true, origin, token, name: "My computer", cloud: place }`.
   The remote origin must use HTTPS; loopback HTTP is supported for fixtures.
4. Read `GET /api/bot-link` locally to check `on`, `online`, `peer` and `bots`.
5. Turn it off locally with `PUT /api/bot-link` and `{ on: false }`, or revoke
   it remotely with `DELETE /api/bot-link/pair?computer=<environment-id>`.

Treat the returned link token as a credential. The server limits it to sync and
file-transfer routes; ordinary bot, authentication and workspace APIs reject
it. Shared-workspace membership does not qualify as personal ownership.

Run the isolated acceptance fixture:

```sh
pnpm exec vitest run server/bot-link.e2e.test.ts
```

It starts two throwaway servers with fake providers, verifies owner-only
pairing, dedicated-token restrictions, handoffs and file contents in both
directions, requester continuation, backup admission during long polling, and
token revocation. It closes both servers on completion. Never run this recipe
against the user's live workspace.
