import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  studySummary,
  studySeries,
  customsLectureProgress,
} from "../src/dashboard.ts";
import {
  recordLectureCompletion,
  cancelLectureCompletion,
} from "../src/lectureLearning.ts";
import { recordEbsReview } from "../src/ebsReview.ts";
import { recordEbsLearning } from "../src/ebs.ts";
import { weekStart } from "../src/dates.ts";
const ref = "2026-10-21";
const fixture = () => {
  const template = createInitialData().logs[0];
  const log = (id, date, minutes, patch = {}) => ({
    ...template,
    id,
    date,
    minutes,
    origin: "entered",
    ...patch,
  });
  return [
    log("before", "2026-10-14", 100),
    log("edge", "2026-10-15", 10),
    log("yesterday", "2026-10-20", 20),
    log("today", ref, 30),
    log("replay", ref, 5, { activity: "review" }),
    log("unknown", ref, null),
    log("voided", ref, 77, { voided: true, completed: false }),
    log("system", ref, 88, { activity: "system" }),
    log("partial", ref, 7, { completed: false, area: "customs" }),
    log("future", "2026-10-22", 100),
    log("undated", null, 100),
    log("prior-month", "2026-09-30", 12),
    log("bad-date", "2026-10-32", 90),
  ];
};
test("HOME summaries and weekly charts use Monday–Sunday, excluding previous-week, future, cancelled, unknown and system time", () => {
  const logs = fixture();
  assert.deepEqual(studySummary(logs, ref), {
    today: 42,
    week: 62,
    month: 172,
  });
  assert.deepEqual(studySummary([], ref), { today: 0, week: 0, month: 0 });
  const series = studySeries(logs, ref, "7");
  assert.equal(series[0].date, "2026-10-19");
  assert.equal(series.at(-1).date, "2026-10-25");
  assert.deepEqual(
    series.map((p) => p.minutes),
    [0, 20, 42, 0, 0, 0, 0],
  );
  assert.equal(
    studySeries(logs, ref, "7", undefined, "customs").find(
      (p) => p.date === ref,
    ).minutes,
    7,
  );
  assert.ok(
    studySeries(logs, ref, "7", undefined, "japanese").every(
      (p) => p.minutes === 0,
    ),
  );
});
test("week boundaries reset on Monday and remain correct on Sunday, across months, years and leap days", () => {
  assert.equal(weekStart("2026-10-25"), "2026-10-19");
  assert.equal(weekStart("2026-10-26"), "2026-10-26");
  assert.equal(weekStart("2028-02-29"), "2028-02-28");
  const logs = [
    ["2026-12-27", 100],
    ["2026-12-28", 10],
    ["2026-12-31", 20],
    ["2027-01-01", 30],
    ["2027-01-02", 40],
    ["2027-01-03", 50],
    ["2027-01-04", 5],
  ].map(([date, minutes]) => ({
    id: date,
    date,
    minutes,
    activity: "study",
    area: "english",
  }));
  assert.deepEqual(studySummary(logs, "2027-01-01"), {
    today: 30,
    week: 60,
    month: 30,
  });
  const week = studySeries(logs, "2027-01-01", "7");
  assert.equal(week[0].date, "2026-12-28");
  assert.equal(week.at(-1).date, "2027-01-03");
  assert.deepEqual(
    week.map((p) => p.minutes),
    [10, 0, 0, 20, 30, 0, 0],
  );
  assert.equal(studySummary(logs, "2027-01-03").week, 150);
  assert.equal(studySummary(logs, "2027-01-04").week, 5);
});
test("chart supports thirty dates, full calendar months, leap years and zeroes for absent/future dates", () => {
  const logs = fixture();
  const thirty = studySeries(logs, ref, "30");
  assert.equal(thirty.length, 30);
  assert.equal(thirty[0].date, "2026-09-22");
  const october = studySeries(logs, ref, "month", "2026-10");
  assert.equal(october.length, 31);
  assert.equal(
    october.reduce((n, p) => n + p.minutes, 0),
    172,
  );
  assert.equal(october.find((p) => p.date === "2026-10-22").minutes, 0);
  assert.equal(studySeries([], "2028-03-01", "month", "2028-02").length, 29);
  assert.equal(studySeries([], "2026-03-01", "month", "2026-02").length, 28);
  assert.deepEqual(studySeries(logs, ref, "month", "invalid"), []);
});
test("edits and cancellation immediately recalculate; duplicate IDs do not double-count intentional distinct reviews", () => {
  const logs = fixture();
  logs.push({ ...logs.find((l) => l.id === "today") });
  assert.equal(studySummary(logs, ref).today, 42);
  const edited = logs
    .filter((l, i) => i !== logs.length - 1)
    .map((l) => (l.id === "today" ? { ...l, minutes: 11 } : l));
  assert.equal(studySummary(edited, ref).today, 23);
  assert.equal(
    studySummary(
      edited.map((l) => (l.id === "today" ? { ...l, voided: true } : l)),
      ref,
    ).today,
    12,
  );
  let data = recordEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-08",
    "2026-10-20",
    "listen",
  );
  data = recordEbsReview(data, "listen", ref, "review");
  assert.equal(studySummary(data.logs, ref).today, 0); // Optional time is not an assumed eighteen minutes.
  data.logs.at(-1).minutes = 3.5;
  assert.equal(studySummary(data.logs, ref).today, 3.5);
});
test("customs progress is weighted across real registered lecture lists and counts each completed lecture once per round", () => {
  let d = createInitialData();
  assert.equal(customsLectureProgress(d).total, 343);
  assert.equal(customsLectureProgress(d).done, 0);
  for (const [id, n] of [
    ["customs-trade-english-theory", 1],
    ["customs-domestic-consumption-tax", 1],
    ["customs-cost-management-accounting", 1],
    ["customs-cost-management-accounting", 2],
  ])
    d = recordLectureCompletion(d, id, 1, n, `${id}-${n}`, ref);
  const p = customsLectureProgress(d);
  assert.equal(p.done, 4);
  assert.equal(p.percent, (4 / 343) * 100);
  const average =
    p.subjects.reduce((n, s) => n + s.percent, 0) / p.subjects.length;
  assert.notEqual(p.percent, average);
  d.logs.push({ ...d.logs.at(-1), id: "repeat-same-lecture" });
  assert.equal(customsLectureProgress(d).done, 4);
  d = recordLectureCompletion(
    d,
    "customs-law-introduction",
    2,
    1,
    "second-round",
    ref,
  );
  assert.equal(customsLectureProgress(d).done, 4);
  assert.equal(customsLectureProgress(d, 2).done, 1);
  d = cancelLectureCompletion(d, "customs-cost-management-accounting", 1, 2);
  assert.equal(customsLectureProgress(d).done, 3);
  const subject = d.materials.find(
    (m) => m.id === "customs-financial-accounting",
  );
  subject.lectures.push({ number: 115, title: "실제 추가 강의", duration: 30 });
  subject.total = 115;
  assert.equal(customsLectureProgress(d).total, 344);
});
