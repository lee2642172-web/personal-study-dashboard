import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { validData, browserRepository, STORAGE_KEY } from "../src/storage.ts";
import {
  includeVocabularies,
  configureVocabulary,
  vocabularyPlan,
  vocabularyEvidence,
  parseVocabularyText,
  normalizeTerm,
  duplicateCandidates,
  vocabularyDuplicateIndex,
  addVocabularyEntries,
  setVocabularyReview,
  editVocabularyEntry,
  deleteVocabularyEntry,
  appendVocabularyDays,
  connectVocabularyTask,
  validVocabulary,
} from "../src/vocabulary.ts";
import {
  isDayBook,
  dayRoundTotal,
  recordDayReview,
  addDayLearning,
} from "../src/dayLearning.ts";
import { studySummary } from "../src/dashboard.ts";
const get = (d, area = "spanish") =>
  d.vocabularies.find((b) => b.area === area);
function add(d, n, prefix, sheet, reference = false, area = "spanish") {
  const b = get(d, area);
  return addVocabularyEntries(
    d,
    b.id,
    Array.from({ length: n }, (_, i) => ({
      term: `${prefix}-${i}`,
      meaning: `뜻 ${i}`,
      note: "실제 입력을 대신한 격리된 검증 데이터",
    })),
    sheet ?? b.sheets[0].id,
    reference,
    Array.from({ length: n }, (_, i) => `${prefix}-id-${i}`),
  );
}
const ready = (d, area = "spanish") =>
  setVocabularyReview(
    d,
    get(d, area).id,
    get(d, area)
      .entries.filter((e) => e.status === "pending")
      .map((e) => e.id),
    "ready",
  );
const configure = (d, last, area = "chinese") => {
  const b = get(d, area);
  return configureVocabulary(d, b.id, {
    materialId: b.materialId,
    baselineLastDay: last,
    existingWordEstimate: b.existingWordEstimate,
    incomingWordEstimate: b.incomingWordEstimate,
    sheets: b.sheets,
  });
};
const legacy = () => {
  const d = createInitialData();
  d.materials = d.materials.filter((m) => !m.vocabularyId);
  delete d.vocabularies;
  return d;
};
const oldMaterial = (id, area, total, title) => ({
  ...createInitialData().materials.find((m) => m.id === "vocabulary"),
  id,
  area,
  total,
  title,
});

test("metadata seeds only known Spanish Days and approximate word counts; Chinese last Day and actual words remain unknown", () => {
  const d = createInitialData(),
    sp = get(d),
    cn = get(d, "chinese");
  assert.equal(sp.baselineLastDay, 450);
  assert.equal(sp.existingWordEstimate, 4500);
  assert.equal(sp.incomingWordEstimate, 5113);
  assert.equal(cn.baselineLastDay, null);
  assert.equal(cn.existingWordEstimate, 2500);
  assert.equal(cn.incomingWordEstimate, 2500);
  assert.equal(d.materials.find((m) => m.id === cn.materialId).total, null);
  assert.equal(cn.sheets.length, 6);
  assert.ok(cn.sheets.every((s) => s.startDay === null && s.endDay === null));
  assert.ok(d.vocabularies.every((b) => b.entries.length === 0));
  assert.equal(d.logs.length, 22);
  assert.equal(d.tasks.length, 1);
  assert.equal(d.dayBooks, undefined);
  assert.ok(validData(d));
  assert.equal(includeVocabularies(d), d);
});
test("migration reuses registered books, preserves real last Day and never merges/renumbers multiple HSK sheets", () => {
  const d = legacy();
  d.materials.push(
    oldMaterial("my-spanish", "spanish", 600, "나의 스페인어 단어장"),
  );
  for (let n = 1; n <= 5; n++)
    d.materials.push(
      oldMaterial(`hsk-${n}`, "chinese", n * 40, `HSK ${n}급 단어장`),
    );
  d.logs.push({
    ...d.logs[0],
    id: "prior-sp",
    area: "spanish",
    materialId: "my-spanish",
    item: "599",
    round: 3,
    date: "2026-10-24",
    minutes: 7,
  });
  d.dayBooks = [
    {
      materialId: "my-spanish",
      totalDays: 600,
      activeRound: 3,
      rounds: [{ round: 3, nextDay: 1, lastOpenedDay: 599 }],
    },
  ];
  const old = structuredClone(d),
    result = includeVocabularies(d);
  assert.equal(result.materials.length, old.materials.length);
  assert.equal(get(result).materialId, "my-spanish");
  assert.equal(get(result).baselineLastDay, 600);
  assert.equal(get(result, "chinese").materialId, "");
  assert.equal(get(result, "chinese").baselineLastDay, null);
  assert.deepEqual(result.logs, old.logs);
  assert.deepEqual(result.dayBooks, old.dayBooks);
  assert.deepEqual(result.tasks, old.tasks);
  assert.deepEqual(d, old);
  for (const m of result.materials) {
    const { vocabularyId, ...rest } = m;
    assert.deepEqual(
      rest,
      old.materials.find((x) => x.id === m.id),
    );
  }
  assert.equal(includeVocabularies(result), result);
  assert.ok(validData(result));
});
test("an existing reference material is not cloned or mistaken for a Day count", () => {
  const d = legacy();
  d.materials.push({
    ...oldMaterial("reference-cn", "chinese", 2500, "중국어 단어 원본"),
    kind: "reference",
  });
  const next = includeVocabularies(d);
  assert.equal(next.materials.filter((m) => m.area === "chinese").length, 1);
  assert.equal(get(next, "chinese").materialId, "");
  assert.equal(get(next, "chinese").baselineLastDay, null);
  assert.equal(next.materials.find((m) => m.id === "reference-cn").total, 2500);
});
test("conflicting registered Day evidence blocks guesses; verified setup rejects overlapping grade ranges", () => {
  const d = legacy();
  d.materials.push(oldMaterial("cn-old", "chinese", 250, "HSK 단어장"));
  d.logs.push({
    ...d.logs[0],
    id: "cn275",
    area: "chinese",
    materialId: "cn-old",
    item: "275",
  });
  const adopted = includeVocabularies(d);
  assert.equal(get(adopted, "chinese").baselineLastDay, null);
  assert.equal(vocabularyEvidence(adopted, get(adopted, "chinese")), 275);
  assert.equal(configure(adopted, 250), adopted);
  const confirmed = configure(adopted, 275);
  assert.equal(get(confirmed, "chinese").baselineLastDay, 275);
  assert.equal(confirmed.materials.find((m) => m.id === "cn-old").total, 275);
  const b = get(confirmed, "chinese"),
    sheets = b.sheets.map((s, i) =>
      i < 2 ? { ...s, startDay: 1, endDay: 100 } : s,
    );
  assert.equal(
    configureVocabulary(confirmed, b.id, { ...b, sheets }),
    confirmed,
  );
  assert.equal(appendVocabularyDays(confirmed, b.id), confirmed);
});
test("Excel-pasted columns preserve legitimate words and accents; duplicate review spans sheets and known references only", () => {
  assert.deepEqual(
    parseVocabularyText("단어\t뜻\t메모\r\n  señor \t신사\t확인"),
    [{ term: "señor", meaning: "신사", note: "확인" }],
  );
  assert.equal(parseVocabularyText("palabra\t단어")[0].term, "palabra");
  assert.equal(
    parseVocabularyText("palabra\tsignificado\nuno\t하나")[0].term,
    "uno",
  );
  assert.equal(normalizeTerm("  SÍ  "), "sí");
  assert.notEqual(normalizeTerm("sí"), normalizeTerm("si"));
  assert.notEqual(normalizeTerm("后"), normalizeTerm("後"));
  let d = createInitialData(),
    b = get(d);
  d = addVocabularyEntries(
    d,
    b.id,
    [{ term: "Sí", meaning: "예", note: "" }],
    b.sheets[0].id,
    true,
    ["reference"],
  );
  d = addVocabularyEntries(
    d,
    b.id,
    [
      { term: " sí ", meaning: "예", note: "" },
      { term: "si", meaning: "만약", note: "" },
    ],
    b.sheets[0].id,
    false,
    ["same", "different"],
  );
  b = get(d);
  assert.equal(
    duplicateCandidates(
      b,
      b.entries.find((e) => e.id === "same"),
    ).length,
    1,
  );
  assert.equal(
    duplicateCandidates(
      b,
      b.entries.find((e) => e.id === "different"),
    ).length,
    0,
  );
  assert.equal(vocabularyDuplicateIndex(b).size, 2);
  d = setVocabularyReview(d, b.id, ["same"], "excluded");
  assert.equal(get(d).entries.find((e) => e.id === "same").status, "excluded");
  assert.equal(
    get(d).entries.find((e) => e.id === "reference").status,
    "reference",
  );
});
test("newly entered duplicate evidence returns earlier ready words to review instead of silently importing stale approvals", () => {
  let d = ready(add(createInitialData(), 10, "ready"));
  assert.equal(vocabularyPlan(d, get(d)).days, 1);
  const b = get(d);
  d = addVocabularyEntries(
    d,
    b.id,
    [{ term: "READY-0", meaning: "기존 단어", note: "" }],
    b.sheets[0].id,
    true,
    ["new-reference"],
  );
  assert.equal(
    get(d).entries.find((e) => e.id === "ready-id-0").status,
    "pending",
  );
  assert.equal(vocabularyPlan(d, get(d)).days, 0);
  const ref = get(d).entries.find((e) => e.id === "new-reference");
  d = editVocabularyEntry(d, b.id, { ...ref, term: "ready-1" });
  assert.equal(
    get(d).entries.find((e) => e.id === "ready-id-1").status,
    "pending",
  );
});
test("only ten confirmed real words create Spanish Day 451; leftovers never invent words or future Days", () => {
  let d = add(createInitialData(), 13, "new");
  const b = get(d);
  assert.equal(appendVocabularyDays(d, b.id), d);
  d = ready(d);
  const before = structuredClone(d);
  const next = appendVocabularyDays(d, b.id),
    book = get(next);
  assert.equal(next.materials.find((m) => m.id === book.materialId).total, 451);
  assert.equal(book.entries.filter((e) => e.status === "imported").length, 10);
  assert.equal(book.entries.filter((e) => e.status === "ready").length, 3);
  assert.deepEqual(
    book.entries
      .filter((e) => e.status === "imported")
      .map((e) => [e.day, e.position]),
    Array.from({ length: 10 }, (_, i) => [451, i + 1]),
  );
  assert.deepEqual(next.logs, before.logs);
  assert.deepEqual(next.tasks, before.tasks);
  assert.deepEqual(d, before);
  assert.equal(appendVocabularyDays(next, b.id), next);
  assert.ok(validData(next));
  assert.equal(
    addDayLearning(next, b.materialId, 452, "not-prep", "2026-10-25"),
    next,
  ); // Managed books cannot add an empty Day as preparation/learning together.
});
test("Chinese grade sheets use one global counter and never mix partial grade groups in a Day", () => {
  let d = configure(createInitialData(), 250);
  d = add(d, 5, "grade5", "hsk-5", false, "chinese");
  d = add(d, 5, "grade6", "hsk-6", false, "chinese");
  d = ready(d, "chinese");
  assert.equal(vocabularyPlan(d, get(d, "chinese")).days, 0);
  d = ready(add(d, 5, "grade5b", "hsk-5", false, "chinese"), "chinese");
  d = ready(add(d, 5, "grade6b", "hsk-6", false, "chinese"), "chinese");
  d = appendVocabularyDays(d, get(d, "chinese").id);
  const book = get(d, "chinese");
  assert.equal(d.materials.find((m) => m.id === book.materialId).total, 252);
  assert.equal(book.entries.filter((e) => e.day === 251).length, 10);
  assert.ok(
    book.entries
      .filter((e) => e.day === 251)
      .every((e) => e.sheetId === "hsk-5"),
  );
  assert.ok(
    book.entries
      .filter((e) => e.day === 252)
      .every((e) => e.sheetId === "hsk-6"),
  );
  assert.ok(validData(d));
});
test("append preserves existing round counts, frozen scopes, active round and browsing position without recording learning", () => {
  let d = createInitialData();
  const b = get(d),
    id = b.materialId,
    base = d.logs[0];
  for (let n = 1; n <= 450; n++)
    d.logs.push({
      ...base,
      id: `old-day-${n}`,
      materialId: id,
      area: "spanish",
      item: String(n),
      round: 1,
      date: "2026-10-20",
      minutes: null,
    });
  d.logs.push({
    ...base,
    id: "old-round2",
    materialId: id,
    area: "spanish",
    item: "1",
    round: 2,
    date: "2026-10-24",
    minutes: 5,
  });
  d.dayBooks = [
    {
      materialId: id,
      totalDays: 450,
      activeRound: 2,
      rounds: [
        { round: 1, nextDay: null, lastOpenedDay: 450 },
        { round: 2, nextDay: 2, lastOpenedDay: 88, lastReviewId: "old-round2" },
      ],
    },
  ];
  d = ready(add(d, 10, "append"));
  const before = structuredClone(d),
    result = appendVocabularyDays(d, b.id),
    book = result.dayBooks.find((x) => x.materialId === id);
  assert.equal(book.activeRound, 2);
  assert.equal(book.rounds[1].lastOpenedDay, 88);
  assert.equal(book.rounds[1].nextDay, 2);
  assert.equal(book.rounds[1].lastReviewId, "old-round2");
  assert.equal(dayRoundTotal(book, 1), 450);
  assert.equal(book.rounds[0].nextDay, null);
  assert.deepEqual(result.logs, before.logs);
  assert.deepEqual(
    studySummary(result.logs, "2026-10-25"),
    studySummary(before.logs, "2026-10-25"),
  );
  assert.ok(!result.logs.some((l) => l.materialId === id && l.item === "451"));
  const learned = recordDayReview(
    result,
    id,
    2,
    451,
    "explicit-learning",
    "2026-10-25",
  );
  assert.equal(learned.logs.length, result.logs.length + 1);
  assert.equal(
    learned.dayBooks.find((x) => x.materialId === id).rounds[1].lastOpenedDay,
    88,
  );
  assert.ok(isDayBook(learned.materials.find((m) => m.id === id)));
});
test("allocation always follows current registered last Day and never rewrites imported positions", () => {
  let d = ready(add(createInitialData(), 10, "current"));
  const id = get(d).materialId;
  d.materials.find((m) => m.id === id).total = 600;
  assert.equal(vocabularyPlan(d, get(d)).next, 601);
  d = appendVocabularyDays(d, get(d).id);
  const b = get(d),
    word = b.entries[0];
  assert.equal(word.day, 601);
  const changed = editVocabularyEntry(d, b.id, {
    ...word,
    term: "수정 단어",
    meaning: "뜻 수정",
    day: 1,
    position: 1,
    sheetId: "wrong",
  });
  assert.equal(get(changed).entries[0].day, 601);
  assert.equal(get(changed).entries[0].position, 1);
  assert.equal(get(changed).entries[0].sheetId, word.sheetId);
  assert.equal(get(changed).entries[0].term, "수정 단어");
  assert.equal(deleteVocabularyEntry(changed, b.id, word.id), changed);
  assert.equal(configure(changed, 600, "spanish"), changed); // Baseline cannot be redefined after real import.
});
test("preparation tasks are explicitly linked/reused once without changing their actual records or replacing user totals", () => {
  let d = createInitialData();
  const b = get(d);
  assert.equal(d.tasks.length, 1);
  d = connectVocabularyTask(d, b.id);
  assert.equal(d.tasks.length, 2);
  const first = get(d).taskId;
  d = connectVocabularyTask(d, b.id);
  assert.equal(d.tasks.length, 2);
  assert.equal(get(d).taskId, first);
  assert.equal(d.tasks.find((t) => t.id === first).records, undefined);
  const task = d.tasks.find((t) => t.id === first);
  task.status = "보류";
  task.tracking.total = 5000;
  task.records = [
    {
      id: "work",
      mode: "quantity",
      quantity: 200,
      date: "2026-10-25",
      note: "기존 실적",
    },
  ];
  const old = structuredClone(task);
  d = connectVocabularyTask(d, b.id);
  assert.deepEqual(
    d.tasks.find((t) => t.id === first),
    old,
  );
  assert.equal(connectVocabularyTask(d, get(d, "chinese").id, "not-real"), d);
  let two = createInitialData();
  two.tasks.push({ ...task, id: "choice1" }, { ...task, id: "choice2" });
  assert.equal(connectVocabularyTask(two, get(two).id), two);
  two = connectVocabularyTask(two, get(two).id, "choice2");
  assert.equal(two.tasks.length, 3);
  assert.equal(get(two).taskId, "choice2");
});
test("vocabulary data and references persist; malformed ten-word Days and duplicate collections are rejected safely", () => {
  let d = ready(add(createInitialData(), 10, "stored"));
  d = appendVocabularyDays(d, get(d).id);
  d = add(d, 2, "references", undefined, true);
  d = connectVocabularyTask(d, get(d).id);
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
  assert.ok(validVocabulary(get(d)));
  for (const change of [
    (x) => get(x).entries.shift(),
    (x) => (get(x).entries[0].position = 11),
    (x) => (get(x).entries[1].position = 1),
    (x) => (get(x).entries[0].sheetId = "missing"),
    (x) => x.vocabularies.push({ ...get(x), id: "duplicate-area" }),
  ]) {
    const bad = structuredClone(d);
    change(bad);
    const raw = JSON.stringify(bad);
    entries.set(STORAGE_KEY, raw);
    assert.equal(validData(bad), false);
    assert.throws(() => browserRepository.load());
    assert.equal(entries.get(STORAGE_KEY), raw);
  }
});

test("5,113 actually supplied words allocate only 511 complete Days and retain three confirmed leftovers", () => {
  let d = ready(add(createInitialData(), 5113, "bulk-actual"));
  const p = vocabularyPlan(d, get(d));
  assert.equal(p.days, 511);
  assert.equal(p.words, 5110);
  assert.equal(p.next, 451);
  d = appendVocabularyDays(d, get(d).id);
  assert.equal(d.materials.find((m) => m.id === get(d).materialId).total, 961);
  assert.equal(get(d).entries.filter((e) => e.status === "ready").length, 3);
  assert.equal(vocabularyDuplicateIndex(get(d)).size, 5113);
  assert.equal(d.logs.length, 22);
  assert.ok(validData(d));
});

test("a learning-round task linked to the same book is not automatically reused as a preparation project", () => {
  let d = createInitialData();
  const b = get(d);
  const learning = {
    id: "actual-review",
    title: "스페인어 단어장 회독",
    area: "spanish",
    kind: "프로젝트",
    status: "진행 중",
    note: "학습용",
    items: [],
    tracking: {
      mode: "rounds",
      subject: "스페인어 단어장",
      roundTarget: 10,
      materialId: b.materialId,
    },
    records: [
      { id: "round1", mode: "rounds", date: "2026-10-25", note: "실제 학습" },
    ],
  };
  d.tasks.push(learning);
  d = connectVocabularyTask(d, b.id);
  assert.notEqual(get(d).taskId, learning.id);
  assert.deepEqual(
    d.tasks.find((t) => t.id === learning.id),
    learning,
  );
  assert.equal(
    d.tasks.find((t) => t.id === get(d).taskId).tracking.mode,
    "quantity",
  );
});
