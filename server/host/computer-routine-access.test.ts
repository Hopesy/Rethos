import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { HandoffView } from "../coordinator.ts";
import { personKey } from "../person-key.ts";
import type { Routine, RoutineRun } from "../routines.ts";
import type { PublicSession } from "../sessions.ts";
import { createComputerRoutineAccess } from "./computer-routine-access.ts";
import type { ActingLine, DirectRequest } from "./acting-person.ts";

let directory: string;
beforeEach(() => { const root = resolve(".Rethos-temp/computer-routine-access/unit"); mkdirSync(root, { recursive: true }); directory = mkdtempSync(join(root, "case-")); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function fixture() {
  const session: PublicSession = { id: "owner-token", label: "Owner", token: true, scopes: ["admin", "client"], createdAt: 1, lastSeenAt: 1, expiresAt: Date.now() + 60_000 };
  const person = personKey(session), turn = { botId: "chief", threadId: "run-thread", generation: "root" };
  const routine = { id: "monitor", name: "Monitor", prompt: "Read the project", target: "bot", botId: turn.botId, runOn: "maus", enabled: true, schedule: { type: "interval", everyMinutes: 5, anchorAt: 1 }, attachments: [] } as unknown as Routine;
  const run: RoutineRun = { id: "run", routineId: routine.id, routineName: routine.name, scheduledFor: 1, manual: false, createdAt: 1, threadId: turn.threadId, botId: turn.botId, prompt: routine.prompt, target: "bot", runOn: "maus", attachments: [], status: "running", triggerSource: "schedule" };
  const requests = new Map<string, DirectRequest>([[turn.threadId, { generation: turn.generation, messageId: "scheduled", generations: new Set([turn.generation]), automation: "schedule" }]]);
  const messages = new Map<string, ActingLine[]>([[turn.threadId, [{ id: "scheduled", at: 1, role: "user" }]]]);
  const nodes = new Map<string, HandoffView>();
  const manual = new Map<string, string>();
  let liveSessions = [session], starter = person, shared = false;
  const deps = {
    file: join(directory, "authors.json"), ownServer: () => shared ? null : { admin: null }, sessions: () => liveSessions,
    request: (id: string) => requests.get(id), messages: (id: string) => messages.get(id) ?? [], starter: () => starter,
    routine: (id: string) => id === routine.id ? routine : undefined, run: (id: string) => id === turn.threadId ? run : null,
    taskRun: (_botId: string, id: string) => id === turn.threadId ? run.id : undefined,
    manualPerson: (id: string) => manual.get(id),
    assignment: (child: typeof turn) => nodes.get(child.generation), node: (id: string) => nodes.get(id),
  };
  const access = createComputerRoutineAccess(deps);
  access.record(routine, person);
  return { access, deps, person, turn, run, routine, requests, messages, nodes, manual,
    revoke: () => { liveSessions = []; }, stranger: () => { starter = personKey({ id: "someone-else" }); }, shared: () => { shared = true; } };
}

it("keeps authenticated author proof after restart and rejects changed instructions or a stale generation", () => {
  const f = fixture();
  expect(createComputerRoutineAccess(f.deps).person(f.turn)).toBe(f.person);
  expect(f.access.person({ ...f.turn, generation: "stale" })).toBeNull();
  f.routine.prompt = "Different work";
  expect(f.access.person(f.turn)).toBeNull();
  f.access.record(f.routine, f.person);
  expect(f.access.person(f.turn), "the old run keeps its old prompt").toBeNull();
});

it("revokes a running periodic check when paused, its author expires or the server becomes shared", () => {
  for (const change of [(f: ReturnType<typeof fixture>) => { f.routine.enabled = false; }, (f: ReturnType<typeof fixture>) => f.revoke(), (f: ReturnType<typeof fixture>) => f.shared(), (f: ReturnType<typeof fixture>) => f.stranger()]) {
    const f = fixture(); expect(f.access.person(f.turn)).toBe(f.person); change(f); expect(f.access.person(f.turn)).toBeNull();
  }
});

it("allows a consumed one-time schedule to finish while an explicit pause still revokes its approval", () => {
  const f = fixture(); f.routine.schedule = { type: "once", at: 1 }; f.access.record(f.routine, f.person);
  f.routine.enabled = false;
  expect(f.access.person(f.turn)).toBe(f.person);
  f.access.record(f.routine, f.person);
  expect(f.access.person(f.turn)).toBeNull();
});

it("keeps webhook, API and unproven manual runs outside the computer grant", () => {
  const f = fixture();
  for (const trigger of ["webhook", "api", "manual"] as const) {
    f.run.triggerSource = trigger; f.requests.get(f.turn.threadId)!.automation = trigger;
    expect(f.access.person(f.turn)).toBeNull();
  }
  f.manual.set(f.run.id, personKey({ id: "other" })); expect(f.access.person(f.turn)).toBeNull();
  f.manual.set(f.run.id, f.person); expect(f.access.person(f.turn)).toBe(f.person);
});

it("follows the live coordinator chain to a project bot and revokes late work after pause or Stop", () => {
  const f = fixture(), child = { botId: "project", threadId: "project-thread", generation: "child" };
  f.nodes.set("root", { id: "root", rootId: "root", threadId: f.turn.threadId, botId: f.turn.botId, status: "waiting" } as HandoffView);
  f.nodes.set("child", { id: "child", rootId: "root", parentId: "root", threadId: child.threadId, botId: child.botId, status: "running" } as HandoffView);
  f.requests.set(child.threadId, { generation: child.generation, generations: new Set([child.generation]) });
  expect(f.access.person(child)).toBe(f.person);
  f.routine.enabled = false; expect(f.access.person(child)).toBeNull(); f.routine.enabled = true;
  f.requests.get(f.turn.threadId)!.stopped = true; expect(f.access.person(child)).toBeNull();
});

it("refuses a guest joining a delegated conversation or a completed delegation", () => {
  const f = fixture(), child = { botId: "project", threadId: "project-thread", generation: "child" };
  f.nodes.set("root", { id: "root", rootId: "root", threadId: f.turn.threadId, botId: f.turn.botId, status: "waiting" } as HandoffView);
  f.nodes.set("child", { id: "child", rootId: "root", parentId: "root", threadId: child.threadId, botId: child.botId, status: "running" } as HandoffView);
  f.requests.set(child.threadId, { generation: child.generation, generations: new Set([child.generation]) });
  f.messages.set(child.threadId, [{ id: "guest", at: 2, role: "user", sender: { id: personKey({ id: "guest" }) } }]);
  expect(f.access.person(child)).toBeNull(); f.messages.set(child.threadId, []);
  f.nodes.get("child")!.status = "completed"; expect(f.access.person(child)).toBeNull();
});
