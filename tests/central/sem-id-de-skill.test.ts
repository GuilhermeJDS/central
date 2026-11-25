/**
 * Nenhum id de skill na tela da Central: cada skill aparece pelo nome de ação
 * (nome-acao.ts). Duas travas:
 * 1. toda skill do vendor, do cardápio e das áreas de rede tem nome de ação;
 * 2. o HTML renderizado da Central (texto e atributos que a pessoa lê, sem os
 *    <script>) não tem nenhum id de skill nem nome de repositório. Navega
 *    logado com o usuário de teste local no servidor de dev
 *    (CENTRAL_URL, padrão http://localhost:3001), seguindo os links da
 *    Central e abrindo cardápios, filtros e detalhes.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { CARDAPIO } from "@/lib/chefes/cardapio";
import { AREAS_REDES } from "@/lib/central/redes-areas";
import { NOME_DA_ACAO, idsProibidosNaTela, nomeDaAcao } from "@/lib/central/nome-acao";

const BASE = process.env.CENTRAL_URL ?? "http://localhost:3001";
const EMAIL = process.env.CENTRAL_TESTE_EMAIL ?? "teste-chefes@korely.local";
const SENHA = process.env.CENTRAL_TESTE_SENHA ?? "DacEbvSxWKc4ZGjcsDgn";

const REPO_VENDOR: Record<string, string> = {
  "claude-illegal-codes": "illegal",
  "closer-skill": "closer",
  "founder-skill": "founder",
  "instagram-agent-skill": "instagram",
  "linkedin-agent-skill": "linkedin",
  "master-skills": "master",
  tiktok: "tiktok",
  "whale-skill": "whale",
  "x-agent-skill": "x",
  "youtube-agent-skill": "youtube",
};

function skillsDoVendor(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [pasta, repo] of Object.entries(REPO_VENDOR)) {
    const base = join("vendor/skills", pasta);
    if (!existsSync(base)) continue;
    const raiz = existsSync(join(base, "skills")) ? join(base, "skills") : base;
    for (const n of readdirSync(raiz)) {
      const p = join(raiz, n);
      if (statSync(p).isDirectory() && existsSync(join(p, "SKILL.md"))) out.push([repo, n]);
    }
  }
  return out;
}

test("toda skill tem nome de ação em português", () => {
  const faltando: string[] = [];
  for (const [repo, skill] of skillsDoVendor()) if (!NOME_DA_ACAO[`${repo}/${skill}`]) faltando.push(`${repo}/${skill}`);
  for (const lista of Object.values(CARDAPIO)) for (const a of lista) if (!NOME_DA_ACAO[`${a.repositorio}/${a.skill}`]) faltando.push(`${a.repositorio}/${a.skill}`);
  for (const area of AREAS_REDES) for (const a of area.acoes) if (!NOME_DA_ACAO[`${a.repositorio}/${a.skill}`]) faltando.push(`${a.repositorio}/${a.skill}`);
  assert.deepEqual([...new Set(faltando)], [], "skills sem nome de ação em nome-acao.ts");
  assert.equal(nomeDaAcao("whale", "nao-existe"), "Trabalho do chefe");
});

test("nenhum nome de ação nem rótulo de cardápio repete um id", () => {
  const ids = idsProibidosNaTela();
  const re = proibidos(ids);
  const textos = [
    ...Object.values(NOME_DA_ACAO),
    ...Object.values(CARDAPIO).flatMap((l) => l.flatMap((a) => [a.rotulo, a.sai, a.chip, a.grupo])),
    ...AREAS_REDES.flatMap((ar) => ar.acoes.flatMap((a) => [a.rotulo, a.sai])),
  ];
  assert.deepEqual(textos.filter((t) => re.test(t)), []);
});

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Id solto: sem letra, dígito, hífen ou barra colados (barra antes conta: "/edit"). */
function proibidos(ids: string[]): RegExp {
  const lista = ids.sort((a, b) => b.length - a.length).map(escapar).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}_-])/?(?:${lista})(?![\\p{L}\\p{N}_-])`, "iu");
}

test("o HTML da Central não mostra id de skill", { timeout: 600_000 }, async () => {
  const { chromium } = await import("playwright");
  const ids = idsProibidosNaTela();
  const re = proibidos(ids);
  const navegador = await chromium.launch();
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const r = await p.goto(`${BASE}/login?redirect=%2Fcentral`, { waitUntil: "networkidle", timeout: 180_000 }).catch(() => null);
    assert.ok(r, `servidor de dev fora do ar em ${BASE} (npm run dev -- -p 3001)`);
    if (p.url().includes("/login")) {
      await p.fill("input[type=email], input[name=email]", EMAIL);
      await p.fill("input[type=password]", SENHA);
      await p.click("button[type=submit]");
      await p.waitForURL(/\/central/, { timeout: 60_000 });
    }

    const vistos = new Set<string>();
    const fila = ["/central", "/central/execucoes", "/central/decisoes", "/central/linha", "/central/redes", "/central/conexoes"];
    const achados: string[] = [];
    while (fila.length && vistos.size < 80) {
      const caminho = fila.shift()!;
      if (vistos.has(caminho)) continue;
      vistos.add(caminho);
      await p.goto(BASE + caminho, { waitUntil: "networkidle", timeout: 180_000 });
      // Abre o que estiver fechado: cardápios, detalhes, filtros.
      await p.evaluate(() => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")));
      const texto = await p.evaluate(() => {
        const c = document.body.cloneNode(true) as HTMLElement;
        c.querySelectorAll("script, style, noscript, template").forEach((e) => e.remove());
        const attrs: string[] = [];
        c.querySelectorAll("[title], [aria-label], [alt], [placeholder], option").forEach((e) => {
          for (const a of ["title", "aria-label", "alt", "placeholder"]) {
            const v = e.getAttribute(a);
            if (v) attrs.push(v);
          }
          if (e.tagName === "OPTION") attrs.push(e.textContent ?? "");
        });
        return `${c.innerText}\n${c.textContent}\n${attrs.join("\n")}`;
      });
      for (const linha of texto.split("\n")) {
        const m = linha.match(re);
        if (m) achados.push(`${caminho}: "${m[0]}" em "${linha.trim().slice(0, 140)}"`);
      }
      const links = await p.$$eval("a[href^='/central']", (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));
      for (const h of links) {
        const limpo = h.split("#")[0];
        if (/\/central\/(conta|contratar|editor)/.test(limpo) || /recibo/.test(limpo)) continue;
        if (!vistos.has(limpo)) fila.push(limpo);
      }
    }
    assert.ok(vistos.size >= 6, "a Central não abriu (login do usuário de teste?)");
    assert.deepEqual([...new Set(achados)], [], `ids de skill na tela (${vistos.size} páginas)`);
  } finally {
    await navegador.close();
  }
});
