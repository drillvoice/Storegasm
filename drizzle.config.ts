import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js keeps env vars in .env.local, which dotenv doesn't load by default.
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
