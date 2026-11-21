import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
const run = promisify(execFile);
const child = spawn(process.execPath, ["--test", "--test-reporter=spec", "--test-timeout=45000", "electron/*.node-test.mjs"], { stdio: "inherit" });
let done = false;
const finished = new Promise(resolve => child.once("exit", (code) => { done = true; resolve(code); }));
await Promise.race([finished, delay(110_000)]);
if (!done) {
  const { stdout } = await run("ps", ["-axo", "pid,ppid,etime,command"]);
  const lines = stdout.split("\n").filter(line => /node|electron|workerd/.test(line));
  console.log("Remaining processes", lines.join("\n"));
  for (const line of lines.filter(line => line.includes(".node-test.mjs") && !line.includes("--test") && !line.includes("ps -axo"))) {
    const pid = line.trim().split(/\s+/)[0];
    const sample = await run("sample", [pid, "2"], { timeout: 10_000, maxBuffer: 4_000_000 }).catch(error => ({ stdout: error.message }));
    console.log(sample.stdout);
  }
  child.kill("SIGTERM");
}
process.exitCode = await finished ?? 1;
