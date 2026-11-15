import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = process.argv[2];
if (!output) throw new Error("Usage: node deploy/local-files/build.mjs <output.mjs>");
await build({ entryPoints: [fileURLToPath(new URL("./server.mjs", import.meta.url))], outfile: resolve(output), bundle: true, platform: "node", target: "node24", format: "esm", logLevel: "info" });
