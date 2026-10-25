import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { progress } from "../src/model.ts";
import { studySummary } from "../src/dashboard.ts";
import { browserRepository, STORAGE_KEY, validData } from "../src/storage.ts";
import {
  saveTask,
  saveTaskRecord,
  deleteTaskRecord,
  taskProgress,
  mergedDayRanges,
  validTask,
  taskSettingsError,
  saveTaskStep,
  toggleTaskStep,
  deleteTaskStep,
  roundNumber,
  taskTemplates,
} from "../src/taskWork.ts";
const today = "2026-10-25";
const task = (patch = {}) => ({
  id: "work",
  title: "장기 작업",
  area: "english",
  kind: "프로젝트",
  status: "예정",
  note: "",
  items: [],
  tracking: { mode: "day-range", dayStart: 1, dayEnd: 303 },
  ...patch,
});
const range = (id, startDay, endDay, date = today) => ({
  id,
  mode: "day-range",
  startDay,
  endDay,
  date,
  note: `실제 작업 ${id}`,
});
const put = (d, id, r) => saveTaskRecord(d, id, r, today);
const get = (d, id = "work") => d.tasks.find((t) => t.id === id);
const repository = () => {
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  return entries;
};

test("legacy task checkboxes, notes and storage remain valid without invented tracking or work history", () => {
  const old = createInitialData();
  old.tasks[0].items[0].done = true;
  assert.ok(validTask(old.tasks[0]));
  assert.equal(taskProgress(old.tasks[0]).done, 1);
  assert.equal(taskProgress(old.tasks[0]).total, 3);
  repository();
  browserRepository.save(old);
  assert.deepEqual(browserRepository.load(), old);
  assert.equal(browserRepository.load().tasks[0].records, undefined);
  assert.equal(browserRepository.load().tasks[0].tracking, undefined);
  assert.equal(
    taskTemplates.find((t) => t.id === "spanish-words").tracking.total,
    5113,
  );
  assert.equal(
    taskTemplates.find((t) => t.id === "chinese-hsk6").tracking.total,
    2500,
  );
  assert.equal(old.tasks.length, 1); // Registration templates are not automatically created tasks.
});
test("free out-of-order Day intervals use their union, including nested and adjacent overlap", () => {
  let d = saveTask(createInitialData(), task());
  for (const r of [
    range("one", 12, 27, "2026-10-23"),
    range("two", 80, 95, "2026-10-24"),
    range("three", 28, 45),
    range("overlap", 20, 35),
  ])
    d = put(d, "work", r);
  assert.deepEqual(mergedDayRanges(get(d).records), [
    [12, 45],
    [80, 95],
  ]);
  let p = taskProgress(get(d));
  assert.equal(p.done, 50);
  assert.equal(p.total, 303);
  assert.equal(p.percent, (50 / 303) * 100);
  assert.equal(p.remaining, 253);
  assert.equal(get(d).records.length, 4); // Separate actual work histories are retained.
  const before = structuredClone(d);
  d = put(d, "work", range("two", 80, 85, "2026-10-24"));
  assert.equal(taskProgress(get(d)).done, 40);
  assert.equal(get(d).records.length, 4);
  assert.deepEqual(
    before.tasks.at(-1).records[1],
    range("two", 80, 95, "2026-10-24"),
  );
  d = deleteTaskRecord(d, "work", "overlap");
  assert.equal(taskProgress(get(d)).done, 40);
  d = deleteTaskRecord(d, "work", "one");
  assert.equal(taskProgress(get(d)).done, 24);
  assert.equal(deleteTaskRecord(d, "work", "missing"), d);
});
test("continuous Chinese Day numbers can start anywhere without renumbering another material", () => {
  const old = createInitialData();
  let d = saveTask(
    old,
    task({
      area: "chinese",
      tracking: { mode: "day-range", dayStart: 451, dayEnd: 500 },
    }),
  );
  d = put(d, "work", range("a", 451, 460));
  d = put(d, "work", range("b", 459, 470));
  assert.equal(taskProgress(get(d)).done, 20);
  assert.equal(taskProgress(get(d)).total, 50);
  assert.equal(put(d, "work", range("reset", 1, 10)), d);
  assert.deepEqual(d.materials, old.materials);
  assert.deepEqual(d.logs, old.logs);
});
test("quantity totals update after edits/deletion; unknown totals and overruns retain actual counts", () => {
  let d = saveTask(
    createInitialData(),
    task({
      area: "spanish",
      tracking: { mode: "quantity", total: 5113, unit: "단어" },
    }),
  );
  const count = (id, quantity) => ({
    id,
    date: today,
    note: "중복 단어 검토",
    mode: "quantity",
    quantity,
  });
  d = put(d, "work", count("a", 100));
  d = put(d, "work", count("b", 150));
  assert.equal(taskProgress(get(d)).done, 250);
  assert.equal(taskProgress(get(d)).remaining, 4863);
  d = put(d, "work", count("a", 60));
  assert.equal(taskProgress(get(d)).done, 210);
  assert.equal(get(d).records.length, 2);
  d = deleteTaskRecord(d, "work", "b");
  assert.equal(taskProgress(get(d)).done, 60);
  d = saveTask(d, { ...get(d), tracking: { ...get(d).tracking, total: 50 } });
  assert.equal(taskProgress(get(d)).done, 60);
  assert.equal(taskProgress(get(d)).percent, 100);
  assert.equal(taskProgress(get(d)).overflow, 10);
  assert.equal(taskProgress(get(d)).remaining, 0);
  d = saveTask(d, {
    ...get(d),
    tracking: { mode: "quantity", total: null, unit: "단어" },
  });
  assert.equal(taskProgress(get(d)).done, 60);
  assert.equal(taskProgress(get(d)).percent, null);
  assert.equal(taskProgress(get(d)).remaining, null);
});
test("hiragana and katakana round histories are independent and continue beyond targets without auto-completing the task", () => {
  let d = createInitialData();
  for (const id of ["hira", "kata"])
    d = saveTask(
      d,
      task({
        id,
        area: "japanese",
        title: id,
        tracking: { mode: "rounds", subject: id, roundTarget: 1 },
      }),
    );
  for (let i = 0; i < 3; i++)
    d = put(d, "hira", {
      id: `h${i}`,
      mode: "rounds",
      date: `2026-10-${23 + i}`,
      note: `回 ${i}`,
    });
  d = put(d, "kata", {
    id: "k",
    mode: "rounds",
    date: today,
    note: "가타카나",
  });
  assert.equal(taskProgress(get(d, "hira")).done, 3);
  assert.equal(taskProgress(get(d, "kata")).done, 1);
  assert.equal(get(d, "hira").status, "예정");
  assert.equal(taskProgress(get(d, "hira")).overflow, 2);
  d = put(d, "hira", {
    id: "h0",
    mode: "rounds",
    date: today,
    note: "날짜 수정",
  });
  assert.equal(taskProgress(get(d, "hira")).done, 3);
  assert.equal(roundNumber(get(d, "hira"), "h1"), 1);
  d = deleteTaskRecord(d, "hira", "h1");
  assert.equal(taskProgress(get(d, "hira")).done, 2);
  assert.equal(
    get(d, "hira").records.some((r) => r.id === "h1"),
    false,
  );
  d = put(d, "hira", {
    id: "fourth",
    mode: "rounds",
    date: today,
    note: "추가",
  });
  assert.equal(taskProgress(get(d, "hira")).done, 3);
});
test("step add/edit/check/delete preserve notes and completion dates while leaving learning records untouched", () => {
  let d = saveTask(createInitialData(), task({ tracking: { mode: "steps" } })),
    original = structuredClone(d.logs);
  d = saveTaskStep(d, "work", {
    id: "a",
    title: "목차 작성",
    done: false,
    note: "페이지 확인",
  });
  d = saveTaskStep(d, "work", { id: "b", title: "PDF 인덱스", done: false });
  d = toggleTaskStep(d, "work", "a", today);
  assert.equal(taskProgress(get(d)).percent, 50);
  assert.equal(get(d).items[0].completedDate, today);
  d = saveTaskStep(d, "work", {
    ...get(d).items[0],
    title: "목차 제목 수정",
    note: "수정 메모",
  });
  assert.equal(get(d).items[0].done, true);
  d = toggleTaskStep(d, "work", "a", today);
  assert.equal(get(d).items[0].completedDate, undefined);
  assert.equal(taskProgress(get(d)).done, 0);
  d = toggleTaskStep(d, "work", "a", today);
  d = deleteTaskStep(d, "work", "a");
  assert.equal(taskProgress(get(d)).done, 0);
  assert.equal(taskProgress(get(d)).total, 1);
  assert.equal(get(d).items[0].id, "b");
  assert.deepEqual(d.logs, original);
  assert.ok(validData(d));
});
test("mode changes keep all histories and old history remains editable; narrowing away recorded Days is rejected", () => {
  let d = saveTask(createInitialData(), task());
  d = put(d, "work", range("r", 12, 27));
  d = saveTask(d, {
    ...get(d),
    tracking: { ...get(d).tracking, mode: "quantity", total: 100, unit: "개" },
  });
  assert.equal(get(d).records.length, 1);
  assert.equal(taskProgress(get(d)).done, 0);
  d = put(d, "work", range("r", 15, 30));
  assert.equal(get(d).records[0].endDay, 30);
  d = put(d, "work", {
    id: "q",
    mode: "quantity",
    date: today,
    note: "수량",
    quantity: 20,
  });
  assert.equal(taskProgress(get(d)).done, 20);
  const invalid = { ...get(d), tracking: { ...get(d).tracking, dayEnd: 25 } };
  assert.match(taskSettingsError(invalid), /기존 작업 구간/);
  assert.equal(saveTask(d, invalid), d);
  assert.equal(get(d).records.length, 2);
});
test("invalid ranges, fractional quantities, future dates, foreign tasks and wrong modes never alter data", () => {
  const d = saveTask(createInitialData(), task());
  for (const r of [
    range("reverse", 30, 10),
    range("outside", 300, 304),
    range("zero", 0, 1),
    range("fraction", 1.5, 3),
    range("future", 1, 2, "2026-10-26"),
    range("bad-date", 1, 2, "2026-02-29"),
    { id: "q", mode: "quantity", quantity: 2, date: today, note: "" },
  ])
    assert.equal(put(d, "work", r), d, JSON.stringify(r));
  assert.equal(put(d, "missing", range("none", 1, 2)), d);
  const q = saveTask(
    d,
    task({ id: "quantity", tracking: { mode: "quantity", total: null } }),
  );
  for (const quantity of [0, -1, 1.5, Infinity])
    assert.equal(
      put(q, "quantity", {
        id: "bad",
        mode: "quantity",
        quantity,
        date: today,
        note: "",
      }),
      q,
    );
  const once = put(d, "work", range("same", 1, 2)),
    twice = put(once, "work", range("same", 1, 2));
  assert.equal(get(twice).records.length, 1);
  assert.equal(taskProgress(get(twice)).done, 2);
});
test("task work never modifies words, Day/round positions, calendars, goals or HOME learning time", () => {
  const old = createInitialData();
  old.events = [];
  old.dayBooks = [
    {
      materialId: "vocabulary",
      totalDays: 303,
      activeRound: 1,
      rounds: [{ round: 1, nextDay: 1, lastOpenedDay: 88 }],
    },
  ];
  const before = structuredClone(old);
  let d = saveTask(old, task());
  d = put(d, "work", range("prep", 1, 303));
  for (const key of ["materials", "logs", "dayBooks", "goals", "events"])
    assert.deepEqual(d[key], before[key]);
  assert.deepEqual(
    studySummary(d.logs, today),
    studySummary(before.logs, today),
  );
  assert.equal(
    progress(
      d.materials.find((m) => m.id === "vocabulary"),
      d.logs,
    ).count,
    0,
  );
  assert.deepEqual(old, before);
  assert.equal(get(d).status, "예정");
});
test("all modes and paused status persist after reload; malformed work history is rejected without overwriting raw data", () => {
  const entries = repository();
  let d = createInitialData();
  for (const template of taskTemplates)
    d = saveTask(d, task({ ...template, id: template.id, status: "보류" }));
  d = put(d, "english-cleanup", range("english-range", 12, 27));
  d = put(d, "spanish-words", {
    id: "spanish-q",
    mode: "quantity",
    quantity: 50,
    date: today,
    note: "메모",
  });
  d = put(d, "hiragana", {
    id: "japanese-round",
    mode: "rounds",
    date: today,
    note: "완료",
  });
  browserRepository.save(d);
  assert.deepEqual(browserRepository.load(), d);
  assert.ok(validData(d));
  for (const mutate of [
    (x) =>
      (x.tasks.at(-1).records = [
        { id: "bad", mode: "quantity", date: today, note: "", quantity: -1 },
      ]),
    (x) => (x.tasks.at(-1).tracking.mode = "fake"),
    (x) =>
      (x.tasks.at(-1).items = [
        { id: "step", title: "a", done: true },
        { id: "step", title: "b", done: false },
      ]),
    (x) => {
      const t = x.tasks.find((t) => t.id === "english-cleanup");
      t.records.push({ ...t.records[0] });
    },
  ]) {
    const bad = structuredClone(d);
    mutate(bad);
    assert.equal(validData(bad), false);
    const raw = JSON.stringify(bad);
    entries.set(STORAGE_KEY, raw);
    assert.throws(() => browserRepository.load());
    assert.equal(entries.get(STORAGE_KEY), raw);
  }
});
