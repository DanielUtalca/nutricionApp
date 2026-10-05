// Genera los íconos PNG de la PWA a partir de public/icons/icon.svg
// Uso: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(out(`icon-${size}.png`));
}
// Maskable: el ícono ocupa el 80 % central sobre fondo verde (zona segura)
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#2F9E44" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("maskable-512.png"));
await sharp(svg).resize(180, 180).flatten({ background: "#2F9E44" }).png().toFile(out("apple-touch-icon.png"));
console.log("Íconos generados en public/icons/");
