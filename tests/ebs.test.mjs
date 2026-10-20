import { localDate } from "../src/dates.ts";
import { learningTime } from "../src/studyTime.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { browserRepository, STORAGE_KEY } from "../src/storage.ts";
import {
  recordEbsLearning,
  recordEbsToday,
  toggleEbsLearning,
  EBS_GROUP_ID,
  connectEbsGroup,
  ebsCourses,
  courseDay,
  monthStats,
  defaultEbsDate,
  calendarDates,
  shiftMonth,
  validDate,
} from "../src/ebs.ts";

test("legacy EBS IDs gain only group metadata; original records and other materials are preserved", () => {
  const old = createInitialData();
  old.materials.forEach((m) => delete m.groupId);
  const original = structuredClone(old);
  const connected = connectEbsGroup(old);
  assert.equal(ebsCourses(connected.materials).length, 3);
  assert.deepEqual(connected.logs, original.logs);
  assert.deepEqual(old, original);
  assert.deepEqual(
    connected.materials.filter((m) => m.groupId !== EBS_GROUP_ID),
    original.materials.filter((m) => !m.id.startsWith("ebs-")),
  );
  assert.deepEqual(connectEbsGroup(connected), connected);
  assert.equal(
    defaultEbsDate(
      ebsCourses(connected.materials),
      connected.logs,
      "2026-10-18",
    ),
    "2026-04-07",
  );
});
test("monthly completion uses unique course/publication dates and ignores replays and organization time", () => {
  const d = createInitialData(),
    courses = ebsCourses(d.materials);
  const stats = monthStats(courses, d.logs, "2026-04", "2026-10-18");
  assert.deepEqual(
    stats.byCourse.map((c) => [c.done, c.total]),
    [
      [5, 22],
      [5, 22],
      [6, 26],
    ],
  );
  assert.equal(stats.done, 16);
  assert.equal(stats.total, 70);
  const source = d.logs.find((l) => l.materialId === "ebs-0");
  const logs = [
    ...d.logs,
    {
      ...source,
      id: "replay",
      round: 2,
      activity: "review",
      date: "2026-10-18",
      minutes: 18,
    },
    { ...source, id: "organization", item: "2026-04-08", activity: "system" },
  ];
  assert.equal(monthStats(courses, logs, "2026-04", "2026-10-18").done, 16);
  assert.equal(
    courseDay(courses[0], logs, source.item, "2026-10-18").entries.length,
    2,
  );
  assert.deepEqual(
    d.logs.find((l) => l.id === source.id),
    source,
  );
});
test("future dates stay planned and unrecorded days are not inferred to be complete", () => {
  const d = createInitialData(),
    courses = ebsCourses(d.materials);
  const stats = monthStats(courses, d.logs, "2026-04", "2026-04-07");
  assert.equal(stats.total, 16);
  assert.equal(stats.planned, 54);
  assert.equal(
    courseDay(courses[0], d.logs, "2026-04-08", "2026-04-07").completed,
    false,
  );
  assert.equal(
    courseDay(courses[0], d.logs, "2026-04-08", "2026-04-07").future,
    true,
  );
  assert.equal(monthStats(courses, d.logs, "2026-11", "2026-10-18").total, 0);
  assert.ok(monthStats(courses, d.logs, "2026-11", "2026-10-18").planned > 0);
});
test("weekend scheduling, leap months and calendar navigation remain date based", () => {
  const d = createInitialData(),
    courses = ebsCourses(d.materials);
  assert.deepEqual(
    courses.map(
      (m) => courseDay(m, d.logs, "2026-04-04", "2026-10-18").scheduled,
    ),
    [false, false, true],
  );
  assert.ok(
    courses.every(
      (m) => !courseDay(m, d.logs, "2026-04-05", "2026-10-18").scheduled,
    ),
  );
  const dates = calendarDates("2026-04");
  assert.equal(dates.length, 35);
  assert.equal(dates[3], "2026-04-01");
  assert.ok(calendarDates("2028-02").includes("2028-02-29"));
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
  assert.equal(validDate("2026-02-30"), false);
});
test("stored history outside an edited publication schedule remains visible and counted", () => {
  const d = createInitialData(),
    courses = ebsCourses(d.materials);
  courses[0] = { ...courses[0], schedule: [2] };
  assert.equal(
    courseDay(courses[0], d.logs, "2026-04-01", "2026-10-18").scheduled,
    false,
  );
  assert.equal(
    courseDay(courses[0], d.logs, "2026-04-01", "2026-10-18").completed,
    true,
  );
  assert.equal(
    monthStats([courses[0]], d.logs, "2026-04", "2026-10-18").done,
    5,
  );
});
test("loading and saving an old browser snapshot retains every ID, timestamp and learning value", () => {
  const old = createInitialData();
  old.materials.forEach((m) => delete m.groupId);
  old.logs[0].date = "2026-04-09";
  old.logs[0].minutes = 17;
  const map = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    },
  });
  const loaded = browserRepository.load();
  assert.deepEqual(loaded.logs, old.logs);
  browserRepository.save(loaded);
  assert.deepEqual(browserRepository.load(), loaded);
  assert.equal(ebsCourses(loaded.materials).length, 3);
  assert.equal(loaded.logs[0].date, "2026-04-09");
});

test("one-tap completion writes 18 minutes and separate publication / local learning dates without changing history", () => {
  const d = createInitialData();
  const result = recordEbsLearning(
    d,
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "quick-one",
  );
  assert.equal(result.logs.length, d.logs.length + 1);
  assert.deepEqual(result.logs.slice(0, -1), d.logs);
  const log = result.logs.at(-1);
  assert.equal(log.minutes, 18);
  assert.equal(log.date, "2026-10-18");
  assert.equal(log.contentDate, "2026-04-08");
  assert.equal(log.item, "2026-04-08");
  assert.equal(log.completed, true);
  assert.equal(
    recordEbsLearning(
      result,
      "ebs-0",
      "2026-04-08",
      "2026-10-18",
      "duplicate-click",
    ),
    result,
  );
  assert.equal(
    recordEbsLearning(d, "ebs-0", "2026-04-07", "2026-10-18", "already-done"),
    d,
  );
  assert.ok(d.logs.every((l) => l.minutes === null && l.date === null));
});
test("additional learning appends a new 18-minute review without duplicating completion progress", () => {
  const d = recordEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "first",
  );
  const replay = recordEbsLearning(
    d,
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "extra",
    true,
  );
  assert.equal(replay.logs.length, d.logs.length + 1);
  assert.equal(replay.logs.at(-1).activity, "review");
  assert.equal(replay.logs.at(-1).minutes, 18);
  assert.equal(replay.logs.at(-1).round, 2);
  assert.equal(
    monthStats(
      ebsCourses(replay.materials),
      replay.logs,
      "2026-04",
      "2026-10-18",
    ).done,
    17,
  );
  assert.equal(
    recordEbsLearning(
      replay,
      "ebs-0",
      "2026-04-08",
      "2026-10-18",
      "extra",
      true,
    ),
    replay,
  );
});
test("quick records cannot complete future or unscheduled content and do not apply to other materials", () => {
  const d = createInitialData();
  for (const [id, date] of [
    ["ebs-0", "2026-10-19"],
    ["ebs-0", "2026-04-05"],
    ["basic", "2026-04-08"],
  ])
    assert.equal(recordEbsLearning(d, id, date, "2026-10-18", "invalid"), d);
  assert.equal(
    recordEbsLearning(d, "ebs-0", "2026-04-08", "2026-10-18", "no-first", true),
    d,
  );
});
test("local date uses the device calendar day rather than UTC or an imposed timezone", () => {
  assert.equal(localDate(new Date(2026, 9, 18, 23, 30)), "2026-10-18");
  assert.equal(localDate(new Date(2026, 0, 2, 0, 1)), "2026-01-02");
});
test("HOME periods use actual learning dates, count reviews and separate organization time", () => {
  const d = recordEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "actual-day",
  );
  const source = d.logs.at(-1);
  const logs = [
    ...d.logs,
    { ...source, id: "review", activity: "review" },
    { ...source, id: "system", activity: "system", minutes: 20 },
    { ...source, id: "undated", date: null, minutes: 90 },
  ];
  assert.equal(
    learningTime(logs, "today", "2026-10-18", "2026-10-18").studyMinutes,
    36,
  );
  assert.equal(
    learningTime(logs, "today", "2026-10-18", "2026-10-18").systemMinutes,
    20,
  );
  assert.equal(
    learningTime(logs, "date", "2026-04-08", "2026-10-18").studyMinutes,
    0,
  );
  assert.equal(
    learningTime(logs, "all", "2026-10-18", "2026-10-18").studyMinutes,
    36,
  );
  assert.equal(
    learningTime(logs, "week", "2026-10-18", "2026-10-18").studyMinutes,
    36,
  );
  assert.equal(
    learningTime(logs, "month", "2026-10-18", "2026-10-18").studyMinutes,
    36,
  );
  const edited = d.logs.map((l) =>
    l.id === "actual-day" ? { ...l, date: "2026-10-11", minutes: 25 } : l,
  );
  assert.equal(
    learningTime(edited, "today", "2026-10-18", "2026-10-18").studyMinutes,
    0,
  );
  assert.equal(
    learningTime(edited, "week", "2026-10-18", "2026-10-18").studyMinutes,
    0,
  );
  assert.equal(
    learningTime(edited, "date", "2026-10-11", "2026-10-18").studyMinutes,
    25,
  );
});
test("quick completion roundtrips through local storage with both date fields intact", () => {
  const data = recordEbsLearning(
    createInitialData(),
    "ebs-1",
    "2026-04-08",
    "2026-10-18",
    "save-record",
  );
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  browserRepository.save(data);
  assert.deepEqual(browserRepository.load(), data);
});

test("completion toggle cancels prior sessions and re-completion creates one new session on the click date", () => {
  const original = createInitialData();
  const on = toggleEbsLearning(
    original,
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "toggle-on",
  );
  const replay = recordEbsLearning(
    on,
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "toggle-review",
    true,
  );
  const withOther = recordEbsLearning(
    replay,
    "ebs-1",
    "2026-04-08",
    "2026-10-18",
    "other-course",
  );
  const off = toggleEbsLearning(
    withOther,
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "toggle-off",
  );
  assert.equal(off.logs.length, withOther.logs.length);
  assert.equal(
    courseDay(off.materials[0], off.logs, "2026-04-08", "2026-10-18").completed,
    false,
  );
  assert.ok(
    off.logs
      .filter((l) => ["toggle-on", "toggle-review"].includes(l.id))
      .every((l) => !l.completed && l.voided && l.minutes === 18),
  );
  assert.equal(learningTime(off.logs).studyMinutes, 18);
  assert.equal(
    monthStats(ebsCourses(off.materials), off.logs, "2026-04", "2026-10-18")
      .done,
    17,
  );
  const restored = toggleEbsLearning(
    off,
    "ebs-0",
    "2026-04-08",
    "2026-10-19",
    "toggle-restore",
  );
  assert.equal(restored.logs.length, off.logs.length + 1);
  assert.equal(learningTime(restored.logs).studyMinutes, 36);
  assert.equal(
    learningTime(restored.logs, "today", "2026-10-19", "2026-10-19")
      .studyMinutes,
    18,
  );
  assert.equal(restored.logs.at(-1).id, "toggle-restore");
  assert.equal(restored.logs.at(-1).date, "2026-10-19");
  assert.ok(
    restored.logs
      .filter((l) => ["toggle-on", "toggle-review"].includes(l.id))
      .every((l) => !l.completed && l.voided && l.date === "2026-10-18"),
  );
  assert.deepEqual(restored.logs.slice(0, original.logs.length), original.logs);
});
test("toggle cancellation gives zero recorded time and persists across reload without deleting edits", () => {
  let d = toggleEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "edited-toggle",
  );
  d = {
    ...d,
    logs: d.logs.map((l) =>
      l.id === "edited-toggle" ? { ...l, minutes: 27, date: "2026-10-17" } : l,
    ),
  };
  const off = toggleEbsLearning(d, "ebs-0", "2026-04-08", "2026-10-18", "off");
  const time = learningTime(off.logs);
  assert.equal(time.hasStudyTime, false);
  assert.equal(time.studyMinutes, 0);
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  browserRepository.save(off);
  const loaded = browserRepository.load();
  assert.deepEqual(loaded, off);
  const restored = toggleEbsLearning(
    loaded,
    "ebs-0",
    "2026-04-08",
    "2026-10-18",
    "restore",
  );
  const log = restored.logs.find((l) => l.id === "edited-toggle");
  assert.equal(log.minutes, 27);
  assert.equal(log.date, "2026-10-17");
  assert.equal(log.completed, false);
  assert.equal(log.voided, true);
  assert.equal(restored.logs.at(-1).date, "2026-10-18");
  assert.equal(restored.logs.at(-1).minutes, 18);
  assert.equal(learningTime(restored.logs).studyMinutes, 18);
});
test("re-completion of unknown-time history creates a dated 18-minute session without backfilling old logs", () => {
  const d = createInitialData();
  const off = toggleEbsLearning(
    d,
    "ebs-0",
    "2026-04-07",
    "2026-10-18",
    "unused-off",
  );
  const restored = toggleEbsLearning(
    off,
    "ebs-0",
    "2026-04-07",
    "2026-10-18",
    "unused-restore",
  );
  assert.equal(restored.logs.length, d.logs.length + 1);
  assert.ok(
    restored.logs
      .slice(0, d.logs.length)
      .every((l) => l.date === null && l.minutes === null),
  );
  assert.equal(restored.logs.at(-1).date, "2026-10-18");
  assert.equal(restored.logs.at(-1).minutes, 18);
});

test("three courses completed today total 54 minutes even when two were previously cancelled on another date", () => {
  const date = "2026-10-20",
    content = "2026-04-08";
  const original = createInitialData();
  let d = original;
  for (const id of ["ebs-0", "ebs-1"]) {
    d = recordEbsLearning(d, id, content, "2026-10-18", `old-${id}`);
    d = toggleEbsLearning(d, id, content, "2026-10-18", `off-${id}`);
  }
  const cancelled = structuredClone(d.logs);
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    d = toggleEbsLearning(d, id, content, date, `today-${id}`);
  assert.equal(learningTime(d.logs, "today", date, date).studyMinutes, 54);
  assert.equal(learningTime(d.logs, "today", date, date).measured.length, 3);
  assert.deepEqual(d.logs.slice(0, cancelled.length), cancelled);
  assert.deepEqual(
    d.logs.slice(-3).map((l) => [l.date, l.minutes, l.contentDate]),
    Array(3).fill([date, 18, content]),
  );
});
test("explicit today batch fills missing courses: historical Start/Easy plus today's Power gives 18 then 54", () => {
  let d = createInitialData();
  const date = "2026-10-20",
    content = "2026-04-08";
  for (const id of ["ebs-0", "ebs-1"])
    d = recordEbsLearning(d, id, content, "2026-10-18", `history-${id}`);
  d = recordEbsLearning(d, "ebs-2", content, date, "today-power");
  const before = structuredClone(d.logs);
  assert.equal(learningTime(d.logs, "today", date, date).studyMinutes, 18);
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    d = recordEbsToday(d, id, content, date, `today-${id}`);
  assert.equal(learningTime(d.logs, "today", date, date).studyMinutes, 54);
  assert.deepEqual(d.logs.slice(0, before.length), before);
  assert.equal(d.logs.length, before.length + 2);
  assert.equal(d.logs.at(-1).activity, "review");
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    assert.equal(recordEbsToday(d, id, content, date, `duplicate-${id}`), d);
  assert.equal(
    monthStats(ebsCourses(d.materials), d.logs, "2026-04", date).done,
    19,
  );
  browserRepository.save(d);
  assert.deepEqual(browserRepository.load(), d);
});
test("today recording is explicit, preserves unknown historical times, and follows future/weekend schedules", () => {
  const original = createInitialData(),
    date = "2026-10-20";
  let d = original;
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    d = recordEbsToday(d, id, "2026-04-07", date, `today-${id}`);
  assert.deepEqual(d.logs.slice(0, original.logs.length), original.logs);
  assert.equal(learningTime(d.logs, "today", date, date).studyMinutes, 54);
  assert.equal(
    monthStats(ebsCourses(d.materials), d.logs, "2026-04", date).done,
    16,
  );
  assert.equal(recordEbsToday(d, "ebs-0", "2026-10-21", date, "future"), d);
  assert.equal(recordEbsToday(d, "ebs-0", "2026-10-18", date, "sunday"), d);
  assert.equal(
    recordEbsToday(d, "ebs-0", "2026-10-17", date, "saturday-start"),
    d,
  );
  const saturday = recordEbsToday(
    d,
    "ebs-2",
    "2026-10-17",
    date,
    "saturday-power",
  );
  assert.equal(saturday.logs.length, d.logs.length + 1);
});
test("today batch does not replace customized or deliberately unmeasured records with default time", () => {
  let d = recordEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-08",
    "2026-10-20",
    "custom",
  );
  d.logs = d.logs.map((l) => (l.id === "custom" ? { ...l, minutes: 27 } : l));
  assert.equal(
    recordEbsToday(d, "ebs-0", "2026-04-08", "2026-10-20", "default"),
    d,
  );
  d.logs = d.logs.map((l) => (l.id === "custom" ? { ...l, minutes: null } : l));
  assert.equal(
    recordEbsToday(d, "ebs-0", "2026-04-08", "2026-10-20", "unknown"),
    d,
  );
});
