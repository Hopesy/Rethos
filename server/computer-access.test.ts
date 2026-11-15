import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { ComputerAccess } from "./computer-access.ts";
import { SharedComputers } from "./shared-computers.ts";

it("persists owner-scoped pause and revocation, and restores only a new local grant", () => {
  const dir = mkdtempSync(join(tmpdir(), "rethos-access-"));
  try {
    const file = join(dir, "access.json"), id = randomUUID(), revision = randomUUID();
    const access = new ComputerAccess(file);
    access.set("owner", id, "paused", revision);
    expect(new ComputerAccess(file).mode("owner", id)).toBe("paused");
    expect(access.mode("other", id)).toBe("enabled");
    access.set("owner", id, "revoked");
    const restarted = new ComputerAccess(file);
    restarted.registered("owner", id, revision);
    expect(restarted.mode("owner", id)).toBe("revoked");
    restarted.registered("owner", id, randomUUID());
    expect(restarted.mode("owner", id)).toBe("enabled");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("keeps two devices on the same token and cancels a job when the owner pauses its device", async () => {
  const broker = new SharedComputers(() => true);
  const owner = { session: "same-token", person: "owner" }, secret = "a".repeat(64);
  const device = () => ({ id: randomUUID(), name: "Desktop", environmentId: randomUUID(), grantRevision: randomUUID(), folders: [], terminal: true, computer: true });
  const a = device(), b = device();
  broker.register(a, owner, secret); broker.register(b, owner, secret);
  expect(broker.status(owner.person)).toHaveLength(2);
  const job = broker.request({ computer_id: a.id, action: "run_command", command: "echo fixture" }, owner.person, () => true);
  const result = expect(job).rejects.toThrow(/paused/);
  broker.setAccess(owner.person, a.id, "paused");
  await result;
  await expect(broker.request({ computer_id: a.id, action: "read_file", path: "/fixture" }, owner.person, () => true)).rejects.toThrow(/paused/);
  expect(broker.accessMode(owner.person, b.id)).toBe("enabled");
  expect(() => broker.setAccess("other", a.id, "enabled")).toThrow(/not found/);
  expect(() => broker.linkable(a.id, owner.session, secret)).toThrow(/paused/);
  expect(broker.lendingNow(owner.person).map(item => item.id)).toEqual([b.id]);
  broker.setAccess(owner.person, a.id, "revoked");
  expect(() => broker.setAccess(owner.person, a.id, "enabled")).toThrow(/on that computer/);
  broker.close();
});
