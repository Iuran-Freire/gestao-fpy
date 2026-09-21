import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/backend/database/migrations",
  schema: "./src/backend/database/schema.ts",
  dialect: "sqlite",
});
