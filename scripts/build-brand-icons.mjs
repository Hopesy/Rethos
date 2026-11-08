import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Rethos">
  <rect width="1024" height="1024" rx="224" fill="#17191d"/>
  <path d="M294 244h238c138 0 208 70 208 181 0 81-42 137-116 164l151 191H628L491 602h-76v178H294V244Zm121 109v144h109c58 0 89-24 89-72 0-47-31-72-89-72H415Z" fill="#f4f1eb"/>
</svg>\n`;
const png = size => new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
const save = (relative, bytes) => { const file = join(root, relative); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); };
save("build/icon.svg", svg);
save("public/app-icon.svg", svg);
for (const [file, size] of [["build/icon-1024.png",1024],["electron/resources/app-icon.png",512],["public/app-icon-512.png",512],["public/app-icon-192.png",192],["public/apple-touch-icon.png",180]]) save(file, png(size));
for (const size of [16,32,64,128,256,512]) {
  save(`build/icon.iconset/icon_${size}x${size}.png`,png(size));
  save(`build/icon.iconset/icon_${size}x${size}@2x.png`,png(size*2));
}
const sizes = [16,24,32,48,64,128,256];
const images = sizes.map(png);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1,2);
header.writeUInt16LE(sizes.length,4);
let offset=header.length;
sizes.forEach((size,index)=>{
  const at=6+index*16;
  header[at]=header[at+1]=size===256?0:size;
  header.writeUInt16LE(1,at+4);
  header.writeUInt16LE(32,at+6);
  header.writeUInt32LE(images[index].length,at+8);
  header.writeUInt32LE(offset,at+12);
  offset+=images[index].length;
});
save("build/icon.ico",Buffer.concat([header,...images]));
const chunks = [["ic07",128],["ic08",256],["ic09",512],["ic10",1024],["ic11",32],["ic12",64]].map(([type,size])=>{
  const image=png(size), head=Buffer.alloc(8);
  head.write(type); head.writeUInt32BE(8+image.length,4);
  return Buffer.concat([head,image]);
});
const icns=Buffer.alloc(8); icns.write("icns"); icns.writeUInt32BE(8+chunks.reduce((sum,chunk)=>sum+chunk.length,0),4);
save("build/icon.icns",Buffer.concat([icns,...chunks]));
console.log("Rethos SVG, desktop and PWA icons generated.");
