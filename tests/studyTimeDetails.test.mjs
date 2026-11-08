import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  studyActivityDays,
  studySummary,
  dashboardTimeEntries,
} from "../src/dashboard.ts";
import { weekStart } from "../src/dates.ts";

const asOf = "2027-01-03";
function fixture() {
  const data = createInitialData();
  const template = data.logs[0];
  const log = (id, date, minutes, patch = {}) => ({
    ...template,
    id,
    date,
    minutes,
    ...patch,
  });
  data.logs = [
    log("listening", asOf, 18, {
      item: "2026-04-14",
      contentDate: "2026-04-14",
    }),
    log("listening", asOf, 18), // Duplicate ID must not show or count twice.
    log("replay", asOf, 10, { activity: "review" }),
    log("unknown", asOf, null),
    log("cancelled", asOf, 100, { voided: true, completed: false }),
    log("undated", null, 30),
    log("future", "2027-01-04", 60),
    log("previous-year", "2026-12-28", 90),
  ];
  data.todos = [
    {
      id: "todo",
      title: "교재 구매",
      dueDate: "",
      note: "",
      completion: { date: asOf, minutes: 5 },
    },
    {
      id: "cancelled-todo",
      title: "취소한 일",
      dueDate: "",
      note: "",
      completion: null,
    },
    {
      id: "zero",
      title: "시간 없는 완료",
      dueDate: "",
      note: "",
      completion: { date: asOf, minutes: 0 },
    },
  ];
  data.tasks = [
    {
      ...data.tasks[0],
      status: "보류",
      records: [
        {
          id: "work",
          date: asOf,
          mode: "session",
          minutes: 40,
          note: "",
          completed: false,
        },
      ],
    },
  ];
  return data;
}

test("daily drill-down matches HOME total and shows unknown/zero time without cancelled, duplicate or undated records", () => {
  const data = fixture();
  const original = JSON.stringify(data);
  const [day] = studyActivityDays(data, asOf);
  assert.equal(day.date, asOf);
  assert.equal(day.minutes, 73);
  assert.equal(
    day.minutes,
    studySummary(dashboardTimeEntries(data), asOf).today,
  );
  assert.equal(day.entries.length, 6);
  assert.equal(day.unknown, 1);
  assert.deepEqual(
    new Set(day.entries.map((e) => e.source)),
    new Set(["study", "todo", "task"]),
  );
  assert.equal(
    day.entries.find((e) => e.id === "study:listening").log.contentDate,
    "2026-04-14",
  );
  assert.equal(JSON.stringify(data), original);
});

test("weekly drill-down keeps Monday–Sunday dates across years and agrees with the summary, including empty days", () => {
  const data = fixture();
  const days = studyActivityDays(data, asOf, weekStart(asOf), 7);
  assert.deepEqual(
    days.map((day) => day.date),
    [
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ],
  );
  assert.deepEqual(
    days.map((day) => day.minutes),
    [90, 0, 0, 0, 0, 0, 73],
  );
  assert.equal(
    days.reduce((sum, day) => sum + day.minutes, 0),
    studySummary(dashboardTimeEntries(data), asOf).week,
  );
  assert.deepEqual(days[1].entries, []);
  const nextWeek = studyActivityDays(data, asOf, "2027-01-04", 7);
  assert.ok(nextWeek.every((day) => day.minutes === 0 && !day.entries.length));
});

test("time edits, moved actual dates, undo and deleted project records immediately change detail totals", () => {
  const data = fixture();
  data.logs = data.logs
    .filter((log) => log.id !== "listening")
    .map((log) =>
      log.id === "replay" ? { ...log, minutes: 7, date: "2027-01-02" } : log,
    );
  data.todos[0].completion = null;
  data.tasks[0].records = [];
  const days = studyActivityDays(data, asOf, weekStart(asOf), 7);
  assert.equal(days[5].minutes, 7);
  assert.equal(days[6].minutes, 0);
  assert.equal(days[6].entries.length, 2); // Unknown time and a real zero-minute completion remain visible.
  assert.equal(
    days.reduce((sum, day) => sum + day.minutes, 0),
    studySummary(dashboardTimeEntries(data), asOf).week,
  );
});
