import { progress, completedRounds } from "../src/model.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  getDayBook,
  dayRoundTotal,
  addDayLearning,
  recordInitialDayLearning,
  ensureDayBook,
  openDay,
  selectDayRound,
  startDayRound,
  recordDayReview,
  cancelDayReview,
  saveDayAwareLog,
  dayCompleted,
} from "../src/dayLearning.ts";
import { learningTime } from "../src/studyTime.ts";
import { browserRepository, validData } from "../src/storage.ts";
const material = (d, id = "vocabulary") => d.materials.find((m) => m.id === id);
const state = (d, id = "vocabulary", round) => {
  const b = getDayBook(d, material(d, id));
  return b.rounds.find((r) => r.round === (round ?? b.activeRound));
};
const review = (d, day, id, round = 1, book = "vocabulary") =>
  recordDayReview(d, book, round, day, id, "2026-10-18");

test("old records initialize at first unfinished gap, not highest completed Day; raw history is unchanged", () => {
  let d = createInitialData();
  const logs = [1, 3, 99].map((n) => ({
    ...d.logs[0],
    id: `old-${n}`,
    materialId: "vocabulary",
    item: n === 1 ? "01" : String(n),
    round: 1,
    activity: "review",
  }));
  logs.push({ ...logs[0], id: "same-day-numeric", item: "1" });
  d = { ...d, logs: [...d.logs, ...logs] };
  const original = structuredClone(d.logs);
  d = ensureDayBook(d, "vocabulary");
  assert.equal(state(d).nextDay, 2);
  assert.equal(progress(material(d), d.logs).count, 3);
  assert.equal(state(d).lastOpenedDay, 2);
  assert.deepEqual(d.logs, original);
  assert.ok(dayCompleted(d.logs, "vocabulary", 1, 1));
  assert.ok(validData(d));
});
test("opening past/distant Days only persists browsing and never changes learning progress", () => {
  let d = review(createInitialData(), 1, "r1");
  assert.equal(state(d).nextDay, 2);
  d = openDay(d, "vocabulary", 1, 200);
  assert.equal(state(d).lastOpenedDay, 200);
  assert.equal(state(d).nextDay, 2);
  d = openDay(d, "vocabulary", 1, 1);
  assert.equal(state(d).nextDay, 2);
  assert.equal(openDay(d, "vocabulary", 1, 304), d);
  assert.equal(openDay(d, "vocabulary", 1, 0), d);
});
test("review and cancellation update progress without moving the selected Day", () => {
  const d = createInitialData();
  const on = review(d, 1, "first");
  assert.equal(state(on).nextDay, 2);
  assert.equal(state(on).lastOpenedDay, 1);
  assert.equal(on.logs.at(-1).minutes, null);
  const off = cancelDayReview(on, "first");
  assert.equal(state(off).nextDay, 1);
  assert.equal(state(off).lastOpenedDay, 1);
  assert.deepEqual(off.logs, d.logs);
  assert.equal(state(off).lastReviewId, undefined);
  assert.equal(cancelDayReview(off, "first"), off);
  const restored = review(off, 1, "new-first");
  assert.equal(state(restored).nextDay, 2);
  assert.equal(state(restored).lastOpenedDay, 1);
  assert.equal(restored.logs.length, on.logs.length);
  assert.equal(restored.logs.at(-1).date, "2026-10-18");
});
test("out-of-order study and repeats do not skip gaps, and cancelling a repeat retains completed progress", () => {
  let d = review(createInitialData(), 10, "far");
  assert.equal(state(d).nextDay, 1);
  assert.equal(state(d).lastOpenedDay, 1);
  d = review(d, 1, "one");
  assert.equal(state(d).nextDay, 2);
  d = review(d, 1, "repeat");
  assert.equal(state(d).nextDay, 2);
  d = cancelDayReview(d, "repeat");
  assert.equal(state(d).nextDay, 2);
  assert.equal(state(d).lastOpenedDay, 1);
  assert.ok(dayCompleted(d.logs, "vocabulary", 1, 1));
  assert.ok(!d.logs.some((l) => l.id === "repeat"));
  assert.equal(
    d.logs.filter((l) => l.materialId === "vocabulary" && l.item === "1")
      .length,
    1,
  );
});
test("cancelling earlier progress after later reviews returns to the real gap and reviewing again skips only completed Days", () => {
  let d = review(review(createInitialData(), 1, "one"), 2, "two");
  assert.equal(state(d).nextDay, 3);
  d = cancelDayReview(d, "one");
  assert.equal(state(d).nextDay, 1);
  assert.ok(dayCompleted(d.logs, "vocabulary", 1, 2));
  assert.ok(!d.logs.some((l) => l.id === "one"));
  d = review(d, 1, "new-one");
  assert.equal(state(d).nextDay, 3);
  assert.equal(state(d).lastOpenedDay, 1);
});
test("round cursors and browsing are separate; explicit and new rounds have no target-count cap", () => {
  let d = review(createInitialData(), 1, "one");
  d = openDay(d, "vocabulary", 1, 250);
  d = selectDayRound(d, "vocabulary", 2);
  assert.equal(state(d).nextDay, 1);
  d = review(d, 1, "r2", 2);
  assert.equal(state(d).nextDay, 2);
  d = selectDayRound(d, "vocabulary", 1);
  assert.equal(state(d).nextDay, 2);
  assert.equal(state(d).lastOpenedDay, 250);
  d = selectDayRound(d, "vocabulary", 100);
  assert.equal(getDayBook(d, material(d)).activeRound, 100);
  d = startDayRound(d, "vocabulary");
  assert.equal(getDayBook(d, material(d)).activeRound, 101);
  assert.equal(state(d).nextDay, 1);
  assert.equal(state(d, "vocabulary", 1).nextDay, 2);
});
test("completed phrase-book scope stays complete when new Days are added; old logs survive", () => {
  let d = createInitialData();
  d = {
    ...d,
    materials: d.materials.map((m) =>
      m.id === "phrases" ? { ...m, total: 2 } : m,
    ),
  };
  d = review(d, 1, "p1", 1, "phrases");
  d = openDay(d, "phrases", 1, 2);
  d = review(d, 2, "p2", 1, "phrases");
  assert.equal(state(d, "phrases").nextDay, null);
  assert.equal(state(d, "phrases").lastOpenedDay, 2);
  d = cancelDayReview(d, "p2");
  assert.equal(state(d, "phrases").nextDay, 2);
  assert.ok(!d.logs.some((l) => l.id === "p2"));
  d = review(d, 2, "new-p2", 1, "phrases");
  assert.equal(state(d, "phrases").nextDay, null);
  d = {
    ...d,
    materials: d.materials.map((m) =>
      m.id === "phrases" ? { ...m, total: 3 } : m,
    ),
  };
  d = ensureDayBook(d, "phrases");
  assert.equal(state(d, "phrases").nextDay, null);
  assert.equal(dayRoundTotal(getDayBook(d, material(d, "phrases")), 1), 2);
  assert.ok(d.logs.some((l) => l.id === "new-p2"));
  assert.ok(validData(d));
});
test("editing dates/time preserves browsing, while existing record editor cancellation reconciles the cursor", () => {
  let d = review(createInitialData(), 1, "one");
  d = openDay(d, "vocabulary", 1, 50);
  d = saveDayAwareLog(d, {
    ...d.logs.at(-1),
    minutes: 24,
    date: "2026-10-17",
  });
  assert.equal(state(d).lastOpenedDay, 50);
  assert.equal(state(d).nextDay, 2);
  d = saveDayAwareLog(d, {
    ...d.logs.at(-1),
    completed: false,
    voided: true,
  });
  assert.equal(state(d).nextDay, 1);
  assert.equal(state(d).lastOpenedDay, 50);
  assert.ok(!d.logs.some((l) => l.id === "one"));
  assert.equal(state(d).lastReviewId, undefined);
  assert.deepEqual(d.logs, createInitialData().logs);
});
test("browser repository restores saved per-round next and viewed positions and rejects malformed navigation", () => {
  let d = review(createInitialData(), 1, "persist");
  d = openDay(d, "vocabulary", 1, 203);
  d = selectDayRound(d, "vocabulary", 2);
  d = openDay(d, "vocabulary", 2, 17);
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
  assert.equal(
    getDayBook(browserRepository.load(), material(d)).activeRound,
    2,
  );
  assert.equal(state(browserRepository.load()).nextDay, 1);
  assert.equal(state(browserRepository.load()).lastOpenedDay, 17);
  assert.equal(state(browserRepository.load(), "vocabulary", 1).nextDay, 2);
  assert.equal(
    state(browserRepository.load(), "vocabulary", 1).lastOpenedDay,
    203,
  );
  const bad = structuredClone(d);
  bad.dayBooks[0].rounds[0].lastOpenedDay = 999;
  assert.equal(validData(bad), false);
  assert.equal(validData(createInitialData()), true);
});

test("legacy cancelled word reviews are deleted on load; active, partial, system and EBS history survive", () => {
  let d = review(review(createInitialData(), 1, "active"), 2, "cancelled");
  d = review(d, 1, "phrase-cancelled", 1, "phrases");
  d = openDay(d, "vocabulary", 1, 200);
  d.logs = d.logs.map((l) =>
    ["cancelled", "phrase-cancelled"].includes(l.id)
      ? { ...l, completed: false, voided: true }
      : l,
  );
  const template = d.logs.find((l) => l.id === "cancelled");
  const retained = [
    { ...template, id: "partial", completed: false, voided: false },
    { ...template, id: "system", activity: "system" },
    { ...d.logs[0], id: "ebs-cancelled", completed: false, voided: true },
  ];
  d.logs.push(...retained);
  const original = structuredClone(d);
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  browserRepository.save(d);
  const loaded = browserRepository.load();
  assert.deepEqual(
    loaded.logs,
    original.logs.filter(
      (l) => !["cancelled", "phrase-cancelled"].includes(l.id),
    ),
  );
  assert.equal(state(loaded).nextDay, 2);
  assert.equal(state(loaded).lastOpenedDay, 200);
  assert.equal(state(loaded).lastReviewId, undefined);
  assert.equal(state(loaded, "phrases").nextDay, 1);
  assert.equal(state(loaded, "phrases").lastReviewId, undefined);
  assert.equal(cancelDayReview(loaded, "ebs-cancelled"), loaded);
  browserRepository.save(loaded);
  assert.deepEqual(browserRepository.load(), loaded);
  assert.deepEqual(d, original);
});
test("deleting a measured review removes its time while preserving other rounds and materials", () => {
  let d = review(review(createInitialData(), 1, "first"), 1, "second-round", 2);
  d = review(d, 1, "phrase", 1, "phrases");
  d = saveDayAwareLog(d, {
    ...d.logs.find((l) => l.id === "first"),
    minutes: 25,
  });
  d = saveDayAwareLog(d, {
    ...d.logs.find((l) => l.id === "phrase"),
    minutes: 10,
  });
  const otherRound = structuredClone(state(d, "vocabulary", 2));
  const otherBook = structuredClone(getDayBook(d, material(d, "phrases")));
  assert.equal(learningTime(d.logs, "date", "2026-10-18").studyMinutes, 35);
  const off = cancelDayReview(d, "first");
  assert.equal(learningTime(off.logs, "date", "2026-10-18").studyMinutes, 10);
  assert.deepEqual(state(off, "vocabulary", 2), otherRound);
  assert.deepEqual(getDayBook(off, material(off, "phrases")), otherBook);
  assert.ok(!off.logs.some((l) => l.id === "first"));
});

test("adding, editing and deleting records never changes either round's selected Day", () => {
  let d = ensureDayBook(createInitialData(), "vocabulary");
  d = openDay(d, "vocabulary", 1, 50);
  d = review(d, 1, "one");
  assert.equal(state(d).lastOpenedDay, 50);
  assert.equal(state(d).nextDay, 2);
  d = review(d, 2, "two");
  assert.equal(state(d).lastOpenedDay, 50);
  assert.equal(state(d).nextDay, 3);
  d = selectDayRound(d, "vocabulary", 2);
  d = openDay(d, "vocabulary", 2, 20);
  d = saveDayAwareLog(d, {
    ...d.logs.find((l) => l.id === "two"),
    round: 2,
    item: "1",
  });
  assert.equal(state(d).lastOpenedDay, 20);
  assert.equal(state(d).nextDay, 2);
  assert.equal(state(d, "vocabulary", 1).lastOpenedDay, 50);
  assert.equal(state(d, "vocabulary", 1).nextDay, 2);
  d = cancelDayReview(d, "one");
  assert.equal(state(d).lastOpenedDay, 20);
  assert.equal(state(d, "vocabulary", 1).lastOpenedDay, 50);
  assert.equal(state(d, "vocabulary", 1).nextDay, 1);
});

test("new Day and first learning save atomically for both word books, with time but no invented review progress", () => {
  for (const [id, target] of [
    ["vocabulary", 304],
    ["phrases", 36],
  ]) {
    const d = createInitialData(),
      original = structuredClone(d);
    const result = addDayLearning(
      d,
      id,
      target,
      `new-${id}`,
      "2026-10-18",
      27.5,
      "  새 단어와 예문 학습  ",
    );
    assert.equal(material(result, id).total, target);
    assert.equal(result.logs.length, d.logs.length + 1);
    assert.deepEqual(result.logs.slice(0, -1), d.logs);
    assert.equal(result.logs.at(-1).activity, "study");
    assert.equal(result.logs.at(-1).initialLearning, true);
    assert.equal(result.logs.at(-1).date, "2026-10-18");
    assert.equal(result.logs.at(-1).note, "새 단어와 예문 학습");
    assert.equal(
      learningTime(result.logs, "date", "2026-10-18").studyMinutes,
      27.5,
    );
    assert.equal(
      learningTime(result.logs, "date", "2026-10-18").systemMinutes,
      0,
    );
    assert.equal(progress(material(result, id), result.logs).count, 0);
    assert.equal(progress(material(result, id), result.logs).percent, null);
    assert.equal(state(result, id).nextDay, 1);
    assert.equal(state(result, id).lastOpenedDay, target);
    assert.equal(dayCompleted(result.logs, id, 1, target), false);
    assert.deepEqual(d, original);
    assert.ok(validData(result));
  }
});
test("invalid or duplicate submissions never add a Day or overwrite records; unknown duration stays unknown", () => {
  const d = createInitialData();
  const result = addDayLearning(d, "vocabulary", 304, "new", "2026-10-18");
  assert.equal(result.logs.at(-1).minutes, null);
  assert.equal(
    learningTime(result.logs, "date", "2026-10-18").hasStudyTime,
    false,
  );
  assert.equal(
    addDayLearning(result, "vocabulary", 304, "double-click", "2026-10-18"),
    result,
  );
  for (const [date, minutes] of [
    ["bad", null],
    ["2026-02-30", 10],
    ["2026-10-18", -1],
    ["2026-10-18", Infinity],
  ]) {
    assert.equal(addDayLearning(d, "vocabulary", 304, "bad", date, minutes), d);
  }
  assert.equal(
    addDayLearning(result, "vocabulary", 305, "new", "2026-10-18"),
    result,
  );
  assert.equal(addDayLearning(d, "basic", 114, "bad", "2026-10-18"), d);
  assert.equal(
    addDayLearning(d, "vocabulary", 305, "skipped", "2026-10-18"),
    d,
  );
});
test("first learning and reviews count independently; cancelling first learning retains the Day and its reviews", () => {
  let d = addDayLearning(
    createInitialData(),
    "vocabulary",
    304,
    "initial",
    "2026-10-18",
    30,
  );
  d = recordDayReview(d, "vocabulary", 1, 304, "review", "2026-10-19");
  assert.equal(progress(material(d), d.logs).count, 1);
  assert.equal(state(d).lastOpenedDay, 304);
  d = openDay(d, "vocabulary", 1, 50);
  d = saveDayAwareLog(d, {
    ...d.logs.find((l) => l.id === "initial"),
    minutes: 25,
    date: "2026-10-17",
  });
  assert.equal(state(d).lastOpenedDay, 50);
  assert.equal(state(d).nextDay, 1);
  const off = cancelDayReview(d, "initial");
  assert.equal(material(off).total, 304);
  assert.ok(off.logs.some((l) => l.id === "review"));
  assert.ok(!off.logs.some((l) => l.id === "initial"));
  assert.equal(progress(material(off), off.logs).count, 1);
  assert.equal(learningTime(off.logs, "date", "2026-10-17").studyMinutes, 0);
  const again = recordInitialDayLearning(
    off,
    "vocabulary",
    304,
    "initial-again",
    "2026-10-20",
  );
  assert.equal(material(again).total, 304);
  assert.equal(state(again).lastOpenedDay, 50);
  assert.equal(progress(material(again), again.logs).count, 1);
});
test("completed round scope freezes while unfinished and new rounds include appended Days", () => {
  let d = createInitialData();
  d.materials = d.materials.map((m) =>
    m.id === "vocabulary" ? { ...m, total: 2 } : m,
  );
  d = review(review(d, 1, "one"), 2, "two");
  d = selectDayRound(d, "vocabulary", 2);
  d = review(d, 1, "second-one", 2);
  d = addDayLearning(d, "vocabulary", 3, "new-three", "2026-10-18", 15);
  let book = getDayBook(d, material(d));
  assert.equal(dayRoundTotal(book, 1), 2);
  assert.equal(state(d, "vocabulary", 1).nextDay, null);
  assert.equal(dayRoundTotal(book, 2), 3);
  assert.equal(state(d, "vocabulary", 2).nextDay, 2);
  assert.equal(completedRounds(material(d), d.logs, book.rounds), 1);
  d = addDayLearning(d, "vocabulary", 4, "new-four", "2026-10-18");
  book = getDayBook(d, material(d));
  assert.equal(dayRoundTotal(book, 1), 2);
  assert.equal(dayRoundTotal(book, 2), 4);
  assert.equal(
    recordDayReview(d, "vocabulary", 1, 3, "out-of-scope", "2026-10-18"),
    d,
  );
  d = startDayRound(d, "vocabulary");
  assert.equal(dayRoundTotal(getDayBook(d, material(d)), 3), 4);
  assert.ok(validData(d));
  const restored = cancelDayReview(d, "one");
  assert.equal(state(restored, "vocabulary", 1).nextDay, 1);
  assert.equal(dayRoundTotal(getDayBook(restored, material(restored)), 1), 2);
});
test("new learning and frozen scopes survive browser storage and optional metadata is validated", () => {
  let d = createInitialData();
  d.materials = d.materials.map((m) =>
    m.id === "phrases" ? { ...m, total: 1 } : m,
  );
  d = review(d, 1, "completed-phrase", 1, "phrases");
  d = addDayLearning(d, "phrases", 2, "new-phrase", "2026-10-18", 12);
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
  assert.equal(
    completedRounds(
      material(d, "phrases"),
      d.logs,
      getDayBook(d, material(d, "phrases")).rounds,
    ),
    1,
  );
  const badLog = structuredClone(d);
  badLog.logs.at(-1).initialLearning = "yes";
  assert.equal(validData(badLog), false);
  const badScope = structuredClone(d);
  badScope.dayBooks[0].rounds[0].totalDays = 0;
  assert.equal(validData(badScope), false);
});
