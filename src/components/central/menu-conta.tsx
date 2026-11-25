"use client";

import { ChevronsUpDown, CreditCard, LogOut, ReceiptText, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { sair } from "@/acoes/acesso";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type UsuarioMenu = { nome: string; email: string; foto: string | null };

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

export function Avatar({ u, tamanho = 36 }: { u: UsuarioMenu; tamanho?: number }) {
  return u.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={u.foto} alt="" className="cx-avatar" width={tamanho} height={tamanho} style={{ width: tamanho, height: tamanho }} />
  ) : (
    <span className="cx-avatar cx-avatar--iniciais" aria-hidden="true" style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }}>
      {iniciais(u.nome)}
    </span>
  );
}

const ITENS = [
  { href: "/central/conta", rotulo: "Minha conta", icone: UserRound },
  { href: "/central/conta/plano", rotulo: "Meu plano", icone: CreditCard },
  { href: "/central/conta/compras", rotulo: "Histórico de compras", icone: ReceiptText },
  { href: "/central/conta/configuracoes", rotulo: "Configurações", icone: Settings },
] as const;

/**
 * Rodapé da barra lateral: avatar, nome e e-mail; abre um menu para cima com
 * a conta, o plano, as compras, as configurações e Sair. Teclado: setas,
 * Home/End, Esc fecha e devolve o foco ao botão.
 */
export function MenuConta({ usuario }: { usuario: UsuarioMenu }) {
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    function fora(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    const itens = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      botao.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      itens[(i + 1) % itens.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itens[(i - 1 + itens.length) % itens.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itens[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itens[itens.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  }

  return (
    <div className="cx-conta" ref={raiz}>
      {aberto ? (
        <div className="cx-conta-menu" role="menu" id={id} aria-label="Conta" ref={menu} onKeyDown={teclas}>
          <div className="cx-conta-menu-topo" role="presentation">
            <Avatar u={usuario} tamanho={40} />
            <span className="cx-conta-menu-quem">
              <span className="cx-conta-nome">{usuario.nome}</span>
              <span className="cx-conta-email">{usuario.email}</span>
            </span>
          </div>
          {ITENS.map(({ href, rotulo, icone: I }) => (
            <Link key={href} href={href} role="menuitem" className="cx-conta-item" onClick={() => setAberto(false)}>
              <I size={18} strokeWidth={1.9} aria-hidden="true" />
              {rotulo}
            </Link>
          ))}
          <span className="cx-conta-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="cx-conta-item cx-conta-item--sair"
            disabled={saindo}
            onClick={() => {
              setSaindo(true);
              void sair();
            }}
          >
            <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
            {saindo ? "Saindo…" : "Sair"}
          </button>
        </div>
      ) : null}
      <button
        ref={botao}
        type="button"
        className="cx-conta-botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setAberto(true);
          }
        }}
      >
        <Avatar u={usuario} />
        <span className="cx-conta-quem">
          <span className="cx-conta-nome">{usuario.nome}</span>
          <span className="cx-conta-email">{usuario.email}</span>
        </span>
        <ChevronsUpDown size={16} strokeWidth={2} aria-hidden="true" className="cx-conta-seta" />
        <span className="cx-so-leitor">Abrir menu da conta</span>
      </button>
    </div>
  );
}
