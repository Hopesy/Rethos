import { deflateSync } from "node:zlib";
import environments from "./environments.cjs";

export const CLOUD_COLORS = environments.ENTRY_COLORS;
export const DEFAULT_CLOUD_COLOR = "blue";
export const CLOUD_NAME_MAX = 28;
/** Each colour in the default skin (src/lib/mascot.ts MAUS_COLORS), for the native menu's dot; the page uses the skin's own. */
export const CLOUD_COLOR_HEX = Object.freeze({ blue: "#377FE6", teal: "#01A492", purple: "#8057C8", orange: "#E78531", red: "#D94B52", yellow: "#D8A729" });
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/;

export function cleanCloudName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name && [...name].length <= CLOUD_NAME_MAX && !CONTROL.test(name) ? name : null;
}
export const cleanCloudColor = value => (CLOUD_COLORS.includes(value) ? value : null);

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = bytes => { let c = 0xffffffff; for (const byte of bytes) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngChunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, "latin1"); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
/** A filled circle with a soft edge, as a PNG data URL (straight RGBA, so no platform's pixel order matters). */
export function colorDotPng(hex, size, diameter = size * 0.72) {
  const [red, green, blue] = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16));
  const rows = Buffer.alloc(size * (size * 4 + 1)), center = size / 2, radius = diameter / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x + 0.5 - center, y + 0.5 - center)));
      rows.set([red, green, blue, Math.round(alpha * 255)], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(rows)), pngChunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** The native switcher's dot for a saved colour (14 pt, sharp at 2x), drawn once per colour; null where it cannot be drawn. */
export function colorDotIcons(nativeImage) {
  const made = new Map();
  return color => {
    if (!cleanCloudColor(color)) return null;
    if (!made.has(color)) {
      try {
        const image = nativeImage.createEmpty();
        for (const scaleFactor of [1, 2]) image.addRepresentation({ scaleFactor, dataURL: colorDotPng(CLOUD_COLOR_HEX[color], 14 * scaleFactor) });
        made.set(color, image.isEmpty() ? null : image);
      } catch { made.set(color, null); }
    }
    return made.get(color) ?? null;
  };
}


export { CLOUD_SWATCH_COLORS, CLOUD_SWATCHES, swatchColor } from "../shared/place-colors.mjs";
