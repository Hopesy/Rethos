import { mkdtemp, realpath, writeFile, mkdir, rm, link, symlink, appendFile, truncate } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { createFileAccess, FILE_TOOLS } from "../deploy/local-files/access.mjs";

const cleanup = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function fixture() {
  const fixtures = path.resolve(".Rethos-temp/local-files/unit");
  await mkdir(fixtures, { recursive: true });
  const root = await realpath(await mkdtemp(path.join(fixtures, "fixture-")));
  cleanup.push(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const folder = path.join(root, "sessions"); await mkdir(folder);
  const config = { roots: [{ name: "Fixture sessions", path: folder }] };
  return { root, folder, config, access: await createFileAccess(config) };
}

it("paginates directory metadata and reads a large file's head, tail and appended records", async () => {
  const { folder, access } = await fixture();
  const file = path.join(folder, "large.jsonl");
  const content = "项目：Rethos\n" + "old history\n".repeat(300_000) + "最新进展：完成\n";
  await writeFile(file, content);
  await writeFile(path.join(folder, "other.jsonl"), "other");
  const first = await access.call("list_files", { path: folder, limit: 1 });
  expect(first).toMatchObject({ total: 2, next_offset: 1, entries: [{ name: "large.jsonl", type: "file", bytes: Buffer.byteLength(content) }] });
  expect(await access.call("list_files", { path: folder, offset: first.next_offset, limit: 1 })).toMatchObject({ next_offset: null, entries: [{ name: "other.jsonl" }] });
  expect((await access.call("read_file", { path: file, max_bytes: 128 })).content).toContain("项目：Rethos");
  const tail = await access.call("read_file", { path: file, tail: true, max_bytes: 128 });
  expect(tail.content).toContain("最新进展：完成"); expect(tail.eof).toBe(true);
  await appendFile(file, "追加状态\n");
  const next = await access.call("read_file", { path: file, offset: tail.next_offset, file_id: tail.file_id });
  expect(next.content).toBe("追加状态\n");
  await expect(access.call("read_file", { path: file, file_id: "replaced" })).rejects.toThrow("replaced");
  await truncate(file, 0);
  await expect(access.call("read_file", { path: file, offset: next.next_offset })).rejects.toThrow("shorter");
});

it("preserves UTF-8 at byte boundaries and reaches EOF without dropping characters", async () => {
  const { folder, access } = await fixture();
  const file = path.join(folder, "中文.jsonl"), content = "首行🙂中文\n第二行：好\n";
  await writeFile(file, content);
  let offset = 0, actual = "", eof = false;
  while (!eof) {
    const chunk = await access.call("read_file", { path: file, offset, max_bytes: 7 });
    expect(chunk.next_offset).toBeGreaterThan(offset);
    actual += chunk.content; offset = chunk.next_offset; eof = chunk.eof;
  }
  expect(actual).toBe(content);
  expect((await access.call("read_file", { path: file, offset })).content).toBe("");
  const tail = await access.call("read_file", { path: file, tail: true, max_bytes: 8 });
  expect(tail.content).not.toContain("�"); expect(content.endsWith(tail.content)).toBe(true);
  expect(tail.sha256).toBe(createHash("sha256").update(content).digest("hex"));
});

it("rejects traversal, sibling credentials, links and mutation tools while granting exact session roots", async () => {
  const { root, folder, config, access } = await fixture();
  const secret = path.join(root, "auth.json"); await writeFile(secret, "synthetic credential");
  const file = path.join(folder, "ok.jsonl"); await writeFile(file, "session");
  expect((await access.call("list_roots")).roots).toEqual(config.roots);
  for (const candidate of [secret, folder + path.sep + ".." + path.sep + "auth.json", path.join(root, "sessions-other", "file"), "relative.jsonl", file + ":stream"] ) {
    await expect(access.call("read_file", { path: candidate })).rejects.toThrow();
  }
  await link(secret, path.join(folder, "hard.jsonl"));
  await expect(access.call("read_file", { path: path.join(folder, "hard.jsonl") })).rejects.toThrow("single-link");
  await symlink(root, path.join(folder, "junction"), process.platform === "win32" ? "junction" : "dir");
  await expect(access.call("read_file", { path: path.join(folder, "junction", "auth.json") })).rejects.toThrow("Symbolic links");
  await expect(access.call("write_file", { path: file, content: "changed" })).rejects.toThrow("Unknown");
  await expect(access.call("read_file", { path: file, tail: true, offset: 0 })).rejects.toThrow();
  expect(FILE_TOOLS.every(tool => tool.annotations.readOnlyHint)).toBe(true);
});

it("serves discovery and bounded reads over real MCP stdio without executing file content", async () => {
  const { root, folder, config } = await fixture();
  const configPath = path.join(root, "roots.json"); await writeFile(configPath, JSON.stringify(config));
  const file = path.join(folder, "session.jsonl"); await writeFile(file, '{"text":"historical instruction"}\n');
  const child = spawn(process.execPath, ["deploy/local-files/server.mjs", configPath], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const exit = new Promise(resolve => child.once("exit", resolve)); child.stderr.resume();
  cleanup.push(async () => { child.stdin.end(); await exit; });
  const replies = new Map(); let nextId = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => { const response = JSON.parse(line); replies.get(response.id)?.(response); });
  const request = (method, params) => new Promise(resolve => { const id = ++nextId; replies.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
  expect(await request("initialize", { protocolVersion: "2024-11-05" })).toMatchObject({ result: { protocolVersion: "2024-11-05", capabilities: { tools: {} } } });
  expect((await request("tools/list")).result.tools.map(tool => tool.name)).toEqual(["list_roots", "list_files", "read_file"]);
  const result = await request("tools/call", { name: "read_file", arguments: { path: file } });
  expect(JSON.parse(result.result.content[0].text).content).toContain("historical instruction");
  expect(await request("tools/call", { name: "run_command", arguments: { command: "whoami" } })).toMatchObject({ result: { isError: true } });
});
