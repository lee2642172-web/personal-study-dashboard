import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { prepareChatOperations } from "../src/chatOperations.ts";
import { dashboardTimeEntries, studySummary } from "../src/dashboard.ts";
import { recordEbsLearning } from "../src/ebs.ts";
const asOf = "2026-11-08";
const batch = {
  op: "ebs_listen",
  id: "request-nov-2-4",
  sessions: [
    { contentDate: "2026-04-14", learnedDate: "2026-11-02" },
    { contentDate: "2026-04-15", learnedDate: "2026-11-03" },
    { contentDate: "2026-04-16", learnedDate: "2026-11-04" },
  ],
};
const totals = (d) => studySummary(dashboardTimeEntries(d), asOf);

test("reported three EBS dates add exactly nine records, 54 minutes on each actual date, and no duplicate on retry", () => {
  const before = createInitialData(),
    plan = prepareChatOperations(before, [batch], asOf);
  assert.deepEqual(plan.summary, { added: 9, updated: 0, deleted: 0 });
  assert.equal(plan.next.logs.length, before.logs.length + 9);
  for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"])
    assert.equal(studySummary(dashboardTimeEntries(plan.next), date).today, 54);
  assert.deepEqual(totals(plan.next), { today: 0, week: 162, month: 162 });
  assert.deepEqual(prepareChatOperations(plan.next, [batch], asOf).summary, {
    added: 0,
    updated: 0,
    deleted: 0,
  });
  assert.equal(before.logs.length, createInitialData().logs.length);
});
test("unknown listening dates are filled once, existing measured minutes and other dated sessions are preserved", () => {
  let d = recordEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-14",
    "2026-11-01",
    "prior",
  );
  d.logs.push({
    ...d.logs[0],
    id: "reported-unknown",
    materialId: "ebs-1",
    item: "2026-04-14",
    date: null,
    minutes: 12.5,
  });
  const plan = prepareChatOperations(d, [batch], asOf);
  assert.equal(plan.next.logs.find((l) => l.id === "prior").date, "2026-11-01");
  assert.equal(
    plan.next.logs.find((l) => l.id === "reported-unknown").minutes,
    12.5,
  );
  assert.equal(
    plan.next.logs.find((l) => l.id === "reported-unknown").date,
    "2026-11-02",
  );
  assert.deepEqual(plan.summary, { added: 8, updated: 1, deleted: 0 });
});
test("one atomic request can update books/goals, add calendar and work records, and complete an ordinary todo", () => {
  const d = createInitialData();
  d.todos = [
    { id: "buy", title: "교재 구매", dueDate: "", note: "", completion: null },
  ];
  const event = {
    id: "exam",
    title: "시험 일정",
    date: "2026-12-01",
    endDate: "",
    startTime: "",
    endTime: "",
    category: "시험",
    registrationPhase: "",
    note: "",
    area: "english",
    goalId: "opic",
  };
  const operations = [
    {
      op: "set",
      collection: "materials",
      entityId: "basic",
      path: ["note"],
      value: "새 학습 루틴",
    },
    {
      op: "set",
      collection: "goals",
      entityId: "opic",
      path: ["targetDate"],
      value: "2026-12-01",
    },
    { op: "append", collection: "events", value: event },
    {
      op: "set",
      collection: "todos",
      entityId: "buy",
      path: ["completion"],
      value: { date: "2026-11-06", minutes: 6 },
    },
    {
      op: "append",
      collection: "tasks",
      entityId: "vocabulary-cleanup",
      path: ["records"],
      value: {
        id: "work",
        mode: "session",
        date: "2026-11-05",
        minutes: 40,
        note: "양식 정리",
      },
    },
    {
      op: "set",
      collection: "tasks",
      entityId: "vocabulary-cleanup",
      path: ["items", { key: "id", value: "format" }, "done"],
      value: true,
    },
  ];
  const plan = prepareChatOperations(d, operations, asOf);
  assert.equal(plan.next.events[0].id, "exam");
  assert.equal(plan.next.goals[0].targetDate, "2026-12-01");
  assert.equal(plan.next.tasks[0].records[0].minutes, 40);
  assert.equal(plan.next.tasks[0].items[2].done, true);
  assert.equal(totals(plan.next).month, 46);
  assert.deepEqual(plan.next.logs, d.logs);
  assert.equal(
    prepareChatOperations(plan.next, operations, asOf).changes.length,
    0,
  );
  const deleted = prepareChatOperations(
    plan.next,
    [
      {
        op: "delete",
        collection: "tasks",
        entityId: "vocabulary-cleanup",
        path: ["records", { key: "id", value: "work" }],
      },
      { op: "delete", collection: "events", entityId: "exam" },
    ],
    asOf,
  );
  assert.equal(deleted.next.tasks[0].records.length, 0);
  assert.equal(deleted.next.events.length, 0);
  assert.equal(totals(deleted.next).month, 6);
});
test("generic log creation, date/time correction and removal use actual dates without modifying any other history", () => {
  const d = createInitialData(),
    log = {
      ...d.logs[0],
      id: "eea-log",
      materialId: "eea-reading",
      item: "3",
      contentDate: undefined,
      date: "2026-11-05",
      minutes: 30,
      origin: "entered",
    };
  let plan = prepareChatOperations(
    d,
    [{ op: "append", collection: "logs", value: log }],
    asOf,
  );
  assert.equal(totals(plan.next).month, 30);
  plan = prepareChatOperations(
    plan.next,
    [
      {
        op: "set",
        collection: "logs",
        entityId: log.id,
        path: ["date"],
        value: "2026-11-04",
      },
      {
        op: "set",
        collection: "logs",
        entityId: log.id,
        path: ["minutes"],
        value: 20,
      },
    ],
    asOf,
  );
  assert.equal(totals(plan.next).month, 20);
  plan = prepareChatOperations(
    plan.next,
    [{ op: "delete", collection: "logs", entityId: log.id }],
    asOf,
  );
  assert.deepEqual(plan.next.logs, d.logs);
});
test("malformed/future data, prototype paths and whole history replacement are rejected without partially changing originals", () => {
  const d = createInitialData();
  d.tasks[0].records = [
    { id: "old", mode: "session", date: "2026-11-01", minutes: 20, note: "" },
  ];
  const original = structuredClone(d);
  for (const operations of [
    [
      {
        op: "set",
        collection: "tasks",
        entityId: "vocabulary-cleanup",
        path: ["records"],
        value: [],
      },
    ],
    [
      {
        op: "set",
        collection: "logs",
        entityId: d.logs[0].id,
        path: ["date"],
        value: "2026-12-01",
      },
    ],
    [
      {
        op: "set",
        collection: "materials",
        entityId: "basic",
        path: ["id"],
        value: "other",
      },
    ],
    [
      {
        op: "set",
        collection: "materials",
        entityId: "basic",
        path: ["__proto__", "polluted"],
        value: true,
      },
    ],
    [{ op: "set", collection: "goals", entityId: "opic", path: [], value: {} }],
    [
      {
        op: "set",
        collection: "users",
        entityId: "someone",
        path: ["role"],
        value: "admin",
      },
    ],
    [
      {
        ...batch,
        sessions: [{ contentDate: "2026-04-19", learnedDate: "2026-11-02" }],
      },
    ],
  ])
    assert.throws(() => prepareChatOperations(d, operations, asOf));
  assert.deepEqual(d, original);
  assert.equal({}.polluted, undefined);
});
