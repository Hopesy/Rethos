import { createServer, type Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import { anthropicRequest, readAnthropicMessage } from "./anthropic-messages.ts";
import { OpenAICompatDriver } from "./openai-compat.ts";
import { recordEvents } from "../testing/events.ts";
import { startFakeHttpMcp } from "../testing/fake-http-mcp-server.ts";
import { modelApiUrl } from "../model-api.ts";

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPp0AAAAASUVORK5CYII=";
const message = (blocks: unknown[], stop = "end_turn") => ({ type: "message", content: blocks, stop_reason: stop, usage: { input_tokens: 10, output_tokens: 4 } });
const events = [
  { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 0 } } },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "已完成" } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } },
  { type: "message_stop" },
];

it("maps system, images, tool calls and grouped results to Anthropic blocks", () => {
  expect(modelApiUrl("https://example.test/anthropic", "anthropic", "completion")).toBe("https://example.test/anthropic/v1/messages");
  expect(modelApiUrl("https://example.test/v1/", "anthropic", "models")).toBe("https://example.test/v1/models");
  const body = anthropicRequest({ model: "fixture", stream: true, tools: [], messages: [
    { role: "system", content: "Use the selected desktop." },
    { role: "user", content: [{ type: "text", text: "Inspect" }, { type: "image_url", image_url: { url: "data:image/png;base64,YQ==" } }] },
    { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "inspect", arguments: '{"id":1}' } }] },
    { role: "tool", tool_call_id: "call-1", content: "running" },
    { role: "user", content: "Continue checking." },
  ] });
  expect(body).toMatchObject({ system: [{ type: "text", text: "Use the selected desktop." }], messages: [
    { role: "user", content: [{ type: "text", text: "Inspect" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "YQ==" } }] },
    { role: "assistant", content: [{ type: "tool_use", id: "call-1", name: "inspect", input: { id: 1 } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "call-1", content: [{ type: "text", text: "running" }] }, { type: "text", text: "Continue checking." }] },
  ] });
});

it("reads chunked Unicode SSE and refuses truncated or malformed tool results", async () => {
  const bytes = new TextEncoder().encode(events.map(frame).join(""));
  let offset = 0;
  const response = new Response(new ReadableStream({ pull(controller) {
    if (offset >= bytes.length) controller.close();
    else { controller.enqueue(bytes.slice(offset, offset + 7)); offset += 7; }
  } }), { headers: { "content-type": "text/event-stream" } });
  const deltas: string[] = [];
  expect(await readAnthropicMessage(response, { onBytes() {}, onDelta: text => deltas.push(text) })).toMatchObject({ text: "已完成", usage: { input: 10, output: 4 } });
  expect(deltas.join("")).toBe("已完成");
  await expect(readAnthropicMessage(new Response(events.slice(0, -1).map(frame).join("")), { onBytes() {} })).rejects.toThrow("message_stop");
  await expect(readAnthropicMessage(Response.json(message([{ type: "tool_use", id: "1", name: "inspect", input: {} }], "max_tokens")), { onBytes() {} })).rejects.toThrow("not completed");
  await expect(readAnthropicMessage(new Response(frame({ type: "error", error: { message: "private provider detail" } })), { onBytes() {} })).rejects.toThrow("stream reported an error");
  await expect(readAnthropicMessage(Response.json(message([{ type: "text", text: 123 }])), { onBytes() {} })).rejects.toThrow("content block");
  await expect(readAnthropicMessage(Response.json(message([{ type: "tool_use", id: "same", name: "inspect", input: {} }, { type: "tool_use", id: "same", name: "inspect", input: {} }], "tool_use")), { onBytes() {} })).rejects.toThrow("duplicate tool call");
});

it("replays signed reasoning and streams tool argument fragments", async () => {
  const stream = [events[0],
    { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "inspect first" } },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "signed-fixture" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "call-1", name: "inspect", input: {} } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"id":' } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '1}' } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 8 } }, events.at(-1),
  ];
  const reply = await readAnthropicMessage(new Response(stream.map(frame).join("")), { onBytes() {} });
  expect(reply.toolCalls[0]?.function.arguments).toBe('{"id":1}');
  expect(reply.anthropicContent?.[0]).toEqual({ type: "thinking", thinking: "inspect first", signature: "signed-fixture" });
  const request = anthropicRequest({ model: "fixture", stream: true, messages: [{ role: "assistant", content: null }], tools: [], replay: () => reply.anthropicContent });
  expect(request.messages).toEqual([{ role: "assistant", content: reply.anthropicContent }]);
});

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

it.each(["allow", "deny"] as const)("runs the Anthropic runtime through actual MCP and preserves %s approval", async behavior => {
  const remote = await startFakeHttpMcp({ tools: [{ name: "inspect", inputSchema: { type: "object", properties: {}, additionalProperties: false } }],
    callResult: () => ({ content: [{ type: "text", text: "fixture window is running" }, { type: "image", mimeType: "image/png", data: PNG }] }) });
  cleanup.push(() => remote.close());
  const requests: any[] = [];
  const headers: Array<Record<string, unknown>> = [];
  const provider = createServer(async (req, res) => {
    if (req.url !== "/v1/messages") { res.writeHead(404); res.end(); return; }
    let raw = ""; for await (const part of req) raw += part;
    const body = JSON.parse(raw); requests.push(body); headers.push(req.headers);
    if (requests.length === 1) {
      const tool = body.tools.find((entry: any) => entry.name.endsWith("inspect"));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(message([{ type: "tool_use", id: "call-1", name: tool?.name, input: {} }], "tool_use")));
    } else { res.setHeader("content-type", "text/event-stream"); res.end(events.map(frame).join("")); }
  });
  const url = await listen(provider);
  const instance = await OpenAICompatDriver.create({ instanceId: "anthropic-fixture", displayName: "Fixture", enabled: true,
    config: OpenAICompatDriver.decodeConfig({ url, key: "fixture-key", protocol: "anthropic", managedModels: ["fixture-model"], model: "fixture-model" }), environment: {} });
  const recorder = recordEvents(instance.adapter);
  cleanup.push(async () => { recorder.stop(); await instance.dispose(); });
  await instance.adapter.sendTurn({ threadId: "fixture", model: "fixture-model", text: "Inspect the fixture.",
    integrations: { custom: { desk: { type: "http", url: remote.url, headers: {} } } } });
  const approval = await recorder.until(event => event.type === "request.opened");
  expect(remote.calls).toHaveLength(0);
  await instance.adapter.respondToRequest("fixture", approval.requestId!, { behavior });
  expect(await recorder.until(event => event.type === "turn.completed")).toMatchObject({ ok: behavior === "allow" });
  expect(remote.calls).toHaveLength(behavior === "allow" ? 1 : 0);
  expect(requests).toHaveLength(2);
  expect(headers[0]).toMatchObject({ "x-api-key": "fixture-key", "anthropic-version": "2023-06-01" });
  expect(headers[0]).not.toHaveProperty("authorization");
  expect(requests[1].messages.at(-1).content[0]).toMatchObject({ type: "tool_result", tool_use_id: "call-1" });
  expect(JSON.stringify(requests[1].messages)).toContain(behavior === "allow" ? "fixture window is running" : "denied");
  if (behavior === "allow") expect(requests[1].messages.at(-1).content).toContainEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: PNG } });
});
