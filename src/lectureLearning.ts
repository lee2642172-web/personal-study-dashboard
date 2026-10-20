import { isDateString } from "./dates.ts";
import { type DashboardData, type Material, type StudyLog } from "./model.ts";
export function lectureCompleted(
  logs: StudyLog[],
  id: string,
  round: number,
  number: number,
) {
  return logs.some(
    (l) =>
      l.materialId === id &&
      l.round === round &&
      Number(l.item) === number &&
      l.activity !== "system" &&
      l.completed &&
      !l.voided,
  );
}
export function nextLecture(
  material: Material,
  logs: StudyLog[],
  round: number,
) {
  for (let n = 1; n <= (material.total ?? 0); n++)
    if (!lectureCompleted(logs, material.id, round, n)) return n;
  return material.total ?? 1;
}
export function lectureMinutes(
  material: Material,
  number: number,
): number | null {
  return (
    material.lectures?.find((l) => l.number === number)?.duration ??
    material.duration
  );
}
/** Completion uses course length by default; explicit corrections (including zero) take precedence. */
export function recordLectureCompletion(
  data: DashboardData,
  id: string,
  round: number,
  number: number,
  logId: string,
  date: string,
  minutes: number | null = null,
): DashboardData {
  const material = data.materials.find((m) => m.id === id);
  if (
    !material ||
    material.kind !== "lectures" ||
    !material.total ||
    !Number.isSafeInteger(round) ||
    round < 1 ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > material.total ||
    !logId ||
    data.logs.some((l) => l.id === logId) ||
    !isDateString(date) ||
    (minutes !== null && (!Number.isFinite(minutes) || minutes < 0)) ||
    lectureCompleted(data.logs, id, round, number)
  )
    return data;
  const log: StudyLog = {
    id: logId,
    area: material.area,
    materialId: id,
    item: String(number),
    round,
    date,
    minutes: minutes ?? lectureMinutes(material, number),
    activity: round === 1 ? "study" : "review",
    note: "",
    topic: "",
    writing: "",
    speaking: "",
    origin: "entered",
    completed: true,
  };
  return { ...data, logs: [...data.logs, log] };
}
/** Undo completed checks in this round only; partial study and other rounds remain intact. */
export function cancelLectureCompletion(
  data: DashboardData,
  id: string,
  round: number,
  number: number,
): DashboardData {
  if (!data.materials.some((m) => m.id === id && m.kind === "lectures"))
    return data;
  const logs = data.logs.filter(
    (l) =>
      !(
        l.materialId === id &&
        l.round === round &&
        Number(l.item) === number &&
        l.activity !== "system" &&
        l.completed &&
        !l.voided
      ),
  );
  return logs.length === data.logs.length ? data : { ...data, logs };
}
