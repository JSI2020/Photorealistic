/**
 * Pure-JS sketch preprocessing (pngjs — no native sharp).
 * Contrast boost, crop-to-drawing, and a lineart derivative.
 */

import { PNG } from "pngjs";

export type PreprocessResult = {
  processed: Buffer;
  lineArt: Buffer;
  width: number;
  height: number;
};

function isPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function decodePng(input: Buffer): PNG {
  return PNG.sync.read(input);
}

function encodePng(png: PNG): Buffer {
  return PNG.sync.write(png);
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Stretch contrast around midtones — helps faint pencil sketches. */
function boostContrast(png: PNG, amount = 1.35): void {
  const { data, width, height } = png;
  const mid = 128;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    for (let c = 0; c < 3; c++) {
      const v = data[o + c]!;
      const n = Math.round(mid + (v - mid) * amount);
      data[o + c] = Math.max(0, Math.min(255, n));
    }
  }
}

/** Trim near-white margins so the drawing fills the frame. */
function cropToDrawing(png: PNG, threshold = 245, pad = 12): PNG {
  const { data, width, height } = png;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const a = data[o + 3]!;
      if (a < 8) continue;
      const lum = luminance(data[o]!, data[o + 1]!, data[o + 2]!);
      if (lum < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return png;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  if (cw >= width - 4 && ch >= height - 4) return png;

  const out = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const src = ((minY + y) * width + (minX + x)) * 4;
      const dst = (y * cw + x) * 4;
      out.data[dst] = data[src]!;
      out.data[dst + 1] = data[src + 1]!;
      out.data[dst + 2] = data[src + 2]!;
      out.data[dst + 3] = data[src + 3]!;
    }
  }
  return out;
}

/** High-contrast ink-like lineart for a second fal reference. */
function toLineArt(png: PNG): PNG {
  const { data, width, height } = png;
  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const lum = luminance(data[o]!, data[o + 1]!, data[o + 2]!);
    const v = lum < 170 ? 20 : 255;
    out.data[o] = v;
    out.data[o + 1] = v;
    out.data[o + 2] = v;
    out.data[o + 3] = 255;
  }
  return out;
}

/**
 * Preprocess a sketch buffer. Non-PNG inputs pass through unchanged
 * (lineArt = same buffer) so JPEG uploads still work.
 */
export async function preprocessSketch(input: Buffer): Promise<PreprocessResult> {
  if (!isPng(input)) {
    return {
      processed: input,
      lineArt: input,
      width: 0,
      height: 0,
    };
  }

  try {
    let png = decodePng(input);
    boostContrast(png, 1.4);
    png = cropToDrawing(png);
    const line = toLineArt(png);
    return {
      processed: encodePng(png),
      lineArt: encodePng(line),
      width: png.width,
      height: png.height,
    };
  } catch (err) {
    console.warn("[preprocess] failed, using original:", err);
    return {
      processed: input,
      lineArt: input,
      width: 0,
      height: 0,
    };
  }
}

export async function bufferToPngBlob(
  buffer: Buffer,
  name = "image.png",
): Promise<File> {
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}
