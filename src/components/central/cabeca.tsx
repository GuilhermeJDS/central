import Link from "next/link";
import type { ReactNode } from "react";

import type { Periodo } from "@/components/central/tipos";

/** Topo de cada página: sobrelinha, título enorme com ponto, subtítulo e ações à direita. */
export function CabecaPagina({
  secao,
  titulo,
  destaque,
  subtitulo,
  chip,
  ponto = true,
  children,
}: {
  secao: string;
  /** Texto do título SEM o ponto final. */
  titulo: string;
  /** Parte final do título em azul (ex.: o nome). */
  destaque?: string;
  subtitulo: ReactNode;
  chip?: ReactNode;
  /** false: títulos que já terminam em ? ou ! (nomes de peças). */
  ponto?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="cx-cabeca entra">
      <div className="cx-cabeca-texto">
        <p className="cx-sobrelinha">
          <span aria-hidden="true" className="cx-traco" />
          Korely · {secao}
        </p>
        <h1 className="cx-titulo">
          {titulo}
          {destaque ? <span className="cx-titulo-destaque">{destaque}</span> : null}
          {ponto && !/[.?!…]$/.test(destaque ?? titulo) ? <span className="cx-ponto">.</span> : null}
        </h1>
        <div className="cx-subtitulo-linha">
          {chip}
          <p className="cx-subtitulo">{subtitulo}</p>
        </div>
      </div>
      {children ? <div className="cx-cabeca-acoes">{children}</div> : null}
    </header>
  );
}

/** 7 / 14 / 30 dias (fica na URL como ?p=). */
export function SeletorPeriodo({ caminho, atual }: { caminho: string; atual: Periodo }) {
  return (
    <nav className="cx-segmentos" aria-label="Período">
      {([7, 14, 30] as const).map((p) => (
        <Link
          key={p}
          href={p === 7 ? caminho : `${caminho}?p=${p}`}
          className="cx-segmento"
          aria-current={p === atual ? "true" : undefined}
          scroll={false}
        >
          {p} dias
        </Link>
      ))}
    </nav>
  );
}

/** Marca a página como "tem bloco de exemplo": a pílula da barra lateral aparece pelo CSS. */
export function MarcaExemplo({ ativo }: { ativo: boolean }) {
  return ativo ? <span data-exemplo="" hidden /> : null;
}

/** Chip ▲ verde / ▼ vermelho. menosEMelhor inverte a cor. */
export function ChipVariacao({ valor, menosEMelhor = false }: { valor: number | null; menosEMelhor?: boolean }) {
  if (valor === null || !Number.isFinite(valor)) return null;
  const sobe = valor > 0;
  const igual = valor === 0;
  const bom = igual ? null : sobe !== menosEMelhor;
  const texto = `${Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <span
      className={`cx-variacao${bom === null ? "" : bom ? " cx-variacao--boa" : " cx-variacao--ruim"}`}
      aria-label={igual ? "sem variação" : `${sobe ? "subiu" : "caiu"} ${texto}`}
    >
      <span aria-hidden="true">{igual ? "=" : sobe ? "▲" : "▼"}</span> {texto}
    </span>
  );
}
