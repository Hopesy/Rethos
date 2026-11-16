import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { launchVerificationServer } from "../scripts/control-omb.ts";
import { request } from "../scripts/mcp-server.ts";

it("the default main bot creates project bots, passes files, receives their results and saves verified project memory", async () => {
  const fixture = await launchVerificationServer({ ...process.env }, undefined, undefined, undefined, undefined, { scripted: true });
  const api = (path: string, body?: unknown, method = "POST") => request(path, body === undefined ? {} : { method, body: JSON.stringify(body) }, fixture.info.url) as Promise<any>;
  const names = ["Zelos", "XDTerminal", "XDTag", "XDForge", "XDTrace"];
  const dataDir = fixture.info.dataDir;
  const planPath = join(dataDir, "room-plan.json");
  const gate = join(dataDir, "project-team-ready");
  const envelope = (decision: Record<string, string>) => `<openmaus-goal>${JSON.stringify(decision)}</openmaus-goal>`;
  const evidence = () => existsSync(`${planPath}.evidence.jsonl`)
    ? readFileSync(`${planPath}.evidence.jsonl`, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
  try {
    const main = (await api("/api/bots")).bots.find((bot: any) => bot.defaultBot && !bot.defaultBot.person);
    expect(main).toMatchObject({ defaultBot: {}, memoryEnabled: true });
    const instance = (await api("/api/instances")).instances.find((item: any) => item.instanceId === main.modelSelection.instanceId);
    const modelSelection = { instanceId: instance.instanceId, model: instance.models.default };
    const summary = "Project portfolio: Zelos, XDTerminal, XDTag, XDForge and XDTrace returned verified reports. Next: implement the reviewed milestones.";
    const plan: Record<string, any> = {
      [main.id]: { turns: [
        {
          steps: [
            { tool: "list_team_setup", arguments: {} },
            { tool: "propose_team_setup", arguments: { reason: "Create the requested project specialists", operations: names.map(name => ({
              action: "create", key: name, fields: { name, title: `${name} project agent`, modelSelection,
                soul: `Own ${name}'s project background, session references, progress and results. Verify work and maintain project memory. Keep cancelled monitoring cancelled.` },
            })) } },
          ],
          gateFile: gate,
          reply: `Project team created.\n${envelope({ status: "continue", next: main.id, instruction: "Distribute the project brief with acceptance checks.", detail: "Project specialists ready." })}`,
        },
        {
          steps: [names.slice(0, 4), names.slice(4)].map(bot_ids => ({ tool: "coordinate_bots", arguments: { bot_ids, message: "Read project-brief.txt, return your verified report with attach_file and save your project's verified progress in memory.", files: ["project-brief.txt"], done_when: "A report is attached and project memory records the verified result." } })),
          reply: `Project reviews assigned.\n${envelope({ status: "continue", next: main.id, instruction: "Review the returned project reports and update portfolio memory.", detail: "Waiting for project reports." })}`,
        },
        {
          expectContextIncludes: ["files returned with its result", "Zelos", "XDTerminal", "XDTag", "XDForge", "XDTrace"],
          steps: [{ tool: "memory_update", arguments: { action: "append", text: summary } }],
          reply: "Reviewed all five project reports and saved portfolio memory.",
        },
        {
          expectContextIncludes: [summary],
          reply: `Reviewed all five project reports.\n${envelope({ status: "completed", detail: "All five reports received and project memory updated." })}`,
        },
      ] },
    };
    const own = (id: string, file: string, text: string) => {
      const folder = join(dataDir, "workspaces", id);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, file), text);
    };
    own(main.id, "project-brief.txt", "Portfolio acceptance: each project returns a report, records verified progress, and preserves cancelled monitoring.");
    writeFileSync(planPath, JSON.stringify(plan));
    const accepted = await api(`/api/bots/${main.id}/messages`, { text: "Create these five project bots, have them review the attached project brief, collect their reports and update project memory.", threadId: main.threadId, mode: "goal" });
    expect(accepted.message.channelMode).toBe("goal");
    await expect.poll(async () => (await api("/api/bots")).bots.filter((bot: any) => names.includes(bot.name)).length, { timeout: 25_000 }).toBe(5);
    const projects = (await api("/api/bots")).bots.filter((bot: any) => names.includes(bot.name));
    for (const bot of projects) {
      const result = `${bot.name}: project brief reviewed; next milestone ready. Cancelled monitoring remains cancelled.`;
      own(bot.id, "project-report.md", result);
      plan[bot.id] = {
        expectContextIncludes: ["project-brief.txt", "information only"],
        steps: [
          { tool: "memory_update", arguments: { action: "append", text: result } },
          { tool: "attach_file", arguments: { path: "project-report.md" } },
        ],
        reply: result,
      };
    }
    writeFileSync(planPath, JSON.stringify(plan));
    writeFileSync(gate, "fixture plans ready");
    const messages = async () => (await api(`/api/threads/${main.threadId}/messages?limit=200`)).messages;
    await expect.poll(async () => (await messages()).find((message: any) => message.kind === "goal.run")?.goalRun.status ?? "working", { timeout: 60_000 }).not.toBe("working");
    const goal = (await messages()).find((message: any) => message.kind === "goal.run")?.goalRun;
    expect(goal, JSON.stringify(goal)).toMatchObject({ status: "completed" });
    const turns = evidence();
    const mainTurns = turns.filter((turn: any) => turn.botId === main.id);
    expect(mainTurns).toHaveLength(4);
    expect(mainTurns[2].resumed).toBe(true);
    expect(mainTurns.flatMap((turn: any) => turn.evidence).filter((row: any) => row.step?.tool === "propose_team_setup")).toHaveLength(1);
    const receipts = mainTurns[1].evidence.filter((row: any) => row.step?.tool === "coordinate_bots")
      .flatMap((row: any) => JSON.parse(row.response.result.content[0].text).receipts);
    expect(receipts).toHaveLength(5);
    for (const bot of projects) {
      const receipt = receipts.find((item: any) => item.botId === bot.id);
      expect(receipt).toBeDefined();
      const worker = turns.find((turn: any) => turn.botId === bot.id);
      expect(worker.threadId).toBe(receipt.threadId);
      expect(worker.evidence.filter((row: any) => row.step).every((row: any) => !row.response.result.isError)).toBe(true);
      const input = join(dataDir, "task-workspaces", bot.id, receipt.threadId, "inbox", "fixture-starter", receipt.requestId, "project-brief.txt");
      expect(readFileSync(input, "utf8")).toContain("Portfolio acceptance:");
      const returnedFile = join(dataDir, "task-workspaces", main.id, main.threadId, "inbox", bot.name.toLowerCase(), `${receipt.requestId}-returned`, "project-report.md");
      expect(readFileSync(returnedFile, "utf8")).toBe(`${bot.name}: project brief reviewed; next milestone ready. Cancelled monitoring remains cancelled.`);
      const memory = await api(`/api/bots/${bot.id}/memory/file?path=MEMORY.md`);
      expect(memory.text).toContain(`${bot.name}: project brief reviewed; next milestone ready.`);
      for (const other of names.filter(name => name !== bot.name)) expect(memory.text).not.toContain(`${other}: project brief reviewed`);
    }
    expect((await api(`/api/bots/${main.id}/memory/file?path=MEMORY.md`)).text).toContain(summary);
    const returned = (await messages()).filter((message: any) => message.roomRequest?.phase === "result");
    expect(returned.flatMap((message: any) => message.attachments ?? [])).toHaveLength(5);
  } finally {
    writeFileSync(`${fixture.info.logPath}.workflow.json`, JSON.stringify(evidence(), null, 2));
    await fixture.close();
  }
}, 100_000);
