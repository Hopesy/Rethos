import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createComputerSharing } from "../../electron/computer-sharing.mjs";
import { SharedComputerControl } from "../../server/shared-computer-control.ts";
import { TurnResources } from "../../server/turn-resources.ts";

async function main() {
  const configPath = process.argv[2];
  if (!configPath) throw new Error("Usage: connected-computer.cjs <computer.json>");
  const config = JSON.parse((await fs.readFile(configPath, "utf8")).replace(/^\uFEFF/, ""));
  if (config.botPermissions !== true || !config.environmentId || !config.tokenFile) throw new Error("Configure the server identity, token file and botPermissions consent");
  const env = { id: config.environmentId, origin: config.origin, name: config.name ?? "Rethos" };
  const control = new SharedComputerControl(new TurnResources());
  const profile = path.join(path.dirname(configPath), "computer-sharing.json");
  const sharing = createComputerSharing({
    file: profile, environments: () => [env],
    fetch: async (url, init) => {
      const token = (await fs.readFile(config.tokenFile, "utf8")).trim();
      return fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
    },
    cuaConnection: async () => config.cua ? { mcpCommand: config.cua.command, mcpArgs: config.cua.args, mcpEnv: config.cua.env ?? {} } : null,
    hostControl: async id => {
      const refusal = control.acquire(id);
      if (refusal) throw new Error(refusal);
      return { renew: async () => control.renew(id), release: async () => control.release(id) };
    },
    log: message => process.stderr.write(message + "\n"),
    onChange: status => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), lending: status.lending, busy: status.busy }) + "\n"),
  });
  const stop = () => { sharing.close(); control.close(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const identity = await sharing.ownServer(env);
    if (!identity || identity.environmentId !== config.environmentId) throw new Error("The connected server identity or owner sign-in changed");
    const stored = sharing.state(env.id);
    if (stored.own) sharing.start();
    else {
      const folders = await Promise.all((config.folders ?? []).map(async folder => ({
        id: folder.id ?? randomUUID(), name: folder.name, path: await fs.realpath(folder.path), write: folder.write === true,
      })));
      await sharing.lendOwn(env, { folders, terminal: config.terminal === true, computer: Boolean(config.cua), botPermissions: true });
    }
  } catch (error) { stop(); throw error; }
}

main().catch(error => { process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; });
