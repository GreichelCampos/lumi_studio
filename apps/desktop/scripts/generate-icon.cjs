const { app, nativeImage } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');

app.whenReady().then(() => {
  const sourcePath = join(__dirname, '..', 'resources', 'lumi-taskbar-source.png');
  const outputPath = join(__dirname, '..', 'resources', 'lumi-taskbar-adapted.ico');
  const sourceBytes = readFileSync(sourcePath);
  const source = nativeImage.createFromBuffer(sourceBytes);
  const { width, height } = source.getSize();
  if (source.isEmpty() || width !== height || width < 256) {
    throw new Error('Se requiere un PNG cuadrado de al menos 256 px; no se deformará la imagen.');
  }
  // Ignore nearly invisible alpha residue when locating the actual artwork.
  // Fit the whole adapted silhouette; never crop parts of the character.
  const pixels = source.toBitmap();
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('El PNG no contiene una imagen visible.');
  const artworkSize = Math.max(right - left + 1, bottom - top + 1);
  const size = Math.min(width, Math.ceil(artworkSize * 1.04));
  const crop = {
    x: Math.max(0, Math.min(width - size, Math.floor((left + right + 1 - size) / 2))),
    y: Math.max(0, Math.min(height - size, Math.floor((top + bottom + 1 - size) / 2))),
    width: size, height: size,
  };
  const artwork = source.crop(crop);
  writeFileSync(join(__dirname, '..', 'resources', 'lumi-taskbar.png'), artwork.toPNG());
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = sizes.map((size) => artwork.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); // ICO, with PNG-compressed RGBA frames (Windows Vista+).
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  writeFileSync(outputPath, Buffer.concat([header, ...images]));
  console.log(`Ícono generado: ${sizes.join(', ')} px. Mascota completa, sin primer plano ni recoloración.`);
  console.log(`SHA-256 variante para ícono: ${createHash('sha256').update(sourceBytes).digest('hex')}`);
  app.quit();
}).catch((error) => { console.error(error); app.exit(1); });
