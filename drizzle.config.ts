import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/platform/db/schema/*.ts",
  out: "./lib/platform/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});