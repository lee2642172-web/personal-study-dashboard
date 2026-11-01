import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  createEeaMaterials,
  includeEea,
  isEeaMaterial,
  EEA_READING_ID,
} from "../src/catalogs/eea.ts";
import { restoreData, validData } from "../src/storage.ts";
import {
  homeEnglishMaterialProgress,
  englishMaterialProgress,
} from "../src/englishProgress.ts";
import {
  recordDayReview,
  cancelDayReview,
  selectDayRound,
  openDay,
  getDayBook,
  startDayRound,
} from "../src/dayLearning.ts";
import { dashboardTimeEntries, studySummary } from "../src/dashboard.ts";
import { DashboardStore } from "../src/sync.ts";

test("EEA registers three books, only the reading volume has 50 Days, and no completion/time/round goal is invented", () => {
  const d = createInitialData(),
    books = d.materials.filter(isEeaMaterial);
  assert.equal(books.length, 3);
  assert.deepEqual(
    books.map((m) => [m.total, m.status, m.targetPasses]),
    [
      [50, "학습 중", null],
      [null, "보관 중", null],
      [null, "보관 중", null],
    ],
  );
  assert.ok(books.every((m) => m.duration === null && m.startDate === ""));
  assert.equal(
    d.logs.filter((l) => books.some((m) => m.id === l.materialId)).length,
    0,
  );
  assert.ok(validData(d));
});

test("restoring legacy data adds EEA once and preserves all old material settings, logs, task history and existing EEA changes", () => {
  const old = createInitialData();
  old.materials = old.materials.filter((m) => !isEeaMaterial(m));
  old.materials.find((m) => m.id === "basic").total = 120;
  const before = structuredClone(old),
    restored = restoreData(old);
  assert.equal(restored.materials.length, old.materials.length + 3);
  for (const m of before.materials)
    assert.deepEqual(
      restored.materials.find((x) => x.id === m.id),
      m,
    );
  assert.deepEqual(restored.logs, before.logs);
  assert.deepEqual(restored.tasks, before.tasks);
  assert.deepEqual(restoreData(restored), restored);
  const reading = restored.materials.find((m) => m.id === EEA_READING_ID);
  reading.total = 60;
  reading.targetPasses = 12;
  reading.status = "보류";
  assert.equal(includeEea(restored), restored);
  assert.deepEqual(
    createEeaMaterials().map((m) => m.total),
    [50, null, null],
  );
});

test("EEA Day 1–50 keeps separate unlimited rounds and positions, cancellation removes actual time and history, and reload preserves records", () => {
  let d = recordDayReview(
    createInitialData(),
    EEA_READING_ID,
    1,
    50,
    "reading-50",
    "2026-11-01",
    15,
  );
  d = openDay(d, EEA_READING_ID, 1, 17);
  const book = getDayBook(
    d,
    d.materials.find((m) => m.id === EEA_READING_ID),
  );
  assert.equal(book.rounds[0].nextDay, 1);
  assert.equal(book.rounds[0].lastOpenedDay, 17);
  assert.equal(studySummary(dashboardTimeEntries(d), "2026-11-01").today, 15);
  d = selectDayRound(d, EEA_READING_ID, 11);
  d = recordDayReview(d, EEA_READING_ID, 11, 1, "round-11", "2026-11-01", null);
  assert.equal(
    homeEnglishMaterialProgress(d).find((s) => s.material.id === EEA_READING_ID)
      .done,
    1,
  );
  d = startDayRound(d, EEA_READING_ID);
  assert.equal(
    getDayBook(
      d,
      d.materials.find((m) => m.id === EEA_READING_ID),
    ).activeRound,
    12,
  );
  d = cancelDayReview(d, "reading-50");
  assert.equal(
    d.logs.some((l) => l.id === "reading-50"),
    false,
  );
  assert.equal(studySummary(dashboardTimeEntries(d), "2026-11-01").today, 0);
  assert.deepEqual(restoreData(JSON.parse(JSON.stringify(d))), d);
});

test("HOME selects only Basic and EEA reading while all other English data remains available unchanged", () => {
  const d = createInitialData(),
    before = structuredClone(d);
  assert.deepEqual(
    homeEnglishMaterialProgress(d).map((s) => s.material.id),
    ["basic", EEA_READING_ID],
  );
  const all = englishMaterialProgress(d);
  for (const id of [
    "intermediate",
    "vocabulary",
    "phrases",
    "eea-survival",
    "eea-idioms",
  ])
    assert.ok(all.some((s) => s.material.id === id));
  const reading = homeEnglishMaterialProgress(d).find(
    (s) => s.material.id === EEA_READING_ID,
  );
  assert.deepEqual(
    [reading.total, reading.done, reading.round, reading.position],
    [50, 0, 1, 1],
  );
  assert.deepEqual(d, before);
});

test("existing online data gains each EEA volume once and two devices converge without adding learning logs", async () => {
  const original = createInitialData();
  original.materials = original.materials.filter((m) => !isEeaMaterial(m));
  let row = { data: original, revision: 1, updatedAt: "2026-11-01T03:00:00Z" };
  const db = {
    read: async () => structuredClone(row),
    async write(data, revision) {
      if (row.revision !== revision) throw new Error("DASHBOARD_CONFLICT");
      row = {
        data: structuredClone(data),
        revision: revision + 1,
        updatedAt: "2026-11-01T03:00:00Z",
      };
      return structuredClone(row);
    },
  };
  const devices = [0, 1].map(() => {
    const map = new Map();
    return new DashboardStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    });
  });
  for (const device of devices) await device.connect("project:user", db);
  await devices[0].sync();
  assert.equal(row.data.materials.filter(isEeaMaterial).length, 3);
  assert.deepEqual(row.data.logs, original.logs);
  for (const device of devices)
    assert.equal(
      device.getSnapshot().data.materials.filter(isEeaMaterial).length,
      3,
    );
});
