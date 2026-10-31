export const MINUTES_PER_T = 90;
export const DEFAULT_RECORD_MINUTES = 90;
export const DEFAULT_TODO_MINUTES = 5;
export const TODO_MINUTE_STEP = 5;

export function formatT(minutes: number): string {
  const value = Number((minutes / MINUTES_PER_T).toFixed(2));
  return value === 0 && minutes > 0 ? "<0.01T" : `${value}T`;
}
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes * 100) / 100;
  const hours = Math.floor(total / 60),
    rest = Number((total % 60).toFixed(2));
  return hours ? `${hours}시간${rest ? ` ${rest}분` : ""}` : `${rest}분`;
}
export function formatTimeT(minutes: number): string {
  return `${formatT(minutes)} (${formatDuration(minutes)})`;
}
/** Native step stays 1 for manual 6/7/8; only arrow actions use five-minute increments. */
export function shiftTodoMinutes(value: string, direction: 1 | -1): string {
  const parsed = Number(value);
  const base = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  return String(
    Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.max(0, base + direction * TODO_MINUTE_STEP),
    ),
  );
}
