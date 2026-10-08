/**
 * scripts/make-icons.mjs
 * ---------------------
 * Draws the app icon as PNG files.
 *
 * You do not normally need to run this: the finished icons are already in
 * public/icons. Run it only if you change the picture:
 *
 *     npm run icons
 *
 * It writes three files: icon-192.png, icon-512.png and icon-maskable-512.png.
 * Only Node's built-in tools are used, so nothing extra is installed.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ICON_DIR = join(HERE, '..', 'public', 'icons')

/** The colours used, matching public/icons/icon.svg. */
const TEAL = [15, 118, 110]
const WHITE = [255, 255, 255]
const MINT = [153, 246, 228]

/** A simple picture we can paint shapes onto. */
function createCanvas(size) {
  const pixels = new Uint8Array(size * size * 3)
  return {
    size,
    pixels,
    fill(colour) {
      for (let i = 0; i < size * size; i += 1) {
        pixels[i * 3] = colour[0]
        pixels[i * 3 + 1] = colour[1]
        pixels[i * 3 + 2] = colour[2]
      }
    },
    /** Paints one pixel, ignoring anything outside the picture. */
    set(x, y, colour, alpha = 1) {
      if (x < 0 || y < 0 || x >= size || y >= size) return
      const index = (y * size + x) * 3
      pixels[index] = Math.round(pixels[index] * (1 - alpha) + colour[0] * alpha)
      pixels[index + 1] = Math.round(pixels[index + 1] * (1 - alpha) + colour[1] * alpha)
      pixels[index + 2] = Math.round(pixels[index + 2] * (1 - alpha) + colour[2] * alpha)
    },
  }
}

/** A rectangle with soft (rounded) corners. */
function roundRect(canvas, x, y, width, height, radius, colour, alpha = 1) {
  const left = Math.round(x)
  const top = Math.round(y)
  const right = Math.round(x + width)
  const bottom = Math.round(y + height)
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      // How far inside the rounded corner are we?
      const dx = Math.min(px - left, right - 1 - px)
      const dy = Math.min(py - top, bottom - 1 - py)
      if (dx >= radius || dy >= radius) {
        canvas.set(px, py, colour, alpha)
        continue
      }
      const cornerX = radius - dx
      const cornerY = radius - dy
      const distance = Math.sqrt(cornerX * cornerX + cornerY * cornerY)
      if (distance <= radius) canvas.set(px, py, colour, alpha)
      else if (distance <= radius + 1) canvas.set(px, py, colour, alpha * (radius + 1 - distance))
    }
  }
}

/** Builds the whole icon at one size. */
function drawIcon(size, maskable) {
  const canvas = createCanvas(size)
  const scale = size / 512
  // A maskable icon needs its picture inside a safe area, so it is drawn smaller.
  const inset = maskable ? Math.round(size * 0.1) : 0
  const box = size - inset * 2
  const at = (value) => inset + value * scale

  if (!maskable) {
    roundRect(canvas, 0, 0, size, size, Math.round(96 * scale), TEAL)
  } else {
    canvas.fill(TEAL)
  }

  const barWidth = Math.round(320 * scale * (box / size))
  const left = Math.round((size - barWidth) / 2)

  // The heading bar.
  roundRect(canvas, left, at(120), barWidth, Math.round(40 * scale), Math.round(10 * scale), WHITE, 0.95)
  // Four lines of data.
  const rows = [
    [184, 0.55],
    [228, 0.35],
    [272, 0.55],
    [316, 0.35],
  ]
  for (const [y, alpha] of rows) {
    roundRect(canvas, left, at(y), barWidth, Math.round(28 * scale), Math.round(8 * scale), WHITE, alpha)
  }
  // The totals bar.
  roundRect(canvas, left, at(384), barWidth, Math.round(44 * scale), Math.round(10 * scale), MINT)

  // The two column separators.
  const separatorWidth = Math.max(1, Math.round(10 * scale))
  roundRect(canvas, left + Math.round(92 * scale), at(120), separatorWidth, Math.round(64 * scale), 0, TEAL)
  roundRect(canvas, left + Math.round(92 * scale), at(184), separatorWidth, Math.round(160 * scale), 0, TEAL)

  return canvas
}

/** The CRC a PNG chunk needs, so the file is valid. */
const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** Turns our picture into a real PNG file. */
function toPng(canvas) {
  const { size, pixels } = canvas
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1)
    raw[rowStart] = 0 // "no filter", which every reader understands
    for (let x = 0; x < size; x += 1) {
      const from = (y * size + x) * 3
      raw[rowStart + 1 + x * 3] = pixels[from]
      raw[rowStart + 2 + x * 3] = pixels[from + 1]
      raw[rowStart + 3 + x * 3] = pixels[from + 2]
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 8 bits per colour
  header[9] = 2 // true colour (red, green, blue)
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(ICON_DIR, { recursive: true })

const jobs = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]

for (const job of jobs) {
  writeFileSync(join(ICON_DIR, job.name), toPng(drawIcon(job.size, job.maskable)))
  console.log(`wrote ${job.name}`)
}
