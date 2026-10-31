import test from "node:test";
import assert from "node:assert/strict";
import { recordQuickActivity } from "../src/quickActivity.ts";
import { createInitialData } from "../src/initialData.ts";
import { addTodo, editTodo, deleteTodo } from "../src/todos.ts";
import { activityEntries } from "../src/activities.ts";
import {
  dashboardTimeEntries,
  studySummary,
  timedStudyLogs,
} from "../src/dashboard.ts";
import { DashboardStore } from "../src/sync.ts";
const day = "2026-10-31";
const input = (patch = {}) => ({
  id: "quick-1",
  title: "  독서와 메모  ",
  date: day,
  minutes: 25,
  ...patch,
});
test("one-line capture creates one completed activity and one time owner without inventing material progress or a pending task", () => {
  const before = createInitialData(),
    result = recordQuickActivity(before, input());
  assert.equal(result.todos.length, 1);
  assert.equal(result.todos[0].title, "독서와 메모");
  assert.deepEqual(result.todos[0].completion, { date: day, minutes: 25 });
  assert.deepEqual(result.logs, before.logs);
  assert.deepEqual(result.materials, before.materials);
  assert.deepEqual(result.tasks, before.tasks);
  const entries = activityEntries(result).filter(
    (e) => e.id === "todo:quick-1",
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].area, undefined);
  assert.equal(studySummary(dashboardTimeEntries(result), day).today, 25);
  assert.equal(studySummary(dashboardTimeEntries(result), day).month, 25);
  assert.equal(
    timedStudyLogs(dashboardTimeEntries(result), day, "english").length,
    0,
  );
});
test("repeated submission IDs are idempotent and never complete an unrelated existing pending task", () => {
  const first = recordQuickActivity(createInitialData(), input());
  assert.equal(recordQuickActivity(first, input()), first);
  assert.equal(first.todos.length, 1);
  const pending = addTodo(createInitialData(), {
    id: "quick-1",
    title: "기존 할 일",
  });
  assert.equal(recordQuickActivity(pending, input()), pending);
  assert.equal(pending.todos[0].completion, null);
  const separate = recordQuickActivity(first, input({ id: "quick-2" }));
  assert.equal(separate.todos.length, 2);
  assert.equal(studySummary(dashboardTimeEntries(separate), day).today, 50);
});
test("invalid title, time or dates leave all existing records unchanged; a deliberate zero-minute record is valid", () => {
  const before = createInitialData();
  for (const patch of [
    { id: "" },
    { title: "  " },
    { minutes: -1 },
    { minutes: 0.5 },
    { minutes: Infinity },
    { minutes: NaN },
    { date: "2026-02-30" },
    { date: "2026-11-01" },
  ])
    assert.equal(recordQuickActivity(before, input(patch), day), before);
  const zero = recordQuickActivity(before, input({ minutes: 0 }));
  assert.equal(zero.todos[0].completion.minutes, 0);
  assert.equal(studySummary(dashboardTimeEntries(zero), day).today, 0);
});
test("existing record editing and deletion immediately recalculate actual-date time without a mirrored study log", () => {
  let data = recordQuickActivity(createInitialData(), input());
  data = editTodo(
    data,
    { ...data.todos[0], completion: { date: "2026-10-30", minutes: 12 } },
    day,
  );
  assert.equal(studySummary(dashboardTimeEntries(data), day).today, 0);
  assert.equal(studySummary(dashboardTimeEntries(data), day).week, 12);
  data = deleteTodo(data, "quick-1");
  assert.equal(
    activityEntries(data).filter((e) => e.source === "todo").length,
    0,
  );
  assert.equal(studySummary(dashboardTimeEntries(data), day).week, 0);
  assert.equal(data.logs.length, createInitialData().logs.length);
});
test("quick entries from two devices merge, survive reload, and their cancellation propagates as a deletion", async () => {
  function memory() {
    const map = new Map();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    };
  }
  const storageA = memory(),
    storageB = memory();
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
  const a = new DashboardStore(storageA),
    b = new DashboardStore(storageB);
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update((d) => recordQuickActivity(d, input()));
  b.update((d) =>
    recordQuickActivity(
      d,
      input({ id: "phone-note", title: "휴대폰 기록", minutes: 15 }),
    ),
  );
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  assert.equal(
    studySummary(dashboardTimeEntries(a.getSnapshot().data), day).today,
    40,
  );
  const reopened = new DashboardStore(storageA);
  await reopened.connect("p:u", db);
  assert.equal(reopened.getSnapshot().data.todos.length, 2);
  reopened.update((d) => deleteTodo(d, "quick-1"));
  await reopened.sync();
  await b.sync();
  assert.equal(
    studySummary(dashboardTimeEntries(b.getSnapshot().data), day).today,
    15,
  );
  assert.ok(!b.getSnapshot().data.todos.some((t) => t.id === "quick-1"));
});
