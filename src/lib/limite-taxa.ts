import "server-only";

/*
 * Limite simples em memória para formulários públicos (orçamento, contato).
 * Um processo só (o deploy roda uma instância); o Cloudflare segura o volume
 * grande, isto segura o abuso de um mesmo IP ou e-mail.
 */
const baldes = new Map<string, Map<string, { count: number; resetAt: number }>>();

/** true quando a chave já passou de `max` usos na janela. Conta o uso atual. */
export function limiteEstourado(
  balde: string,
  chave: string | null | undefined,
  max: number,
  janelaMs: number,
): boolean {
  if (!chave) return false;
  let mapa = baldes.get(balde);
  if (!mapa) {
    mapa = new Map();
    baldes.set(balde, mapa);
  }
  const agora = Date.now();
  const atual = mapa.get(chave);
  if (atual && agora < atual.resetAt) {
    if (atual.count >= max) return true;
    atual.count++;
  } else {
    mapa.set(chave, { count: 1, resetAt: agora + janelaMs });
  }
  if (mapa.size > 2000) {
    for (const [k, v] of mapa) if (agora > v.resetAt) mapa.delete(k);
  }
  return false;
}

/**
 * Formulário enviado rápido demais (menos de `minMs` desde que abriu) é robô.
 * `inicio` vem de um campo escondido preenchido no navegador.
 */
export function enviadoRapidoDemais(inicio: FormDataEntryValue | null, minMs = 2500): boolean {
  const t = Number(inicio);
  if (!Number.isFinite(t) || t <= 0) return true;
  const decorrido = Date.now() - t;
  return decorrido < minMs || decorrido > 24 * 60 * 60 * 1000;
}

/** Mais de N links numa mensagem é quase sempre spam. */
export function temLinksDemais(texto: string, max = 2): boolean {
  return (texto.match(/https?:\/\/|www\./gi)?.length ?? 0) > max;
}
