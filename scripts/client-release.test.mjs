import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "vitest";
import { parse } from "yaml";
import { assembleClients, CLIENT_ASSETS } from "./client-release.mjs";

const root = resolve(".Rethos-temp/release-0.1.156/publisher-tests");
mkdirSync(root, { recursive: true });
const version = "0.1.156";
const commit = "a".repeat(40);
function fixture(change = () => {}) {
  const directory = mkdtempSync(join(root, "release-"));
  const platforms = [
    { folder: "windows-assets", manifest: "BUILD-INFO.json", platform: "win32-x64", names: [`Rethos-${version}-setup.exe`, `Rethos-${version}-setup.exe.blockmap`, `Rethos-${version}-x64.zip`] },
    { folder: "android-assets", manifest: "BUILD-INFO-android.json", platform: "android", names: [`Rethos-Android-${version}.apk`] },
  ];
  for (const platform of platforms) {
    const folder = join(directory, platform.folder);
    mkdirSync(folder);
    const files = {};
    for (const name of platform.names) {
      const data = Buffer.from(`verified bytes of ${name}`);
      writeFileSync(join(folder, name), data);
      files[name] = createHash("sha256").update(data).digest("hex");
    }
    const info = { product: "Rethos", version, commit, platform: platform.platform, files, applicationId: "cc.hopesy.rethos", certificateSha256: "b".repeat(64), versionCode: 1156 };
    change(info, folder);
    writeFileSync(join(folder, platform.manifest), JSON.stringify(info));
  }
  return directory;
}

test("publishes both installers once with a valid Windows update feed and combined checksums", () => {
  const output = assembleClients(fixture(), version, commit);
  assert.deepEqual(readdirSync(output).sort(), [...CLIENT_ASSETS].sort());
  const feed = parse(readFileSync(join(output, "latest.yml"), "utf8"));
  assert.equal(feed.version, version);
  assert.equal(feed.path, "Rethos-setup.exe");
  assert.equal(feed.files.length, 1);
  const installer = readFileSync(join(output, feed.path));
  assert.equal(feed.files[0].size, installer.length);
  assert.equal(feed.sha512, createHash("sha512").update(installer).digest("base64"));
  assert.equal(feed.files[0].sha512, feed.sha512);
  const sums = readFileSync(join(output, "SHA256SUMS.txt"), "utf8").trim().split("\n");
  assert.equal(sums.length, 4);
  for (const line of sums) {
    const [digest, name] = line.split("  ");
    assert.equal(createHash("sha256").update(readFileSync(join(output, name))).digest("hex"), digest);
  }
});

for (const [name, change] of [
  ["different Android version", info => { if (info.platform === "android") info.version = "0.1.3"; }],
  ["different source commit", info => { if (info.platform === "android") info.commit = "c".repeat(40); }],
  ["changed installer", (info, folder) => { if (info.platform === "win32-x64") writeFileSync(join(folder, `Rethos-${version}-setup.exe`), "changed"); }],
  ["missing APK hash", info => { if (info.platform === "android") info.files = {}; }],
  ["old Android version code", info => { if (info.platform === "android") info.versionCode = 4; }],
]) test(`rejects ${name}`, () => assert.throws(() => assembleClients(fixture(change), version, commit)));
