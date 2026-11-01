import type { DashboardData, TodoItem } from "./model.ts";
import { isDateString } from "./dates.ts";
import { DEFAULT_RECORD_MINUTES } from "./timeUnits.ts";

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const validMinutes = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;

export function validTodo(v: unknown): v is TodoItem {
  if (
    !object(v) ||
    !["id", "title", "dueDate", "note"].every(
      (key) => typeof v[key] === "string",
    ) ||
    !String(v.id).trim() ||
    !String(v.title).trim() ||
    (v.dueDate !== "" && !isDateString(String(v.dueDate))) ||
    (v.plannedMinutes !== undefined && !validMinutes(v.plannedMinutes)) ||
    (v.isGroup !== undefined && v.isGroup !== true) ||
    (v.recordDate !== undefined &&
      (typeof v.recordDate !== "string" || !isDateString(v.recordDate))) ||
    (v.groupId !== undefined &&
      (typeof v.groupId !== "string" ||
        !v.groupId.trim() ||
        v.groupId === v.id)) ||
    (v.isGroup === true && (!v.recordDate || v.groupId !== undefined))
  )
    return false;
  return (
    v.completion === null ||
    (object(v.completion) &&
      typeof v.completion.date === "string" &&
      isDateString(v.completion.date) &&
      validMinutes(v.completion.minutes))
  );
}

export function addTodo(
  data: DashboardData,
  input: {
    id: string;
    title: string;
    dueDate?: string;
    note?: string;
    plannedMinutes?: number;
  },
): DashboardData {
  const item: TodoItem = {
    id: input.id,
    title: input.title.trim(),
    dueDate: input.dueDate ?? "",
    note: (input.note ?? "").trim(),
    completion: null,
    ...(input.plannedMinutes !== undefined
      ? { plannedMinutes: input.plannedMinutes }
      : {}),
  };
  if (!validTodo(item) || data.todos?.some((t) => t.id === item.id))
    return data;
  return { ...data, todos: [...(data.todos ?? []), item] };
}

export function setTodoPlannedMinutes(
  data: DashboardData,
  id: string,
  minutes: number,
): DashboardData {
  if (!validMinutes(minutes)) return data;
  const item = data.todos?.find((todo) => todo.id === id);
  if (!item || item.completion || item.plannedMinutes === minutes) return data;
  return {
    ...data,
    todos: data.todos!.map((todo) =>
      todo.id === id ? { ...todo, plannedMinutes: minutes } : todo,
    ),
  };
}

export function editTodo(
  data: DashboardData,
  item: TodoItem,
  asOf: string,
): DashboardData {
  const current = data.todos?.find((t) => t.id === item.id);
  if (
    !validTodo(item) ||
    !isDateString(asOf) ||
    (item.completion && item.completion.date > asOf) ||
    !current ||
    current.isGroup !== item.isGroup ||
    current.groupId !== item.groupId
  )
    return data;
  const saved = {
    ...item,
    title: item.title.trim(),
    note: item.note.trim(),
    ...(item.isGroup && item.completion
      ? { recordDate: item.completion.date }
      : {}),
  };
  return {
    ...data,
    todos: data.todos!.map((t) => (t.id === item.id ? saved : t)),
  };
}

export function completeTodo(
  data: DashboardData,
  id: string,
  date: string,
  minutes = 0,
  asOf = date,
): DashboardData {
  const item = data.todos?.find((t) => t.id === id);
  if (
    !item ||
    item.completion ||
    todoGroup(data, item) !== undefined ||
    (item.isGroup &&
      (!todoGroupItems(data.todos, item.id).length ||
        date !== item.recordDate)) ||
    !isDateString(date) ||
    !isDateString(asOf) ||
    date > asOf ||
    !validMinutes(minutes)
  )
    return data;
  return {
    ...data,
    todos: data.todos!.map((t) =>
      t.id === id ? { ...t, completion: { date, minutes } } : t,
    ),
  };
}

export function undoTodo(data: DashboardData, id: string): DashboardData {
  if (!data.todos?.some((t) => t.id === id && t.completion)) return data;
  return {
    ...data,
    todos: data.todos.map((t) =>
      t.id === id ? { ...t, completion: null } : t,
    ),
  };
}

export function deleteTodo(data: DashboardData, id: string): DashboardData {
  if (!data.todos?.some((t) => t.id === id)) return data;
  return {
    ...data,
    todos: data.todos
      .filter((t) => t.id !== id)
      .map((t) => {
        if (t.groupId !== id) return t;
        const { groupId: _groupId, ...rest } = t;
        return rest;
      }),
  };
}

export function todoGroupItems(
  items: TodoItem[] = [],
  groupId: string,
): TodoItem[] {
  return items.filter(
    (item) => !item.isGroup && !item.completion && item.groupId === groupId,
  );
}

export function todoGroup(
  data: DashboardData,
  item: TodoItem,
): TodoItem | undefined {
  return item.groupId && !item.completion
    ? data.todos?.find((t) => t.id === item.groupId && t.isGroup)
    : undefined;
}

/** One shared draft per work date. Remember deleted IDs to avoid reusing tombstones. */
function nextGroupId(data: DashboardData, date: string): string {
  const prefix = `todo-group:${date}:`,
    ids = new Set<string>();
  for (const item of [
    ...(data.todos ?? []),
    ...(data.syncState?.seed.todos ?? []),
  ])
    ids.add(item.id);
  for (const path of Object.keys(data.syncState?.changes ?? {})) {
    const parts = JSON.parse(path);
    if (
      parts[0] === "todos" &&
      typeof parts[1] === "string" &&
      parts[1].startsWith("@")
    )
      ids.add(parts[1].slice(1));
  }
  let next = 1;
  for (const id of ids)
    if (id.startsWith(prefix)) {
      const n = Number(id.slice(prefix.length));
      if (Number.isSafeInteger(n) && n >= next) next = n + 1;
    }
  return prefix + next;
}

/** Checking a small todo never creates an activity or invents time. */
export function stageTodo(
  data: DashboardData,
  id: string,
  date: string,
  asOf = date,
): DashboardData {
  const item = data.todos?.find((t) => t.id === id);
  if (
    !item ||
    item.isGroup ||
    item.completion ||
    todoGroup(data, item) ||
    !isDateString(date) ||
    !isDateString(asOf) ||
    date > asOf
  )
    return data;
  const group = data.todos
    ?.filter((t) => t.isGroup && !t.completion && t.recordDate === date)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  const groupId = group?.id ?? nextGroupId(data, date);
  const todos = data.todos!.map((t) => (t.id === id ? { ...t, groupId } : t));
  if (!group)
    todos.push({
      id: groupId,
      title: "간단한 할 일",
      dueDate: "",
      note: "",
      isGroup: true,
      recordDate: date,
      plannedMinutes: DEFAULT_RECORD_MINUTES,
      completion: null,
    });
  return { ...data, todos };
}

export function unstageTodo(data: DashboardData, id: string): DashboardData {
  const item = data.todos?.find((t) => t.id === id),
    group = item && todoGroup(data, item);
  if (!item || !group || group.completion) return data;
  return {
    ...data,
    todos: data.todos!.map((t) => {
      if (t.id !== id) return t;
      const { groupId: _groupId, ...rest } = t;
      return rest;
    }),
  };
}

export function todoTitle(item: TodoItem, items: TodoItem[] = []): string {
  return item.isGroup
    ? `${item.title} · ${todoGroupItems(items, item.id).length}건`
    : item.title;
}

export function completedTodos(items: TodoItem[] = []): TodoItem[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return (
      t.completion !== null &&
      (!t.isGroup || todoGroupItems(items, t.id).length > 0)
    );
  });
}
