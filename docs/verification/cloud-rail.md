# Saved server rail

The desktop rail switches between this computer and saved self-hosted servers. The add action opens server pairing or a server address.

Run `node --test electron/two-places.node-test.mjs electron/lending-target.node-test.mjs` for saved-place navigation and self-hosted ownership. Run `pnpm exec vitest run src/components/PlacesRail.test.ts` for the renderer. Use an isolated desktop fixture for any pairing mutation.

The connected-computer workflow and browser verification are described in [connected-computer.md](connected-computer.md).
