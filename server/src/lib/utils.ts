export function toMoney(value: number | string) {
  return Number(value ?? 0);
}

export function formatTokenFromHeader(header?: string) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7);
}

export function startOfDay(date = new Date()) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target;
}

export function endOfDay(date = new Date()) {
  const target = new Date(date);
  target.setHours(23, 59, 59, 999);
  return target;
}

export function parseDateRange(period?: string, start?: string, end?: string) {
  const now = new Date();

  if (start || end) {
    return {
      start: start ? new Date(start) : startOfDay(now),
      end: end ? endOfDay(new Date(end)) : endOfDay(now)
    };
  }

  const day = startOfDay(now);
  if (period === "semana") {
    const startWeek = new Date(day);
    startWeek.setDate(day.getDate() - 6);
    return { start: startWeek, end: endOfDay(now) };
  }

  if (period === "mes") {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startMonth, end: endOfDay(now) };
  }

  return { start: day, end: endOfDay(now) };
}
