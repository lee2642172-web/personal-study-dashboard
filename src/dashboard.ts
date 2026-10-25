import { type DashboardData, type StudyLog, type FieldId } from "./model.ts";
import { isDateString, shiftDate, calendarDates, weekStart } from "./dates.ts";
import { lectureCompleted } from "./lectureLearning.ts";
import { activityEntries } from "./activities.ts";

type TimeEntry = Pick<StudyLog, "id" | "date" | "minutes"> & {
  activity: StudyLog["activity"] | "todo" | "task";
  area?: FieldId;
  voided?: boolean;
};

/** Projection only: completion time has one persisted owner and never becomes a duplicate study log. */
export function dashboardTimeEntries(data: DashboardData): TimeEntry[] {
  return activityEntries(data);
}

/** Count actual sessions once by ID; never deduplicate intentional replays by episode. */
export function timedStudyLogs(
  logs: TimeEntry[],
  asOf: string,
  area?: FieldId,
) {
  const seen = new Set<string>();
  return logs.filter((log) => {
    if (seen.has(log.id)) return false;
    seen.add(log.id);
    return (
      !log.voided &&
      log.date &&
      isDateString(log.date) &&
      log.date <= asOf &&
      log.minutes !== null &&
      Number.isFinite(log.minutes) &&
      log.minutes >= 0 &&
      (!area || log.area === area)
    );
  });
}
export function studySummary(logs: TimeEntry[], asOf: string) {
  const measured = timedStudyLogs(logs, asOf);
  const sum = (start: string) =>
    measured.reduce(
      (total, l) => total + (l.date! >= start ? l.minutes! : 0),
      0,
    );
  return {
    today: sum(asOf),
    week: sum(weekStart(asOf)),
    month: sum(`${asOf.slice(0, 7)}-01`),
  };
}
export function studySeries(
  logs: TimeEntry[],
  asOf: string,
  period: "7" | "30" | "month",
  month = asOf.slice(0, 7),
  area?: FieldId,
) {
  const start =
    period === "month"
      ? `${month}-01`
      : period === "7"
        ? weekStart(asOf)
        : shiftDate(asOf, -29);
  if (!isDateString(start)) return [];
  const count =
    period === "month"
      ? calendarDates(month).filter(Boolean).length
      : Number(period);
  const totals = new Map<string, number>();
  for (const log of timedStudyLogs(logs, asOf, area))
    totals.set(log.date!, (totals.get(log.date!) ?? 0) + log.minutes!);
  return Array.from({ length: count }, (_, i) => {
    const date = shiftDate(start, i);
    return { date, minutes: totals.get(date) ?? 0 };
  });
}
export function customsLectureProgress(data: DashboardData, round = 1) {
  const subjects = data.materials
    .filter(
      (m) =>
        m.area === "customs" && m.kind === "lectures" && m.lectures?.length,
    )
    .map((material) => {
      const numbers = new Set(material.lectures!.map((l) => l.number));
      const total = numbers.size;
      const done = [...numbers].filter((n) =>
        lectureCompleted(data.logs, material.id, round, n),
      ).length;
      return {
        material,
        total,
        done,
        percent: total ? (done / total) * 100 : 0,
      };
    });
  const done = subjects.reduce((n, s) => n + s.done, 0),
    total = subjects.reduce((n, s) => n + s.total, 0);
  return { subjects, done, total, percent: total ? (done / total) * 100 : 0 };
}
