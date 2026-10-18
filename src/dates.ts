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
  const monday = new Date(`${reference}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return date >= localDate(monday) && date <= reference;
}
