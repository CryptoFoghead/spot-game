// Rasterizes public/icon.svg into the PNG sizes installers actually want.
// Re-run after changing the SVG: node scripts/generate-icons.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SOURCE = path.join("public", "icon.svg");
const OUT = path.join("public", "icons");

// Maskable icons are cropped to a circle by Android, so the artwork needs
// padding inside the safe zone (the inner ~80%).
const TARGETS = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  { file: "icon-maskable-512.png", size: 512, padding: 0.1 },
  { file: "apple-touch-icon.png", size: 180, padding: 0 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const svg = fs.readFileSync(SOURCE);

  for (const { file, size, padding } of TARGETS) {
    const inner = Math.round(size * (1 - padding * 2));
    const offset = Math.round((size - inner) / 2);

    const art = await sharp(svg, { density: 384 })
      .resize(inner, inner)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: art, top: offset, left: offset }])
      .png()
      .toFile(path.join(OUT, file));

    console.log(`wrote ${path.join(OUT, file)} (${size}x${size})`);
  }
})();
