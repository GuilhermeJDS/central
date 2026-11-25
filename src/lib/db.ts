import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Um cliente só, com o adaptador certo para a DATABASE_URL:
 * file:... → SQLite local; postgresql://... → Postgres (Supabase, Neon, VPS).
 */
function criar() {
  const url = process.env.DATABASE_URL?.trim() || "file:./dados/central.db";
  if (url.startsWith("file:")) {
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const global = globalThis as unknown as { __db?: PrismaClient };
export const db = global.__db ?? criar();
if (process.env.NODE_ENV !== "production") global.__db = db;

export const ehSqlite = () => (process.env.DATABASE_URL?.trim() || "file:").startsWith("file:");
