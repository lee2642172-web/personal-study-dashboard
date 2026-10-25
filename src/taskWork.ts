import {
  fields,
  type DashboardData,
  type Task,
  type TaskTracking,
  type TaskStep,
  type TaskWorkRecord,
  type FieldId,
} from "./model.ts";
import { isDateString } from "./dates.ts";
export const taskStatuses = ["예정", "진행 중", "보류", "완료"] as const;
export const trackingLabels: Record<TaskTracking["mode"], string> = {
  "day-range": "Day 구간 기록형",
  quantity: "수량 기록형",
  rounds: "회독 기록형",
  steps: "단계별 진행형",
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const positive = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) > 0;
const optionalNumber = (v: unknown) =>
  v === undefined || v === null || positive(v);
export const taskMode = (task: Task) => task.tracking?.mode ?? "steps";
export function validWorkRecord(v: unknown): v is TaskWorkRecord {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !v.id.trim() ||
    typeof v.date !== "string" ||
    !isDateString(v.date) ||
    typeof v.note !== "string"
  )
    return false;
  if (v.mode === "day-range")
    return (
      positive(v.startDay) &&
      positive(v.endDay) &&
      Number(v.endDay) >= Number(v.startDay)
    );
  if (v.mode === "quantity") return positive(v.quantity);
  return v.mode === "rounds";
}
export function validTask(v: unknown): v is Task {
  if (
    !object(v) ||
    !["id", "title", "note"].every((k) => typeof v[k] === "string") ||
    !fields.some((f) => f.id === v.area) ||
    !["자유 과업", "프로젝트"].includes(String(v.kind)) ||
    !taskStatuses.includes(v.status as never)
  )
    return false;
  // Legacy records are accepted without tracking configuration or dated steps.
  if (
    !Array.isArray(v.items) ||
    !v.items.every(
      (i) =>
        object(i) &&
        typeof i.id === "string" &&
        typeof i.title === "string" &&
        typeof i.done === "boolean" &&
        (i.note === undefined || typeof i.note === "string") &&
        (i.completedDate === undefined ||
          (typeof i.completedDate === "string" &&
            isDateString(i.completedDate))),
    )
  )
    return false;
  if (new Set(v.items.map((i) => i.id)).size !== v.items.length) return false;
  if (
    v.targetDate !== undefined &&
    (typeof v.targetDate !== "string" ||
      (v.targetDate !== "" && !isDateString(v.targetDate)))
  )
    return false;
  if (v.tracking !== undefined) {
    const c = v.tracking;
    if (!object(c) || !Object.hasOwn(trackingLabels, String(c.mode)))
      return false;
    if (
      !["dayStart", "dayEnd", "total", "roundTarget"].every((k) =>
        optionalNumber(c[k]),
      ) ||
      !["unit", "subject", "materialId"].every(
        (k) => c[k] === undefined || typeof c[k] === "string",
      )
    )
      return false;
    if (
      c.mode === "day-range" &&
      (!positive(c.dayStart) || !positive(c.dayEnd) || c.dayEnd < c.dayStart)
    )
      return false;
    if (
      c.mode === "rounds" &&
      (typeof c.subject !== "string" || !c.subject.trim())
    )
      return false;
  }
  if (
    v.records !== undefined &&
    (!Array.isArray(v.records) ||
      !v.records.every(validWorkRecord) ||
      new Set(v.records.map((r) => r.id)).size !== v.records.length)
  )
    return false;
  const task = v as Task;
  // Preserve old modes' records when switching; their original configuration must still cover them.
  if (
    task.records?.some(
      (r) =>
        r.mode === "day-range" &&
        (!positive(task.tracking?.dayStart) ||
          !positive(task.tracking?.dayEnd) ||
          r.startDay < task.tracking.dayStart ||
          r.endDay > task.tracking.dayEnd),
    )
  )
    return false;
  return true;
}
export function taskSettingsError(task: Task): string {
  if (!task.title.trim()) return "과업명을 입력해 주세요.";
  if (
    taskMode(task) === "day-range" &&
    (!positive(task.tracking?.dayStart) ||
      !positive(task.tracking?.dayEnd) ||
      task.tracking.dayEnd < task.tracking.dayStart)
  )
    return "전체 시작 Day와 종료 Day를 확인해 주세요.";
  if (taskMode(task) === "rounds" && !task.tracking?.subject?.trim())
    return "회독 대상을 입력해 주세요.";
  if (
    task.records?.some(
      (r) =>
        r.mode === "day-range" &&
        (r.startDay < (task.tracking?.dayStart ?? Infinity) ||
          r.endDay > (task.tracking?.dayEnd ?? 0)),
    )
  )
    return "기존 작업 구간을 포함하는 전체 Day 범위를 설정해 주세요. 이력은 임의로 잘라내지 않습니다.";
  return validTask(task)
    ? ""
    : "목표 수량·회독 수·날짜와 설정을 확인해 주세요.";
}
export function recordError(
  task: Task,
  record: TaskWorkRecord,
  asOf: string,
): string {
  if (!validWorkRecord(record))
    return "실제 날짜와 양수인 작업 범위를 확인해 주세요.";
  if (record.date > asOf)
    return "실제로 작업한 날짜는 오늘 이후로 입력할 수 없습니다.";
  if (
    record.mode === "day-range" &&
    (record.startDay < (task.tracking?.dayStart ?? Infinity) ||
      record.endDay > (task.tracking?.dayEnd ?? 0))
  )
    return "작업 구간은 설정된 전체 Day 범위 안에 입력해 주세요.";
  return "";
}
export function saveTask(data: DashboardData, task: Task): DashboardData {
  if (taskSettingsError(task)) return data;
  const saved = { ...task, title: task.title.trim() };
  return {
    ...data,
    tasks: data.tasks.some((t) => t.id === task.id)
      ? data.tasks.map((t) => (t.id === task.id ? saved : t))
      : [...data.tasks, saved],
  };
}
export function saveTaskRecord(
  data: DashboardData,
  taskId: string,
  record: TaskWorkRecord,
  asOf: string,
): DashboardData {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || !isDateString(asOf) || recordError(task, record, asOf))
    return data;
  const prior = task.records?.find((r) => r.id === record.id);
  if (prior ? prior.mode !== record.mode : record.mode !== taskMode(task))
    return data;
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            records: prior
              ? t.records!.map((r) => (r.id === record.id ? { ...record } : r))
              : [...(t.records ?? []), { ...record }],
          }
        : t,
    ),
  };
}
export function deleteTaskRecord(
  data: DashboardData,
  taskId: string,
  id: string,
): DashboardData {
  if (
    !data.tasks.some(
      (t) => t.id === taskId && t.records?.some((r) => r.id === id),
    )
  )
    return data;
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === taskId
        ? { ...t, records: t.records!.filter((r) => r.id !== id) }
        : t,
    ),
  };
}
export function saveTaskStep(
  data: DashboardData,
  taskId: string,
  step: TaskStep,
): DashboardData {
  if (!step.title.trim()) return data;
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return data;
  const items = task.items.some((i) => i.id === step.id)
    ? task.items.map((i) => (i.id === step.id ? step : i))
    : [...task.items, step];
  const next = { ...task, items };
  return validTask(next)
    ? { ...data, tasks: data.tasks.map((t) => (t.id === taskId ? next : t)) }
    : data;
}
export function deleteTaskStep(
  data: DashboardData,
  taskId: string,
  id: string,
): DashboardData {
  if (
    !data.tasks.some((t) => t.id === taskId && t.items.some((i) => i.id === id))
  )
    return data;
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === taskId ? { ...t, items: t.items.filter((i) => i.id !== id) } : t,
    ),
  };
}
export function toggleTaskStep(
  data: DashboardData,
  taskId: string,
  id: string,
  date: string,
): DashboardData {
  if (!isDateString(date)) return data;
  const step = data.tasks
    .find((t) => t.id === taskId)
    ?.items.find((i) => i.id === id);
  if (!step) return data;
  return saveTaskStep(data, taskId, {
    ...step,
    done: !step.done,
    completedDate: step.done ? undefined : date,
  });
}
export function mergedDayRanges(records: TaskWorkRecord[]) {
  const ranges = records
    .filter((r) => r.mode === "day-range")
    .map((r) => [r.startDay, r.endDay] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
export function taskProgress(task: Task) {
  const mode = taskMode(task),
    records = (task.records ?? []).filter((r) => r.mode === mode);
  let done = 0,
    total: number | null = null,
    unit = "단계";
  if (mode === "day-range") {
    done = mergedDayRanges(records).reduce((n, [s, e]) => n + e - s + 1, 0);
    total =
      task.tracking?.dayStart && task.tracking.dayEnd
        ? task.tracking.dayEnd - task.tracking.dayStart + 1
        : null;
    unit = "Days";
  }
  if (mode === "quantity") {
    done = records.reduce(
      (n, r) => n + (r.mode === "quantity" ? r.quantity : 0),
      0,
    );
    total = task.tracking?.total ?? null;
    unit = task.tracking?.unit || "개";
  }
  if (mode === "rounds") {
    done = records.length;
    total = task.tracking?.roundTarget ?? null;
    unit = "회독";
  }
  if (mode === "steps") {
    done = task.items.filter((i) => i.done).length;
    total = task.items.length || null;
  }
  const latest = [...records]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestStep = task.items
    .filter((i) => i.done && i.completedDate)
    .sort((a, b) => b.completedDate!.localeCompare(a.completedDate!))[0];
  return {
    mode,
    done,
    total,
    unit,
    remaining: total === null ? null : Math.max(0, total - done),
    overflow: total === null ? 0 : Math.max(0, done - total),
    percent: total ? Math.min(100, (done / total) * 100) : null,
    latest,
    date: mode === "steps" ? latestStep?.completedDate : latest?.date,
  };
}
export function roundNumber(task: Task, recordId: string) {
  return (
    [...(task.records ?? [])]
      .filter((r) => r.mode === "rounds")
      .sort((a, b) => a.date.localeCompare(b.date))
      .findIndex((r) => r.id === recordId) + 1
  );
}
export const workLabel = (task: Task, record: TaskWorkRecord) =>
  record.mode === "day-range"
    ? `Day ${record.startDay}~${record.endDay}`
    : record.mode === "quantity"
      ? `${record.quantity.toLocaleString()} ${task.tracking?.unit || "개"}`
      : `${roundNumber(task, record.id)}회독 완료`;
export const taskTemplates: {
  id: string;
  area: FieldId;
  title: string;
  tracking: TaskTracking;
  note: string;
}[] = [
  {
    id: "english-cleanup",
    area: "english",
    title: "영어 단어장 Excel 시트 정리",
    tracking: {
      mode: "day-range",
      dayStart: 1,
      dayEnd: 303,
      materialId: "vocabulary",
    },
    note: "기존 Day 번호 유지 · 정리 구간은 학습/복습 완료와 별도로 관리",
  },
  {
    id: "spanish-words",
    area: "spanish",
    title: "미정리 단어 DB 구축",
    tracking: { mode: "quantity", total: 5113, unit: "단어" },
    note: "정리 대상 약 5,113개(수정 가능). 기존 Day 1~450 보존 · 신규 단어는 Day 451부터 10개씩 편입 예정. 중복 검토 후 최종 Day 수는 미정이며, 정리 완료가 학습 완료를 뜻하지 않습니다.",
  },
  {
    id: "chinese-hsk6",
    area: "chinese",
    title: "중국어 단어장 추가 정리",
    tracking: { mode: "day-range", dayStart: 311, dayEnd: 500 },
    note: "Day 1~310 정리 완료 · Day 311~500 (190 Days) 추가 정리 예정. 급수별 시트 구분 없이 전체 연속 Day로 관리하며, 정리 진도와 실제 학습·회독 기록은 별도로 유지합니다.",
  },
  {
    id: "hiragana",
    area: "japanese",
    title: "히라가나 암기",
    tracking: { mode: "rounds", subject: "히라가나", roundTarget: null },
    note: "회독 이력을 기록하며 최종 암기 완료는 직접 판단합니다.",
  },
  {
    id: "katakana",
    area: "japanese",
    title: "가타카나 암기",
    tracking: { mode: "rounds", subject: "가타카나", roundTarget: null },
    note: "목표 회독 이후에도 계속 기록할 수 있습니다.",
  },
];
