/**
 * Editora Pauta — chefe do departamento REDES.
 *
 * Roda todas as skills de Instagram (13), YouTube (11), X (11) e LinkedIn
 * (11), o TikTok (repositório próprio em vendor/skills/tiktok) e, do
 * master-skills, /edit (plano de edição de vídeo curto) e /virality.
 * As áreas de cada rede (redes-areas.ts) dão um botão para cada uma.
 *
 * Virais (ig-viral, yt-viral, x-viral e virality): só entram no cardápio com
 * a rede conectada (Configurações → Conexões); o motor injeta as buscas dos
 * coletores (lib/redes) na entrada da skill.
 *
 * As skills que trabalham em cima de um texto (ig-human, yt-edit, *-reply,
 * *-repurpose…) recebem o que o dono colou no botão; nenhum script roda.
 * Fora: o repositório video-production-skills (não foi clonado: sem licença)
 * e master-skills/build (site/app, não é rede social).
 */
import "server-only";

import type { ConfigChefe } from "@/lib/chefes/motor";
import { executarSkillInstagram } from "@/lib/skills/instagram/executar";
import { executarSkillLinkedin } from "@/lib/skills/linkedin/executar";
import { executarSkillMaster } from "@/lib/skills/master/executar";
import { executarSkillTiktok, SKILLS_TIKTOK } from "@/lib/skills/tiktok/executar";
import { executarSkillX } from "@/lib/skills/x/executar";
import { executarSkillYoutube } from "@/lib/skills/youtube/executar";

export const EDITORA_PAUTA: ConfigChefe = {
  nome: "Editora Pauta",
  departamento: "REDES",
  repositorios: {
    instagram: {
      pastaSkills: "instagram-agent-skill/skills",
      skills: [
        "ig-audit",
        "ig-caption",
        "ig-carousel",
        "ig-comment",
        "ig-dm",
        "ig-human",
        "ig-plan",
        "ig-profile",
        "ig-reel",
        "ig-reply",
        "ig-repurpose",
        "ig-story",
        "ig-viral",
      ],
      conexoes: { "ig-viral": ["INSTAGRAM"] },
      executar: executarSkillInstagram,
    },
    youtube: {
      pastaSkills: "youtube-agent-skill/skills",
      skills: [
        "yt-audit",
        "yt-chapters",
        "yt-comment",
        "yt-edit",
        "yt-package",
        "yt-plan",
        "yt-retention",
        "yt-script",
        "yt-seo",
        "yt-shorts",
        "yt-viral",
      ],
      conexoes: { "yt-viral": ["YOUTUBE"] },
      executar: executarSkillYoutube,
    },
    linkedin: {
      pastaSkills: "linkedin-agent-skill/skills",
      skills: [
        "li-audit",
        "li-carousel",
        "li-comment",
        "li-dm",
        "li-human",
        "li-inbox",
        "li-plan",
        "li-post",
        "li-profile",
        "li-reply",
        "li-repurpose",
      ],
      executar: executarSkillLinkedin,
    },
    x: {
      pastaSkills: "x-agent-skill/skills",
      skills: [
        "x-audit",
        "x-comment",
        "x-dm",
        "x-human",
        "x-plan",
        "x-post",
        "x-profile",
        "x-reply",
        "x-repurpose",
        "x-thread",
        "x-viral",
      ],
      conexoes: { "x-viral": ["X"] },
      executar: executarSkillX,
    },
    tiktok: {
      pastaSkills: "tiktok/skills",
      skills: SKILLS_TIKTOK,
      executar: executarSkillTiktok,
    },
    master: {
      pastaSkills: "master-skills/skills",
      skills: ["edit", "virality"],
      conexoes: { virality: ["INSTAGRAM", "YOUTUBE", "X"] },
      executar: executarSkillMaster,
    },
  },
};
