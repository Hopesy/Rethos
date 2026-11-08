# Enterprise layer loading and license expiry

Rethos excludes the upstream proprietary enterprise implementation and key
issuance tools. Release builds must contain no enterprise directory.

## Driving it

```sh
pnpm check:oss
pnpm exec vitest run server/enterprise.test.ts server/brand.test.ts server/license-expiry-api.test.ts
pnpm test:packaged-server
```

The Apache core compatibility tests create synthetic layers in disposable
directories to check feature gating, expiry behavior and access policy.
They do not require proprietary source or production license keys.

The packaged-server smoke verifies `/api/edition` reports `oss` with an
empty feature list even when an invalid legacy key is present. Docker and npm
checks also assert that no enterprise directory is shipped.

See [Rethos licensing](../../LICENSING.md) and
[standalone access checks](hosted-workspaces.md).
