export type PreprocessResult = {
  processed: Buffer;
  lineArt: Buffer;
  width: number;
  height: number;
};

/**
 * Pass-through only.
 * Sharp was removed from the Next.js runtime path — its native binary
 * segfaulted on Render free Docker (exit 139 → HTML 502).
 * Local contrast/crop can be re-added later via a separate script if needed.
 */
export async function preprocessSketch(input: Buffer): Promise<PreprocessResult> {
  return {
    processed: input,
    lineArt: input,
    width: 0,
    height: 0,
  };
}

export async function bufferToPngBlob(
  buffer: Buffer,
  name = "image.png",
): Promise<File> {
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}
