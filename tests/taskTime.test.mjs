import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  saveTask,
  saveTaskRecord,
  deleteTaskRecord,
  taskProgress,
  taskWorkSummary,
  formatWorkMinutes,
  validTask,
  toggleTaskStep,
  roundNumber,
} from "../src/taskWork.ts";
import { activityEntries } from "../src/activities.ts";
import {
  dashboardTimeEntries,
  studySummary,
  studySeries,
  timedStudyLogs,
} from "../src/dashboard.ts";
import { addTodo, completeTodo } from "../src/todos.ts";
import { recordEbsLearning } from "../src/ebs.ts";
import { browserRepository, validData, STORAGE_KEY } from "../src/storage.ts";
const asOf = "2026-10-26";
const get = (d, id) => d.tasks.find((t) => t.id === id);
const put = (d, id, r) => saveTaskRecord(d, id, r, asOf);
const task = (id, mode = "steps", area = "english") => ({
  id,
  title: id,
  area,
  kind: "프로젝트",
  status: "진행 중",
  note: "",
  items: [],
  ...(mode === "steps"
    ? {}
    : {
        tracking:
          mode === "day-range"
            ? { mode, dayStart: 1, dayEnd: 303 }
            : mode === "quantity"
              ? { mode, total: 5113, unit: "단어" }
              : { mode, subject: id, roundTarget: 1 },
      }),
});
const range = (id, startDay, endDay, date, minutes, completed = false) => ({
  id,
  mode: "day-range",
  startDay,
  endDay,
  date,
  minutes,
  completed,
  note: "",
});
const summary = (d) => studySummary(dashboardTimeEntries(d), asOf);

test("the original checklist task records 200 minutes across dates without changing checklist, progress or task state", () => {
  let d = createInitialData();
  const id = d.tasks[0].id;
  d.tasks[0].items[0].done = true;
  const old = structuredClone(d),
    checklist = structuredClone(d.tasks[0].items),
    previousProgress = taskProgress(d.tasks[0]);
  for (const r of [
    range("one", 1, 15, "2026-10-23", 60),
    range("two", 16, 30, "2026-10-24", 90, true),
    range("three", 31, 42, "2026-10-26", 50),
  ])
    d = put(d, id, r);
  assert.deepEqual(get(d, id).items, checklist);
  assert.equal(get(d, id).tracking, undefined);
  assert.equal(taskProgress(get(d, id)).done, previousProgress.done);
  assert.equal(taskProgress(get(d, id)).total, previousProgress.total);
  assert.equal(get(d, id).status, old.tasks[0].status);
  const work = taskWorkSummary(get(d, id));
  assert.equal(work.minutes, 200);
  assert.equal(formatWorkMinutes(work.minutes), "3시간 20분");
  assert.equal(work.latestDate, "2026-10-26");
  assert.equal(work.completedDays, 15);
  for (const key of ["logs", "materials", "goals", "dayBooks", "vocabularies"])
    assert.deepEqual(d[key], old[key]);
  assert.ok(validData(d));
});

test("in-progress ranges do not complete Days; overlapping completed ranges use a union while each session retains its time", () => {
  let d = saveTask(createInitialData(), task("day-work", "day-range"));
  d = put(d, "day-work", range("a", 1, 15, "2026-10-23", 60));
  assert.equal(taskProgress(get(d, "day-work")).done, 0);
  d = put(d, "day-work", range("b", 10, 30, "2026-10-24", 90, true));
  assert.equal(taskProgress(get(d, "day-work")).done, 21);
  d = put(d, "day-work", range("c", 1, 20, "2026-10-26", 50, true));
  assert.equal(taskProgress(get(d, "day-work")).done, 30);
  assert.equal(taskWorkSummary(get(d, "day-work")).minutes, 200);
  d = put(d, "day-work", range("d", 8, 12, "2026-10-26", 25));
  assert.equal(taskProgress(get(d, "day-work")).done, 30);
  assert.equal(taskWorkSummary(get(d, "day-work")).minutes, 225);
  d = put(d, "day-work", range("b", 10, 30, "2026-10-24", 90, false));
  assert.equal(taskProgress(get(d, "day-work")).done, 20);
  assert.equal(taskWorkSummary(get(d, "day-work")).minutes, 225);
  d = deleteTaskRecord(d, "day-work", "c");
  assert.equal(taskProgress(get(d, "day-work")).done, 0);
  assert.equal(taskWorkSummary(get(d, "day-work")).minutes, 175);
  d = put(d, "day-work", range("later", 100, 110, "2026-10-26", 5, true));
  assert.equal(taskProgress(get(d, "day-work")).done, 11);
});

test("the same Day may be worked on repeatedly before completion without losing any recorded duration", () => {
  let d = saveTask(createInitialData(), task("repeat", "day-range"));
  d = put(d, "repeat", range("first", 7, 7, "2026-10-23", 10));
  d = put(d, "repeat", range("second", 7, 7, "2026-10-24", 15));
  assert.equal(taskProgress(get(d, "repeat")).done, 0);
  assert.equal(taskWorkSummary(get(d, "repeat")).minutes, 25);
  d = put(d, "repeat", range("finish", 7, 7, "2026-10-26", 5, true));
  assert.equal(taskProgress(get(d, "repeat")).done, 1);
  assert.equal(taskWorkSummary(get(d, "repeat")).minutes, 30);
});

test("time-only work is available to quantity, rounds and steps while only explicit completions contribute to progress", () => {
  let d = createInitialData();
  for (const [id, mode, area] of [
    ["es", "quantity", "spanish"],
    ["jp", "rounds", "japanese"],
    ["pdf", "steps", "english"],
  ])
    d = saveTask(d, task(id, mode, area));
  d = put(d, "es", {
    id: "q1",
    mode: "quantity",
    quantity: 100,
    date: asOf,
    minutes: 45,
    completed: false,
    note: "",
  });
  d = put(d, "es", {
    id: "q2",
    mode: "quantity",
    quantity: 100,
    date: asOf,
    minutes: 20,
    completed: true,
    note: "",
  });
  assert.equal(taskProgress(get(d, "es")).done, 100);
  assert.equal(taskWorkSummary(get(d, "es")).minutes, 65);
  d = put(d, "es", {
    id: "only-time",
    mode: "session",
    date: asOf,
    minutes: 10,
    completed: false,
    scope: "Excel 양식 검토",
    note: "",
  });
  assert.equal(taskProgress(get(d, "es")).done, 100);
  assert.equal(taskWorkSummary(get(d, "es")).minutes, 75);
  d = put(d, "jp", {
    id: "unfinished",
    mode: "rounds",
    date: asOf,
    minutes: 15,
    completed: false,
    note: "",
  });
  d = put(d, "jp", {
    id: "r1",
    mode: "rounds",
    date: asOf,
    minutes: 20,
    completed: true,
    note: "",
  });
  d = put(d, "jp", {
    id: "r2",
    mode: "rounds",
    date: asOf,
    minutes: 25,
    completed: true,
    note: "",
  });
  assert.equal(taskProgress(get(d, "jp")).done, 2);
  assert.equal(taskWorkSummary(get(d, "jp")).minutes, 60);
  assert.equal(roundNumber(get(d, "jp"), "r1"), 1);
  assert.equal(roundNumber(get(d, "jp"), "r2"), 2);
  d = put(d, "pdf", {
    id: "pdf-time",
    mode: "session",
    date: asOf,
    minutes: 30,
    scope: "PDF 인덱스 검토",
    note: "완료 전 작업",
  });
  assert.equal(taskProgress(get(d, "pdf")).done, 0);
  assert.equal(taskWorkSummary(get(d, "pdf")).minutes, 30);
  assert.ok(validData(d));
});

test("legacy work without durations preserves its completed progress and receives no invented time", () => {
  let d = saveTask(createInitialData(), task("legacy", "day-range"));
  d = put(d, "legacy", {
    id: "old",
    mode: "day-range",
    startDay: 3,
    endDay: 12,
    date: "2026-10-23",
    note: "기존 이력",
  });
  const before = structuredClone(d);
  assert.equal(taskProgress(get(d, "legacy")).done, 10);
  assert.equal(taskWorkSummary(get(d, "legacy")).minutes, 0);
  assert.equal(taskWorkSummary(get(d, "legacy")).measuredCount, 0);
  assert.equal(summary(d).month, 0);
  assert.deepEqual(d, before);
  assert.ok(validTask(get(d, "legacy")));
});

test("HOME and date-filtered records share one projection for study, todo, preparation and project sessions on actual work dates", () => {
  let d = createInitialData();
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    d = recordEbsLearning(d, id, "2026-04-08", asOf, id);
  d = completeTodo(
    addTodo(d, { id: "buy", title: "교재 구매" }),
    "buy",
    asOf,
    10,
  );
  d.logs.push({
    ...d.logs[0],
    id: "legacy-preparation",
    activity: "system",
    date: asOf,
    minutes: 20,
  });
  const oldLogs = structuredClone(d.logs);
  d = saveTask(d, { ...task("paused", "day-range"), status: "보류" });
  for (const r of [
    range("a", 1, 15, "2026-10-23", 60),
    range("b", 16, 30, "2026-10-24", 90, true),
    range("c", 31, 42, asOf, 50),
  ])
    d = put(d, "paused", r);
  assert.deepEqual(summary(d), { today: 134, week: 134, month: 284 });
  assert.equal(studySeries(dashboardTimeEntries(d), asOf, "7")[0].minutes, 134);
  assert.equal(
    studySeries(dashboardTimeEntries(d), asOf, "30").reduce(
      (n, p) => n + p.minutes,
      0,
    ),
    284,
  );
  const day = activityEntries(d).filter((e) => e.date === "2026-10-24");
  assert.equal(
    timedStudyLogs(day, asOf).reduce((n, e) => n + e.minutes, 0),
    90,
  );
  assert.equal(activityEntries(d).filter((e) => e.source === "task").length, 3);
  assert.deepEqual(d.logs, oldLogs);
  assert.equal(get(d, "paused").status, "보류");
});

test("editing/deleting one session and changing task completion state recalculate time independently of task final completion", () => {
  let d = saveTask(createInitialData(), task("editing", "day-range"));
  d = put(d, "editing", range("a", 1, 5, asOf, 40, true));
  d = put(d, "editing", range("b", 3, 8, "2026-10-24", 10, true));
  assert.deepEqual(summary(d), { today: 40, week: 40, month: 50 });
  d = saveTask(d, { ...get(d, "editing"), status: "완료" });
  const records = structuredClone(get(d, "editing").records);
  assert.equal(summary(d).month, 50);
  d = saveTask(d, { ...get(d, "editing"), status: "진행 중" });
  assert.deepEqual(get(d, "editing").records, records);
  d = put(d, "editing", range("a", 1, 5, "2026-10-23", 25, false));
  assert.deepEqual(summary(d), { today: 0, week: 0, month: 35 });
  assert.equal(taskProgress(get(d, "editing")).done, 6);
  d = deleteTaskRecord(d, "editing", "b");
  assert.equal(summary(d).month, 25);
  assert.equal(taskProgress(get(d, "editing")).done, 0);
  assert.equal(taskWorkSummary(get(d, "editing")).latestDate, "2026-10-23");
});

test("session IDs are unique per task, repeated saves are idempotent and projected task time is never persisted as a study log", () => {
  let d = createInitialData();
  for (const id of ["a:b", "a"]) d = saveTask(d, task(id));
  const one = { id: "c", mode: "session", date: asOf, minutes: 10, note: "" };
  d = put(d, "a:b", one);
  d = put(d, "a:b", one);
  d = put(d, "a", { ...one, id: "b:c", minutes: 20 });
  assert.equal(summary(d).today, 30);
  assert.equal(get(d, "a:b").records.length, 1);
  const duplicated = { ...d, tasks: [...d.tasks, get(d, "a:b")] };
  assert.equal(studySummary(dashboardTimeEntries(duplicated), asOf).today, 30);
  assert.equal(d.logs.length, createInitialData().logs.length);
});

test("checklist/status edits preserve sessions; work edits preserve original language learning, todo and calendar records", () => {
  let d = createInitialData();
  const id = d.tasks[0].id;
  d.events = [];
  const original = structuredClone(d);
  d = put(d, id, {
    id: "time",
    mode: "session",
    date: asOf,
    minutes: 15,
    note: "검토",
  });
  const records = structuredClone(get(d, id).records);
  d = toggleTaskStep(d, id, d.tasks[0].items[0].id, asOf);
  assert.deepEqual(get(d, id).records, records);
  assert.equal(taskProgress(get(d, id)).done, 1);
  for (const key of [
    "logs",
    "materials",
    "goals",
    "dayBooks",
    "vocabularies",
    "todos",
    "events",
  ])
    assert.deepEqual(d[key], original[key]);
});

test("invalid duration, incomplete ranges, future dates and empty sessions are rejected while unknown and zero time remain distinct", () => {
  const d = createInitialData(),
    id = d.tasks[0].id;
  for (const patch of [
    { minutes: -1 },
    { minutes: Infinity },
    { minutes: NaN },
    { completed: true },
    { date: "2026-10-27" },
    { date: "2026-02-30" },
  ])
    assert.equal(
      put(d, id, {
        id: "bad",
        mode: "session",
        date: asOf,
        minutes: 10,
        note: "",
        ...patch,
      }),
      d,
    );
  assert.equal(
    put(d, id, { id: "empty", mode: "session", date: asOf, note: "" }),
    d,
  );
  assert.equal(put(d, id, range("reverse", 5, 2, asOf, 10)), d);
  let next = put(d, id, {
    id: "zero",
    mode: "session",
    date: asOf,
    minutes: 0,
    note: "",
  });
  assert.equal(get(next, id).records[0].minutes, 0);
  next = put(next, id, {
    id: "unknown",
    mode: "session",
    date: asOf,
    minutes: null,
    note: "작업 내용만 기록",
  });
  assert.equal(get(next, id).records[1].minutes, null);
  assert.equal(taskWorkSummary(get(next, id)).measuredCount, 1);
  assert.ok(validData(next));
});

test("new and legacy work sessions survive the existing storage unchanged; malformed time/flags never overwrite backups", () => {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
  });
  let d = createInitialData();
  const id = d.tasks[0].id;
  d = put(d, id, range("day", 1, 15, asOf, 60, false));
  d = put(d, id, {
    id: "session",
    mode: "session",
    date: asOf,
    minutes: 90,
    note: "추가 작업",
  });
  browserRepository.save(d);
  assert.deepEqual(browserRepository.load(), d);
  assert.equal(summary(browserRepository.load()).today, 150);
  for (const mutate of [
    (x) => (x.tasks[0].records[0].minutes = -1),
    (x) => (x.tasks[0].records[0].completed = "yes"),
    (x) => (x.tasks[0].records[1].completed = true),
    (x) => x.tasks[0].records.push({ ...x.tasks[0].records[0] }),
  ]) {
    const bad = structuredClone(d);
    mutate(bad);
    assert.ok(!validData(bad));
    const raw = JSON.stringify(bad);
    values.set(STORAGE_KEY, raw);
    assert.throws(() => browserRepository.load());
    assert.equal(values.get(STORAGE_KEY), raw);
  }
});
