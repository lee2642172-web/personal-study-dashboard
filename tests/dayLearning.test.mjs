import { progress } from "../src/model.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  getDayBook,
  ensureDayBook,
  openDay,
  selectDayRound,
  startDayRound,
  recordDayReview,
  cancelDayReview,
  restoreDayReview,
  saveDayAwareLog,
  dayCompleted,
} from "../src/dayLearning.ts";
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
test("review advances automatically and cancellation returns both learning and browsing positions", () => {
  const d = createInitialData();
  const on = review(d, 1, "first");
  assert.equal(state(on).nextDay, 2);
  assert.equal(state(on).lastOpenedDay, 2);
  assert.equal(on.logs.at(-1).minutes, null);
  const off = cancelDayReview(on, "first");
  assert.equal(state(off).nextDay, 1);
  assert.equal(state(off).lastOpenedDay, 1);
  assert.equal(off.logs.length, on.logs.length);
  assert.ok(off.logs.at(-1).voided);
  const restored = restoreDayReview(off, "first");
  assert.equal(state(restored).nextDay, 2);
  assert.equal(state(restored).lastOpenedDay, 2);
  assert.equal(restored.logs.length, on.logs.length);
  assert.equal(restored.logs.at(-1).date, "2026-10-18");
});
test("out-of-order study and repeats do not skip gaps, and cancelling a repeat retains completed progress", () => {
  let d = review(createInitialData(), 10, "far");
  assert.equal(state(d).nextDay, 1);
  assert.equal(state(d).lastOpenedDay, 11);
  d = review(d, 1, "one");
  assert.equal(state(d).nextDay, 2);
  d = review(d, 1, "repeat");
  assert.equal(state(d).nextDay, 2);
  d = cancelDayReview(d, "repeat");
  assert.equal(state(d).nextDay, 2);
  assert.equal(state(d).lastOpenedDay, 1);
  assert.ok(dayCompleted(d.logs, "vocabulary", 1, 1));
});
test("cancelling earlier progress after later reviews returns to the real gap and restoration skips only completed Days", () => {
  let d = review(review(createInitialData(), 1, "one"), 2, "two");
  assert.equal(state(d).nextDay, 3);
  d = cancelDayReview(d, "one");
  assert.equal(state(d).nextDay, 1);
  assert.ok(dayCompleted(d.logs, "vocabulary", 1, 2));
  d = restoreDayReview(d, "one");
  assert.equal(state(d).nextDay, 3);
  assert.equal(state(d).lastOpenedDay, 3);
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
test("35-Day phrase book completes without Day 36, supports undo, and total changes preserve old logs", () => {
  let d = createInitialData();
  d = {
    ...d,
    materials: d.materials.map((m) =>
      m.id === "phrases" ? { ...m, total: 2 } : m,
    ),
  };
  d = review(d, 1, "p1", 1, "phrases");
  d = review(d, 2, "p2", 1, "phrases");
  assert.equal(state(d, "phrases").nextDay, null);
  assert.equal(state(d, "phrases").lastOpenedDay, 2);
  d = cancelDayReview(d, "p2");
  assert.equal(state(d, "phrases").nextDay, 2);
  d = restoreDayReview(d, "p2");
  assert.equal(state(d, "phrases").nextDay, null);
  d = {
    ...d,
    materials: d.materials.map((m) =>
      m.id === "phrases" ? { ...m, total: 3 } : m,
    ),
  };
  d = ensureDayBook(d, "phrases");
  assert.equal(state(d, "phrases").nextDay, 3);
  assert.ok(d.logs.some((l) => l.id === "p2"));
  assert.ok(validData(d));
});
test("editing dates/time preserves browsing, while existing record editor cancellation reconciles the cursor", () => {
  let d = review(createInitialData(), 1, "one");
  d = openDay(d, "vocabulary", 1, 50);
  d = saveDayAwareLog(d, { ...d.logs.at(-1), minutes: 24, date: "2026-10-17" });
  assert.equal(state(d).lastOpenedDay, 50);
  assert.equal(state(d).nextDay, 2);
  d = saveDayAwareLog(d, { ...d.logs.at(-1), completed: false, voided: true });
  assert.equal(state(d).nextDay, 1);
  assert.equal(state(d).lastOpenedDay, 1);
  assert.equal(d.logs.at(-1).minutes, 24);
});
test("browser repository restores saved per-round next and viewed positions and rejects malformed navigation", () => {
  let d = review(createInitialData(), 1, "persist");
  d = openDay(d, "vocabulary", 1, 203);
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
  assert.equal(state(browserRepository.load()).nextDay, 2);
  assert.equal(state(browserRepository.load()).lastOpenedDay, 203);
  const bad = structuredClone(d);
  bad.dayBooks[0].rounds[0].lastOpenedDay = 999;
  assert.equal(validData(bad), false);
  assert.equal(validData(createInitialData()), true);
});
