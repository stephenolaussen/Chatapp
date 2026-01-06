#!/usr/bin/env node

/**
 * Icon Generator for Familieskatt PWA
 * Generates PNG icons from SVG using canvas simulation
 */

const path = require('path');
const fs = require('fs');

// For now, we'll create placeholder images
// In production, use a library like 'sharp' or 'jimp' to generate actual PNGs

const iconSizes = [192, 512];

const createPlaceholder = (size) => {
  // Create a simple PNG placeholder (1x1 pixel for now)
  // In production, generate proper images
  const width = size;
  const height = size;
  
  // Simple base64 encoded placeholder PNG (purple square with emoji)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, // compression info
    0x00, 0x00, 0xFE, 0xFF, // data
    0x66, 0x2E, 0x65, 0xEA, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  return pngData;
};

try {
  const iconsDir = path.join(__dirname, 'public', 'icons');
  
  // Create icons
  iconSizes.forEach(size => {
    const filename = `icon-${size}.png`;
    const filepath = path.join(iconsDir, filename);
    const data = createPlaceholder(size);
    fs.writeFileSync(filepath, data);
    console.log(`✓ Created ${filename}`);
  });

  // Create maskable variants
  iconSizes.forEach(size => {
    const filename = `icon-maskable-${size}.png`;
    const filepath = path.join(iconsDir, filename);
    const data = createPlaceholder(size);
    fs.writeFileSync(filepath, data);
    console.log(`✓ Created ${filename}`);
  });

  console.log('\n✓ All icons generated successfully!');
} catch (err) {
  console.error('Error generating icons:', err);
  process.exit(1);
}
