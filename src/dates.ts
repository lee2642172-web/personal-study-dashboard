/** Browser-local calendar date; UTC/Korean time must not shift a user's click date. */
export function localDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isDateString(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export type TimePeriod = "all" | "today" | "week" | "month" | "date";
/** Calendar arithmetic uses UTC noon so DST never changes the date interval. */
export function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
/** Monday of the week containing the supplied browser-local calendar date. */
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}
export function dateDistance(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000,
  );
}
export function matchesActualDate(
  date: string | null,
  period: TimePeriod,
  reference = localDate(),
  selected = reference,
): boolean {
  if (!date || !isDateString(date)) return false;
  if (period === "all") return true;
  if (period === "today") return date === reference;
  if (period === "date") return date === selected;
  if (period === "month")
    return date.slice(0, 7) === reference.slice(0, 7) && date <= reference;
  return date >= weekStart(reference) && date <= reference;
}

export function shiftMonth(month: string, delta: number): string {
  const next = new Date(`${month}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + delta);
  return next.toISOString().slice(0, 7);
}
export const calendarWeekdays = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
] as const;

/** Month grid starts on Monday; blanks keep every date under its weekday. */
export function calendarDates(month: string): (string | null)[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !isDateString(`${month}-01`))
    return [];
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(first.getUTCMonth() + 1, 0);
  const length = last.getUTCDate();
  return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) =>
    i < offset || i >= offset + length
      ? null
      : `${month}-${String(i - offset + 1).padStart(2, "0")}`,
  );
}
