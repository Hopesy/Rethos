import "./check-oss.mjs";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "release", "npm");
const app = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const required of ["dist-server/index.js", "dist-server/openmausbot.js", "dist/index.html"]) {
  assert(existsSync(join(root, required)), `Missing ${required}: run pnpm build:server && pnpm exec vite build first.`);
}
assert.equal(relative(root, out).replaceAll("\\", "/"), "release/npm");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const directory of ["dist-server", "dist", "skills", "third_party"]) {
  cpSync(join(root, directory), join(out, directory), { recursive: true });
}
for (const file of ["LICENSE", "NOTICE", "LICENSING.md", "README.md"]) {
  cpSync(join(root, file), join(out, file));
}
writeFileSync(join(out, "cli.js"), '#!/usr/bin/env node\nimport "./dist-server/openmausbot.js";\n');
writeFileSync(join(out, "package.json"), JSON.stringify({
  name: app.name,
  version: app.version,
  description: app.description,
  license: "Apache-2.0",
  author: app.author,
  contributors: app.contributors,
  type: "module",
  bin: { rethos: "cli.js" },
  dependencies: Object.fromEntries(["@1password/sdk", "@duckdb/node-api", "@resvg/resvg-js"].map(name => [name, app.dependencies[name]])),
  files: ["cli.js", "dist-server", "dist", "skills", "third_party", "LICENSE", "NOTICE", "LICENSING.md", "README.md"],
  engines: { node: ">=24" },
  repository: app.repository,
  homepage: app.homepage,
  keywords: ["rethos", "agents", "self-hosted", "server"],
}, null, 2) + "\n");
console.log(`Rethos npm package assembled at ${out} (${app.name}@${app.version}).`);
