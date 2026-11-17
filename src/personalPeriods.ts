import { dateDistance, shiftDate, weekStart } from "./dates.ts";

// A personal year starts on the Monday containing January 1.
// 13 × 28 days fill a 52-week year; a 53rd week is the separate 13.5 period.
export function personalYearStart(year: number) {
  return weekStart(`${year}-01-01`);
}
export function personalPeriod(date: string) {
  let year = Number(date.slice(0, 4));
  if (date >= personalYearStart(year + 1)) year++;
  const anchor = personalYearStart(year);
  const offset = dateDistance(anchor, date);
  const index = Math.min(13, Math.floor(offset / 28));
  const extra = index === 13;
  const start = shiftDate(anchor, index * 28);
  const count = extra ? 7 : 28;
  return {
    year,
    index,
    start,
    end: shiftDate(start, count - 1),
    count,
    label: `${year}년 ${extra ? "13.5" : index + 1}달`,
    week: Math.floor(dateDistance(start, date) / 7) + 1,
    day: dateDistance(start, date) + 1,
    extra,
  };
}
export function movePersonalPeriod(
  period: ReturnType<typeof personalPeriod>,
  direction: -1 | 1,
) {
  return personalPeriod(
    direction === -1 ? shiftDate(period.start, -1) : shiftDate(period.end, 1),
  );
}
