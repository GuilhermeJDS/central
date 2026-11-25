/**
 * Editora Pauta — chefe do departamento REDES.
 *
 * As mesmas skills (pasta skills/redes) servem todas as redes: o
 * "repositório" aqui é a rede, e o executor avisa a skill de qual rede se
 * trata. Assim os dados reais de cada rede conectada (dados-redes.ts) entram
 * na skill certa. As áreas de cada rede (redes-areas.ts) dão um botão para
 * cada ação.
 *
 * o-que-viraliza só entra no cardápio com a rede conectada (Conexões); o
 * motor injeta as buscas dos coletores (lib/redes) na entrada da skill.
 * As skills que trabalham em cima de um texto (responder, reaproveitar,
 * tirar-cara-de-ia…) recebem o que o dono colou no botão.
 */
import "server-only";

import type { ConfigChefe, RepositorioChefe } from "@/lib/chefes/motor";
import { executorDeSkills } from "@/lib/skills/executar";

const BASE = ["plano-do-mes", "legenda", "carrossel", "roteiro-curto", "responder", "reaproveitar", "auditoria-do-perfil", "tirar-cara-de-ia"];

function rede(nome: string, extras: string[], viral?: "INSTAGRAM" | "YOUTUBE" | "X"): RepositorioChefe {
  return {
    pastaSkills: "redes",
    skills: [...BASE, ...extras, ...(viral ? ["o-que-viraliza"] : [])],
    ...(viral ? { conexoes: { "o-que-viraliza": [viral] } } : {}),
    executar: executorDeSkills({ rede: nome }),
  };
}

export const EDITORA_PAUTA: ConfigChefe = {
  nome: "Editora Pauta",
  departamento: "REDES",
  repositorios: {
    instagram: rede("Instagram", ["stories"], "INSTAGRAM"),
    youtube: rede("YouTube", ["roteiro-youtube", "titulo-e-capa"], "YOUTUBE"),
    tiktok: rede("TikTok", []),
    linkedin: rede("LinkedIn", []),
    x: rede("X", [], "X"),
  },
};
