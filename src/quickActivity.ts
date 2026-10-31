import type { DashboardData } from "./model.ts";
import { isDateString } from "./dates.ts";
import { addTodo, completeTodo } from "./todos.ts";

/** One completed one-off activity; uses the existing editable completion/time owner. */
export function recordQuickActivity(
  data: DashboardData,
  input: { id: string; title: string; date: string; minutes: number },
  asOf = input.date,
): DashboardData {
  if (
    !input.id ||
    !input.title.trim() ||
    !isDateString(input.date) ||
    !isDateString(asOf) ||
    input.date > asOf ||
    !Number.isSafeInteger(input.minutes) ||
    input.minutes < 0 ||
    data.todos?.some((todo) => todo.id === input.id)
  )
    return data;
  return completeTodo(
    addTodo(data, { id: input.id, title: input.title }),
    input.id,
    input.date,
    input.minutes,
    asOf,
  );
}
