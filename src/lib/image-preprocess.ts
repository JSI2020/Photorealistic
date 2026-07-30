import sharp from "sharp";

export type PreprocessResult = {
  /** Contrast-boosted, auto-trimmed sketch ready for fal. */
  processed: Buffer;
  /** Optional clean line-art variant (high-contrast greyscale). */
  lineArt: Buffer;
  width: number;
  height: number;
};

/**
 * Preprocess an uploaded sketch: auto-crop whitespace, boost contrast,
 * and produce a clean line version for models that benefit from it.
 */
export async function preprocessSketch(input: Buffer): Promise<PreprocessResult> {
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

export async function bufferToPngBlob(
  buffer: Buffer,
  name = "image.png",
): Promise<File> {
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}
