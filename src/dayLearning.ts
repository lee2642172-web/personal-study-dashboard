import { isDateString } from "./dates.ts";
import {
  type DashboardData,
  type Material,
  type StudyLog,
  type DayBookState,
  type DayRoundState,
} from "./model.ts";
export const isDayBook = (m: Material) =>
  m.kind === "days" &&
  ((m.area === "english" && ["vocabulary", "phrases"].includes(m.id)) ||
    (["chinese", "spanish"].includes(m.area) && !!m.vocabularyId));
const active = (log: StudyLog) =>
  log.activity !== "system" &&
  !log.initialLearning &&
  log.completed &&
  !log.voided;
const totalDays = (m: Material) =>
  m.total && Number.isInteger(m.total) && m.total > 0 ? m.total : 0;
export function dayCompleted(
  logs: StudyLog[],
  materialId: string,
  round: number,
  day: number,
) {
  return logs.some(
    (l) =>
      l.materialId === materialId &&
      l.round === round &&
      Number(l.item) === day &&
      active(l),
  );
}
/** First gap, never highest completed Day + 1. Out-of-order history cannot skip work. */
export function nextUnfinished(
  logs: StudyLog[],
  materialId: string,
  round: number,
  total: number,
): number | null {
  const done = new Set(
    logs
      .filter(
        (l) => l.materialId === materialId && l.round === round && active(l),
      )
      .map((l) => Number(l.item)),
  );
  for (let day = 1; day <= total; day++) if (!done.has(day)) return day;
  return null;
}
export function getDayBook(data: DashboardData, m: Material): DayBookState {
  const total = totalDays(m);
  const stored = data.dayBooks?.find((b) => b.materialId === m.id);
  if (stored && stored.totalDays === total) return stored;
  const known = [
    ...new Set([
      1,
      ...(stored?.rounds.map((r) => r.round) ?? []),
      ...data.logs
        .filter(
          (l) =>
            l.materialId === m.id &&
            l.activity !== "system" &&
            !l.initialLearning,
        )
        .map((l) => l.round),
    ]),
  ].sort((a, b) => a - b);
  return {
    materialId: m.id,
    totalDays: total,
    activeRound: stored?.activeRound ?? known.at(-1) ?? 1,
    rounds: known.map((round) => {
      const previous = stored?.rounds.find((r) => r.round === round);
      const frozenTotal =
        previous?.totalDays ??
        (stored &&
        total > stored.totalDays &&
        nextUnfinished(data.logs, m.id, round, stored.totalDays) === null
          ? stored.totalDays
          : undefined);
      const scope = Math.min(total, frozenTotal ?? total);
      const nextDay = nextUnfinished(data.logs, m.id, round, scope);
      return {
        round,
        ...(frozenTotal ? { totalDays: frozenTotal } : {}),
        nextDay,
        lastOpenedDay: Math.min(
          total || 1,
          Math.max(1, previous?.lastOpenedDay ?? nextDay ?? total ?? 1),
        ),
        ...(previous?.lastReviewId
          ? { lastReviewId: previous.lastReviewId }
          : {}),
      };
    }),
  };
}
export function dayRoundTotal(book: DayBookState, round: number): number {
  return Math.min(
    book.totalDays,
    book.rounds.find((r) => r.round === round)?.totalDays ?? book.totalDays,
  );
}
function putBook(data: DashboardData, book: DayBookState): DashboardData {
  return {
    ...data,
    dayBooks: [
      ...(data.dayBooks ?? []).filter((b) => b.materialId !== book.materialId),
      book,
    ],
  };
}
export function ensureDayBook(data: DashboardData, id: string): DashboardData {
  const m = data.materials.find((m) => m.id === id);
  if (!m || !isDayBook(m) || !totalDays(m)) return data;
  const book = getDayBook(data, m);
  return data.dayBooks?.includes(book) ? data : putBook(data, book);
}
export function selectDayRound(
  data: DashboardData,
  id: string,
  round: number,
): DashboardData {
  const m = data.materials.find((m) => m.id === id);
  if (
    !m ||
    !isDayBook(m) ||
    !totalDays(m) ||
    !Number.isSafeInteger(round) ||
    round < 1
  )
    return data;
  const book = getDayBook(data, m);
  const previous = book.rounds.find((r) => r.round === round);
  const nextDay = nextUnfinished(data.logs, id, round, book.totalDays);
  return putBook(data, {
    ...book,
    activeRound: round,
    rounds: previous
      ? book.rounds
      : [
          ...book.rounds,
          { round, nextDay, lastOpenedDay: nextDay ?? book.totalDays },
        ].sort((a, b) => a.round - b.round),
  });
}
export function startDayRound(data: DashboardData, id: string): DashboardData {
  const m = data.materials.find((m) => m.id === id);
  if (!m) return data;
  const book = getDayBook(data, m);
  const highestLog = data.logs
    .filter(
      (l) =>
        l.materialId === id && l.activity !== "system" && !l.initialLearning,
    )
    .reduce((n, l) => Math.max(n, l.round), 0);
  const round =
    book.rounds.reduce((n, r) => Math.max(n, r.round), highestLog) + 1;
  return selectDayRound(data, id, round);
}
export function openDay(
  data: DashboardData,
  id: string,
  round: number,
  day: number,
): DashboardData {
  const m = data.materials.find((m) => m.id === id);
  if (
    !m ||
    !isDayBook(m) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > totalDays(m)
  )
    return data;
  const book = getDayBook(data, m);
  const state = book.rounds.find((r) => r.round === round);
  if (!state || state.lastOpenedDay === day) return data;
  return putBook(data, {
    ...book,
    rounds: book.rounds.map((r) =>
      r.round === round ? { ...r, lastOpenedDay: day } : r,
    ),
  });
}
/** Shared by quick review and the existing record editor, including cancellations. */
export function saveDayAwareLog(
  data: DashboardData,
  next: StudyLog,
): DashboardData {
  const previous = data.logs.find((l) => l.id === next.id);
  let result = {
    ...data,
    logs: previous
      ? data.logs.map((l) => (l.id === next.id ? next : l))
      : [...data.logs, next],
  };
  const affected = [previous, next]
    .filter((l): l is StudyLog => !!l && !l.initialLearning)
    .filter(
      (l, i, list) =>
        list.findIndex(
          (x) => x.materialId === l.materialId && x.round === l.round,
        ) === i,
    );
  for (const record of affected) {
    const m = data.materials.find((m) => m.id === record.materialId);
    if (!m || !isDayBook(m) || !totalDays(m)) continue;
    const before = getDayBook(data, m);
    const state = before.rounds.find((r) => r.round === record.round) ?? {
      round: record.round,
      nextDay: nextUnfinished(data.logs, m.id, record.round, totalDays(m)),
      lastOpenedDay: 1,
    };
    const nextDay = nextUnfinished(
      result.logs,
      m.id,
      record.round,
      dayRoundTotal(before, record.round),
    );
    const sameTuple =
      previous?.materialId === next.materialId &&
      previous?.round === next.round &&
      previous?.item === next.item;
    const added =
      record.materialId === next.materialId &&
      record.round === next.round &&
      active(next) &&
      (!previous || !active(previous) || !sameTuple);
    // Recording and cancelling affect progress, never the selected browsing Day.
    const changed: DayRoundState = {
      ...state,
      nextDay,
      ...(added ? { lastReviewId: next.id } : {}),
    };
    const current = getDayBook(result, m);
    result = putBook(result, {
      ...current,
      activeRound: before.activeRound,
      rounds: [
        ...current.rounds.filter((r) => r.round !== record.round),
        changed,
      ].sort((a, b) => a.round - b.round),
    });
  }
  const material = data.materials.find((m) => m.id === next.materialId);
  if (
    next.voided &&
    next.activity !== "system" &&
    material &&
    isDayBook(material)
  ) {
    result = {
      ...result,
      logs: result.logs.filter((l) => l.id !== next.id),
      dayBooks: result.dayBooks?.map((book) => ({
        ...book,
        rounds: book.rounds.map((round) => {
          if (round.lastReviewId !== next.id) return round;
          const { lastReviewId: _removed, ...remaining } = round;
          return remaining;
        }),
      })),
    };
  }
  return result;
}
export function recordDayReview(
  data: DashboardData,
  id: string,
  round: number,
  day: number,
  logId: string,
  date: string,
  minutes: number | null = null,
): DashboardData {
  const m = data.materials.find((m) => m.id === id);
  if (
    !m ||
    !isDayBook(m) ||
    !totalDays(m) ||
    !Number.isSafeInteger(round) ||
    round < 1 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > dayRoundTotal(getDayBook(data, m), round) ||
    data.logs.some((l) => l.id === logId)
  )
    return data;
  if (
    !logId ||
    !isDateString(date) ||
    (minutes !== null && (!Number.isFinite(minutes) || minutes < 0))
  )
    return data;
  const log: StudyLog = {
    id: logId,
    area: m.area,
    materialId: m.id,
    item: String(day),
    round,
    date,
    minutes,
    activity: "review",
    note: "",
    topic: "",
    writing: "",
    speaking: "",
    origin: "entered",
    completed: true,
  };
  return saveDayAwareLog(data, log);
}
export function cancelDayReview(
  data: DashboardData,
  logId: string,
): DashboardData {
  const log = data.logs.find((l) => l.id === logId);
  const material = data.materials.find((m) => m.id === log?.materialId);
  if (
    !log ||
    !material ||
    !isDayBook(material) ||
    log.activity === "system" ||
    (!log.completed && !log.voided)
  )
    return data;
  return saveDayAwareLog(data, { ...log, completed: false, voided: true });
}
/** Remove legacy cancelled word-book reviews without touching EBS or active history. */
export function removeCancelledDayReviews(data: DashboardData): DashboardData {
  return data.logs
    .filter(
      (log) =>
        log.voided &&
        data.materials.some(
          (m) => m.id === log.materialId && m.area === "english",
        ),
    )
    .reduce((current, log) => cancelDayReview(current, log.id), data);
}

/** Explicit first learning is independent of review rounds and never invents duration. */
export function recordInitialDayLearning(
  data: DashboardData,
  materialId: string,
  day: number,
  logId: string,
  date: string,
  minutes: number | null = null,
  note = "",
): DashboardData {
  const material = data.materials.find((m) => m.id === materialId);
  if (
    !material ||
    !isDayBook(material) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > totalDays(material) ||
    !logId ||
    data.logs.some((l) => l.id === logId) ||
    !isDateString(date) ||
    (minutes !== null && (!Number.isFinite(minutes) || minutes < 0))
  )
    return data;
  const book = getDayBook(data, material);
  return {
    ...data,
    logs: [
      ...data.logs,
      {
        id: logId,
        area: material.area,
        materialId,
        item: String(day),
        round: book.activeRound,
        date,
        minutes,
        activity: "study",
        initialLearning: true,
        note: note.trim(),
        topic: "",
        writing: "",
        speaking: "",
        origin: "entered",
        completed: true,
      },
    ],
  };
}
/** Append and first-learning record commit together; completed review scopes stay frozen. */
export function addDayLearning(
  data: DashboardData,
  materialId: string,
  expectedDay: number,
  logId: string,
  date: string,
  minutes: number | null = null,
  note = "",
): DashboardData {
  const material = data.materials.find((m) => m.id === materialId);
  if (
    !material ||
    !isDayBook(material) ||
    !!material.vocabularyId ||
    expectedDay !== totalDays(material) + 1 ||
    expectedDay > 10000
  )
    return data;
  const initialized = ensureDayBook(data, materialId);
  const updated = {
    ...initialized,
    materials: initialized.materials.map((m) =>
      m.id === materialId ? { ...m, total: expectedDay } : m,
    ),
  };
  const recorded = recordInitialDayLearning(
    updated,
    materialId,
    expectedDay,
    logId,
    date,
    minutes,
    note,
  );
  if (recorded === updated) return data;
  const ready = ensureDayBook(recorded, materialId);
  const book = getDayBook(
    ready,
    ready.materials.find((m) => m.id === materialId)!,
  );
  return openDay(ready, materialId, book.activeRound, expectedDay);
}
