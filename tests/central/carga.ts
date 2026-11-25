/**
 * Teste de carga da Central (item 4): N contas pedem carrossel ao mesmo tempo,
 * cada uma com a própria chave de IA. O modelo é simulado (o fetch para
 * /chat/completions é interceptado e responde depois de uma latência
 * aleatória), então nada sai para a internet nem gasta crédito.
 *
 * Mede, por peça: espera na fila (do pedido até o modelo ser chamado) e
 * tempo total (até a peça ficar PRONTA); dá p50, p95 e máx. Confere que
 * nada travou (toda peça termina) e que nada misturou (cada conta recebe
 * só o próprio carrossel e cada chamada ao modelo leva a chave da conta).
 *
 * Uso: npm run carga:central
 *   CARGA_CONTAS=100 CARGA_PECAS=1 CARGA_LAT_MIN=2000 CARGA_LAT_MAX=6000
 *   CENTRAL_FILA_POR_CONTA / CENTRAL_FILA_GLOBAL mudam os limites da fila.
 */
import { criarPecaNova } from "@/lib/central/producao";
import { filaCentral } from "@/lib/central/fila";
import { cifrar } from "@/lib/ia/cofre";
import { prisma } from "@/lib/prisma";

import { apagarContasDeTeste, criarConta } from "./_contas";

const CONTAS = Number(process.env.CARGA_CONTAS ?? 100);
const PECAS = Number(process.env.CARGA_PECAS ?? 1);
const LAT_MIN = Number(process.env.CARGA_LAT_MIN ?? 2000);
const LAT_MAX = Number(process.env.CARGA_LAT_MAX ?? 6000);
const LIMITE_MS = Number(process.env.CARGA_LIMITE_MS ?? 10 * 60_000);

const MARCA = /\[\[conta:([\w-]+)#(\d+)\]\]/;

type Medida = { conta: string; n: number; pedido: number; modelo?: number; pronta?: number };
const medidas = new Map<string, Medida>();
const chaveDaConta = new Map<string, string>();
const problemas: string[] = [];
let chamadasModelo = 0;

// --------------------------------------------------------------------------
// Modelo simulado
// --------------------------------------------------------------------------
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(url);
  if (!u.includes("/chat/completions")) return fetchOriginal(url, init);
  chamadasModelo++;
  const corpo = JSON.parse(String(init?.body ?? "{}")) as { messages: { role: string; content: string }[] };
  const texto = corpo.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const m = MARCA.exec(texto);
  const chave = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
  if (!m) problemas.push("chamada ao modelo sem marca de conta");
  else {
    const med = medidas.get(`${m[1]}#${m[2]}`);
    if (!med) problemas.push(`marca desconhecida ${m[1]}`);
    else med.modelo ??= performance.now();
    if (chaveDaConta.get(m[1]) !== chave) problemas.push(`conta ${m[1]} chamou o modelo com chave de outra conta`);
    const outras = [...texto.matchAll(new RegExp(MARCA, "g"))].filter((x) => x[1] !== m[1]);
    if (outras.length) problemas.push(`pedido de ${m[1]} levou texto de outra conta`);
  }
  await new Promise((ok) => setTimeout(ok, LAT_MIN + Math.random() * (LAT_MAX - LAT_MIN)));
  const marca = m ? m[0] : "[[conta:?#0]]";
  const slides = Array.from({ length: 5 }, (_, i) => ({ titulo: `Slide ${i + 1} ${marca}`, texto: `Texto ${marca}`, imagem: "foto" }));
  const content = JSON.stringify({ titulo: `Carrossel ${marca}`, legenda: `Legenda ${marca}`, slides });
  return new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 500, completion_tokens: 400 } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}) as typeof fetch;

// --------------------------------------------------------------------------
function pct(v: number[], p: number): number {
  if (!v.length) return NaN;
  const o = [...v].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)];
}
const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

async function main() {
  console.log(`Carga: ${CONTAS} contas × ${PECAS} carrossel, modelo simulado ${LAT_MIN}–${LAT_MAX} ms, fila ${filaCentral.porConta}/conta e ${filaCentral.global} global`);
  await apagarContasDeTeste();
  const contas: string[] = [];
  for (let i = 0; i < CONTAS; i++) {
    const { id } = await criarConta(`carga-${i}`);
    const chave = `sk-simulada-${id}`;
    chaveDaConta.set(id, chave);
    await prisma.chaveIa.create({
      data: { accountId: id, provedor: "OPENAI", chaveCifrada: cifrar(chave), ultimos4: chave.slice(-4), modelo: "modelo-simulado", validaEm: new Date() },
    });
    contas.push(id);
  }

  // Todos ao mesmo tempo.
  const t0 = performance.now();
  const ids = new Map<string, string>(); // entregaId → conta#n
  await Promise.all(
    contas.flatMap((conta) =>
      Array.from({ length: PECAS }, async (_, n) => {
        const chave = `${conta}#${n}`;
        medidas.set(chave, { conta, n, pedido: performance.now() });
        const { id } = await criarPecaNova(conta, { tipo: "CARROSSEL", rede: "INSTAGRAM", tema: `Dicas da semana [[conta:${conta}#${n}]]`, slides: 5 });
        ids.set(id, chave);
      }),
    ),
  );
  const tPedidos = performance.now() - t0;

  // Acompanha até todas terminarem.
  let pendentes = ids.size;
  while (pendentes && performance.now() - t0 < LIMITE_MS) {
    await new Promise((ok) => setTimeout(ok, 100));
    const linhas = await prisma.entregaChefe.findMany({
      where: { id: { in: [...ids.keys()] }, status: { in: ["PRONTA", "ERRO"] } },
      select: { id: true, status: true },
    });
    const agora = performance.now();
    for (const l of linhas) {
      const med = medidas.get(ids.get(l.id)!)!;
      med.pronta ??= agora;
    }
    pendentes = ids.size - linhas.length;
  }
  const tTotal = performance.now() - t0;

  // Conferência: cada conta só com o próprio carrossel.
  const finais = await prisma.entregaChefe.findMany({
    where: { id: { in: [...ids.keys()] } },
    select: { id: true, accountId: true, status: true, erro: true, titulo: true, texto: true, conteudo: true },
  });
  const erros = finais.filter((f) => f.status !== "PRONTA");
  for (const f of finais) {
    const [conta] = ids.get(f.id)!.split("#");
    if (f.accountId !== conta) problemas.push(`peça ${f.id} gravada em outra conta`);
    if (f.status !== "PRONTA") continue;
    const tudo = JSON.stringify([f.titulo, f.texto, f.conteudo]);
    const donos = new Set([...tudo.matchAll(new RegExp(MARCA, "g"))].map((x) => x[1]));
    if (donos.size !== 1 || !donos.has(conta)) problemas.push(`peça de ${conta} tem conteúdo de ${[...donos].join(",")}`);
  }
  const versoes = await prisma.versaoEntrega.findMany({ where: { entregaId: { in: [...ids.keys()] } }, select: { accountId: true, entregaId: true } });
  for (const v of versoes) if (finais.find((f) => f.id === v.entregaId)?.accountId !== v.accountId) problemas.push(`versão de ${v.entregaId} em outra conta`);

  const ms = [...medidas.values()];
  const espera = ms.filter((m) => m.modelo).map((m) => m.modelo! - m.pedido);
  const total = ms.filter((m) => m.pronta).map((m) => m.pronta! - m.pedido);
  const est = filaCentral.estatisticas();

  console.log("");
  console.log(`Pedidos aceitos em          ${s(tPedidos)} (${ids.size} peças)`);
  console.log(`Todas terminaram em         ${s(tTotal)}${pendentes ? `  — ${pendentes} NÃO terminaram (travou)` : ""}`);
  console.log(`Chamadas ao modelo          ${chamadasModelo}`);
  console.log(`Espera na fila   p50 ${s(pct(espera, 50))}  p95 ${s(pct(espera, 95))}  máx ${s(Math.max(...espera))}`);
  console.log(`Tempo total      p50 ${s(pct(total, 50))}  p95 ${s(pct(total, 95))}  máx ${s(Math.max(...total))}`);
  console.log(`Pico rodando     ${est.picoRodando} (limite ${filaCentral.global}); pico por conta ${est.picoPorConta} (limite ${filaCentral.porConta})`);
  console.log(`Prontas ${finais.length - erros.length}/${finais.length}; erros ${erros.length}${erros.length ? `: ${[...new Set(erros.map((e) => e.erro))].join(" | ")}` : ""}`);
  console.log(`Misturas/isolamento         ${problemas.length ? problemas.slice(0, 10).join("; ") : "nenhuma"}`);

  await apagarContasDeTeste();
  await prisma.$disconnect();
  const ok = !pendentes && !erros.length && !problemas.length && est.picoRodando <= filaCentral.global && est.picoPorConta <= filaCentral.porConta;
  console.log(ok ? "\nRESULTADO: OK" : "\nRESULTADO: FALHOU");
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await apagarContasDeTeste().catch(() => {});
  process.exit(1);
});
