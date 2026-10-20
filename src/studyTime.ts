import { type StudyLog } from "./model.ts";
import { localDate, matchesActualDate, type TimePeriod } from "./dates.ts";
export function learningTime(
  logs: StudyLog[],
  period: TimePeriod = "all",
  selected = localDate(),
  reference = localDate(),
) {
  const hasStudyTime = logs.some(
    (l) =>
      !l.voided &&
      l.activity !== "system" &&
      l.minutes !== null &&
      matchesActualDate(l.date, period, reference, selected),
  );
  const active = logs.filter((l) => !l.voided);
  const records =
    period === "all"
      ? active
      : active.filter((l) =>
          matchesActualDate(l.date, period, reference, selected),
        );
  const dated = records.filter(
    (l) =>
      l.minutes !== null &&
      matchesActualDate(l.date, period, reference, selected),
  );
  const measured = dated.filter((l) => l.activity !== "system");
  const system = dated.filter((l) => l.activity === "system");
  return {
    hasStudyTime,
    records,
    study: records.filter((l) => l.activity !== "system"),
    measured,
    system,
    studyMinutes: measured.reduce((s, l) => s + (l.minutes ?? 0), 0),
    systemMinutes: system.reduce((s, l) => s + (l.minutes ?? 0), 0),
  };
}
