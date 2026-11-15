import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { sharedPath, openSharedFile } from "./shared-file-path.mjs";

export const SHARED_EDIT_LIMIT = 2 * 1024 * 1024;

export async function listSharedFiles(folder, relative, { offset = 0, limit = 50, sort = "name" } = {}) {
  const target = await sharedPath(folder, relative);
  const entries = [];
  for await (const entry of await fs.opendir(target)) {
    const entryPath = path.join(target, entry.name);
    let stat;
    try { stat = await fs.lstat(entryPath); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    entries.push({ name: entry.name, path: entryPath, type: stat.isSymbolicLink() ? "blocked-link" : stat.isDirectory() ? "directory" : stat.isFile() && stat.nlink === 1 ? "file" : "blocked-file", bytes: stat.size, modified_at: stat.mtime.toISOString() });
  }
  await sharedPath(folder, relative);
  entries.sort((a, b) => (sort === "modified" ? b.modified_at.localeCompare(a.modified_at) : 0) || a.name.localeCompare(b.name));
  const end = Math.min(entries.length, offset + limit);
  return { path: target, entries: entries.slice(offset, end), total: entries.length, next_offset: end < entries.length ? end : null };
}

export async function readSharedRange(folder, relative, args = {}) {
  const maxBytes = args.max_bytes ?? 8192;
  if (args.tail && args.offset !== undefined) throw new Error("Choose either tail or offset");
  const { file, stat, target } = await openSharedFile(folder, relative);
  try {
    const fileId = `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`;
    if (args.file_id && args.file_id !== fileId) throw new Error("File was replaced; read it again from the start or tail");
    const size = Number(stat.size);
    const offset = args.tail ? Math.max(0, size - maxBytes) : args.offset ?? 0;
    if (offset > size) throw new Error("File is shorter than the requested offset; read it again from the start or tail");
    const buffer = Buffer.alloc(Math.min(maxBytes + 4, size - offset));
    let received = 0;
    while (received < buffer.length) {
      const { bytesRead } = await file.read(buffer, received, buffer.length - received, offset + received);
      if (!bytesRead) break;
      received += bytesRead;
    }
    let start = 0, end = Math.min(received, maxBytes);
    const continuation = byte => (byte & 0xc0) === 0x80;
    if (args.encoding !== "base64") {
      while (start < end && continuation(buffer[start])) start++;
      if (end < received) while (end > start && continuation(buffer[end])) end--;
    }
    const chunk = buffer.subarray(start, end);
    const content = args.encoding === "base64" ? chunk.toString("base64") : new TextDecoder("utf-8", { fatal: true }).decode(chunk);
    const hash = createHash("sha256").update(chunk).digest("hex");
    let sha256;
    if (size <= SHARED_EDIT_LIMIT) {
      if (offset + start === 0 && end === size) sha256 = hash;
      else {
        const whole = createHash("sha256");
        if (size) for await (const piece of file.createReadStream({ start: 0, end: size - 1, autoClose: false })) whole.update(piece);
        sha256 = whole.digest("hex");
      }
    }
    return { path: target, file_id: fileId, size, modified_at: new Date(Number(stat.mtimeMs)).toISOString(), offset: offset + start, bytes: chunk.length, next_offset: offset + end, eof: offset + end >= size, range_sha256: hash, ...(sha256 ? { sha256 } : {}), encoding: args.encoding ?? "utf8", content };
  } finally { await file.close(); }
}
