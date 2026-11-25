import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "pg", "sharp"],
  // Fotos da marca e da biblioteca sobem por Server Action.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  poweredByHeader: false,
  // As skills são lidas do disco em tempo de execução: vão junto no deploy (Vercel).
  outputFileTracingIncludes: { "/**": ["./skills/**/*"] },
  // Permite rodar uma segunda cópia (testes) sem brigar com a pasta .next da principal.
  distDir: process.env.CENTRAL_DIST || ".next",
};

export default config;
