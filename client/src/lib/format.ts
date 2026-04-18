export const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short"
});

export function formatMoney(value: number | string) {
  return moneyFormatter.format(Number(value ?? 0));
}

export function formatDate(value: string | Date) {
  return dateFormatter.format(new Date(value));
}
