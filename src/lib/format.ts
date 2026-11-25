const moedaFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dataFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatarMoeda(valor: number | string) {
  return moedaFormatter.format(Number(valor));
}

export function formatarData(data: Date | string | number) {
  const value = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(value.getTime())) return "";
  return dataFormatter.format(value);
}

const dataHoraFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatarDataHora(data: Date | string | number) {
  const value = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(value.getTime())) return "";
  return dataHoraFormatter.format(value);
}

export function formatarDuracao(minutos: number) {
  if (minutos < 60) {
    return `${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (resto === 0) {
    return `${horas}h`;
  }

  return `${horas}h ${resto}min`;
}
