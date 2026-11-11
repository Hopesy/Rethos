import { expect, it } from "vitest";
import { testSummary } from "./ci-test-summary.mjs";

it("reports assertion and collection failures with portable paths and escaped Markdown", () => {
  const summary = testSummary({ numPassedTests: 7, numFailedTests: 1, numPendingTests: 2, testResults: [
    { name: "D:\\repo\\src\\view.test.ts", status: "failed", assertionResults: [{ status: "failed", fullName: "view | <script>", failureMessages: ["expected A\nstack trace"] }] },
    { name: "D:\\repo\\server\\boot.test.ts", status: "failed", message: "Import failed\nstack trace", assertionResults: [] },
  ] }, "D:\\repo");
  expect(summary).toContain("7 passed · 1 failed · 2 skipped");
  expect(summary).toContain("| src/view.test.ts | view &#124; &lt;script&gt; | expected A |");
  expect(summary).toContain("| server/boot.test.ts | Suite setup / collection | Import failed |");
  expect(summary).not.toContain("stack trace");
});

it("keeps runner errors visible even when every assertion passed", () => {
  expect(testSummary({ success: false, numPassedTests: 3, numFailedTests: 0, testResults: [] })).toContain("runner failed outside a test assertion");
  expect(testSummary({ success: true, numPassedTests: 3, numFailedTests: 0, testResults: [] })).not.toContain("runner failed");
});
