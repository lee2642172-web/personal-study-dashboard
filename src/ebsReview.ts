import { type DashboardData, type Material, type StudyLog } from "./model.ts";
import {
  ebsCourses,
  isEbsCourse,
  recordEbsLearning,
  validDate,
} from "./ebs.ts";

export function nextEbsReviewDate(date: string): string {
  if (!validDate(date)) return "";
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export type EbsReview = {
  course: Material;
  contentDate: string;
  learnedDate: string;
  dueDate: string;
  sourceIds: string[];
  completion?: StudyLog;
};

/** Derived reminders never create learning records. Scheduled reviews do not schedule another review. */
export function ebsReviews(data: DashboardData, asOf: string): EbsReview[] {
  if (!validDate(asOf)) return [];
  const courses = new Map(ebsCourses(data.materials).map((m) => [m.id, m]));
  const byId = new Map(data.logs.map((l) => [l.id, l]));
  const groups = new Map<string, EbsReview>();
  const active = data.logs.filter(
    (l) => l.completed && !l.voided && l.activity !== "system",
  );
  for (const log of active) {
    const course = courses.get(log.materialId);
    if (
      !course ||
      log.reviewOf ||
      !log.date ||
      !validDate(log.date) ||
      !validDate(log.item) ||
      log.date < log.item ||
      log.date > asOf
    )
      continue;
    const key = `${course.id}:${log.item}:${log.date}`;
    const group = groups.get(key);
    if (group) group.sourceIds.push(log.id);
    else
      groups.set(key, {
        course,
        contentDate: log.item,
        learnedDate: log.date,
        dueDate: nextEbsReviewDate(log.date),
        sourceIds: [log.id],
      });
  }
  for (const group of groups.values()) {
    group.completion = active
      .filter((l) => {
        const source = l.reviewOf ? byId.get(l.reviewOf) : undefined;
        return (
          l.materialId === group.course.id &&
          l.item === group.contentDate &&
          l.activity === "review" &&
          l.date &&
          validDate(l.date) &&
          l.date >= group.dueDate &&
          l.date <= asOf &&
          (!l.reviewOf ||
            (source &&
              source.materialId === group.course.id &&
              source.item === group.contentDate &&
              source.date === group.learnedDate))
        );
      })
      .sort(
        (a, b) => a.date!.localeCompare(b.date!) || a.id.localeCompare(b.id),
      )[0];
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.contentDate.localeCompare(b.contentDate) ||
      a.course.id.localeCompare(b.course.id),
  );
}

/** One tap records completion; actual review time stays unknown until entered. */
export function recordEbsReview(
  data: DashboardData,
  sourceId: string,
  learnedDate: string,
  id: string,
): DashboardData {
  const review = ebsReviews(data, learnedDate).find((r) =>
    r.sourceIds.includes(sourceId),
  );
  if (!review || review.dueDate > learnedDate || review.completion) return data;
  const next = recordEbsLearning(
    data,
    review.course.id,
    review.contentDate,
    learnedDate,
    id,
    true,
  );
  if (next === data) return data;
  return {
    ...next,
    logs: next.logs.map((l) =>
      l.id === id ? { ...l, reviewOf: sourceId, minutes: null } : l,
    ),
  };
}

/** Cancel only this scheduled review; retain the original listening and other reviews. */
export function cancelEbsReview(
  data: DashboardData,
  id: string,
): DashboardData {
  const log = data.logs.find(
    (l) => l.id === id && l.reviewOf && l.completed && !l.voided,
  );
  if (
    !log ||
    !data.materials.some((m) => m.id === log.materialId && isEbsCourse(m))
  )
    return data;
  return {
    ...data,
    logs: data.logs.map((l) =>
      l.id === id ? { ...l, completed: false, voided: true } : l,
    ),
  };
}
