import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { parseConfigPatch, parseStoredConfig } from "./config.ts";
import { RoutineManager } from "./routines.ts";

it("migrates the retired default desktop while retaining model, permissions, memory and private VPS settings", () => {
  const legacy = { newBotDefaults: { profile: { name: "Chief", computer: "cloud", cloudBackend: "box", approvalMode: "full", memoryEnabled: true,
    modelSelection: { instanceId: "custom", model: "my-model" } }, memory: { "MEMORY.md": "Project context" }, skills: [], routines: [] },
    vps: { sshAlias: "my-vps" }, box: { token: "retired-fixture-token" } };
  const migrated = parseStoredConfig(legacy);
  expect(migrated.newBotDefaults?.profile).toEqual({ name: "Chief", approvalMode: "full", memoryEnabled: true, modelSelection: { instanceId: "custom", model: "my-model" } });
  expect(migrated.newBotDefaults?.memory).toEqual(legacy.newBotDefaults.memory);
  expect(migrated.vps).toEqual(legacy.vps);
  expect(migrated).not.toHaveProperty("box");
  expect(parseStoredConfig(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  expect(() => parseConfigPatch({ box: { token: "retired" } })).toThrow(/removed/);
});

it("persists disabled legacy routines and cancels pending desktop runs without restarting cancelled monitoring", async () => {
  const parent = join(process.cwd(), ".Rethos-temp", "work-location");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "retired-routines-")), file = join(root, "routines.json");
  const startTurn = vi.fn(async () => {}), now = 1_800_000_000_000;
  const options = { file, now: () => now, botState: () => "ready" as const, createTask: () => ({ threadId: "fixture" }), startTurn };
  let manager = new RoutineManager(options);
  try {
    const retired = manager.create({ name: "Old desktop", prompt: "inspect", botId: "bot", runOn: "cloud", schedule: { type: "once", at: now + 1000 } });
    const cancelled = manager.create({ name: "Cancelled monitor", prompt: "inspect", botId: "bot", enabled: false, schedule: { type: "once", at: now + 1000 } });
    manager.close();
    const disk = JSON.parse(readFileSync(file, "utf8"));
    disk.runs = ["queued", "cancelled"].map(status => ({ id: status, routineId: retired.id, routineName: retired.name, botId: "bot", target: "bot", runOn: "cloud",
      status, manual: false, scheduledFor: now, createdAt: now, ...(status === "cancelled" ? { error: "Cancelled by user", finishedAt: now - 1 } : {}) }));
    writeFileSync(file, JSON.stringify(disk));
    manager = new RoutineManager({ ...options, now: () => now + 2000 });
    manager.holdFor([]);
    await manager.tick();
    expect(startTurn).not.toHaveBeenCalled();
    expect(manager.listRoutines().find(row => row.id === retired.id)).toMatchObject({ enabled: false, runOn: "maus", nextRunAt: null, checkTroubleCode: "routines.server.desktopRetired" });
    expect(manager.listRoutines().find(row => row.id === cancelled.id)).toMatchObject({ enabled: false });
    expect(manager.listRuns().find(row => row.id === "queued")).toMatchObject({ status: "cancelled", errorCode: "routines.server.desktopRetired" });
    expect(manager.listRuns().find(row => row.id === "cancelled")).toMatchObject({ status: "cancelled", error: "Cancelled by user", finishedAt: now - 1 });
    const saved = readFileSync(file, "utf8");
    manager.close(); manager = new RoutineManager(options);
    expect(readFileSync(file, "utf8")).toBe(saved);
    expect(manager.listRoutines().every(row => !row.enabled)).toBe(true);
  } finally { manager.close(); rmSync(root, { recursive: true, force: true }); }
});
