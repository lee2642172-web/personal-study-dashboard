import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  recordEbsLearning,
  recordEbsToday,
  toggleEbsLearning,
  monthStats,
  ebsCourses,
} from "../src/ebs.ts";
import {
  ebsReviews,
  nextEbsReviewDate,
  recordEbsReview,
  cancelEbsReview,
} from "../src/ebsReview.ts";
import { learningTime } from "../src/studyTime.ts";
import { browserRepository, STORAGE_KEY, validData } from "../src/storage.ts";
const learned = () =>
  recordEbsLearning(
    createInitialData(),
    "ebs-0",
    "2026-04-08",
    "2026-10-20",
    "source",
  );
const pending = (d, date) =>
  ebsReviews(d, date).filter((r) => !r.completion && r.dueDate <= date);

test("next calendar day respects month/year/leap boundaries and ignores invalid dates", () => {
  assert.equal(nextEbsReviewDate("2026-10-20"), "2026-10-21");
  assert.equal(nextEbsReviewDate("2026-12-31"), "2027-01-01");
  assert.equal(nextEbsReviewDate("2028-02-28"), "2028-02-29");
  assert.equal(nextEbsReviewDate("2028-02-29"), "2028-03-01");
  assert.equal(nextEbsReviewDate("2026-02-29"), "");
});
test("reminders use actual listening dates, never publication dates or undated initial history", () => {
  const initial = createInitialData();
  assert.deepEqual(ebsReviews(initial, "2026-10-21"), []);
  const d = learned(),
    before = structuredClone(d);
  const reviews = ebsReviews(d, "2026-10-20");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].contentDate, "2026-04-08");
  assert.equal(reviews[0].learnedDate, "2026-10-20");
  assert.equal(reviews[0].dueDate, "2026-10-21");
  assert.equal(pending(d, "2026-10-20").length, 0);
  assert.equal(pending(d, "2026-10-21").length, 1);
  assert.equal(pending(d, "2026-10-25").length, 1); // Missed review remains due.
  assert.deepEqual(ebsReviews(d, "2026-10-19"), []);
  assert.deepEqual(ebsReviews(d, "bad"), []);
  assert.deepEqual(d, before); // Merely displaying a reminder never saves a study log.
});
test("three next-day reviews record completion without estimating time; original lessons retain 54 minutes", () => {
  let d = createInitialData();
  for (const course of ebsCourses(d.materials))
    d = recordEbsLearning(
      d,
      course.id,
      "2026-04-08",
      "2026-10-20",
      `source-${course.id}`,
    );
  const before = structuredClone(d),
    monthly = monthStats(
      ebsCourses(d.materials),
      d.logs,
      "2026-04",
      "2026-10-21",
    );
  for (const r of pending(d, "2026-10-21"))
    d = recordEbsReview(
      d,
      r.sourceIds[0],
      "2026-10-21",
      `review-${r.course.id}`,
    );
  assert.equal(pending(d, "2026-10-21").length, 0);
  assert.equal(
    ebsReviews(d, "2026-10-21").filter((r) => r.completion).length,
    3,
  );
  assert.deepEqual(d.logs.slice(0, before.logs.length), before.logs);
  assert.ok(
    d.logs
      .slice(-3)
      .every(
        (l) =>
          l.minutes === null &&
          l.activity === "review" &&
          l.date === "2026-10-21" &&
          l.contentDate === "2026-04-08" &&
          l.reviewOf,
      ),
  );
  assert.equal(
    learningTime(d.logs, "today", "2026-10-21", "2026-10-21").studyMinutes,
    0,
  );
  assert.equal(
    learningTime(d.logs, "today", "2026-10-20", "2026-10-20").studyMinutes,
    54,
  );
  assert.equal(
    monthStats(ebsCourses(d.materials), d.logs, "2026-04", "2026-10-21").done,
    monthly.done,
  );
  assert.equal(ebsReviews(d, "2026-10-22").length, 3); // No daily chain from scheduled reviews.
  assert.equal(pending(d, "2026-10-22").length, 0);
  assert.equal(
    recordEbsReview(d, "source-ebs-0", "2026-10-21", "duplicate"),
    d,
  );
  assert.ok(validData(d));
});
test("early or invalid reviews cannot be recorded, including future sources and duplicate IDs", () => {
  const d = learned();
  for (const args of [
    ["source", "2026-10-20", "early"],
    ["source", "bad", "bad"],
    ["missing", "2026-10-21", "missing"],
    ["source", "2026-10-21", "source"],
    ["source", "2026-10-21", ""],
  ])
    assert.equal(recordEbsReview(d, ...args), d);
  const bad = structuredClone(d);
  bad.logs.at(-1).completed = false;
  assert.equal(recordEbsReview(bad, "source", "2026-10-21", "no"), bad);
  assert.equal(cancelEbsReview(d, "source"), d); // Cannot undo original listening via review cancel.
});
test("cancelling a review removes its time, restores the reminder and leaves original listening intact", () => {
  const d = learned(),
    reviewed = recordEbsReview(d, "source", "2026-10-22", "review");
  reviewed.logs.at(-1).minutes = 5;
  let cancelled = cancelEbsReview(reviewed, "review");
  assert.equal(pending(cancelled, "2026-10-22").length, 1);
  assert.equal(
    learningTime(cancelled.logs, "today", "2026-10-22", "2026-10-22")
      .studyMinutes,
    0,
  );
  assert.deepEqual(
    cancelled.logs.find((l) => l.id === "source"),
    d.logs.at(-1),
  );
  assert.equal(cancelEbsReview(cancelled, "review"), cancelled);
  cancelled = recordEbsReview(
    cancelled,
    "source",
    "2026-10-23",
    "review-again",
  );
  assert.equal(pending(cancelled, "2026-10-23").length, 0);
  assert.equal(
    learningTime(cancelled.logs, "today", "2026-10-23", "2026-10-23")
      .studyMinutes,
    0,
  );
  const undone = toggleEbsLearning(
    cancelled,
    "ebs-0",
    "2026-04-08",
    "2026-10-23",
    "unused",
  );
  assert.equal(ebsReviews(undone, "2026-10-23").length, 0);
});
test("Saturday Power lessons can be reviewed on Sunday, independently of publication schedules", () => {
  let d = recordEbsLearning(
    createInitialData(),
    "ebs-2",
    "2026-10-17",
    "2026-10-17",
    "sat",
  );
  assert.equal(pending(d, "2026-10-18").length, 1);
  d = recordEbsReview(d, "sat", "2026-10-18", "sun");
  assert.equal(d.logs.at(-1).date, "2026-10-18");
  assert.equal(pending(d, "2026-10-18").length, 0);
});
test("repeated same-day listening is one reminder; saved edits and existing next-day replay are respected", () => {
  let d = learned();
  d = recordEbsLearning(
    d,
    "ebs-0",
    "2026-04-08",
    "2026-10-20",
    "same-day",
    true,
  );
  assert.equal(ebsReviews(d, "2026-10-21").length, 1);
  d = recordEbsReview(d, "source", "2026-10-21", "linked");
  d.logs.find((l) => l.id === "source").voided = true;
  assert.equal(pending(d, "2026-10-21").length, 0); // Same-day duplicate remains the source.
  d.logs.find((l) => l.id === "linked").minutes = 7;
  assert.equal(
    learningTime(d.logs, "today", "2026-10-21", "2026-10-21").studyMinutes,
    7,
  );
  d.logs.find((l) => l.id === "linked").completed = false;
  assert.equal(pending(d, "2026-10-21").length, 1);
  const existing = recordEbsLearning(
    learned(),
    "ebs-0",
    "2026-04-08",
    "2026-10-21",
    "manual-replay",
    true,
  );
  assert.equal(
    ebsReviews(existing, "2026-10-21").find(
      (r) => r.learnedDate === "2026-10-20",
    ).completion.id,
    "manual-replay",
  );
  const historical = recordEbsToday(
    createInitialData(),
    "ebs-0",
    "2026-04-07",
    "2026-10-20",
    "actual-today",
  );
  assert.equal(pending(historical, "2026-10-21").length, 1); // Batch today session on an old episode also schedules a review.
});
test("source date edits recompute reminders and invalid/incomplete/cancelled/organization/non-EBS sources are excluded", () => {
  const d = learned();
  d.logs.at(-1).date = "2026-10-21";
  assert.equal(pending(d, "2026-10-21").length, 0);
  assert.equal(pending(d, "2026-10-22").length, 1);
  for (const patch of [
    { date: null },
    { date: "invalid" },
    { date: "2026-01-01" },
    { voided: true },
    { completed: false },
    { activity: "system" },
    { materialId: "basic" },
  ]) {
    const bad = structuredClone(d);
    Object.assign(bad.logs.at(-1), patch);
    assert.equal(
      ebsReviews(bad, "2026-10-22").length,
      0,
      JSON.stringify(patch),
    );
  }
});
test("review links, date/time edits and cancellation persist through browser repository reload", () => {
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  const d = recordEbsReview(learned(), "source", "2026-10-21", "review");
  d.logs.at(-1).minutes = 9;
  browserRepository.save(d);
  const loaded = browserRepository.load();
  assert.deepEqual(loaded, d);
  assert.equal(ebsReviews(loaded, "2026-10-21")[0].completion.minutes, 9);
  browserRepository.save(cancelEbsReview(loaded, "review"));
  assert.equal(pending(browserRepository.load(), "2026-10-21").length, 1);
  const bad = structuredClone(d);
  bad.logs.at(-1).reviewOf = 25;
  assert.equal(validData(bad), false);
  const old = createInitialData();
  entries.set(STORAGE_KEY, JSON.stringify(old));
  assert.deepEqual(browserRepository.load(), old); // No backfilled dates/review logs.
});

test("optional review minutes distinguish unmeasured, zero and entered time without losing completion", () => {
  let d = recordEbsReview(learned(), "source", "2026-10-21", "optional");
  let time = learningTime(d.logs, "today", "2026-10-21", "2026-10-21");
  assert.equal(time.hasStudyTime, false);
  assert.equal(time.study.length, 1);
  assert.equal(time.measured.length, 0);
  assert.equal(ebsReviews(d, "2026-10-21")[0].completion.minutes, null);
  d.logs.at(-1).minutes = 5;
  time = learningTime(d.logs, "today", "2026-10-21", "2026-10-21");
  assert.equal(time.studyMinutes, 5);
  assert.equal(time.hasStudyTime, true);
  d.logs.at(-1).minutes = 0;
  assert.equal(
    learningTime(d.logs, "today", "2026-10-21", "2026-10-21").hasStudyTime,
    true,
  );
  d.logs.at(-1).minutes = null;
  assert.equal(pending(d, "2026-10-21").length, 0);
  // A cancelled old measured session must not make unmeasured reviews appear as zero-minute time.
  d.logs.push({
    ...d.logs.at(-1),
    id: "old-default",
    minutes: 18,
    completed: false,
    voided: true,
  });
  assert.equal(
    learningTime(d.logs, "today", "2026-10-21", "2026-10-21").hasStudyTime,
    false,
  );
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  browserRepository.save(d);
  assert.deepEqual(browserRepository.load(), d);
  // Existing saved 18-minute records have no provenance for their time; never guess whether edited.
  d.logs.at(-1).minutes = 18;
  d.logs.at(-1).voided = false;
  d.logs.at(-1).completed = true;
  browserRepository.save(d);
  assert.equal(browserRepository.load().logs.at(-1).minutes, 18);
});
