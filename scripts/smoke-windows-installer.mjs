import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

assert.equal(process.platform, "win32");
assert.equal(process.env.GITHUB_ACTIONS, "true", "installer smoke requires an ephemeral GitHub Actions runner");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const base = resolve(".Rethos-temp/desktop-release");
mkdirSync(base, { recursive: true });
const fixture = mkdtempSync(join(base, "installed-"));
const home = join(fixture, "home");
const installation = join(fixture, "app");
const data = join(home, ".openmausbot");
const report = join(fixture, "renderer.json");
mkdirSync(data, { recursive: true });
writeFileSync(join(data, "config.json"), JSON.stringify({ instances: { fixture: { driver: "not-a-real-driver", displayName: "Release verification" } } }));
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  APPDATA: join(home, "AppData", "Roaming"),
  LOCALAPPDATA: join(home, "AppData", "Local"),
  OMB_DATA_DIR: data,
  OMB_COMPOSIO_BROKER_URL: "http://127.0.0.1:1",
  OMB_SMOKE_TEST: "1",
  OMB_SMOKE_CUA: "0",
  OMB_SMOKE_KEEP_OPEN: "1",
  OMB_SMOKE_RESULT_FILE: report,
  ELECTRON_ENABLE_LOGGING: "1",
};
for (const key of ["ELECTRON_RUN_AS_NODE", "CUA_DRIVER_PATH", "OMB_RESOURCES_PATH"]) delete env[key];
for (const directory of [env.APPDATA, env.LOCALAPPDATA]) mkdirSync(directory, { recursive: true });

function killTree(child) {
  if (child?.pid && child.exitCode === null) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  }
}

async function runInstaller(executable, args) {
  const child = spawn(executable, args, { env, windowsHide: true, stdio: "ignore" });
  const timer = setTimeout(() => killTree(child), 120_000);
  try {
    const code = await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("exit", done);
    });
    assert.equal(code, 0, `installer exited with ${code}`);
  } finally {
    clearTimeout(timer);
    killTree(child);
  }
}

await runInstaller(resolve(`release/Rethos-${version}-setup.exe`), ["/S", `/D=${installation}`]);
const executable = join(installation, "Rethos.exe");
assert(existsSync(executable), "installer did not create Rethos.exe");
const child = spawn(executable, [`--user-data-dir=${join(home, "electron")}`, "--enable-logging=file", `--log-file=${join(fixture, "chromium.log")}`], {
  env, cwd: fixture, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let launchError;
child.once("error", error => { launchError = error; });
for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
try {
  const deadline = Date.now() + 90_000;
  let result;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (existsSync(report)) {
      const recorded = JSON.parse(readFileSync(report, "utf8"));
      assert(recorded.ok, recorded.error);
      result = recorded.result;
      break;
    }
    const match = output.match(/\[smoke\] renderer-ready (\{[^\r\n]*\})/);
    if (match) { result = JSON.parse(match[1]); break; }
    assert(!output.includes("[smoke] renderer-failed"), output);
    assert.equal(child.exitCode, null, `desktop exited early: ${child.exitCode}\n${output}`);
    await new Promise(done => setTimeout(done, 250));
  }
  assert(result, `installed desktop did not report a ready renderer\n${output}`);
  assert.equal(result.title, "Rethos");
  assert.equal(result.health?.app, "openmausbot");
  assert.equal(result.health?.static, true);
  assert.equal(result.capabilities?.host?.platform, "win32");
  assert.match(result.location, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  console.log(`Installed Rethos ${version}: renderer, preload, server and owner access passed`);
} finally {
  writeFileSync(join(fixture, "desktop.log"), output);
  killTree(child);
  for (const directory of [join(process.env.APPDATA, "rethos", "logs"), join(env.APPDATA, "rethos", "logs"), join(home, "electron", "logs")]) {
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory)) {
      if (file.endsWith(".log")) copyFileSync(join(directory, file), join(fixture, `app-${file}`));
    }
  }
}
