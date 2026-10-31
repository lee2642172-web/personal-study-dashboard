import type { DashboardData, TodoItem } from "./model.ts";
import { isDateString } from "./dates.ts";

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
    (v.plannedMinutes !== undefined && !validMinutes(v.plannedMinutes))
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
  if (
    !validTodo(item) ||
    !isDateString(asOf) ||
    (item.completion && item.completion.date > asOf) ||
    !data.todos?.some((t) => t.id === item.id)
  )
    return data;
  const saved = { ...item, title: item.title.trim(), note: item.note.trim() };
  return {
    ...data,
    todos: data.todos.map((t) => (t.id === item.id ? saved : t)),
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
  return { ...data, todos: data.todos.filter((t) => t.id !== id) };
}

export function completedTodos(items: TodoItem[] = []): TodoItem[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return t.completion !== null;
  });
}
