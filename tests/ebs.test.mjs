import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { browserRepository, STORAGE_KEY } from "../src/storage.ts";
import {
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
