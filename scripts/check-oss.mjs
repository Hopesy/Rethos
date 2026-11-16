import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const relative of ["enterprise", "dist-server/enterprise", "release/npm/enterprise", "release/npm/dist-server/enterprise",
  "server/boat.ts", "server/cloud-credit-provider.ts", "server/included-services.ts", "server/host/cloud-plan-tier.ts",
  "server/host/starter-caps.ts", "server/pages/service.ts", "electron/cloud-account.mjs", "electron/cloud-buy.mjs",
  "electron/cloud-plan-ipc.mjs", "electron/bot-link-main.mjs", "electron/places-together.mjs",
  "src/components/NewBotPlaceItems.tsx", "src/lib/modelgo-offer.ts", "src/components/CloudAccountSettings.tsx", "src/components/OrganizationSettings.tsx"]) {
  assert(!existsSync(join(root, relative)), `Rethos OSS must exclude ${relative}; remove the stale enterprise source or build output.`);
}
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(pkg.name, "rethos");
assert.equal(pkg.productName, "Rethos");
assert.equal(pkg.repository.url, "https://github.com/Hopesy/Rethos.git");
const manifest = JSON.parse(readFileSync(join(root, "public", "manifest.webmanifest"), "utf8"));
assert.equal(manifest.name, "Rethos");
assert.equal(manifest.short_name, "Rethos");
assert(readFileSync(join(root, "NOTICE"), "utf8").includes("Copyright 2026 Milind Soni"));
assert(readFileSync(join(root, "LICENSE"), "utf8").includes("Apache License"));
console.log("Rethos OSS: enterprise sources and artifacts absent; product identity and upstream notices verified.");
