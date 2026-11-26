import Link from "next/link";

const ABAS = [
  { href: "/central/conta", rotulo: "Minha conta" },
  { href: "/central/configuracoes", rotulo: "Configurações" },
] as const;

/** Abas da conta (as mesmas entradas do menu do avatar). */
export function AbasConta({ atual }: { atual: (typeof ABAS)[number]["href"] }) {
  return (
    <nav className="cx-segmentos cx-abas-conta" aria-label="Conta">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href} className="cx-segmento" aria-current={a.href === atual ? "page" : undefined}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
