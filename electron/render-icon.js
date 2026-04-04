const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(process.argv[2] || 'electron/resources/bible-song-pro-icon.svg');
const outputDir = path.resolve(process.argv[3] || 'electron/resources/win-iconset');
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

app.whenReady().then(() => {
  const image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) {
    throw new Error(`Failed to load icon source: ${sourcePath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  for (const size of sizes) {
    const resized = image.resize({ width: size, height: size, quality: 'best' });
    fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), resized.toPNG());
  }

  app.quit();
}).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
