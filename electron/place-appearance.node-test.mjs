import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { CLOUD_COLORS, CLOUD_COLOR_HEX, cleanCloudColor, cleanCloudName, colorDotIcons, colorDotPng,
 } from "./place-appearance.mjs";
import environments from "./environments.cjs";

const origin = "https://omb-u-1a2b3c4d5e6f.fly.dev";

test("a Cloud's name is up to 28 characters of plain text, and its colour one of six names", () => {
  assert.equal(cleanCloudName("  Studio   cloud "), "Studio cloud");
  assert.equal(cleanCloudName("é".repeat(28)), "é".repeat(28));
  for (const bad of ["", "   ", "x".repeat(29), "nul\u0000here", "bell\u0007", 42, null]) assert.equal(cleanCloudName(bad), null, JSON.stringify(bad));
  assert.equal(cleanCloudName("tab\there\nnext"), "tab here next", "white space is one space");
  assert.deepEqual([...CLOUD_COLORS], ["blue", "teal", "purple", "orange", "red", "yellow"]);
  assert.deepEqual(CLOUD_COLORS, environments.ENTRY_COLORS, "one list for the saved entry and the sheet");
  for (const bad of ["#ff0000", "Blue", "green", "", null, "url(x)"]) assert.equal(cleanCloudColor(bad), null, String(bad));
  assert.equal(cleanCloudColor("teal"), "teal");
});

/** The PNG's own reading: its chunks' checksums, its size and its straight RGBA pixels. */
function readPng(url) {
  const png = Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64");
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let at = 8, header = null; const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at), type = png.toString("latin1", at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], colour: body[9] };
    if (type === "IDAT") data.push(body);
    at += 12 + length;
  }
  const rows = inflateSync(Buffer.concat(data)), stride = header.width * 4 + 1;
  return { header, pixel: (x, y) => [...rows.subarray(y * stride + 1 + x * 4, y * stride + 5 + x * 4)] };
}

test("the native menu's dot is a filled circle drawn as a PNG (straight RGBA), once per colour, at 1x and 2x", () => {
  const { header, pixel } = readPng(colorDotPng("#377FE6", 28));
  assert.deepEqual(header, { width: 28, height: 28, depth: 8, colour: 6 });
  assert.deepEqual(pixel(14, 14), [0x37, 0x7f, 0xe6, 255], "red, green, blue, alpha");
  assert.equal(pixel(0, 0)[3], 0);
  const edge = pixel(14, 3)[3];
  assert.ok(edge > 0 && edge < 255, "a soft edge");
  const made = [];
  const iconFor = colorDotIcons({ createEmpty: () => ({ reps: [], addRepresentation(options) { this.reps.push(options); made.push(options); }, isEmpty() { return this.reps.length === 0; } }) });
  assert.equal(iconFor("teal"), iconFor("teal"));
  assert.deepEqual(made.map(rep => [rep.scaleFactor, readPng(rep.dataURL).header.width]), [[1, 14], [2, 28]]);
  assert.deepEqual(readPng(made[1].dataURL).pixel(14, 14), [0x01, 0xa4, 0x92, 255], "teal");
  assert.equal(iconFor("#ff0000"), null);
  assert.equal(colorDotIcons({ createEmpty: () => { throw new Error("no"); } })("red"), null, "a dot that cannot be drawn is no dot");
  assert.equal(colorDotIcons({ createEmpty: () => ({ addRepresentation() {}, isEmpty: () => true }) })("red"), null);
  for (const color of CLOUD_COLORS) assert.match(CLOUD_COLOR_HEX[color], /^#[0-9A-F]{6}$/i);
  const state = { environments: [{ id: "c", kind: "remote", name: "Studio", origin, color: "teal" }, { id: "o", kind: "remote", name: "Office", origin: "https://office.example" }], activeId: "local" };
  const items = environments.workspaceMenuTemplate(state, { onSwitch() {}, onConnect() {}, onForget() {}, iconFor });
  assert.equal(items.find(item => item.id === "workspace-c").icon, iconFor("teal"));
  assert.equal("icon" in items.find(item => item.id === "workspace-o"), false);
  assert.equal("icon" in environments.workspaceMenuTemplate(state, { onSwitch() {}, onConnect() {}, onForget() {} }).find(item => item.id === "workspace-c"), false);
});
