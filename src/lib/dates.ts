/** Calendar-day helpers for scoring engines (UTC date-only strings). */

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Treat YYYY-MM-DD as UTC midnight to avoid timezone drift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = parseDate(from);
  const b = parseDate(to);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

export function addDays(date: string | Date, days: number): Date {
  const d = parseDate(date);
  const result = new Date(d.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
