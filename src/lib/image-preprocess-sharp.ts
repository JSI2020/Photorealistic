import sharp from "sharp";

import type { PreprocessResult } from "@/lib/image-preprocess";

/** Sharp-backed preprocess — only imported when ENABLE_SHARP=1. */
export async function preprocessWithSharp(
  input: Buffer,
): Promise<PreprocessResult> {
  const trimmed = await sharp(input)
    .rotate()
    .trim({ threshold: 12 })
    .resize({
      width: 1024,
      height: 1536,
      fit: "inside",
      withoutEnlargement: false,
    })
    .normalize()
    .modulate({ brightness: 1.05, saturation: 0.85 })
    .sharpen({ sigma: 0.8 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const lineArt = await sharp(trimmed.data)
    .greyscale()
    .normalize()
    .linear(1.35, -(128 * 0.35))
    .threshold(170)
    .png()
    .toBuffer();

  return {
    processed: trimmed.data,
    lineArt,
    width: trimmed.info.width,
    height: trimmed.info.height,
  };
}
