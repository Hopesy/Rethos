import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = process.argv[2];
if (!output) throw new Error("Usage: node build-connected-computer.mjs <output.cjs>");
await build({ entryPoints: [fileURLToPath(new URL("./connected-computer.mjs", import.meta.url))], outfile: resolve(output), bundle: true, platform: "node", target: "node24", format: "cjs", logLevel: "info" });
