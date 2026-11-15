import { describe, expect, it } from "vitest";
import { botWorkTargetPatch, migrateWorkTargets, resolveWorkTarget, taskWorkTargetPatch, workTargetSchema } from "./work-target.ts";

const target = { kind: "connected" as const, computerId: "11111111-1111-4111-8111-111111111111", cwd: "C:\\Projects" };
describe("computer target contract", () => {
  it("keeps a conversation's chosen computer and lets Off revoke access", () => {
    expect(resolveWorkTarget({ workTarget: target })).toEqual(target);
    expect(resolveWorkTarget({ workTarget: target }, { workTarget: { kind: "browser" } })).toEqual({ kind: "browser" });
    expect(resolveWorkTarget({ computer: "off", workTarget: { kind: "off" } }, { workTarget: target })).toEqual({ kind: "off" });
    expect(taskWorkTargetPatch({}, { workTarget: target })).toMatchObject({ workTarget: target, surface: undefined });
    expect(botWorkTargetPatch({ computer: "local" }, { workTarget: target })).toMatchObject({ workTarget: target, computer: undefined });
    expect(workTargetSchema.safeParse({ ...target, permissions: "full" }).success).toBe(false);
  });
  it("migrates retired hosted settings durably and preserves self-hosted resources", () => {
    const retired = { computer: "cloud" as const, cloudBackend: "box" as const, tasks: [{ surface: "cloud" as const }] };
    expect(migrateWorkTargets(retired)).toBe(true);
    expect(retired).toMatchObject({ computer: undefined, workTarget: { kind: "auto" }, tasks: [{ surface: undefined }] });
    expect(migrateWorkTargets(retired)).toBe(false);
    const vps = { computer: "cloud" as const, cloudBackend: "vps" as const, tasks: [{ surface: "cloud" as const }] };
    expect(migrateWorkTargets(vps)).toBe(false);
    expect(resolveWorkTarget(vps)).toEqual({ kind: "private", backend: "vps" });
  });
});
