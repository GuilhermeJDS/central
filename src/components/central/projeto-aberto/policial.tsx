/**
 * Policial de trânsito em pontilhado: a silhueta vira uma grade de pontos
 * (patterns do SVG recortados por máscaras). Quatro camadas: farda, pele,
 * detalhes (óculos, gravata, quepe) e as insígnias em dourado.
 */
export function Policial({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 560" className={className} aria-hidden>
      <defs>
        <pattern id="pt-farda" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.75" style={{ fill: "var(--cx-tinta-2)" }} />
        </pattern>
        <pattern id="pt-pele" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.45" style={{ fill: "var(--cx-tinta-3)" }} />
        </pattern>
        <pattern id="pt-detalhe" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="2.55" style={{ fill: "var(--cx-tinta)" }} />
        </pattern>
        <pattern id="pt-ouro" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="2.2" fill="#e3ad35" />
        </pattern>

        {/* farda: corpo, braço, quepe — sem rosto nem mão */}
        <mask id="m-farda">
          <rect width="400" height="560" fill="#000" />
          <path d="M40 560C40 410 82 352 150 332l32-20h46l32 20c68 20 110 78 110 228z" fill="#fff" />
          <path d="M128 372L80 330" stroke="#fff" strokeWidth="58" strokeLinecap="round" />
          <path d="M80 332V222" stroke="#fff" strokeWidth="50" strokeLinecap="round" />
          <rect x="182" y="272" width="46" height="46" fill="#fff" />
          <ellipse cx="205" cy="222" rx="60" ry="70" fill="#000" />
          <path d="M120 150C120 98 160 70 206 70s86 28 86 80z" fill="#fff" />
          <rect x="116" y="132" width="178" height="28" rx="7" fill="#fff" />
          <path d="M104 160q101 38 202 0l-6-10q-95 28-190 0z" fill="#fff" />
        </mask>

        {/* pele: rosto, orelhas e a mão de "pare" */}
        <mask id="m-pele">
          <rect width="400" height="560" fill="#000" />
          <ellipse cx="205" cy="226" rx="60" ry="68" fill="#fff" />
          <ellipse cx="143" cy="228" rx="10" ry="17" fill="#fff" />
          <ellipse cx="267" cy="228" rx="10" ry="17" fill="#fff" />
          <rect x="40" y="104" width="82" height="112" rx="28" fill="#fff" />
          <ellipse cx="128" cy="178" rx="14" ry="30" transform="rotate(-28 128 178)" fill="#fff" />
          <path d="M61 106v38M81 104v42M101 106v38" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M116 150C120 98 160 72 206 72s86 26 90 78z" fill="#000" />
          <rect x="114" y="130" width="182" height="32" fill="#000" />
        </mask>

        {/* detalhes: óculos, boca, faixa do quepe, aba, gravata, gola, platinas */}
        <mask id="m-detalhe">
          <rect width="400" height="560" fill="#000" />
          <ellipse cx="181" cy="214" rx="25" ry="16" fill="#fff" />
          <ellipse cx="229" cy="214" rx="25" ry="16" fill="#fff" />
          <rect x="198" y="208" width="14" height="6" fill="#fff" />
          <rect x="188" y="260" width="34" height="5" rx="2.5" fill="#fff" />
          <rect x="116" y="134" width="178" height="22" rx="6" fill="#fff" />
          <path d="M106 160q99 34 198 0l-4-6q-95 26-190 0z" fill="#fff" />
          <path d="M196 322h18l9 84-18 20-18-20z" fill="#fff" />
          <path d="M182 312l23 30-37 6zM228 312l-23 30 37 6z" fill="#fff" />
          <rect x="128" y="334" width="40" height="12" rx="4" transform="rotate(-14 148 340)" fill="#fff" />
          <rect x="242" y="334" width="40" height="12" rx="4" transform="rotate(14 262 340)" fill="#fff" />
          <path d="M60 252h40" stroke="#fff" strokeWidth="10" />
          <rect x="250" y="440" width="70" height="6" rx="3" fill="#fff" />
        </mask>

        {/* insígnias: estrela do quepe e distintivo no peito */}
        <mask id="m-ouro">
          <rect width="400" height="560" fill="#000" />
          <path d="M205 96l6 12 13 2-9.5 9 2.3 13-11.8-6.2-11.8 6.2 2.3-13-9.5-9 13-2z" fill="#fff" />
          <path d="M288 382l9 18 20 3-14.5 14 3.4 20-17.9-9.4-17.9 9.4 3.4-20-14.5-14 20-3z" fill="#fff" />
        </mask>
      </defs>
      <rect width="400" height="560" fill="url(#pt-farda)" mask="url(#m-farda)" />
      <rect width="400" height="560" fill="url(#pt-pele)" mask="url(#m-pele)" />
      <rect width="400" height="560" fill="url(#pt-detalhe)" mask="url(#m-detalhe)" />
      <rect width="400" height="560" fill="url(#pt-ouro)" mask="url(#m-ouro)" />
    </svg>
  );
}
