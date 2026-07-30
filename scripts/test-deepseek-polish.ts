import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { polishUserPrompt } = await import("../src/lib/deepseek");
  const result = await polishUserPrompt({
    mode: "generate",
    description: "redish kameez with soft pants lawn type",
    shirtColour: "redish",
    trouserColour: "offwhite",
    fabric: "lawn",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
