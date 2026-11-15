import { expect, it } from "vitest";
import { ipcErrorText, moveLine, moveQuietUntil } from "./cloud-send";
import { setLocale } from "./i18n";

it("describes self-hosted migration progress, retained files and retry failures by server name", () => {
  setLocale("en");
  expect(moveLine({ phase: "copy", place: "Garage server" }, "local")).toMatchObject({ kind: "sending", place: "Garage server" });
  const failure = moveLine({ phase: "copy", place: "Garage server", failing: { error: "offline" } }, "local");
  expect(failure).toMatchObject({ kind: "failed", place: "Garage server", retry: true, reason: "offline" });
  expect(moveLine({ phase: "done", place: "Garage server", phone: false, held: [], stayed: [{ name: "fetch", needs: "uvx" }] }, "cloud")?.extra.join(" ")).toContain("uvx");
  expect(moveLine({ phase: "copy" }, "local")).toBeNull();
});
it("keeps notices quiet through the move and unwraps Electron errors", () => {
  expect(moveQuietUntil({ phase: "copy", place: "VPS" })).toBe(Infinity);
  expect(moveQuietUntil(null)).toBe(0);
  expect(ipcErrorText(new Error("Error invoking remote method 'workspace-move:retry': Error: Offline"))).toBe("Offline");
});
