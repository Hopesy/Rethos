import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

export const PROTECTED_FILE = "Desktop credentials and sharing settings cannot be accessed through a shared folder";
const absent = error => error.code === "ENOENT" || error.code === "ENOTDIR";
export const fileIdentity = async candidate => { const info = await fs.stat(candidate, { bigint: true }); return `${info.dev}:${info.ino}`; };

/** {dev, ino}, never path text; a root a fresh install has not created yet is skipped. */
export async function protectedIdentities(roots) {
  const identities = new Set();
  for (const root of roots ?? []) {
    if (typeof root !== "string" || !root) continue;
    try { identities.add(await fileIdentity(await fs.realpath(root))); }
    catch (error) { if (!absent(error)) throw error; }
  }
  return identities;
}

/** A write may create a file that does not exist yet, so walk from the nearest existing ancestor. */
export async function assertOutsideProtected(identities, target) {
  if (!identities.size) return;
  let current = path.resolve(target);
  for (;;) {
    try { current = await fs.realpath(current); break; }
    catch (error) {
      if (!absent(error)) throw error;
      const parent = path.dirname(current);
      if (parent === current) return;
      current = parent;
    }
  }
  for (;;) {
    let identity;
    try { identity = await fileIdentity(current); }
    catch (error) { if (!absent(error)) throw error; }
    if (identity !== undefined && identities.has(identity)) throw new Error(PROTECTED_FILE);
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export async function sharedPath(folder, relative = "") {
  if (typeof relative !== "string" || relative.length > 2048 || /[\\:\0]/.test(relative) || path.isAbsolute(relative) || relative.split("/").some(part => part === "..")) throw new Error("Use a relative path inside the shared folder");
  const root = await fs.realpath(folder.path);
  if (root !== folder.path) throw new Error("Shared folder moved. Choose it again in Settings.");
  let target = root;
  const parts = relative.split("/").filter(part => part && part !== ".");
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    let stat = null;
    try { stat = await fs.lstat(target); }
    catch (error) {
      if (error.code === "ENOTDIR") throw new Error(`${parts.slice(0, index).join("/")} is a file, not a folder`);
      if (error.code !== "ENOENT") throw error;
    }
    if (stat?.isSymbolicLink()) throw new Error("Symbolic links cannot be followed in shared folders");
    // Windows answers ENOENT, not ENOTDIR, past a file, so a file with more of the path after it is refused here.
    if (stat && !stat.isDirectory() && index < parts.length - 1) throw new Error(`${parts.slice(0, index + 1).join("/")} is a file, not a folder`);
  }
  return target;
}

/** Security: validate the opened file's identity and its containing folder before returning its descriptor. */
export async function openSharedFile(folder, relative, protectedRoots = new Set(), opening = constants.O_RDONLY) {
  const target = await sharedPath(folder, relative);
  await assertOutsideProtected(protectedRoots, target);
  const file = await fs.open(target, opening | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0), 0o600);
  try {
    const stat = await file.stat({ bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n) throw new Error("Only regular, single-link files can be shared");
    await sharedPath(folder, relative);
    const named = await fs.lstat(target, { bigint: true });
    if (named.ino !== stat.ino || named.dev !== stat.dev || named.isSymbolicLink()) throw new Error("The file changed while opening it; retry after inspecting the folder");
    if (protectedRoots.has(`${stat.dev}:${stat.ino}`)) throw new Error(PROTECTED_FILE);
    await assertOutsideProtected(protectedRoots, target);
    return { file, stat, target };
  } catch (error) { await file.close(); throw error; }
}
