import { defineConfig } from "prisma/config";

try { process.loadEnvFile(); } catch { /* sem .env: usa o ambiente */ }

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL || "file:./dados/garimpo.db" },
});
