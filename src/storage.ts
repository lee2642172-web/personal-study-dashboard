import { connectEbsGroup } from "./ebs.ts";
import { type DashboardData, fields, materialStatuses } from "./model.ts";
export const STORAGE_KEY = "personal-study-dashboard:v1";
export interface DashboardRepository {
  load(): DashboardData | null;
  save(data: DashboardData): void;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === "string");
const numberOrNull = (n: unknown) =>
  n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0);
const positiveOrNull = (n: unknown) =>
  n === null ||
  (typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 10000);
const area = (v: unknown) => fields.some((f) => f.id === v);
export function validData(v: unknown): v is DashboardData {
  if (
    !object(v) ||
    v.version !== 1 ||
    !["materials", "logs", "goals", "tasks"].every((k) => Array.isArray(v[k]))
  )
    return false;
  const unique = (arr: unknown[]) =>
    arr.every(object) &&
    new Set(arr.map((x) => (x as Record<string, unknown>).id)).size ===
      arr.length;
  if (
    !["materials", "logs", "goals", "tasks"].every((k) =>
      unique(v[k] as unknown[]),
    )
  )
    return false;
  return (
    (v.materials as unknown[]).every(
      (m) =>
        object(m) &&
        strings(m, ["id", "title", "note", "routine", "startDate"]) &&
        area(m.area) &&
        ["audio", "units", "days", "reference", "book"].includes(
          String(m.kind),
        ) &&
        materialStatuses.includes(m.status as never) &&
        (m.groupId === undefined || typeof m.groupId === "string") &&
        positiveOrNull(m.total) &&
        positiveOrNull(m.targetPasses) &&
        numberOrNull(m.duration) &&
        Array.isArray(m.schedule) &&
        m.schedule.every(
          (d) => Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 6,
        ),
    ) &&
    (v.logs as unknown[]).every(
      (l) =>
        object(l) &&
        typeof l.completed === "boolean" &&
        strings(l, [
          "id",
          "materialId",
          "item",
          "note",
          "topic",
          "writing",
          "speaking",
        ]) &&
        area(l.area) &&
        (l.date === null || typeof l.date === "string") &&
        typeof l.round === "number" &&
        Number.isInteger(l.round) &&
        l.round > 0 &&
        numberOrNull(l.minutes) &&
        ["study", "review", "system"].includes(String(l.activity)) &&
        ["reported", "entered"].includes(String(l.origin)),
    ) &&
    (v.goals as unknown[]).every(
      (g) =>
        object(g) &&
        strings(g, [
          "id",
          "title",
          "target",
          "current",
          "targetDate",
          "acquiredDate",
          "expiresOn",
          "prerequisiteId",
          "prerequisiteGrade",
        ]) &&
        area(g.area) &&
        ["계획", "진행 중", "장기 목표", "취득"].includes(String(g.status)) &&
        ["인정", "미인정", "확인 필요"].includes(String(g.recognized)),
    ) &&
    (v.tasks as unknown[]).every(
      (t) =>
        object(t) &&
        strings(t, ["id", "title", "note"]) &&
        area(t.area) &&
        ["자유 과업", "프로젝트"].includes(String(t.kind)) &&
        ["예정", "진행 중", "완료"].includes(String(t.status)) &&
        Array.isArray(t.items) &&
        t.items.every(
          (i) =>
            object(i) &&
            strings(i, ["id", "title"]) &&
            typeof i.done === "boolean",
        ),
    )
  );
}
export const browserRepository: DashboardRepository = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    // Additive migration: earlier V1 records represented completed entries.
    if (object(data) && Array.isArray(data.logs))
      data.logs = data.logs.map((l) =>
        object(l) && l.completed === undefined ? { ...l, completed: true } : l,
      );
    if (!validData(data))
      throw new Error(
        "저장된 데이터 형식을 읽을 수 없습니다. 원본을 보존하며 저장을 중단했습니다.",
      );
    return connectEbsGroup(data);
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
export function exportData(data: DashboardData) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-dashboard-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
