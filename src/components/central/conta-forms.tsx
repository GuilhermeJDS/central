"use client";

import { Camera, Check, Eye, EyeOff, Moon, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { salvarPerfilCentral, salvarPreferenciasCentral, trocarSenhaCentral, type ResultadoConta } from "@/app/central/acoes-conta";
import { Avatar, type UsuarioMenu } from "@/components/central/menu-conta";
import {
  PROFILE_PHOTO_FILENAME_HEADER,
  PROFILE_PHOTO_GENERIC_ERROR,
  PROFILE_PHOTO_HELPER_TEXT,
  PROFILE_PHOTO_MIME_HEADER,
  PROFILE_PHOTO_UPLOAD_URL,
  validateProfilePhotoFile,
} from "@/lib/user-profile-client";

function Aviso({ r }: { r: ResultadoConta | null }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={`cx-aviso ${r.ok ? "cx-aviso--ok" : "cx-aviso--erro"} cx-conta-aviso`}>
      {r.ok ? <Check size={16} strokeWidth={2.4} aria-hidden="true" /> : null}
      {r.mensagem}
    </p>
  );
}

/** Foto: escolhe → envia na hora pela mesma API do painel (/api/perfil/foto). */
export function FotoConta({ usuario }: { usuario: UsuarioMenu }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(usuario.foto);
  const [ocupado, setOcupado] = useState<"enviando" | "removendo" | null>(null);
  const [r, setR] = useState<ResultadoConta | null>(null);

  async function enviar(f: File) {
    const v = validateProfilePhotoFile(f);
    if (!v.ok) return setR({ ok: false, mensagem: v.message });
    setOcupado("enviando");
    setR(null);
    try {
      const res = await fetch(PROFILE_PHOTO_UPLOAD_URL, {
        method: "POST",
        headers: { "Content-Type": v.mimeType, [PROFILE_PHOTO_MIME_HEADER]: v.mimeType, [PROFILE_PHOTO_FILENAME_HEADER]: encodeURIComponent(f.name) },
        body: f,
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; fotoPerfil?: string | null };
      if (!res.ok) return setR({ ok: false, mensagem: d.error ?? PROFILE_PHOTO_GENERIC_ERROR });
      setFoto(d.fotoPerfil ?? null);
      setR({ ok: true, mensagem: "Foto atualizada." });
      router.refresh();
    } catch {
      setR({ ok: false, mensagem: PROFILE_PHOTO_GENERIC_ERROR });
    } finally {
      setOcupado(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remover() {
    setOcupado("removendo");
    setR(null);
    try {
      const res = await fetch(PROFILE_PHOTO_UPLOAD_URL, { method: "DELETE" });
      if (!res.ok) return setR({ ok: false, mensagem: PROFILE_PHOTO_GENERIC_ERROR });
      setFoto(null);
      setR({ ok: true, mensagem: "Foto removida." });
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="cx-foto">
      <div className="cx-foto-quadro">
        <Avatar u={{ ...usuario, foto }} tamanho={112} />
        <button type="button" className="cx-foto-trocar" onClick={() => input.current?.click()} disabled={!!ocupado} aria-label="Trocar foto">
          <Camera size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="cx-so-leitor"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />
      <div className="cx-foto-acoes">
        <button type="button" className="cx-botao cx-botao--suave" onClick={() => input.current?.click()} disabled={!!ocupado}>
          {ocupado === "enviando" ? "Enviando…" : foto ? "Trocar foto" : "Enviar foto"}
        </button>
        {foto ? (
          <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => void remover()} disabled={!!ocupado}>
            <Trash2 size={16} strokeWidth={2} aria-hidden="true" /> {ocupado === "removendo" ? "Removendo…" : "Remover"}
          </button>
        ) : null}
      </div>
      <p className="cx-dica cx-foto-dica">{PROFILE_PHOTO_HELPER_TEXT}</p>
      <Aviso r={r} />
    </div>
  );
}

export function FormPerfil({ nome, email, telefone }: { nome: string; email: string; telefone: string }) {
  const router = useRouter();
  const [r, setR] = useState<ResultadoConta | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="cx-conta-form"
      aria-labelledby="cx-dados-t"
      action={(f) =>
        iniciar(async () => {
          const res = await salvarPerfilCentral(f);
          setR(res);
          if (res.ok) router.refresh();
        })
      }
    >
      <h2 id="cx-dados-t" className="cx-conta-form-titulo">
        Seus dados
      </h2>
      <div className="cx-conta-campos">
        <div className="cx-campo">
          <label className="cx-campo-rotulo" htmlFor="conta-nome">
            Nome
          </label>
          <input id="conta-nome" name="nome" className="cx-input" defaultValue={nome} autoComplete="name" maxLength={80} required aria-invalid={r?.campo === "nome"} />
        </div>
        <div className="cx-campo">
          <label className="cx-campo-rotulo" htmlFor="conta-email">
            E-mail
          </label>
          <input id="conta-email" name="email" type="email" inputMode="email" className="cx-input" defaultValue={email} autoComplete="email" maxLength={160} required aria-invalid={r?.campo === "email"} />
        </div>
        <div className="cx-campo">
          <label className="cx-campo-rotulo" htmlFor="conta-telefone">
            WhatsApp
          </label>
          <input id="conta-telefone" name="telefone" type="tel" inputMode="tel" className="cx-input" defaultValue={telefone} autoComplete="tel" maxLength={20} placeholder="(32) 99999-9999" aria-invalid={r?.campo === "telefone"} />
        </div>
      </div>
      <div className="cx-conta-rodape">
        <button type="submit" className="cx-botao cx-botao--azul" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar dados"}
        </button>
        <Aviso r={r} />
      </div>
    </form>
  );
}

export function FormSenha() {
  const form = useRef<HTMLFormElement>(null);
  const [r, setR] = useState<ResultadoConta | null>(null);
  const [ver, setVer] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      ref={form}
      className="cx-conta-form"
      aria-labelledby="cx-senha-t"
      action={(f) =>
        iniciar(async () => {
          const res = await trocarSenhaCentral(f);
          setR(res);
          if (res.ok) form.current?.reset();
        })
      }
    >
      <h2 id="cx-senha-t" className="cx-conta-form-titulo">
        Senha
      </h2>
      <div className="cx-conta-campos cx-conta-campos--2">
        <div className="cx-campo">
          <label className="cx-campo-rotulo" htmlFor="senha-atual">
            Senha atual
          </label>
          <input id="senha-atual" name="atual" type={ver ? "text" : "password"} className="cx-input" autoComplete="current-password" required aria-invalid={r?.campo === "atual"} />
        </div>
        <div className="cx-campo">
          <label className="cx-campo-rotulo" htmlFor="senha-nova">
            Nova senha
          </label>
          <input id="senha-nova" name="nova" type={ver ? "text" : "password"} className="cx-input" autoComplete="new-password" minLength={8} required aria-invalid={r?.campo === "nova"} aria-describedby="senha-nova-dica" />
          <p id="senha-nova-dica" className="cx-dica">
            8 caracteres ou mais.
          </p>
        </div>
      </div>
      <div className="cx-conta-rodape">
        <button type="submit" className="cx-botao cx-botao--azul" disabled={pendente}>
          {pendente ? "Trocando…" : "Trocar senha"}
        </button>
        <button type="button" className="cx-botao cx-botao--fantasma-escuro" onClick={() => setVer((v) => !v)} aria-pressed={ver}>
          {ver ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
          {ver ? "Esconder" : "Mostrar"}
        </button>
        <Aviso r={r} />
      </div>
    </form>
  );
}

export function FormPreferencias({ tema, notificacoesEmail }: { tema: "claro" | "escuro"; notificacoesEmail: boolean }) {
  const router = useRouter();
  const [r, setR] = useState<ResultadoConta | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="cx-conta-form"
      aria-label="Configurações"
      onChange={(e) => {
        // Tema aparece na hora; salva junto com o resto.
        const t = e.target as unknown as HTMLInputElement;
        if (t.name === "tema") document.querySelector<HTMLElement>(".central.cx")?.setAttribute("data-tema", t.value);
      }}
      action={(f) =>
        iniciar(async () => {
          const res = await salvarPreferenciasCentral(f);
          setR(res);
          if (res.ok) router.refresh();
        })
      }
    >
      <fieldset className="cx-ajuste">
        <legend className="cx-ajuste-titulo">Aparência</legend>
        <p className="cx-dica">Vale aqui e no painel do negócio.</p>
        <div className="cx-tema-opcoes">
          {(
            [
              ["claro", "Claro", Sun],
              ["escuro", "Escuro", Moon],
            ] as const
          ).map(([v, rot, I]) => (
            <label key={v} className="cx-tema-opcao" data-tema-amostra={v}>
              <input type="radio" name="tema" value={v} defaultChecked={tema === v} />
              <span className="cx-tema-amostra" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="cx-tema-rotulo">
                <I size={16} strokeWidth={2} aria-hidden="true" /> {rot}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="cx-ajuste">
        <legend className="cx-ajuste-titulo">Avisos por e-mail</legend>
        <label className="cx-chave">
          <input type="checkbox" name="notificacoesEmail" defaultChecked={notificacoesEmail} role="switch" />
          <span className="cx-chave-trilho" aria-hidden="true" />
          <span>Receber por e-mail os avisos da conta: orçamento pronto, pagamento confirmado e versão nova de projeto.</span>
        </label>
      </fieldset>
      <div className="cx-conta-rodape">
        <button type="submit" className="cx-botao cx-botao--azul" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <Aviso r={r} />
      </div>
    </form>
  );
}
