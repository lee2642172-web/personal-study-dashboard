import type { DashboardData } from "./model.ts";
import { restoreData, STORAGE_KEY } from "./storage.ts";
import { isDateString } from "./dates.ts";

export type RecoverySource = {
  id: string;
  label: string;
  at: string;
  raw: string;
  data: DashboardData | null;
  error: string;
};
export function recoverySources(
  storage: Pick<Storage, "getItem">,
  backups: { data: DashboardData; label: string; at: string }[],
): RecoverySource[] {
  const sources: RecoverySource[] = [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        sources.push({
          id: "guest",
          label: "로그인 전 이 브라우저의 원본 기록",
          at: "",
          raw,
          data: restoreData(JSON.parse(raw)),
          error: "",
        });
      } catch {
        sources.push({
          id: "guest",
          label: "로그인 전 이 브라우저의 원본 기록",
          at: "",
          raw,
          data: null,
          error: "형식을 읽지 못했습니다. 원본 파일을 먼저 내려받아 주세요.",
        });
      }
    }
  } catch {
    sources.push({
      id: "guest",
      label: "로그인 전 이 브라우저의 원본 기록",
      at: "",
      raw: "",
      data: null,
      error: "브라우저 저장소에 접근하지 못했습니다.",
    });
  }
  backups.forEach((backup, i) =>
    sources.push({
      id: `backup:${i}`,
      label: backup.label,
      at: backup.at,
      raw: JSON.stringify(backup.data),
      data: backup.data,
      error: "",
    }),
  );
  return sources;
}
export function recoverySummary(data: DashboardData) {
  const dates = [
    ...data.logs
      .filter((l) => !l.voided && l.activity !== "system")
      .map((l) => l.date),
    ...data.tasks.flatMap((t) => (t.records ?? []).map((r) => r.date)),
    ...(data.todos ?? []).map((t) => t.completion?.date),
  ]
    .filter((d): d is string => !!d && isDateString(d))
    .sort();
  return {
    latestActivityDate: dates.at(-1) ?? null,
    logs: data.logs.filter((l) => !l.voided).length,
    materials: data.materials.length,
    taskSessions: data.tasks.reduce(
      (sum, task) => sum + (task.records?.length ?? 0),
      0,
    ),
    todos: data.todos?.length ?? 0,
    recentLogs: [...data.logs]
      .filter((l) => !l.voided && l.date)
      .reverse()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 8),
  };
}
