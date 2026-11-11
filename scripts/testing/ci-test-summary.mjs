import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cell = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replace(/[\r\n]+/g, " ").replaceAll("`", "&#96;");

export function testSummary(report, root = process.cwd()) {
  const prefix = `${root.replaceAll("\\", "/")}/`;
  const failures = [];
  for (const file of report.testResults ?? []) {
    const name = file.name.replaceAll("\\", "/").replace(prefix, "");
    const failed = (file.assertionResults ?? []).filter(test => test.status === "failed");
    for (const test of failed) failures.push([name, test.fullName, test.failureMessages?.[0]?.split(/\r?\n/)[0] ?? "Assertion failed"]);
    if (!failed.length && file.status === "failed") failures.push([name, "Suite setup / collection", file.message?.split(/\r?\n/)[0] ?? "No test result"]);
  }
  const lines = ["## Vitest results", "", `${report.numPassedTests ?? 0} passed · ${report.numFailedTests ?? 0} failed · ${report.numPendingTests ?? 0} skipped`, ""];
  if (failures.length) {
    lines.push("| File | Test | Failure |", "| --- | --- | --- |");
    for (const row of failures.slice(0, 80)) lines.push(`| ${row.map(value => cell(value).slice(0, 500)).join(" | ")} |`);
    lines.push("", "Complete results and retry records are in this job's vitest diagnostic artifact.");
  } else if (report.success === false) lines.push("The runner failed outside a test assertion. Inspect the job log and diagnostic artifact.");
  return lines.join("\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let summary;
  try { summary = testSummary(JSON.parse(readFileSync(process.env.OMB_VITEST_RESULTS, "utf8"))); }
  catch { summary = "## Vitest results\n\nNo readable test report was produced. Check the install, runtime preparation and test runner steps in this job.\n"; }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  else process.stdout.write(summary);
}
