import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { englishMaterialProgress } from "../src/englishProgress.ts";
import {
  recordDayReview,
  cancelDayReview,
  openDay,
  startDayRound,
  ensureDayBook,
} from "../src/dayLearning.ts";
const item = (d, id) =>
  englishMaterialProgress(d).find((s) => s.material.id === id);

test("one English snapshot includes Grammar and vocabularies, excludes EBS/non-English, and does not invent reference progress or change stored data", () => {
  const d = createInitialData(),
    before = structuredClone(d),
    rows = englishMaterialProgress(d);
  assert.ok(
    rows.every(
      (s) => s.material.area === "english" && !s.material.id.startsWith("ebs-"),
    ),
  );
  assert.deepEqual(
    [item(d, "basic").done, item(d, "basic").total, item(d, "basic").round],
    [6, 113, 1],
  );
  assert.deepEqual(
    [item(d, "intermediate").done, item(d, "intermediate").total],
    [0, 142],
  );
  assert.deepEqual(
    [
      item(d, "vocabulary").done,
      item(d, "vocabulary").total,
      item(d, "vocabulary").position,
    ],
    [0, 303, 1],
  );
  assert.deepEqual(
    [item(d, "phrases").done, item(d, "phrases").total],
    [0, 35],
  );
  for (const id of ["patterns", "dialogues", "academy", "reverse-grammar"])
    assert.equal(item(d, id).percent, null);
  assert.equal(item(d, "patterns").material.total, 200);
  assert.equal(item(d, "patterns").total, null);
  assert.deepEqual(d, before);
});

test("Grammar uses its own actual round without a round cap; repeated, cancelled, system and malformed units do not inflate progress", () => {
  const d = createInitialData(),
    base = d.logs.find((l) => l.materialId === "basic");
  for (const [id, item, round, patch] of [
    ["real", "3", 11, {}],
    ["repeat", "03", 11, {}],
    ["partial", "4", 11, { completed: false }],
    ["cancelled", "5", 12, { voided: true }],
    ["preparation", "6", 13, { activity: "system" }],
    ["initial", "7", 14, { initialLearning: true }],
    ["outside", "114", 99, {}],
    ["fraction", "6.5", 99, {}],
  ])
    d.logs.push({ ...base, id, item, round, date: "2026-10-26", ...patch });
  const snapshot = item(d, "basic");
  assert.equal(snapshot.round, 11);
  assert.equal(snapshot.done, 1);
  assert.equal(snapshot.total, 113);
  assert.equal(snapshot.latest.item, "03");
  assert.equal(snapshot.percent, (1 / 113) * 100);
  assert.equal(item(d, "intermediate").round, 1);
});

test("Day books use their independent active round and saved position; frozen completed rounds remain complete when Days are added", () => {
  let d = createInitialData();
  const base = d.logs[0],
    m = d.materials.find((m) => m.id === "vocabulary");
  m.total = 313;
  for (let day = 1; day <= 303; day++)
    d.logs.push({
      ...base,
      id: `old-${day}`,
      materialId: m.id,
      item: String(day),
      round: 1,
      date: "2026-10-24",
    });
  d.logs.push({
    ...base,
    id: "third-seven",
    materialId: m.id,
    item: "7",
    round: 3,
    date: "2026-10-25",
  });
  d.logs.push({
    ...base,
    id: "third-nine",
    materialId: m.id,
    item: "9",
    round: 3,
    date: "2026-10-25",
  });
  d.logs.push({
    ...base,
    id: "new-build",
    materialId: m.id,
    item: "313",
    round: 3,
    date: "2026-10-26",
    initialLearning: true,
  });
  d.dayBooks = [
    {
      materialId: m.id,
      totalDays: 313,
      activeRound: 3,
      rounds: [
        { round: 1, totalDays: 303, nextDay: null, lastOpenedDay: 303 },
        { round: 3, nextDay: 1, lastOpenedDay: 88 },
      ],
    },
  ];
  const before = structuredClone(d),
    snapshot = item(d, m.id);
  assert.equal(snapshot.round, 3);
  assert.equal(snapshot.done, 2);
  assert.equal(snapshot.total, 313);
  assert.equal(snapshot.position, 88);
  assert.equal(snapshot.initialCount, 1);
  assert.deepEqual(d, before);
  d.dayBooks[0].activeRound = 1;
  const frozen = item(d, m.id);
  assert.equal(frozen.done, 303);
  assert.equal(frozen.total, 303);
  assert.equal(frozen.percent, 100);
  assert.equal(frozen.material.total, 313);
});

test("review, cancellation, current-round selection and changed material totals immediately update the English panel data", () => {
  let d = createInitialData();
  d = recordDayReview(d, "phrases", 1, 7, "real-review", "2026-10-26", 5);
  d = openDay(d, "phrases", 1, 12);
  assert.equal(item(d, "phrases").done, 1);
  assert.equal(item(d, "phrases").position, 12);
  d = cancelDayReview(d, "real-review");
  assert.equal(item(d, "phrases").done, 0);
  assert.equal(item(d, "phrases").position, 12);
  d = startDayRound(d, "phrases");
  assert.equal(item(d, "phrases").round, 2);
  assert.equal(item(d, "phrases").done, 0);
  d.materials = d.materials.map((m) =>
    m.id === "phrases" ? { ...m, total: 40 } : m,
  );
  d = ensureDayBook(d, "phrases");
  assert.equal(item(d, "phrases").total, 40);
  d.materials = d.materials.map((m) =>
    m.id === "basic" ? { ...m, total: null } : m,
  );
  assert.equal(item(d, "basic").percent, null);
  assert.equal(item(d, "basic").done, 6);
});
