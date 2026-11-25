/**
 * Item 4 (trava contra regressão): toda consulta Prisma no código da Central
 * leva `accountId` no filtro. As exceções abaixo foram conferidas uma a uma
 * (dados globais, o próprio usuário, ou filtro montado a partir do accountId
 * numa variável). Consulta nova sem accountId faz este teste falhar: confira
 * e, se estiver certa, inclua aqui com o motivo.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const PASTAS = ["src/app/central", "src/lib/central", "src/lib/chefes", "src/lib/redes", "src/lib/negocio"];
const ARQUIVOS = ["src/lib/skills/execucoes.ts", "src/lib/ia/credencial.ts"];
/** Painel da unidade: separado da Central, filtra pela unidade (unidadeId). */
const FORA = ["src/lib/chefes/painel/"];

/** arquivo → modelos.métodos liberados (motivo no comentário). */
const EXCECOES: Record<string, string[]> = {
  // O próprio usuário da sessão (session.user.id).
  "src/app/central/acoes-tema.ts": ["user.update"],
  "src/app/central/acoes-conta.ts": ["user.findFirst", "user.update", "user.findUnique"],
  "src/app/central/_lib/sessao.ts": ["user.findUnique"],
  "src/app/central/layout.tsx": ["user.findUnique"],
  "src/app/central/conta/page.tsx": ["user.findUnique"],
  "src/app/central/conta/configuracoes/page.tsx": ["user.findUnique"],
  "src/app/central/contratar/page.tsx": ["user.findUnique"],
  // A conta da sessão (where: { id: c.contaId }).
  "src/app/central/conta/compras/recibo/[chave]/page.tsx": ["account.findUnique"],
  "src/app/central/conta/plano/page.tsx": ["account.findUnique"],
  // Catálogos globais.
  "src/lib/central/loja-projetos.ts": ["ferramenta.findMany"],
  "src/lib/central/liberacao.ts": ["plan.findMany"],
  // Filtro em variável montada com o accountId (where/topo/w/legacyWhere).
  "src/lib/central/dados.ts": ["execucaoSkill.groupBy", "execucaoSkill.findMany", "agendamento.findMany", "agendamento.count"],
  "src/lib/central/execucoes-painel.ts": ["execucaoSkill.groupBy", "execucaoSkill.count", "execucaoSkill.findMany"],
  "src/lib/chefes/gerente-rotina.ts": ["agendamento.count", "movimentoFinanceiro.aggregate", "agendamento.groupBy", "agendamento.findMany"],
  // Unidade já resolvida a partir da conta.
  "src/lib/central/marca.ts": ["tenantSiteConfig.findUnique"],
  // Por id de linha já lida dentro da conta / rotina diária de todas as contas.
  "src/lib/redes/renovar.ts": ["contaConectada.update"],
  "src/lib/redes/contas.ts": ["contaConectada.update"],
};

const CHAMADA = /prisma\.(\w+)\.(findUnique|findFirst|findMany|update|updateMany|delete|deleteMany|count|aggregate|groupBy|upsert|findUniqueOrThrow|findFirstOrThrow)\(/g;

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

function chamadaCompleta(s: string, inicio: number, fimNome: number): string {
  let d = 1;
  let i = fimNome;
  while (d && i < s.length) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") d--;
    i++;
  }
  return s.slice(inicio, i);
}

test("toda consulta da Central filtra pela conta", () => {
  const sem: string[] = [];
  for (const f of [...PASTAS.flatMap(arquivos), ...ARQUIVOS].filter((f) => !FORA.some((x) => f.startsWith(x)))) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(CHAMADA)) {
      const corpo = chamadaCompleta(s, m.index!, m.index! + m[0].length);
      if (/accountId|account_id/.test(corpo)) continue;
      const nome = `${m[1]}.${m[2]}`;
      if (EXCECOES[f]?.includes(nome)) continue;
      sem.push(`${f}:${s.slice(0, m.index).split("\n").length} ${nome}`);
    }
  }
  assert.deepEqual(sem, [], `Consultas sem accountId:\n${sem.join("\n")}`);
});
