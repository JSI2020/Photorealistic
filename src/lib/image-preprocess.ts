export type PreprocessResult = {
  /** Contrast-boosted, auto-trimmed sketch ready for fal. */
  processed: Buffer;
  /** Optional clean line-art variant (high-contrast greyscale). */
  lineArt: Buffer;
  width: number;
  height: number;
};

function passthrough(input: Buffer): PreprocessResult {
  return {
    processed: input,
    lineArt: input,
    width: 0,
    height: 0,
  };
}

/**
 * Preprocess an uploaded sketch.
 *
 * Sharp is native and has been segfaulting (exit 139) on Render free Docker.
 * Only load it when ENABLE_SHARP=1. Production Docker leaves it off.
 */
export async function preprocessSketch(input: Buffer): Promise<PreprocessResult> {
  if (process.env.ENABLE_SHARP !== "1") {
    return passthrough(input);
  }

  try {
    const { preprocessWithSharp } = await import("@/lib/image-preprocess-sharp");
    return await preprocessWithSharp(input);
  } catch (err) {
    console.warn("[preprocess] sharp unavailable, uploading original:", err);
    return passthrough(input);
  }
}

export async function bufferToPngBlob(
  buffer: Buffer,
  name = "image.png",
): Promise<File> {
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}
