import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const designs = sqliteTable("designs", {
  id: text("id").primaryKey(),
  title: text("title"),
  description: text("description"),
  shirtColour: text("shirt_colour"),
  trouserColour: text("trouser_colour"),
  fabric: text("fabric"),
  sketchUrlsJson: text("sketch_urls_json").notNull().default("[]"),
  oldDesignUrl: text("old_design_url"),
  personaJson: text("persona_json"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  totalCost: real("total_cost").notNull().default(0),
  saved: integer("saved", { mode: "boolean" }).notNull().default(false),
});

export const designVersions = sqliteTable("design_versions", {
  id: text("id").primaryKey(),
  designId: text("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  parentVersionId: text("parent_version_id"),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  seed: integer("seed"),
  modelId: text("model_id").notNull(),
  feedback: text("feedback"),
  costUsd: real("cost_usd").notNull().default(0),
  requestId: text("request_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  personaDescription: text("persona_description"),
  seed: integer("seed"),
  lockSeed: integer("lock_seed", { mode: "boolean" }).notNull().default(true),
  generateModel: text("generate_model").notNull().default("nano-banana-edit"),
  refineModel: text("refine_model").notNull().default("nano-banana-edit"),
  preferredHouseModelId: text("preferred_house_model_id")
    .notNull()
    .default("random"),
  monthlySpendReminderUsd: real("monthly_spend_reminder_usd"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
