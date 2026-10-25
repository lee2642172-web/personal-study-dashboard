import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  addTodo,
  completeTodo,
  editTodo,
  undoTodo,
  deleteTodo,
  validTodo,
} from "../src/todos.ts";
import {
  dashboardTimeEntries,
  studySummary,
  studySeries,
} from "../src/dashboard.ts";
import { validData, browserRepository, STORAGE_KEY } from "../src/storage.ts";
const find = (d, id) => d.todos.find((t) => t.id === id);
const summary = (d, asOf = "2026-11-02") =>
  studySummary(dashboardTimeEntries(d), asOf);
const completed = (d, id, date, minutes, input = {}) =>
  completeTodo(
    addTodo(d, { id, title: id, ...input }),
    id,
    date,
    minutes,
    date,
  );
function fixture() {
  const d = createInitialData(),
    template = d.logs[0];
  d.logs.push({
    ...template,
    id: "todo:collision",
    date: "2026-11-02",
    minutes: 18,
  });
  d.logs.push({
    ...template,
    id: "last-month-study",
    date: "2026-10-31",
    minutes: 20,
  });
  return d;
}
function repository() {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  return values;
}

test("title-only registration adds an empty pending todo without converting legacy tasks or inventing activity time", () => {
  const d = createInitialData(),
    original = structuredClone(d);
  assert.equal(d.todos, undefined);
  assert.ok(validData(d));
  const next = addTodo(d, { id: "buy-book", title: "  교재 구매  " });
  assert.deepEqual(find(next, "buy-book"), {
    id: "buy-book",
    title: "교재 구매",
    dueDate: "",
    note: "",
    completion: null,
  });
  assert.deepEqual(summary(next), { today: 0, week: 0, month: 0 });
  assert.deepEqual(next.tasks, original.tasks);
  assert.deepEqual(next.logs, original.logs);
  assert.deepEqual(next.materials, original.materials);
  assert.deepEqual(next.goals, original.goals);
  assert.deepEqual(d, original);
  assert.ok(validData(next));
  assert.equal(addTodo(next, { id: "buy-book", title: "중복 제출" }), next);
  assert.equal(addTodo(next, { id: "blank", title: "   " }), next);
  assert.equal(
    addTodo(next, { id: "bad-date", title: "제목", dueDate: "2026-02-30" }),
    next,
  );
  const second = addTodo(next, {
    id: "buy-again",
    title: "교재 구매",
    dueDate: "2026-12-01",
    note: "  추가 메모  ",
  });
  assert.equal(second.todos.length, 2);
  assert.equal(find(second, "buy-again").note, "추가 메모");
});

test("completion combines actual dates with study time across today, rolling seven days, months and all chart periods", () => {
  let d = fixture();
  d = completed(d, "collision", "2026-11-02", 12, { dueDate: "2026-12-20" });
  d = completed(d, "unmeasured", "2026-11-02");
  d = completed(d, "yesterday", "2026-11-01", 5);
  d = completed(d, "week-edge", "2026-10-27", 7);
  d = completed(d, "outside-week", "2026-10-26", 100);
  d = completed(d, "future", "2026-11-03", 50);
  assert.equal(find(d, "unmeasured").completion.minutes, 0);
  assert.deepEqual(summary(d), { today: 30, week: 62, month: 35 });
  const entries = dashboardTimeEntries(d),
    seven = studySeries(entries, "2026-11-02", "7");
  assert.equal(seven[0].date, "2026-10-27");
  assert.equal(seven[0].minutes, 7);
  assert.equal(seven.at(-1).minutes, 30);
  assert.equal(
    seven.reduce((n, p) => n + p.minutes, 0),
    62,
  );
  assert.equal(
    studySeries(entries, "2026-11-02", "30").reduce((n, p) => n + p.minutes, 0),
    162,
  );
  const month = studySeries(entries, "2026-11-02", "month", "2026-11");
  assert.equal(month.length, 30);
  assert.equal(month[2].minutes, 0);
  assert.equal(
    month.reduce((n, p) => n + p.minutes, 0),
    35,
  );
  assert.equal(
    studySeries(entries, "2026-11-02", "7", undefined, "english").at(-1)
      .minutes,
    18,
  );
  assert.ok(
    entries
      .filter((e) => e.activity === "todo")
      .every((e) => e.area === undefined),
  );
  assert.ok(validData(d));
});

test("duplicate completions and repeated projections never double-count, including IDs shared with study logs", () => {
  let d = completed(fixture(), "collision", "2026-11-02", 12);
  const original = structuredClone(d),
    logs = d.logs.length;
  assert.equal(completeTodo(d, "collision", "2026-11-02", 99), d);
  assert.equal(completeTodo(d, "collision", "2026-11-03", 99), d);
  assert.equal(summary(d).today, 30);
  assert.equal(summary(d).today, 30);
  assert.equal(d.logs.length, logs);
  assert.deepEqual(d, original);
  const duplicated = {
    ...d,
    logs: [...d.logs, d.logs.at(-2)],
    todos: [...d.todos, d.todos[0]],
  };
  assert.equal(summary(duplicated).today, 30); // Namespaced IDs do not mix study and todo ownership.
});

test("undo clears completion and time while preserving the todo; completing later creates one current completion", () => {
  let d = completed(fixture(), "sign-up", "2026-11-02", 14, {
    title: "시험 접수",
    dueDate: "2026-11-06",
    note: "기존 메모",
  });
  d = undoTodo(d, "sign-up");
  assert.deepEqual(find(d, "sign-up"), {
    id: "sign-up",
    title: "시험 접수",
    dueDate: "2026-11-06",
    note: "기존 메모",
    completion: null,
  });
  assert.equal(summary(d).today, 18);
  assert.equal(undoTodo(d, "sign-up"), d);
  d = completeTodo(d, "sign-up", "2026-11-03", 9);
  assert.equal(summary(d).today, 18);
  assert.equal(summary(d, "2026-11-03").today, 9);
  assert.equal(d.todos.length, 1);
  assert.equal(d.logs.length, fixture().logs.length);
});

test("editing completion date/time and deleting completed items immediately recalculates totals without changing learning records", () => {
  let d = completed(fixture(), "dashboard", "2026-11-02", 15);
  d = completed(d, "another", "2026-11-02", 4);
  const oldLogs = structuredClone(d.logs),
    oldTasks = structuredClone(d.tasks);
  d = editTodo(
    d,
    {
      ...find(d, "dashboard"),
      title: "대시보드 정리",
      dueDate: "2026-12-01",
      completion: { date: "2026-10-26", minutes: 22 },
    },
    "2026-11-02",
  );
  assert.deepEqual(summary(d), { today: 22, week: 42, month: 22 });
  assert.equal(summary(d, "2026-10-26").today, 22);
  d = editTodo(
    d,
    { ...find(d, "dashboard"), completion: { date: "2026-11-02", minutes: 6 } },
    "2026-11-02",
  );
  assert.equal(summary(d).today, 28);
  d = deleteTodo(d, "dashboard");
  assert.equal(summary(d).today, 22);
  assert.ok(!d.todos.some((t) => t.id === "dashboard"));
  assert.equal(find(d, "another").completion.minutes, 4);
  assert.deepEqual(d.logs, oldLogs);
  assert.deepEqual(d.tasks, oldTasks);
  assert.equal(deleteTodo(d, "missing"), d);
});

test("invalid dates, blank titles, negative/fractional/non-finite minutes and stale edit IDs do not change data", () => {
  const d = addTodo(fixture(), { id: "one", title: "교재 구매" });
  for (const minutes of [-1, 0.5, NaN, Infinity, null])
    assert.equal(completeTodo(d, "one", "2026-11-02", minutes), d);
  for (const date of ["", "2026-02-30", "not-a-date"])
    assert.equal(completeTodo(d, "one", date), d);
  assert.equal(completeTodo(d, "one", "2026-11-03", 10, "2026-11-02"), d);
  assert.equal(completeTodo(d, "missing", "2026-11-02"), d);
  assert.equal(editTodo(d, { ...find(d, "one"), title: " " }, "2026-11-02"), d);
  assert.equal(
    editTodo(
      d,
      { ...find(d, "one"), completion: { date: "2026-11-03", minutes: 1 } },
      "2026-11-02",
    ),
    d,
  );
  assert.equal(
    editTodo(d, { ...find(d, "one"), id: "missing" }, "2026-11-02"),
    d,
  );
});

test("all todo operations leave long-project steps/ranges, vocabulary, calendar, goals and learning history intact", () => {
  const d = createInitialData();
  d.tasks[0].tracking = { mode: "day-range", dayStart: 1, dayEnd: 303 };
  d.tasks[0].records = [
    {
      id: "actual-excel-work",
      mode: "day-range",
      startDay: 7,
      endDay: 12,
      date: "2026-11-01",
      note: "Excel 정리",
    },
  ];
  const original = structuredClone(d);
  let next = addTodo(d, { id: "one-off", title: "교재 구매" });
  next = completeTodo(next, "one-off", "2026-11-02", 8);
  next = editTodo(
    next,
    { ...find(next, "one-off"), note: "수정 메모" },
    "2026-11-02",
  );
  next = undoTodo(next, "one-off");
  next = deleteTodo(next, "one-off");
  const { todos, ...preserved } = next;
  assert.deepEqual(preserved, original);
  assert.deepEqual(todos, []);
});

test("legacy and new storage roundtrip without projected log duplication; undo and deletion persist", () => {
  const values = repository(),
    legacy = createInitialData();
  browserRepository.save(legacy);
  assert.deepEqual(browserRepository.load(), legacy);
  let d = completed(fixture(), "done", "2026-11-02", 12);
  d = addTodo(d, { id: "pending", title: "구매", note: "선택 메모" });
  browserRepository.save(d);
  const restored = browserRepository.load();
  assert.deepEqual(restored, d);
  assert.equal(summary(restored).today, 30);
  assert.equal(restored.logs.length, d.logs.length);
  assert.equal(JSON.parse(values.get(STORAGE_KEY)).todos.length, 2);
  d = undoTodo(restored, "done");
  browserRepository.save(d);
  assert.equal(summary(browserRepository.load()).today, 18);
  d = deleteTodo(d, "done");
  browserRepository.save(d);
  assert.deepEqual(browserRepository.load(), d);
  assert.equal(summary(d).today, 18);
});

test("malformed todo backups are rejected without replacing valid legacy data or overwriting the original payload", () => {
  const values = repository(),
    d = completed(createInitialData(), "done", "2026-11-02", 0);
  assert.ok(validTodo(d.todos[0]));
  assert.ok(validData(d));
  for (const change of [
    (x) => x.todos.push(structuredClone(x.todos[0])),
    (x) => (x.todos[0].completion.minutes = null),
    (x) => (x.todos[0].completion.minutes = -1),
    (x) => (x.todos[0].completion.date = "2026-02-30"),
    (x) => (x.todos[0].title = " "),
    (x) => (x.todos[0].dueDate = "2026-13-01"),
    (x) => delete x.todos[0].completion,
    (x) => (x.todos = {}),
  ]) {
    const invalid = structuredClone(d);
    change(invalid);
    assert.ok(!validData(invalid));
    const raw = JSON.stringify(invalid);
    values.set(STORAGE_KEY, raw);
    assert.throws(() => browserRepository.load());
    assert.equal(values.get(STORAGE_KEY), raw);
  }
});
