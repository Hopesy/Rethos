import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "Hopesy/Rethos";
export const CLIENT_ASSETS = ["Rethos-setup.exe", "Rethos-Android.apk", "Rethos-setup.exe.blockmap", "latest.yml", "SHA256SUMS.txt"];
const hash = (file, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(readFileSync(file)).digest(encoding);

export function assembleClients(root, version, commit) {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.match(commit, /^[a-f0-9]{40}$/);
  const windows = join(root, "windows-assets");
  const android = join(root, "android-assets");
  const output = join(root, "client-assets");
  const desktop = JSON.parse(readFileSync(join(windows, "BUILD-INFO.json"), "utf8"));
  const mobile = JSON.parse(readFileSync(join(android, "BUILD-INFO-android.json"), "utf8"));
  for (const [directory, info] of [[windows, desktop], [android, mobile]]) {
    assert.equal(info.product, "Rethos");
    assert.equal(info.version, version, "client versions must match");
    assert.equal(info.commit, commit, "clients must use the same source commit");
    for (const [name, digest] of Object.entries(info.files)) {
      assert(!/[\\/]/.test(name) && name !== "." && name !== "..", "invalid asset name");
      assert.equal(hash(join(directory, name)), digest, `build artifact changed: ${name}`);
    }
  }
  assert.equal(desktop.platform, "win32-x64");
  assert.equal(mobile.applicationId, "cc.hopesy.rethos");
  assert.equal(mobile.platform, "android");
  assert.match(mobile.certificateSha256, /^[a-f0-9]{64}$/i);
  const [major, minor, patch] = version.split(".").map(Number);
  assert.equal(mobile.versionCode, major * 1_000_000 + minor * 1_000 + patch);
  const binaries = [
    [windows, `Rethos-${version}-setup.exe`, "Rethos-setup.exe"],
    [android, `Rethos-Android-${version}.apk`, "Rethos-Android.apk"],
    [windows, `Rethos-${version}-setup.exe.blockmap`, "Rethos-setup.exe.blockmap"],
  ];
  mkdirSync(output, { recursive: true });
  assert(readdirSync(output).every(name => CLIENT_ASSETS.includes(name)), "unexpected release file");
  for (const [directory, source, name] of binaries) {
    const info = directory === windows ? desktop : mobile;
    assert(info.files[source], `asset missing from verified build: ${source}`);
    assert(statSync(join(directory, source)).size > 0);
    copyFileSync(join(directory, source), join(output, name));
  }
  const installer = join(output, "Rethos-setup.exe");
  const sha512 = hash(installer, "sha512", "base64");
  writeFileSync(join(output, "latest.yml"), `version: ${version}\nfiles:\n  - url: Rethos-setup.exe\n    sha512: ${sha512}\n    size: ${statSync(installer).size}\npath: Rethos-setup.exe\nsha512: ${sha512}\n`);
  writeFileSync(join(output, "SHA256SUMS.txt"), CLIENT_ASSETS.filter(name => name !== "SHA256SUMS.txt").map(name => `${hash(join(output, name))}  ${name}\n`).join(""));
  assert.deepEqual(readdirSync(output).sort(), [...CLIENT_ASSETS].sort());
  return output;
}

function publish(directory, version, commit) {
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  const tag = `v${version}`;
  const gh = args => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
  const view = () => JSON.parse(gh(["release", "view", tag, "--repo", repository, "--json", "isDraft,targetCommitish,assets,url"]));
  const digests = new Map(CLIENT_ASSETS.map(name => [name, `sha256:${hash(join(directory, name))}`]));
  const probe = spawnSync("gh", ["release", "view", tag, "--repo", repository], { encoding: "utf8" });
  if (probe.status === 0) {
    const existing = view();
    assert(existing.isDraft, "published releases require a new version");
    assert.equal(existing.targetCommitish, commit, "draft uses another source commit");
    assert(existing.assets.every(asset => digests.has(asset.name)), "unexpected draft assets");
  } else {
    assert(/release not found|HTTP 404/i.test(probe.stderr), `release lookup failed: ${probe.stderr}`);
    gh(["release", "create", tag, "--repo", repository, "--target", commit, "--draft", "--title", `Rethos ${version} · Windows + Android`, "--notes-file", `docs/releases/v${version}.md`]);
  }
  const labels = ["Windows x64 安装程序", "Android 安装包", "Windows 差分更新", "Windows 更新索引", "SHA256 校验"];
  gh(["release", "upload", tag, ...CLIENT_ASSETS.map((name, i) => `${join(directory, name)}#${labels[i]}`), "--repo", repository, "--clobber"]);
  const staged = view();
  assert.equal(staged.assets.length, CLIENT_ASSETS.length);
  for (const asset of staged.assets) assert.equal(asset.digest, digests.get(asset.name), `uploaded bytes differ: ${asset.name}`);
  gh(["release", "edit", tag, "--repo", repository, "--draft=false", "--latest"]);
  assert.equal(view().isDraft, false);
  assert.equal(gh(["api", `repos/${repository}/commits/${tag}`, "--jq", ".sha"]), commit);
  console.log(view().url);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Rethos ${version}\n\n${view().url}\n\nWindows + Android · ${CLIENT_ASSETS.length} verified assets · source ${commit}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  assert.equal(version, process.env.RELEASE_VERSION);
  assert.equal(version, process.env.ANDROID_VERSION);
  const directory = assembleClients("release", version, process.env.RELEASE_SHA);
  if (process.argv[2] === "publish") publish(directory, version, process.env.RELEASE_SHA);
  else assert.equal(process.argv[2], "prepare");
}
