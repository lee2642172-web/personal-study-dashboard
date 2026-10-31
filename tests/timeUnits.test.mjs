import test from "node:test";
import assert from "node:assert/strict";
import {
  formatT,
  formatDuration,
  formatTimeT,
  shiftTodoMinutes,
  DEFAULT_RECORD_MINUTES,
  DEFAULT_TODO_MINUTES,
} from "../src/timeUnits.ts";
import {
  addTodo,
  setTodoPlannedMinutes,
  completeTodo,
  undoTodo,
  validTodo,
} from "../src/todos.ts";
import { createInitialData } from "../src/initialData.ts";
import { dashboardTimeEntries, studySummary } from "../src/dashboard.ts";
import { DashboardStore } from "../src/sync.ts";
const day = "2026-10-31";
test("90 minutes = 1T and 810 minutes = 9T with exact hour/minute detail", () => {
  assert.equal(formatTimeT(810), "9T (13시간 30분)");
  assert.equal(formatTimeT(90), "1T (1시간 30분)");
  assert.equal(formatTimeT(180), "2T (3시간)");
  assert.equal(formatTimeT(45), "0.5T (45분)");
  assert.equal(formatTimeT(0), "0T (0분)");
  assert.equal(DEFAULT_RECORD_MINUTES, 90);
  assert.equal(DEFAULT_TODO_MINUTES, 5);
});
test("partial T values round to two decimals while the original duration remains readable", () => {
  assert.equal(formatTimeT(5), "0.06T (5분)");
  assert.equal(formatTimeT(6), "0.07T (6분)");
  assert.equal(formatTimeT(7), "0.08T (7분)");
  assert.equal(formatTimeT(8), "0.09T (8분)");
  assert.equal(formatT(18), "0.2T");
  assert.equal(formatT(0.1), "<0.01T");
  assert.equal(formatDuration(90.5), "1시간 30.5분");
});
test("arrow controls increment by five without imposing a five-minute multiple on handwritten values", () => {
  assert.equal(shiftTodoMinutes("5", 1), "10");
  assert.equal(shiftTodoMinutes("10", 1), "15");
  assert.equal(shiftTodoMinutes("15", -1), "10");
  assert.equal(shiftTodoMinutes("6", 1), "11");
  assert.equal(shiftTodoMinutes("7", -1), "2");
  assert.equal(shiftTodoMinutes("0", -1), "0");
  assert.equal(shiftTodoMinutes("", 1), "5");
  assert.equal(shiftTodoMinutes("bad", -1), "0");
});
test("registering a planned five- or seven-minute todo does not add actual time until completion", () => {
  let data = addTodo(createInitialData(), {
    id: "book",
    title: "교재 구매",
    plannedMinutes: 5,
  });
  assert.equal(data.todos[0].plannedMinutes, 5);
  assert.equal(studySummary(dashboardTimeEntries(data), day).today, 0);
  data = setTodoPlannedMinutes(data, "book", 7);
  assert.equal(data.todos[0].plannedMinutes, 7);
  assert.equal(studySummary(dashboardTimeEntries(data), day).today, 0);
  data = completeTodo(data, "book", day, 7);
  assert.equal(
    formatTimeT(studySummary(dashboardTimeEntries(data), day).today),
    "0.08T (7분)",
  );
  assert.equal(setTodoPlannedMinutes(data, "book", 15), data);
  data = undoTodo(data, "book");
  assert.equal(data.todos[0].plannedMinutes, 7);
  assert.equal(studySummary(dashboardTimeEntries(data), day).today, 0);
});
test("optional planned time preserves legacy todos and rejects invalid values without changing existing data", () => {
  const initial = createInitialData(),
    old = addTodo(initial, { id: "old", title: "기존 할 일" });
  assert.ok(!Object.hasOwn(old.todos[0], "plannedMinutes"));
  assert.ok(validTodo(old.todos[0]));
  for (const plannedMinutes of [-1, 1.5, NaN, Infinity]) {
    assert.equal(
      addTodo(initial, { id: "invalid", title: "invalid", plannedMinutes }),
      initial,
    );
    assert.equal(setTodoPlannedMinutes(old, "old", plannedMinutes), old);
    assert.equal(validTodo({ ...old.todos[0], plannedMinutes }), false);
  }
  assert.equal(setTodoPlannedMinutes(old, "missing", 10), old);
  const zero = setTodoPlannedMinutes(old, "old", 0);
  assert.equal(zero.todos[0].plannedMinutes, 0);
  assert.equal(studySummary(dashboardTimeEntries(zero), day).today, 0);
});
test("planned minutes synchronize and persist separately from actual completion minutes", async () => {
  const memory = () => {
    const map = new Map();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
    };
  };
  const sa = memory(),
    sb = memory();
  let row = null;
  const db = {
    read: async () => structuredClone(row),
    async write(data, version) {
      if ((row?.revision ?? 0) !== version)
        throw new Error("DASHBOARD_CONFLICT");
      row = {
        data: structuredClone(data),
        revision: version + 1,
        updatedAt: "2026-10-31T00:00:00Z",
      };
      return structuredClone(row);
    },
  };
  const a = new DashboardStore(sa),
    b = new DashboardStore(sb);
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update((d) =>
    addTodo(d, { id: "home-item", title: "메인에서 등록", plannedMinutes: 6 }),
  );
  await a.sync();
  await b.sync();
  assert.equal(b.getSnapshot().data.todos[0].plannedMinutes, 6);
  assert.equal(
    studySummary(dashboardTimeEntries(b.getSnapshot().data), day).today,
    0,
  );
  b.update((d) => setTodoPlannedMinutes(d, "home-item", 8));
  await b.sync();
  await a.sync();
  assert.equal(a.getSnapshot().data.todos[0].plannedMinutes, 8);
  a.update((d) => completeTodo(d, "home-item", day, 8));
  await a.sync();
  const reloaded = new DashboardStore(sb);
  await reloaded.connect("p:u", db);
  assert.equal(reloaded.getSnapshot().data.todos[0].completion.minutes, 8);
  assert.equal(
    formatTimeT(
      studySummary(dashboardTimeEntries(reloaded.getSnapshot().data), day)
        .today,
    ),
    "0.09T (8분)",
  );
});
