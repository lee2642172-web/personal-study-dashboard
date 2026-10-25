import type {
  DashboardData,
  FieldId,
  StudyLog,
  TodoItem,
  Task,
  TaskWorkRecord,
} from "./model.ts";
import { completedTodos } from "./todos.ts";

type ActivityBase = {
  id: string;
  date: string | null;
  minutes: number | null;
  area?: FieldId;
  voided?: boolean;
  title: string;
};
export type ActivityEntry = ActivityBase &
  (
    | { source: "study"; activity: StudyLog["activity"]; log: StudyLog }
    | { source: "todo"; activity: "todo"; todo: TodoItem }
    | { source: "task"; activity: "task"; task: Task; record: TaskWorkRecord }
  );

/** All activity screens project from the original record; no mirrored learning logs are saved. */
export function activityEntries(data: DashboardData): ActivityEntry[] {
  const materials = new Map(data.materials.map((m) => [m.id, m]));
  const entries: ActivityEntry[] = [
    ...data.logs.map((log): ActivityEntry => ({
      id: `study:${log.id}`,
      source: "study",
      activity: log.activity,
      date: log.date,
      minutes: log.minutes,
      area: log.area,
      voided: log.voided,
      log,
      title: log.topic
        ? `OPIc · ${log.topic}`
        : materials.get(log.materialId)?.title || log.note || "자유 학습",
    })),
    ...completedTodos(data.todos).map((todo): ActivityEntry => ({
      id: `todo:${todo.id}`,
      source: "todo",
      activity: "todo",
      date: todo.completion!.date,
      minutes: todo.completion!.minutes,
      title: todo.title,
      todo,
    })),
    ...data.tasks.flatMap((task) =>
      (task.records ?? []).map((record): ActivityEntry => ({
        id: `task:${JSON.stringify([task.id, record.id])}`,
        source: "task",
        activity: "task",
        date: record.date,
        minutes: record.minutes ?? null,
        area: task.area,
        title: task.title,
        task,
        record,
      })),
    ),
  ];
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}
