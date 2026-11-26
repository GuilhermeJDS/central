/**
 * Ícones da Central: só Lucide (DESIGN.md 6.5), traço 1.8, cor herdada.
 * Os departamentos usam o símbolo do chefe (SimboloChefe), não um ícone daqui.
 */
import {
  Activity,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  Gift,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  House,
  Inbox,
  Menu,
  Package,
  PlugZap,
  Settings,
  RefreshCw,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONES = {
  inicio: House,
  decisoes: Inbox,
  linha: Clock3,
  ficha: FileText,
  conexoes: PlugZap,
  configuracoes: Settings,
  atualizar: RefreshCw,
  brilho: Sparkles,
  seta: ChevronRight,
  avancar: ArrowRight,
  menu: Menu,
  fechar: X,
  check: Check,
  projetos: Package,
  contratar: BriefcaseBusiness,
  skills: BookOpen,
  pedagio: Gift,
  agenda: CalendarClock,
  execucoes: Activity,
} satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome, tamanho = 20, className }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  const C = ICONES[nome];
  return <C size={tamanho} strokeWidth={1.8} aria-hidden="true" className={className} />;
}
