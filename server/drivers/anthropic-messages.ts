import type { Completion, OpenAIChatMessage } from "./openai-chat.ts";
import type { ChatToolDefinition } from "./chat-mcp-tools.ts";
import { ChatProtocolError, ChatToolCalls, object } from "./openai-chat-protocol.ts";
import { boundedJson } from "../model-api.ts";

export type AnthropicBlock = Record<string, unknown>;

function contentBlocks(content: OpenAIChatMessage["content"]): AnthropicBlock[] {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  return (content ?? []).map(part => {
    if (part.type === "text") return { type: "text", text: part.text };
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(part.image_url.url);
    return { type: "image", source: match ? { type: "base64", media_type: match[1], data: match[2] } : { type: "url", url: part.image_url.url } };
  });
}

export function anthropicRequest(input: {
  model: string; messages: readonly OpenAIChatMessage[]; tools: readonly ChatToolDefinition[]; stream: boolean;
  replay?: (message: OpenAIChatMessage) => AnthropicBlock[] | undefined;
}): Record<string, unknown> {
  const system = input.messages.filter(message => message.role === "system").flatMap(message => contentBlocks(message.content));
  const messages: Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }> = [];
  for (const message of input.messages) {
    if (message.role === "system") continue;
    const role = message.role === "assistant" ? "assistant" : "user";
    const content = input.replay?.(message) ?? (message.role === "tool"
      ? [{ type: "tool_result", tool_use_id: message.tool_call_id, content: contentBlocks(message.content) }]
      : [...contentBlocks(message.content), ...(message.tool_calls ?? []).map(call => ({
        type: "tool_use", id: call.id, name: call.function.name, input: JSON.parse(call.function.arguments),
      }))]);
    if (!content.length) continue;
    const previous = messages.at(-1);
    if (previous?.role === role) previous.content.push(...content);
    else messages.push({ role, content: [...content] });
  }
  return { model: input.model, max_tokens: 8192, stream: input.stream, ...(system.length ? { system } : {}), messages,
    ...(input.tools.length ? { tools: input.tools.map(tool => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })) } : {}) };
}

function completion(content: AnthropicBlock[], stop: unknown, usage: Record<string, unknown>): Completion {
  if (typeof stop !== "string" || !content.length) throw new ChatProtocolError("Anthropic returned an incomplete message");
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") continue;
    if (block.type === "thinking" && typeof block.thinking === "string" && typeof block.signature === "string") continue;
    if (block.type === "redacted_thinking" && typeof block.data === "string") continue;
    if (block.type === "tool_use") continue;
    throw new ChatProtocolError("Invalid Anthropic content block");
  }
  const toolCalls = content.filter(block => block.type === "tool_use").map(block => {
    if (typeof block.id !== "string" || !block.id || typeof block.name !== "string" || !block.name || !object(block.input)) throw new ChatProtocolError("Invalid Anthropic tool call");
    return { id: block.id, type: "function" as const, function: { name: block.name, arguments: JSON.stringify(block.input) } };
  });
  if (toolCalls.length && stop !== "tool_use") throw new ChatProtocolError("Anthropic tool call was not completed");
  const calls = new ChatToolCalls();
  calls.add(toolCalls, false);
  calls.finish(stop === "tool_use" ? "tool_calls" : "stop", false);
  const count = (name: string) => typeof usage[name] === "number" && Number.isFinite(usage[name]) && usage[name] >= 0 ? usage[name] as number : 0;
  return { text: content.filter(block => block.type === "text").map(block => block.text).join(""),
    reasoning: content.filter(block => block.type === "thinking").map(block => block.thinking).join(""),
    usage: { input: count("input_tokens") + count("cache_creation_input_tokens") + count("cache_read_input_tokens"), output: count("output_tokens") },
    toolCalls, finishReason: stop === "tool_use" ? "tool_calls" : stop === "max_tokens" ? "length" : "stop",
    protocolReasoning: "", protocolReasoningDetails: [], anthropicContent: content };
}

export async function readAnthropicMessage(response: Response, options: {
  onBytes: () => void; onDelta?: (text: string, kind: "assistant_text" | "reasoning_text") => void;
}): Promise<Completion> {
  if (response.headers.get("content-type")?.includes("application/json")) {
    const data = object(await boundedJson(response));
    if (data?.type !== "message" || !Array.isArray(data.content) || data.content.some(block => !object(block))) throw new ChatProtocolError("Invalid Anthropic message");
    return completion(data.content as AnthropicBlock[], data.stop_reason, object(data.usage) ?? {});
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ChatProtocolError("Anthropic returned no response body");
  const blocks = new Map<number, { block: AnthropicBlock; json: string; stopped: boolean }>();
  let usage: Record<string, unknown> = {};
  let stop: unknown;
  let started = false;
  let ended = false;
  let buffer = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  const consume = (frame: string) => {
    const raw = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!raw) return;
    let data: Record<string, unknown> | undefined;
    try { data = object(JSON.parse(raw)); } catch { throw new ChatProtocolError("Malformed Anthropic event"); }
    if (!data) throw new ChatProtocolError("Invalid Anthropic event");
    if (data.type === "error") throw new ChatProtocolError("Anthropic stream reported an error");
    if (data.type === "ping") return;
    if (data.type === "message_start") {
      if (started) throw new ChatProtocolError("Duplicate Anthropic message");
      started = true; usage = object(object(data.message)?.usage) ?? {}; return;
    }
    if (!started || ended) throw new ChatProtocolError("Unexpected Anthropic event");
    if (data.type === "message_delta") { stop = object(data.delta)?.stop_reason; usage = { ...usage, ...object(data.usage) }; return; }
    if (data.type === "message_stop") { ended = true; return; }
    const index = data.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 1000) throw new ChatProtocolError("Invalid Anthropic block index");
    if (data.type === "content_block_start") {
      const block = object(data.content_block);
      if (!block || blocks.has(index)) throw new ChatProtocolError("Invalid Anthropic block");
      blocks.set(index, { block: { ...block }, json: "", stopped: false }); return;
    }
    const entry = blocks.get(index);
    if (!entry || entry.stopped) throw new ChatProtocolError("Unexpected Anthropic block event");
    if (data.type === "content_block_stop") {
      if (entry.json) {
        try { entry.block.input = JSON.parse(entry.json); } catch { throw new ChatProtocolError("Invalid Anthropic tool arguments"); }
      }
      entry.stopped = true; return;
    }
    const delta = object(data.delta);
    if (data.type !== "content_block_delta" || !delta) throw new ChatProtocolError("Invalid Anthropic delta");
    if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") entry.json += delta.partial_json;
    else if (delta.type === "text_delta" && typeof delta.text === "string") {
      entry.block.text = String(entry.block.text ?? "") + delta.text; options.onDelta?.(delta.text, "assistant_text");
    } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
      entry.block.thinking = String(entry.block.thinking ?? "") + delta.thinking; options.onDelta?.(delta.thinking, "reasoning_text");
    } else if (delta.type === "signature_delta" && typeof delta.signature === "string") entry.block.signature = String(entry.block.signature ?? "") + delta.signature;
    else throw new ChatProtocolError("Unsupported Anthropic delta");
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      options.onBytes(); bytes += value.length;
      if (bytes > 8 * 1024 * 1024) throw new ChatProtocolError("Anthropic response too large");
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
      if (ended) break;
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!ended || [...blocks.values()].some(entry => !entry.stopped)) throw new ChatProtocolError("Anthropic stream ended before message_stop");
    return completion([...blocks.entries()].sort(([a], [b]) => a - b).map(([, entry]) => entry.block), stop, usage);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
