import {
  episodes,
  type DashboardData,
  type Material,
  type StudyLog,
} from "./model.ts";
export const EBS_GROUP_ID = "ebs-audio";
export const EBS_START = "2026-04-01";
const legacyIds = new Set(["ebs-0", "ebs-1", "ebs-2"]);
export function connectEbsGroup(data: DashboardData): DashboardData {
  return {
    ...data,
    materials: data.materials.map((m) =>
      !m.groupId &&
      legacyIds.has(m.id) &&
      m.area === "english" &&
      m.kind === "audio"
        ? { ...m, groupId: EBS_GROUP_ID }
        : m,
    ),
  };
}
export const isEbsCourse = (m: Material) =>
  m.groupId === EBS_GROUP_ID && m.kind === "audio" && m.area === "english";
export const ebsCourses = (materials: Material[]) =>
  materials.filter(isEbsCourse);
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  );
}
export function scheduled(m: Material, date: string) {
  return (
    validDate(date) &&
    date >= EBS_START &&
    date >= m.startDate &&
    m.schedule.includes(new Date(`${date}T12:00:00Z`).getUTCDay())
  );
}
export function courseEntries(m: Material, logs: StudyLog[], date?: string) {
  return logs.filter(
    (l) =>
      l.materialId === m.id &&
      l.activity !== "system" &&
      (!date || l.item === date),
  );
}
export function courseDay(
  m: Material,
  logs: StudyLog[],
  date: string,
  asOf: string,
) {
  const entries = courseEntries(m, logs, date);
  return {
    entries,
    scheduled: scheduled(m, date),
    future: date > asOf,
    completed: entries.some((l) => l.completed && !l.voided),
  };
}
export function monthStats(
  courses: Material[],
  logs: StudyLog[],
  month: string,
  asOf: string,
) {
  const byCourse = courses.map((course) => {
    const expected = episodes(course, month).filter(
      (date) => date >= EBS_START,
    );
    const history = courseEntries(course, logs).filter(
      (l) => validDate(l.item) && l.item.startsWith(`${month}-`),
    );
    const dates = new Set([
      ...expected.filter((d) => d <= asOf),
      ...history.filter((l) => l.item <= asOf).map((l) => l.item),
    ]);
    const done = new Set(
      history
        .filter((l) => l.completed && !l.voided && l.item <= asOf)
        .map((l) => l.item),
    );
    return {
      course,
      total: dates.size,
      done: done.size,
      planned: expected.filter((d) => d > asOf).length,
    };
  });
  return {
    byCourse,
    total: byCourse.reduce((s, c) => s + c.total, 0),
    done: byCourse.reduce((s, c) => s + c.done, 0),
    planned: byCourse.reduce((s, c) => s + c.planned, 0),
  };
}
export function defaultEbsDate(
  courses: Material[],
  logs: StudyLog[],
  asOf: string,
) {
  const ids = new Set(courses.map((m) => m.id));
  return (
    logs
      .filter(
        (l) =>
          ids.has(l.materialId) &&
          l.activity !== "system" &&
          l.completed &&
          !l.voided &&
          validDate(l.item) &&
          l.item >= EBS_START &&
          l.item <= asOf,
      )
      .map((l) => l.item)
      .sort()
      .at(-1) ?? EBS_START
  );
}
export function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function calendarDates(month: string): (string | null)[] {
  const [year, mon] = month.split("-").map(Number);
  if (!/^\d{4}-\d{2}$/.test(month) || mon < 1 || mon > 12) return [];
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) =>
    i < offset || i >= offset + length
      ? null
      : `${month}-${String(i - offset + 1).padStart(2, "0")}`,
  );
}

export const EBS_DEFAULT_MINUTES = 18;
/** Idempotent first completion; intentional extra learning appends a distinct record. */
export function recordEbsLearning(
  data: DashboardData,
  courseId: string,
  contentDate: string,
  learnedDate: string,
  id: string,
  replay = false,
): DashboardData {
  if (!id || data.logs.some((log) => log.id === id)) return data;
  const course = ebsCourses(data.materials).find((m) => m.id === courseId);
  if (
    !course ||
    !validDate(contentDate) ||
    !validDate(learnedDate) ||
    contentDate > learnedDate
  )
    return data;
  const day = courseDay(course, data.logs, contentDate, learnedDate);
  if (!day.scheduled && !day.entries.length) return data;
  if (!replay && day.completed) return data;
  if (replay && !day.completed) return data;

  const round =
    day.entries.reduce((highest, l) => Math.max(highest, l.round), 0) + 1;
  const log: StudyLog = {
    id,
    area: course.area,
    materialId: course.id,
    item: contentDate,
    contentDate,
    round,
    date: learnedDate,
    minutes: EBS_DEFAULT_MINUTES,
    activity: replay ? "review" : "study",
    note: "",
    topic: "",
    writing: "",
    speaking: "",
    origin: "entered",
    completed: true,
  };
  return { ...data, logs: [...data.logs, log] };
}

/** Toggle all completed listening/review records for a publication day without deleting history. */
export function toggleEbsLearning(
  data: DashboardData,
  courseId: string,
  contentDate: string,
  learnedDate: string,
  id: string,
): DashboardData {
  const course = ebsCourses(data.materials).find((m) => m.id === courseId);
  if (
    !course ||
    !validDate(contentDate) ||
    !validDate(learnedDate) ||
    contentDate > learnedDate
  )
    return data;
  const day = courseDay(course, data.logs, contentDate, learnedDate);
  if (!day.completed)
    return recordEbsLearning(data, courseId, contentDate, learnedDate, id);
  const ids = new Set(
    day.entries.filter((l) => l.completed && !l.voided).map((l) => l.id),
  );
  return {
    ...data,
    logs: data.logs.map((l) =>
      ids.has(l.id) ? { ...l, completed: false, voided: true } : l,
    ),
  };
}

/** Today is a separate listening session, even if this publication was completed before. */
export function recordEbsToday(
  data: DashboardData,
  courseId: string,
  contentDate: string,
  learnedDate: string,
  id: string,
): DashboardData {
  const course = ebsCourses(data.materials).find((m) => m.id === courseId);
  if (!course || !scheduled(course, contentDate) || contentDate > learnedDate)
    return data;
  const day = courseDay(course, data.logs, contentDate, learnedDate);
  if (
    day.entries.some((l) => l.completed && !l.voided && l.date === learnedDate)
  )
    return data;
  return recordEbsLearning(
    data,
    courseId,
    contentDate,
    learnedDate,
    id,
    day.completed,
  );
}
