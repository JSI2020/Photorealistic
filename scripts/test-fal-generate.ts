/**
 * Part 4 exit: generate one image from a sample sketch and print URL + cost.
 * Run: npm run fal:test
 */
import { fal } from "@fal-ai/client";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const key = process.env.FAL_KEY;
  if (!key) {
    console.error("FAL_KEY missing in .env.local");
    process.exit(1);
  }

  fal.config({ credentials: key });

  // Minimal line-art "sketch" of a tunic silhouette for the smoke test.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
      <rect width="768" height="1024" fill="#f7f5f2"/>
      <g fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M280 210 L320 160 L384 140 L448 160 L488 210"/>
        <path d="M280 210 L250 340 L290 360 L300 520 L280 780 L384 800 L488 780 L468 520 L478 360 L518 340 L488 210"/>
        <path d="M320 160 Q384 190 448 160"/>
        <path d="M300 420 L468 420"/>
        <path d="M310 520 Q384 560 458 520"/>
        <circle cx="360" cy="480" r="6" fill="#1a1a1a" stroke="none"/>
        <circle cx="408" cy="480" r="6" fill="#1a1a1a" stroke="none"/>
      </g>
      <text x="384" y="940" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#666">sample kameez sketch</text>
    </svg>`;

  const sketchUrl = await fal.storage.upload(
    new Blob([svg], { type: "image/svg+xml" }),
  );
  console.log("Uploaded sketch:", sketchUrl);

  const { generateFromSketch } = await import("../src/lib/fal");
  const { buildPrompt } = await import("../src/lib/prompt-builder");

  const built = buildPrompt({
    description: "red kameez, ivory palazzo, lawn fabric",
    shirtColour: "red",
    trouserColour: "ivory",
    fabric: "lawn",
  });

  console.log("Calling fal generateFromSketch…");
  const result = await generateFromSketch({
    sketchUrls: [sketchUrl],
    prompt: built.prompt,
    negativePrompt: built.negativePrompt,
    seed: built.seed,
  });

  if (!result.ok) {
    console.error("FAILED:", result.error);
    process.exit(1);
  }

  console.log("OK");
  console.log("imageUrl:", result.imageUrl);
  console.log("seed:", result.seed);
  console.log("costUsd:", result.costUsd);
  console.log("modelId:", result.modelId);
  console.log("requestId:", result.requestId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
