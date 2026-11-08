# Hosted workspace sign-in and revocation

Rethos ships the standalone OSS edition. The upstream proprietary hosted
identity adapter has been removed together with the integration tests that
imported it. Its protocol and licensed deployment behavior are described in
the [upstream recipe](https://github.com/milind-soni/OpenMausBot/blob/main/docs/verification/hosted-workspaces.md).

## OSS access checks

Use [the isolated verification entry point](README.md). The Apache core keeps
its access-control checks: a workspace configured for hosted sign-in without
an adapter fails closed. Ordinary standalone pairing and email sign-in keep
their existing behavior.

```sh
pnpm check:oss
pnpm exec vitest run server/enterprise.test.ts server/email-signin.test.ts server/sessions.test.ts server/request-auth.test.ts
pnpm test:packaged-server
```

Verify that `/api/edition` reports `oss` with an empty feature list, and that
`/api/health/hosted` remains unavailable. The packaged smoke checks the
standalone service trust gate and confirms the absence of enterprise artifacts.
