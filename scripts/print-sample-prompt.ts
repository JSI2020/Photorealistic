/**
 * One-off inspect script for Part 3 exit criterion.
 * Run: npx tsx --tsconfig tsconfig.json scripts/print-sample-prompt.ts
 */
import { buildPrompt } from "../src/lib/prompt-builder";

const sample = buildPrompt({
  description: "red kameez, ivory palazzo, lawn fabric",
  shirtColour: "red",
  trouserColour: "ivory",
  fabric: "lawn",
  feedback: "make the shirt deep red and add subtle gold embroidery on the sleeves",
});

console.log("=== PROMPT ===");
console.log(sample.prompt);
console.log("\n=== NEGATIVE PROMPT ===");
console.log(sample.negativePrompt);
console.log("\n=== SEED ===");
console.log(sample.seed);
