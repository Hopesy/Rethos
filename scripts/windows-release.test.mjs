import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { stringify } from "yaml";
import { verifyWindowsFeed } from "./windows-release.mjs";

const root = resolve(".Rethos-temp/desktop-release/feed-tests");
mkdirSync(root, { recursive: true });
const version = "0.1.149";
const installer = `Rethos-${version}-setup.exe`;
const zip = `Rethos-${version}-x64.zip`;
const bytes = Buffer.from("release asset fixture");
const sha512 = createHash("sha512").update(bytes).digest("base64");
function fixture(edit = () => {}) {
  const directory = mkdtempSync(join(root, "feed-"));
  for (const name of [installer, zip]) writeFileSync(join(directory, name), bytes);
  const feed = { version, files: [{ url: installer, size: bytes.length, sha512 }, { url: zip, size: bytes.length, sha512 }], path: installer, sha512 };
  edit(feed, directory);
  writeFileSync(join(directory, "latest.yml"), stringify(feed));
  return directory;
}
test("accepts electron-builder feeds with installer and ZIP", () => {
  verifyWindowsFeed(fixture(), version);
});
test("accepts an installer-only feed", () => {
  verifyWindowsFeed(fixture(feed => { feed.files.pop(); }), version);
});
for (const [name, edit] of [
  ["stale version", feed => { feed.version = "0.1.148"; }],
  ["modified installer bytes", (_feed, directory) => { writeFileSync(join(directory, installer), "changed"); }],
  ["incorrect feed hash", feed => { feed.files[0].sha512 = "stale"; }],
  ["incorrect file size", feed => { feed.files[0].size += 1; }],
  ["external download URL", feed => { feed.files[0].url = `https://example.com/${installer}`; }],
  ["wrong installer path", feed => { feed.path = zip; }],
  ["duplicate feed entry", feed => { feed.files.push(feed.files[0]); }],
  ["missing installer entry", feed => { feed.files.shift(); }],
]) test(`rejects ${name}`, () => {
  assert.throws(() => verifyWindowsFeed(fixture(edit), version));
});
