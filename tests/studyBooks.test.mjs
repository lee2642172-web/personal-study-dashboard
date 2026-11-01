import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { defaultStudyMinutes } from "../src/studyBooks.ts";
import {
  getDayBook,
  ensureDayBook,
  recordDayReview,
  cancelDayReview,
  openDay,
  selectDayRound,
  startDayRound,
  addDayLearning,
} from "../src/dayLearning.ts";
import { homeEnglishMaterialProgress } from "../src/englishProgress.ts";
import { studySummary, dashboardTimeEntries } from "../src/dashboard.ts";
import { restoreData, validData } from "../src/storage.ts";
import { DashboardStore } from "../src/sync.ts";
const material = (d, id = "basic") => d.materials.find((m) => m.id === id);
const state = (d) => getDayBook(d, material(d));
const snapshot = (d) =>
  homeEnglishMaterialProgress(d).find((s) => s.material.id === "basic");
const total = (d) => studySummary(dashboardTimeEntries(d), "2026-11-01").today;

test("EEA defaults to 30 minutes and Basic to 20 only at input time; existing reported records remain unmeasured", () => {
  const d = createInitialData(),
    before = structuredClone(d);
  assert.equal(defaultStudyMinutes(material(d)), 20);
  assert.equal(defaultStudyMinutes(material(d, "eea-reading")), 30);
  assert.equal(defaultStudyMinutes(material(d, "vocabulary")), null);
  assert.ok(
    d.logs
      .filter((l) => l.materialId === "basic")
      .every((l) => l.minutes === null && l.date === null),
  );
  assert.equal(total(d), 0);
  assert.deepEqual(d, before);
});

test("Basic starts at first unfinished Unit 7, keeps its original six completions and cannot append vocabulary Days", () => {
  const before = createInitialData(),
    d = ensureDayBook(before, "basic");
  assert.deepEqual(d.logs, before.logs);
  assert.equal(state(d).rounds[0].nextDay, 7);
  assert.equal(state(d).rounds[0].lastOpenedDay, 7);
  assert.equal(snapshot(d).done, 6);
  assert.equal(material(d).kind, "units");
  assert.equal(material(d).total, 113);
  assert.equal(addDayLearning(d, "basic", 114, "wrong", "2026-11-01"), d);
  assert.ok(validData(d));
  assert.deepEqual(restoreData(JSON.parse(JSON.stringify(d))), d);
});

test("Unit learning records actual minutes without moving the selected Unit; cancellation removes time and preserves all old history", () => {
  const original = createInitialData();
  let d = recordDayReview(original, "basic", 1, 7, "unit-7", "2026-11-01", 20);
  assert.equal(total(d), 20);
  assert.equal(state(d).rounds[0].nextDay, 8);
  assert.equal(state(d).rounds[0].lastOpenedDay, 7);
  assert.equal(d.logs.at(-1).activity, "study");
  assert.equal(snapshot(d).done, 7);
  d = openDay(d, "basic", 1, 50);
  d = cancelDayReview(d, "unit-7");
  assert.equal(total(d), 0);
  assert.equal(state(d).rounds[0].nextDay, 7);
  assert.equal(state(d).rounds[0].lastOpenedDay, 50);
  assert.deepEqual(d.logs, original.logs);
  assert.equal(snapshot(d).done, 6);
});

test("Basic rounds and browsing positions remain independent with no limit and repeat logs count time but not duplicate Unit progress", () => {
  let d = recordDayReview(
    createInitialData(),
    "basic",
    1,
    7,
    "first",
    "2026-11-01",
    20,
  );
  d = recordDayReview(d, "basic", 1, 7, "repeat", "2026-11-01", 5);
  assert.equal(total(d), 25);
  assert.equal(snapshot(d).done, 7);
  d = selectDayRound(d, "basic", 15);
  d = openDay(d, "basic", 15, 19);
  d = recordDayReview(d, "basic", 15, 19, "later", "2026-11-01", 0);
  assert.equal(snapshot(d).round, 15);
  assert.equal(snapshot(d).position, 19);
  assert.equal(snapshot(d).done, 1);
  assert.equal(d.logs.at(-1).activity, "review");
  d = startDayRound(d, "basic");
  assert.equal(state(d).activeRound, 16);
  d = selectDayRound(d, "basic", 1);
  assert.equal(state(d).rounds.find((r) => r.round === 1).lastOpenedDay, 7);
  assert.deepEqual(restoreData(JSON.parse(JSON.stringify(d))), d);
});

test("two devices merge Unit records and undo without changing Unit count, old history or other book data", async () => {
  const make = () => {
    const map = new Map();
    return new DashboardStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    });
  };
  let row = null;
  const db = {
    read: async () => structuredClone(row),
    async write(data, revision) {
      if ((row?.revision ?? 0) !== revision)
        throw new Error("DASHBOARD_CONFLICT");
      row = {
        data: structuredClone(data),
        revision: revision + 1,
        updatedAt: "2026-11-01T03:00:00Z",
      };
      return structuredClone(row);
    },
  };
  const a = make(),
    b = make();
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update((d) => recordDayReview(d, "basic", 1, 7, "a", "2026-11-01", 20));
  b.update((d) => recordDayReview(d, "basic", 1, 8, "b", "2026-11-01", 20));
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  assert.equal(total(a.getSnapshot().data), 40);
  assert.equal(snapshot(a.getSnapshot().data).done, 8);
  assert.equal(material(a.getSnapshot().data).total, 113);
  a.update((d) => cancelDayReview(d, "a"));
  await a.sync();
  await b.sync();
  assert.equal(total(b.getSnapshot().data), 20);
  assert.equal(snapshot(b.getSnapshot().data).done, 7);
  assert.deepEqual(
    b.getSnapshot().data.logs.filter((l) => l.origin === "reported"),
    createInitialData().logs,
  );
  a.update((d) => ({
    ...d,
    materials: d.materials.map((m) =>
      m.id === "basic" ? { ...m, total: null } : m,
    ),
  }));
  await a.sync();
  await b.sync();
  assert.ok(validData(b.getSnapshot().data));
  assert.equal(material(b.getSnapshot().data).total, null);
});
