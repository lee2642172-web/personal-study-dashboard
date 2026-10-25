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
  openDay,
} from "../src/dayLearning.ts";
import { studySummary } from "../src/dashboard.ts";
import { taskProgress, saveTaskRecord } from "../src/taskWork.ts";
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

test("metadata uses confirmed Chinese Day 310 and Spanish Day 450 without inventing words or learning", () => {
  const d = createInitialData(),
    sp = get(d),
    cn = get(d, "chinese");
  assert.equal(sp.baselineLastDay, 450);
  assert.equal(sp.existingWordEstimate, 4500);
  assert.equal(sp.incomingWordEstimate, 5113);
  assert.equal(cn.baselineLastDay, 310);
  assert.deepEqual(cn.dayPlan, {
    organizedThroughDay: 310,
    remainingStartDay: 311,
    remainingEndDay: 500,
  });
  assert.equal(cn.existingWordEstimate, 2500);
  assert.equal(cn.incomingWordEstimate, 2500);
  assert.equal(d.materials.find((m) => m.id === cn.materialId).total, 310);
  assert.equal(vocabularyPlan(d, cn).next, 311);
  assert.equal(cn.sheets.length, 1);
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
test("a Chinese source inventory retains its word count while a separate Day study material uses the confirmed 310 Days", () => {
  const d = legacy();
  d.materials.push({
    ...oldMaterial("reference-cn", "chinese", 2500, "중국어 단어 원본"),
    kind: "reference",
  });
  const next = includeVocabularies(d);
  assert.equal(next.materials.filter((m) => m.area === "chinese").length, 2);
  const book = get(next, "chinese"),
    study = next.materials.find((m) => m.id === book.materialId);
  assert.equal(book.baselineLastDay, 310);
  assert.equal(study.kind, "days");
  assert.equal(study.total, 310);
  assert.ok(isDayBook(study));
  assert.deepEqual(
    next.materials.find((m) => m.id === "reference-cn"),
    d.materials.find((m) => m.id === "reference-cn"),
  );
  assert.deepEqual(next.logs, d.logs);
  assert.deepEqual(next.tasks, d.tasks);
  assert.equal(book.entries.length, 0);
  assert.equal(vocabularyPlan(next, book).next, 311);
  assert.equal(includeVocabularies(next), next);
  assert.ok(validData(next));
});
test("existing Chinese Day study bindings are repaired once without duplicating materials or changing review positions", () => {
  let d = createInitialData();
  const id = get(d, "chinese").materialId;
  d = recordDayReview(d, id, 1, 2, "cn-existing-review", "2026-10-25");
  d = openDay(d, id, 1, 77);
  get(d, "chinese").materialId = "";
  delete d.materials.find((m) => m.id === id).vocabularyId;
  const before = structuredClone(d),
    repaired = includeVocabularies(d);
  assert.equal(repaired.materials.length, before.materials.length);
  assert.equal(get(repaired, "chinese").materialId, id);
  assert.ok(isDayBook(repaired.materials.find((m) => m.id === id)));
  assert.deepEqual(repaired.logs, before.logs);
  assert.deepEqual(repaired.dayBooks, before.dayBooks);
  assert.deepEqual(repaired.tasks, before.tasks);
  assert.equal(includeVocabularies(repaired), repaired);
  assert.ok(validData(repaired));
  const missingFlag = structuredClone(repaired);
  delete missingFlag.materials.find((m) => m.id === id).vocabularyId;
  const restored = includeVocabularies(missingFlag);
  assert.ok(isDayBook(restored.materials.find((m) => m.id === id)));
  assert.deepEqual(restored.dayBooks, before.dayBooks);
  assert.deepEqual(restored.logs, before.logs);
});
test("higher existing Day evidence is preserved; setup rejects reductions and overlapping legacy ranges", () => {
  const d = legacy();
  d.materials.push(oldMaterial("cn-old", "chinese", 350, "HSK 단어장"));
  d.logs.push({
    ...d.logs[0],
    id: "cn375",
    area: "chinese",
    materialId: "cn-old",
    item: "375",
  });
  const adopted = includeVocabularies(d);
  assert.equal(get(adopted, "chinese").baselineLastDay, 375);
  assert.equal(vocabularyEvidence(adopted, get(adopted, "chinese")), 375);
  assert.equal(configure(adopted, 350), adopted);
  const confirmed = configure(adopted, 375);
  assert.equal(get(confirmed, "chinese").baselineLastDay, 375);
  assert.equal(confirmed.materials.find((m) => m.id === "cn-old").total, 375);
  const b = get(confirmed, "chinese"),
    sheets = [
      { ...b.sheets[0], startDay: 1, endDay: 100 },
      { ...b.sheets[0], id: "legacy-grade", startDay: 1, endDay: 100 },
    ];
  assert.equal(
    configureVocabulary(confirmed, b.id, { ...b, sheets }),
    confirmed,
  );
  assert.equal(appendVocabularyDays(confirmed, b.id), confirmed);
  // Old logs can contain numeric items beyond the Day navigation limit.
  // Preserve that evidence without creating an invalid material or stored book.
  const unusual = legacy();
  unusual.materials.push(
    oldMaterial("cn-unusual", "chinese", 250, "기존 중국어 단어장"),
  );
  unusual.logs.push({
    ...unusual.logs[0],
    id: "unusual-day",
    area: "chinese",
    materialId: "cn-unusual",
    item: "10001",
  });
  assert.ok(validData(unusual));
  const safe = includeVocabularies(unusual);
  assert.ok(validData(safe));
  assert.deepEqual(safe.logs, unusual.logs);
  assert.equal(safe.materials.find((m) => m.id === "cn-unusual").total, 250);
  assert.equal(get(safe, "chinese").baselineLastDay, null);
  assert.equal(configure(safe, 310), safe);
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
test("Chinese pending words combine across legacy grade sheets into continuous Days after 310", () => {
  let d = createInitialData();
  const b = get(d, "chinese");
  b.sheets.push(
    ...[5, 6].map((n) => ({
      id: `hsk-${n}`,
      title: `HSK ${n}급`,
      materialId: "",
      startDay: null,
      endDay: null,
    })),
  );
  d = add(d, 5, "grade5", "hsk-5", false, "chinese");
  d = add(d, 5, "grade6", "hsk-6", false, "chinese");
  d = ready(d, "chinese");
  assert.equal(vocabularyPlan(d, get(d, "chinese")).days, 1);
  d = ready(add(d, 5, "grade5b", "hsk-5", false, "chinese"), "chinese");
  d = ready(add(d, 5, "grade6b", "hsk-6", false, "chinese"), "chinese");
  d = appendVocabularyDays(d, get(d, "chinese").id);
  const book = get(d, "chinese");
  assert.equal(d.materials.find((m) => m.id === book.materialId).total, 312);
  assert.equal(book.entries.filter((e) => e.day === 311).length, 10);
  assert.equal(book.entries.filter((e) => e.day === 312).length, 10);
  assert.ok(book.entries.every((e) => e.sheetId === "chinese"));
  assert.ok(validData(d));
});
test("confirmed Chinese range migration preserves already imported Days, actual records and saved round positions", () => {
  let d = createInitialData();
  const b = get(d, "chinese"),
    material = d.materials.find((m) => m.id === b.materialId);
  delete b.dayPlan;
  b.baselineLastDay = 250;
  b.sheets = [
    {
      id: "hsk-6",
      title: "HSK 6급",
      materialId: "",
      startDay: null,
      endDay: null,
    },
  ];
  material.total = 251;
  b.entries = Array.from({ length: 10 }, (_, i) => ({
    id: `old-cn-${i}`,
    term: `旧词${i}`,
    meaning: "보존할 원본",
    note: "",
    sheetId: "hsk-6",
    status: "imported",
    day: 251,
    position: i + 1,
  }));
  b.taskId = "old-cn-prep";
  d.tasks.push({
    id: b.taskId,
    title: "HSK 6급 단어 정리",
    area: "chinese",
    kind: "프로젝트",
    status: "보류",
    items: [],
    note: "기존 메모",
    tracking: {
      mode: "quantity",
      total: 2500,
      unit: "단어",
      materialId: material.id,
    },
    records: [
      {
        id: "old-quantity",
        mode: "quantity",
        quantity: 17,
        date: "2026-10-24",
        note: "기존 작업",
      },
    ],
  });
  d.logs.push({
    ...d.logs[0],
    id: "cn-study",
    area: "chinese",
    materialId: material.id,
    item: "5",
    round: 2,
    date: "2026-10-24",
    minutes: 7,
  });
  d.dayBooks = [
    {
      materialId: material.id,
      totalDays: 251,
      activeRound: 2,
      rounds: [
        { round: 1, nextDay: null, lastOpenedDay: 250, totalDays: 250 },
        { round: 2, nextDay: 1, lastOpenedDay: 77, lastReviewId: "cn-study" },
      ],
    },
  ];
  const before = structuredClone(d),
    result = includeVocabularies(d),
    book = get(result, "chinese");
  assert.equal(book.baselineLastDay, 250); // Imported Days 251+ must remain valid.
  assert.equal(vocabularyPlan(result, book).next, 311);
  assert.equal(result.materials.find((m) => m.id === material.id).total, 310);
  assert.deepEqual(
    book.entries,
    before.vocabularies.find((b) => b.area === "chinese").entries,
  );
  assert.deepEqual(result.logs, before.logs);
  assert.equal(result.dayBooks[0].activeRound, 2);
  assert.equal(result.dayBooks[0].rounds[1].lastOpenedDay, 77);
  assert.equal(dayRoundTotal(result.dayBooks[0], 1), 250);
  const task = result.tasks.find((t) => t.id === b.taskId);
  assert.deepEqual(
    task.records,
    before.tasks.find((t) => t.id === b.taskId).records,
  );
  assert.equal(task.status, "보류");
  assert.equal(task.note, "기존 메모");
  assert.equal(task.tracking.total, 2500); // Old quantity history remains editable.
  assert.equal(taskProgress(task).done, 0); // Quantities are never guessed into completed Days.
  assert.equal(taskProgress(task).total, 190);
  assert.equal(includeVocabularies(result), result);
  assert.deepEqual(d, before);
  assert.ok(validData(result));
});
test("Chinese preparation uses 311–500 independently of study; migration never cuts off older work ranges", () => {
  let d = createInitialData(),
    b = get(d, "chinese");
  d = connectVocabularyTask(d, b.id);
  b = get(d, "chinese");
  const original = structuredClone(d),
    id = b.taskId;
  assert.equal(taskProgress(d.tasks.find((t) => t.id === id)).total, 190);
  d = saveTaskRecord(
    d,
    id,
    {
      id: "cn-work",
      mode: "day-range",
      startDay: 311,
      endDay: 312,
      date: "2026-10-25",
      note: "정리만 완료",
    },
    "2026-10-25",
  );
  assert.equal(taskProgress(d.tasks.find((t) => t.id === id)).done, 2);
  assert.deepEqual(d.logs, original.logs);
  assert.deepEqual(d.dayBooks, original.dayBooks);
  assert.deepEqual(d.materials, original.materials); // Work does not create actual Day contents.
  d.tasks.find((t) => t.id === id).tracking.dayEnd = 520;
  d = connectVocabularyTask(d, b.id);
  assert.equal(d.tasks.find((t) => t.id === id).tracking.dayEnd, 520); // Reconnecting must not reset later edits.
  const task = d.tasks.find((t) => t.id === id);
  task.tracking.dayStart = 1;
  task.records.push({
    id: "older-range",
    mode: "day-range",
    startDay: 250,
    endDay: 251,
    date: "2026-10-24",
    note: "보존할 과거 구간",
  });
  delete get(d, "chinese").dayPlan;
  const prior = structuredClone(task),
    result = includeVocabularies(d);
  assert.deepEqual(
    result.tasks.find((t) => t.id === id),
    prior,
  );
  assert.ok(validData(result));
  assert.equal(result.tasks.length, original.tasks.length);
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
