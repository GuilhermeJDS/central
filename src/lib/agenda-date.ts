type DiaSemana = "DOM" | "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB";

const DIA_SEMANA_FROM_JS: DiaSemana[] = [
  "DOM",
  "SEG",
  "TER",
  "QUA",
  "QUI",
  "SEX",
  "SAB",
];

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function toDateKeyBR(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getDiaSemanaFromDateKey(dateKey: string): DiaSemana {
  return DIA_SEMANA_FROM_JS[parseDateKey(dateKey).getDay()];
}

export function combineDateAndTimeBR(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00-03:00`);
}

export function startOfDayBR(dateKey: string): Date {
  return combineDateAndTimeBR(dateKey, "00:00");
}

export function endOfDayBR(dateKey: string): Date {
  return new Date(`${dateKey}T23:59:59.999-03:00`);
}

export function formatarMesAno(year: number, month: number) {
  return `${MESES[month - 1]} ${year}`;
}

export function formatarDataCurta(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatarHora(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function getMonthGrid(year: number, month: number): Array<string | null> {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const cells: Array<string | null> = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad2(month)}-${pad2(day)}`);
  }

  return cells;
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) {
  return startA < endB && endA > startB;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}
