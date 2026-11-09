import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const digest = (file, algorithm = "sha256", encoding = "hex") =>
  createHash(algorithm).update(readFileSync(file)).digest(encoding);

export function verifyWindowsFeed(directory, version) {
  const feed = parse(readFileSync(join(directory, "latest.yml"), "utf8"));
  const installer = `Rethos-${version}-setup.exe`;
  const zip = `Rethos-${version}-x64.zip`;
  assert.equal(feed.version, version, "update version differs from package version");
  assert.equal(feed.path, installer, "updater must target the versioned installer");
  assert.equal(feed.sha512, digest(join(directory, installer), "sha512", "base64"));
  assert(Array.isArray(feed.files) && feed.files.length > 0, "update feed has no files");
  const names = new Set();
  for (const entry of feed.files) {
    assert([installer, zip].includes(entry.url), `unexpected update asset: ${entry.url}`);
    assert(!names.has(entry.url), `duplicate update asset: ${entry.url}`);
    names.add(entry.url);
    const file = join(directory, entry.url);
    assert.equal(entry.size, statSync(file).size, `wrong size: ${entry.url}`);
    assert.equal(entry.sha512, digest(file, "sha512", "base64"), `wrong hash: ${entry.url}`);
  }
  assert(names.has(installer), "update feed must include the installer");
}

function assemble() {
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  assert.match(version, /^\d+\.\d+\.\d+$/, "expected a stable release version");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const resources = "release/win-unpacked/resources";
  const update = parse(readFileSync(join(resources, "app-update.yml"), "utf8"));
  assert.equal(update.provider, "github");
  assert.equal(update.owner, "Hopesy");
  assert.equal(update.repo, "Rethos");
  assert.equal(update.publisherName, undefined, "unsigned builds must omit publisherName");
  for (const file of ["server/index.js", "server/desktop-entry.mjs", "ui/index.html", "cloudflared/cloudflared.exe", "cua-driver.exe", "cua-driver-background.exe", "cua-sdk/cua-sdk.mjs", "cua-sdk/native/cua_driver_sdk.dll", "cua-sdk/native/cua_driver_node_runtime.node", "licenses/Rethos-LICENSE.txt", "licenses/Rethos-NOTICE.txt"]) {
    assert(statSync(join(resources, file)).size > 0, `missing resource: ${file}`);
  }
  verifyWindowsFeed("release", version);
  const directory = "release/windows-assets";
  mkdirSync(directory, { recursive: true });
  assert.equal(readdirSync(directory).length, 0, "release staging must be empty");
  const names = [`Rethos-${version}-setup.exe`, `Rethos-${version}-setup.exe.blockmap`, `Rethos-${version}-x64.zip`, "latest.yml"];
  for (const name of names) {
    assert(statSync(join("release", name)).size > 0, `empty release asset: ${name}`);
    copyFileSync(join("release", name), join(directory, name));
  }
  copyFileSync(join(directory, names[0]), join(directory, "Rethos-setup.exe"));
  names.push("Rethos-setup.exe");
  writeFileSync(join(directory, "SHA256SUMS-windows-x64.txt"), names.map(name => `${digest(join(directory, name))}  ${name}\n`).join(""));
  names.push("SHA256SUMS-windows-x64.txt");
  const files = Object.fromEntries(names.map(name => [basename(name), digest(join(directory, name))]));
  writeFileSync(join(directory, "BUILD-INFO.json"), JSON.stringify({ product: "Rethos", version, commit, platform: "win32-x64", signed: false, files }, null, 2) + "\n");
  console.log(`Verified Rethos ${version} Windows assets from ${commit}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) assemble();
