import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  addTodo,
  stageTodo,
  unstageTodo,
  completeTodo,
  undoTodo,
  deleteTodo,
  editTodo,
  todoGroupItems,
  completedTodos,
} from "../src/todos.ts";
import { activityEntries } from "../src/activities.ts";
import { dashboardTimeEntries, studySummary } from "../src/dashboard.ts";
import { validData, restoreData } from "../src/storage.ts";
import { DashboardStore } from "../src/sync.ts";
const date = "2026-11-01";
const fixture = () =>
  ["book", "register", "tidy"].reduce(
    (d, id) => addTodo(d, { id, title: id, plannedMinutes: 5 }),
    createInitialData(),
  );
const group = (d) => d.todos.find((t) => t.isGroup && !t.completion);
const total = (d, day = date) =>
  studySummary(dashboardTimeEntries(d), day).today;
const find = (d, id) => d.todos.find((t) => t.id === id);
const staged = () =>
  stageTodo(stageTodo(fixture(), "book", date), "register", date);

function memory() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
}
function server() {
  let row = null;
  return {
    read: async () => structuredClone(row),
    async write(data, revision) {
      if ((row?.revision ?? 0) !== revision)
        throw new Error("DASHBOARD_CONFLICT");
      row = {
        data: structuredClone(data),
        revision: revision + 1,
        updatedAt: "2026-11-01T00:00:00Z",
      };
      return structuredClone(row);
    },
  };
}

test("checking multiple small todos collects them without completed activities or time and preserves existing data", () => {
  const original = fixture(),
    d = stageTodo(stageTodo(original, "book", date), "register", date),
    block = group(d);
  assert.equal(d.todos.filter((t) => t.isGroup).length, 1);
  assert.equal(block.plannedMinutes, 90);
  assert.equal(block.completion, null);
  assert.deepEqual(
    todoGroupItems(d.todos, block.id).map((t) => t.id),
    ["book", "register"],
  );
  assert.equal(find(d, "book").plannedMinutes, 5);
  assert.equal(find(d, "book").completion, null);
  assert.equal(total(d), 0);
  assert.equal(completedTodos(d.todos).length, 0);
  assert.deepEqual(d.logs, original.logs);
  assert.deepEqual(d.tasks, original.tasks);
  assert.deepEqual(d.materials, original.materials);
  assert.equal(stageTodo(d, "book", date), d);
  assert.ok(validData(d));
});
test("one work block owns the entire time and actual date, repeated completion cannot double count", () => {
  let d = staged(),
    id = group(d).id;
  d = completeTodo(d, id, date, 90);
  assert.equal(total(d), 90);
  assert.equal(completedTodos(d.todos).length, 1);
  assert.deepEqual(
    activityEntries(d)
      .filter((e) => e.source === "todo")
      .map((e) => [e.title, e.minutes, e.date]),
    [["간단한 할 일 · 2건", 90, date]],
  );
  assert.equal(find(d, "book").completion, null);
  assert.equal(completeTodo(d, id, date, 180), d);
  assert.equal(completeTodo(d, "book", date, 5), d);
  assert.equal(total(d), 90);
  assert.ok(validData(d));
});
test("unchecking staged work restores a pending todo; cancelling recorded block restores the whole checked list without history or time", () => {
  let d = staged(),
    id = group(d).id;
  d = unstageTodo(d, "book");
  assert.equal(find(d, "book").groupId, undefined);
  assert.equal(todoGroupItems(d.todos, id).length, 1);
  d = stageTodo(d, "book", date);
  d = completeTodo(d, id, date, 45);
  assert.equal(total(d), 45);
  assert.equal(unstageTodo(d, "book"), d);
  d = undoTodo(d, id);
  assert.equal(total(d), 0);
  assert.equal(activityEntries(d).filter((e) => e.source === "todo").length, 0);
  assert.equal(todoGroupItems(d.todos, id).length, 2);
  d = completeTodo(d, id, date, 135);
  assert.equal(total(d), 135);
});
test("editing group time/date and deleting a group preserve original todos and recalculate all activity totals", () => {
  let d = staged(),
    id = group(d).id;
  d = completeTodo(d, id, date, 90);
  d = editTodo(
    d,
    {
      ...find(d, id),
      title: "일상 정리",
      completion: { date: "2026-10-31", minutes: 60 },
    },
    date,
  );
  assert.equal(total(d), 0);
  assert.equal(total(d, "2026-10-31"), 60);
  assert.equal(find(d, id).recordDate, "2026-10-31");
  d = deleteTodo(d, id);
  assert.equal(total(d, "2026-10-31"), 0);
  assert.equal(find(d, "book").completion, null);
  assert.equal(find(d, "book").groupId, undefined);
  assert.equal(find(d, "register").groupId, undefined);
  assert.equal(d.todos.length, 3);
  assert.ok(validData(d));
});
test("additional work creates another independent block and unfinished earlier-day blocks keep their actual date", () => {
  let d = staged(),
    id = group(d).id;
  d = completeTodo(d, id, date, 90);
  d = stageTodo(d, "tidy", date);
  assert.notEqual(group(d).id, id);
  d = completeTodo(d, group(d).id, date, 45);
  assert.equal(total(d), 135);
  let old = stageTodo(fixture(), "book", "2026-10-31", date),
    oldId = group(old).id;
  old = completeTodo(old, oldId, "2026-10-31", 20, date);
  assert.equal(total(old), 0);
  assert.equal(total(old, "2026-10-31"), 20);
});
test("pending and completed blocks survive serialization, invalid data and accidental empty/future blocks are rejected", () => {
  let d = staged();
  assert.deepEqual(restoreData(JSON.parse(JSON.stringify(d))), d);
  const id = group(d).id;
  assert.equal(completeTodo(d, id, "2026-11-02", 90, date), d);
  for (const minutes of [-1, 0.5, NaN, Infinity])
    assert.equal(completeTodo(d, id, date, minutes), d);
  for (const day of ["bad", "2026-02-30", "2026-11-02"])
    assert.equal(stageTodo(d, "tidy", day, date), d);
  assert.equal(stageTodo(d, "missing", date), d);
  d = unstageTodo(unstageTodo(d, "book"), "register");
  assert.equal(completeTodo(d, id, date, 90), d);
  d = stageTodo(d, "book", date);
  d = completeTodo(d, id, date, 0);
  assert.equal(completedTodos(d.todos).length, 1);
  assert.equal(total(d), 0);
  assert.deepEqual(restoreData(JSON.parse(JSON.stringify(d))), d);
  for (const patch of [
    { isGroup: false },
    { recordDate: "bad" },
    { groupId: id },
  ])
    assert.equal(
      validData({
        ...d,
        todos: d.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }),
      false,
    );
});
test("two devices stage different todos into one shared block, concurrently finalize once and propagate undo", async () => {
  const db = server(),
    storage = memory(),
    a = new DashboardStore(storage),
    b = new DashboardStore(memory());
  a.update(() => fixture());
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update((d) => stageTodo(d, "book", date));
  b.update((d) => stageTodo(d, "register", date));
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  const id = group(a.getSnapshot().data).id;
  assert.equal(group(b.getSnapshot().data).id, id);
  assert.equal(todoGroupItems(a.getSnapshot().data.todos, id).length, 2);
  for (const store of [a, b])
    store.update((d) => completeTodo(d, id, date, 90));
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  assert.equal(total(a.getSnapshot().data), 90);
  assert.equal(completedTodos(b.getSnapshot().data.todos).length, 1);
  const reopened = new DashboardStore(storage);
  await reopened.connect("p:u", db);
  assert.equal(total(reopened.getSnapshot().data), 90);
  reopened.update((d) => undoTodo(d, id));
  await reopened.sync();
  await b.sync();
  assert.equal(total(b.getSnapshot().data), 0);
  assert.equal(todoGroupItems(b.getSnapshot().data.todos, id).length, 2);
});
test("deleted block IDs are not reused, preventing a later block from resurrecting a cancelled record", async () => {
  const db = server(),
    store = new DashboardStore(memory());
  store.update(() => fixture());
  await store.connect("p:u", db);
  store.update((d) => stageTodo(d, "book", date));
  const id = group(store.getSnapshot().data).id;
  store.update((d) => completeTodo(d, id, date, 90));
  await store.sync();
  store.update((d) => deleteTodo(d, id));
  await store.sync();
  store.update((d) => stageTodo(d, "book", date));
  assert.notEqual(group(store.getSnapshot().data).id, id);
  await store.sync();
  assert.equal(total(store.getSnapshot().data), 0);
});
test("a concurrent legacy individual completion remains valid and is not lost behind an empty block", async () => {
  const db = server(),
    a = new DashboardStore(memory()),
    b = new DashboardStore(memory());
  a.update(() => fixture());
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update((d) => stageTodo(d, "book", date));
  b.update((d) => completeTodo(d, "book", date, 7));
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  const d = a.getSnapshot().data;
  assert.ok(validData(d));
  assert.equal(total(d), 7);
  assert.equal(completedTodos(d.todos).length, 1);
});
