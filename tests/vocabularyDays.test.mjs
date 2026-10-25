import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import {
  registeredVocabularyLastDay,
  normalizeVocabularyDayRanges,
  extendVocabularyDays,
  selectVocabularyDayMaterial,
} from "../src/vocabularyDays.ts";
import {
  getDayBook,
  dayRoundTotal,
  startDayRound,
  recordDayReview,
  saveDayAwareLog,
  cancelDayReview,
} from "../src/dayLearning.ts";
import {
  includeVocabularies,
  addVocabularyEntries,
  setVocabularyReview,
  appendVocabularyDays,
} from "../src/vocabulary.ts";
import { validData, browserRepository } from "../src/storage.ts";
import { studySummary } from "../src/dashboard.ts";
const book = (d, area = "spanish") =>
  d.vocabularies.find((b) => b.area === area);
const material = (d, area = "spanish") =>
  d.materials.find((m) => m.id === book(d, area).materialId);

test("Day-only growth starts at Spanish 451 without word input, study logs or preparation work", () => {
  const d = createInitialData(),
    before = structuredClone(d),
    b = book(d);
  const next = extendVocabularyDays(d, b.id, 451, 450);
  assert.equal(registeredVocabularyLastDay(next, book(next)), 451);
  assert.equal(material(next).total, 451);
  assert.deepEqual(next.vocabularies, before.vocabularies);
  assert.deepEqual(next.logs, before.logs);
  assert.deepEqual(next.tasks, before.tasks);
  assert.deepEqual(next.goals, before.goals);
  assert.deepEqual(d, before);
  assert.equal(extendVocabularyDays(next, b.id, 452, 450), next); // Stale submit must not add another Day.
  assert.ok(validData(next));
});

test("Spanish reference-only legacy storage gains a 450-Day tracker without converting word counts or deleting source data", () => {
  const d = createInitialData(),
    b = book(d),
    old = material(d);
  d.materials = d.materials.filter((m) => m.id !== old.id);
  const source = {
    ...old,
    id: "spanish-word-inventory",
    kind: "reference",
    total: 4500,
  };
  delete source.vocabularyId;
  d.materials.push(source);
  const before = structuredClone(d);
  const next = includeVocabularies(d);
  assert.equal(registeredVocabularyLastDay(next, book(next)), 450);
  assert.equal(material(next).kind, "days");
  assert.equal(next.materials.length, before.materials.length + 1);
  assert.deepEqual(
    next.materials.find((m) => m.id === source.id),
    source,
  );
  assert.deepEqual(next.logs, before.logs);
  assert.deepEqual(next.tasks, before.tasks);
  assert.equal(includeVocabularies(next), next);
  assert.ok(validData(next));
});

test("Chinese next Day follows selected stored Day scope and actual history rather than a fixed 311 or planned 500", () => {
  let d = createInitialData();
  const b = book(d, "chinese"),
    m = material(d, "chinese");
  m.total = 350;
  d.logs.push({
    ...d.logs[0],
    id: "real-cn-day",
    area: "chinese",
    materialId: m.id,
    item: "359",
    round: 3,
    date: "2026-10-24",
    minutes: 12,
  });
  d.dayBooks = [
    {
      materialId: m.id,
      totalDays: 360,
      activeRound: 3,
      rounds: [{ round: 3, nextDay: 1, lastOpenedDay: 359 }],
    },
  ];
  d.materials.push({
    ...m,
    id: "unselected-day-book",
    vocabularyId: undefined,
    total: 700,
  });
  b.materialIds.push("unselected-day-book");
  assert.equal(registeredVocabularyLastDay(d, b), 360);
  const normalized = normalizeVocabularyDayRanges(d);
  assert.equal(material(normalized, "chinese").total, 360);
  assert.deepEqual(normalized.dayBooks, d.dayBooks);
  assert.deepEqual(normalized.logs, d.logs);
  assert.equal(normalizeVocabularyDayRanges(normalized), normalized);
  const legacy = structuredClone(d);
  delete book(legacy, "chinese").dayPlan;
  const migrated = includeVocabularies(legacy);
  assert.equal(
    registeredVocabularyLastDay(migrated, book(migrated, "chinese")),
    360,
  );
  assert.equal(
    migrated.dayBooks
      .find((b) => b.materialId === m.id)
      .rounds.find((r) => r.round === 3).lastOpenedDay,
    359,
  );
  assert.deepEqual(migrated.logs, d.logs);
  const before = structuredClone(d);
  d = extendVocabularyDays(d, b.id, 361, 360);
  assert.equal(material(d, "chinese").total, 361);
  assert.equal(d.dayBooks[0].activeRound, 3);
  assert.equal(
    d.dayBooks[0].rounds.find((r) => r.round === 3).lastOpenedDay,
    359,
  );
  assert.deepEqual(d.logs, before.logs);
  assert.deepEqual(d.tasks, before.tasks);
  assert.deepEqual(d.vocabularies, before.vocabularies);
  assert.ok(validData(d));
});

test("bulk Day growth freezes completed round scopes and preserves unfinished rounds and browsing", () => {
  let d = createInitialData();
  const b = book(d),
    m = material(d);
  for (let n = 1; n <= 450; n++)
    d.logs.push({
      ...d.logs[0],
      id: `old-${n}`,
      area: "spanish",
      materialId: m.id,
      item: String(n),
      round: 1,
      date: "2026-10-24",
      minutes: null,
    });
  d.logs.push({
    ...d.logs[0],
    id: "round-three",
    area: "spanish",
    materialId: m.id,
    item: "88",
    round: 3,
    date: "2026-10-25",
    minutes: 4,
  });
  d.dayBooks = [
    {
      materialId: m.id,
      totalDays: 450,
      activeRound: 3,
      rounds: [
        { round: 1, nextDay: null, lastOpenedDay: 450 },
        {
          round: 3,
          nextDay: 1,
          lastOpenedDay: 88,
          lastReviewId: "round-three",
        },
      ],
    },
  ];
  const before = structuredClone(d);
  d = extendVocabularyDays(d, b.id, 500);
  let state = getDayBook(d, material(d));
  assert.equal(dayRoundTotal(state, 1), 450);
  assert.equal(state.rounds[0].nextDay, null);
  assert.equal(state.activeRound, 3);
  assert.deepEqual(state.rounds[1], before.dayBooks[0].rounds[1]);
  assert.deepEqual(d.logs, before.logs);
  assert.equal(
    recordDayReview(d, m.id, 1, 451, "outside-old-round", "2026-10-25", 5),
    d,
  );
  d = startDayRound(d, m.id);
  state = getDayBook(d, material(d));
  assert.equal(state.activeRound, 4);
  assert.equal(dayRoundTotal(state, 4), 500);
  assert.ok(validData(d));
});

test("existing word/sheet archives survive Day-only management without becoming prerequisites", () => {
  let d = createInitialData(),
    b = book(d);
  d = addVocabularyEntries(
    d,
    b.id,
    Array.from({ length: 10 }, (_, i) => ({
      term: `archive-${i}`,
      meaning: "보존",
      note: "",
    })),
    b.sheets[0].id,
    false,
    Array.from({ length: 10 }, (_, i) => `archive-${i}`),
  );
  d = setVocabularyReview(
    d,
    b.id,
    book(d).entries.map((e) => e.id),
    "ready",
  );
  d = appendVocabularyDays(d, b.id);
  const archived = structuredClone(d.vocabularies);
  d = extendVocabularyDays(d, b.id, 480);
  assert.equal(material(d).total, 480);
  assert.deepEqual(d.vocabularies, archived);
  assert.equal(
    book(d).entries.filter((e) => e.status === "imported").length,
    10,
  );
  assert.ok(validData(d));
});

test("invalid ranges, reductions, unknown books and stale targets never modify history", () => {
  const d = createInitialData(),
    id = book(d).id;
  for (const last of [-1, 0, 449, 450, 450.5, 10001, NaN, Infinity])
    assert.equal(extendVocabularyDays(d, id, last), d);
  assert.equal(extendVocabularyDays(d, "missing", 451), d);
  assert.equal(extendVocabularyDays(d, id, 451, 449), d);
});

test("Day reviews record actual date/time; edit and cancellation recalculate HOME independently of preparation", () => {
  let d = createInitialData();
  const id = material(d).id,
    beforeTasks = structuredClone(d.tasks);
  d = recordDayReview(d, id, 1, 450, "timed-review", "2026-10-24", 12.5);
  assert.equal(d.logs.at(-1).date, "2026-10-24");
  assert.equal(d.logs.at(-1).minutes, 12.5);
  assert.equal(studySummary(d.logs, "2026-10-25").today, 0);
  d = saveDayAwareLog(d, { ...d.logs.at(-1), date: "2026-10-25", minutes: 8 });
  assert.equal(studySummary(d.logs, "2026-10-25").today, 8);
  d = recordDayReview(d, id, 1, 450, "zero-review", "2026-10-25", 0);
  assert.equal(d.logs.at(-1).minutes, 0);
  d = recordDayReview(d, id, 1, 450, "unmeasured-review", "2026-10-25");
  assert.equal(d.logs.at(-1).minutes, null);
  for (const minutes of [-1, NaN, Infinity])
    assert.equal(
      recordDayReview(d, id, 1, 450, "invalid", "2026-10-25", minutes),
      d,
    );
  d = cancelDayReview(d, "timed-review");
  assert.ok(!d.logs.some((l) => l.id === "timed-review"));
  assert.equal(studySummary(d.logs, "2026-10-25").today, 0);
  assert.deepEqual(d.tasks, beforeTasks);
});

test("numeric ranges and all learning/round data persist through the existing browser repository", () => {
  let d = createInitialData();
  d = extendVocabularyDays(d, book(d).id, 480);
  d = extendVocabularyDays(d, book(d, "chinese").id, 335);
  d = recordDayReview(
    d,
    material(d).id,
    1,
    451,
    "persist-review",
    "2026-10-25",
    6,
  );
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
  });
  browserRepository.save(d);
  const restored = browserRepository.load();
  assert.deepEqual(restored, d);
  assert.equal(registeredVocabularyLastDay(restored, book(restored)), 480);
  assert.equal(
    registeredVocabularyLastDay(restored, book(restored, "chinese")),
    335,
  );
});

test("unlinked legacy Day books select an existing material without managing or deleting sheets", () => {
  const d = createInitialData(),
    b = book(d, "chinese"),
    m = material(d, "chinese");
  b.materialId = "";
  m.total = 390;
  d.materials.push({
    ...m,
    id: "another-cn",
    total: 700,
    vocabularyId: undefined,
  });
  b.materialIds.push("another-cn");
  const before = structuredClone(d);
  assert.equal(selectVocabularyDayMaterial(d, b.id, material(d).id), d); // Wrong language.
  const next = selectVocabularyDayMaterial(d, b.id, m.id);
  assert.equal(registeredVocabularyLastDay(next, book(next, "chinese")), 390);
  assert.deepEqual(
    book(next, "chinese").sheets,
    before.vocabularies.find((b) => b.area === "chinese").sheets,
  );
  assert.deepEqual(next.logs, before.logs);
  assert.deepEqual(next.tasks, before.tasks);
  assert.equal(next.materials.length, before.materials.length);
  assert.ok(validData(next));
  const completed = createInitialData(),
    smallBook = book(completed, "chinese"),
    smallMaterial = material(completed, "chinese");
  smallBook.materialId = "";
  smallMaterial.total = 200;
  for (let n = 1; n <= 200; n++)
    completed.logs.push({
      ...completed.logs[0],
      id: `small-${n}`,
      area: "chinese",
      materialId: smallMaterial.id,
      item: String(n),
      round: 1,
      date: "2026-10-24",
      minutes: null,
    });
  const linked = selectVocabularyDayMaterial(
    completed,
    smallBook.id,
    smallMaterial.id,
  );
  assert.equal(
    registeredVocabularyLastDay(linked, book(linked, "chinese")),
    310,
  );
  assert.equal(
    dayRoundTotal(getDayBook(linked, material(linked, "chinese")), 1),
    200,
  );
  assert.equal(
    getDayBook(linked, material(linked, "chinese")).rounds[0].nextDay,
    null,
  );
  assert.deepEqual(linked.logs, completed.logs);
});
