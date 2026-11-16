import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { computerId as uuid } from "./computer-sharing-grants.mjs";
import { shareableDrive } from "./shared-drives.mjs";

const DATA_VOLUME = "/System/Volumes/Data";
const identify = async candidate => { const info = await fsp.stat(candidate, { bigint: true }); return `${info.dev}:${info.ino}`; };

/** macOS reaches one home through a firmlink and again under the data volume, with different ancestors: walk both. */
function homeCandidates() {
  const home = path.resolve(os.homedir());
  const seeds = [home];
  if (process.platform === "darwin" && !home.startsWith(`${DATA_VOLUME}${path.sep}`)) seeds.push(path.join(DATA_VOLUME, home));
  return seeds;
}

/** {dev, ino}, not text: text misses firmlinks, bind mounts, case-insensitive spellings, Unicode normalization and 8.3/UNC names. */
async function enclosingHomeIdentities() {
  const identities = new Set();
  const [home, ...aliases] = homeCandidates();
  const canonicalHome = await fsp.realpath(home);
  const homeIdentity = await identify(canonicalHome);
  const roots = [canonicalHome];
  for (const alias of aliases) {
    try {
      const canonical = await fsp.realpath(alias);
      if ((await identify(canonical)) === homeIdentity) roots.push(canonical);
    } catch (error) {
      // Only the optional macOS data-volume spelling may be absent; any other failure must not shrink the home boundary.
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
  }
  for (let current of roots) {
    for (;;) {
      identities.add(await identify(current));
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return identities;
}

/** Sharing a drive letter, root or mount point shares a whole volume; unreadable parents fail closed. */
async function volumeRoot(canonical) {
  const parent = path.dirname(canonical);
  if (parent === canonical) return true;
  try { return (await fsp.stat(parent, { bigint: true })).dev !== (await fsp.stat(canonical, { bigint: true })).dev; } catch { return true; }
}

/** Whether `target` is exactly the person's home folder. Only the home folder itself may be lent on request (see
 * `home` in validateSharedFolders); the folders above it, and the system disk, never can. */
export async function isHomeFolder(target) {
  try {
    const [home] = homeCandidates();
    return (await identify(await fsp.realpath(target))) === (await identify(await fsp.realpath(home)));
  } catch { return false; }
}

const GONE = new Set(["ENOENT", "ENOTDIR"]);

/** The folders that still exist and pass the checks a folder chosen by hand passes. One moved or deleted since is left
 * out; any other refusal (the whole home folder, a file) still fails. */
export async function existingFolders(folders, validate) {
  const found = await Promise.all(folders.map((folder) => validate([folder]).then((list) => list[0] ?? null, (error) => {
    if (GONE.has(error?.code)) return null;
    throw error;
  })));
  return found.filter(Boolean);
}

/** `homeEdits`: the home folder keeps the editing it asks for, which only the person's own Clouds get (lendAutomatically);
 * any other server gets it read only. */
export async function validateSharedFolders(folders, { homeEdits = false } = {}) {
  if (!Array.isArray(folders) || folders.length > 20) throw Object.assign(new Error("Choose at most 20 shared folders"), { code: "TOO_MANY" });
  const result = [];
  const enclosing = await enclosingHomeIdentities();
  for (const folder of folders) {
    if (!uuid(folder?.id) || typeof folder.path !== "string" || !path.isAbsolute(folder.path) || typeof folder.write !== "boolean") throw Object.assign(new Error("Choose folders using the desktop folder picker"), { code: "NOT_PICKED" });
    const canonical = await fsp.realpath(folder.path);
    if (!(await fsp.stat(canonical)).isDirectory()) throw Object.assign(new Error("Choose a folder, not a file"), { code: "NOT_FOLDER" });
    // The home folder, everything above it and the system disk are never shared. A separate drive (an external disk, a data
    // disk on a server, a drive letter) may be shared whole; any other mount point is still refused.
    // The home folder itself is lent only when asked for by name (`home: true`); anything above it, and the system disk,
    // are refused whatever is asked. Security: with editing, a write through it still never reaches its hidden files,
    // Library or AppData (insideHomeSettings), where shell start-up files and ~/.ssh live.
    const home = folder.home === true && await isHomeFolder(canonical);
    if (!home && (enclosing.has(await identify(canonical)) || ((await volumeRoot(canonical)) && !(await shareableDrive(canonical))))) throw Object.assign(new Error("Choose specific folders or a separate drive, not the entire computer or home folder"), { code: "HOME_OR_ROOT" });
    if (result.some(entry => entry.id === folder.id || entry.path === canonical)) continue;
    result.push({ id: folder.id, path: canonical, name: path.basename(canonical).slice(0, 120), write: home && !homeEdits ? false : folder.write, ...(home ? { home: true } : {}) });
  }
  return result;
}
