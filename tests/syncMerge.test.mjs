import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { validData } from "../src/storage.ts";
import {
  legacyDocument,
  changeDocument,
  mergeDocuments,
  importLegacy,
  plainData,
  equalData,
  captureUntrackedDocument,
  renderDocument,
} from "../src/syncMerge.ts";
import { addTodo, completeTodo, undoTodo } from "../src/todos.ts";
import {
  recordDayReview,
  cancelDayReview,
  startDayRound,
  openDay,
} from "../src/dayLearning.ts";
import { recordEbsLearning, toggleEbsLearning } from "../src/ebs.ts";
import { studySummary, dashboardTimeEntries } from "../src/dashboard.ts";
const day = "2026-10-31",
  fresh = () => legacyDocument(createInitialData(), "seed", 1);
const edit = (d, fn, actor, time) => changeDocument(d, fn(d), actor, time);
const add = (id) => (d) => addTodo(d, { id, title: id });
function both(a, b) {
  const left = mergeDocuments(a, b),
    right = mergeDocuments(b, a);
  assert.ok(equalData(left, right));
  assert.ok(validData(left));
  assert.ok(equalData(mergeDocuments(left, a), left));
  return left;
}

test("independent records from two devices form an idempotent commutative union", () => {
  const base = fresh(),
    a = edit(base, add("pc"), "A", 100),
    b = edit(base, add("phone"), "B", 101),
    merged = both(a, b);
  assert.deepEqual(
    new Set(merged.todos.map((t) => t.id)),
    new Set(["pc", "phone"]),
  );
  assert.equal(merged.todos.length, 2);
});
test("different fields on one task merge while an actual same-field conflict uses a deterministic latest change", () => {
  const base = edit(fresh(), add("shared"), "seed", 10);
  const change = (patch) => (d) => ({
    ...d,
    todos: d.todos.map((t) => (t.id === "shared" ? { ...t, ...patch } : t)),
  });
  const a = edit(base, change({ title: "PC edited title" }), "A", 100),
    b = edit(base, change({ note: "Phone edited memo" }), "B", 101),
    m = both(a, b);
  assert.equal(m.todos[0].title, "PC edited title");
  assert.equal(m.todos[0].note, "Phone edited memo");
  const x = edit(base, change({ title: "older" }), "A", 200),
    y = edit(base, change({ title: "newer" }), "B", 201);
  assert.equal(both(x, y).todos[0].title, "newer");
  const tieA = edit(base, change({ note: "A" }), "A", 300),
    tieB = edit(base, change({ note: "B" }), "B", 300);
  assert.equal(both(tieA, tieB).todos[0].note, "B");
});
test("a causally later edit wins even if that device wall clock is behind", () => {
  const base = edit(fresh(), add("shared"), "seed", 10),
    future = edit(
      base,
      (d) => ({
        ...d,
        todos: d.todos.map((t) => ({ ...t, note: "future clock" })),
      }),
      "A",
      9000000,
    );
  const observed = mergeDocuments(base, future),
    after = edit(
      observed,
      (d) => ({
        ...d,
        todos: d.todos.map((t) => ({ ...t, note: "after observing future" })),
      }),
      "B",
      50,
    );
  assert.equal(both(future, after).todos[0].note, "after observing future");
});
test("deletion tombstones prevent a stale device or a concurrent child edit from resurrecting a record", () => {
  const base = edit(fresh(), add("remove-me"), "seed", 10),
    deleted = edit(base, (d) => ({ ...d, todos: [] }), "A", 100),
    staleEdit = edit(
      base,
      (d) => ({
        ...d,
        todos: d.todos.map((t) => ({ ...t, note: "late offline edit" })),
      }),
      "B",
      999,
    );
  assert.equal(both(deleted, staleEdit).todos.length, 0);
  const imported = importLegacy(
    deleted,
    plainData(base),
    "legacy-device",
    999999,
  );
  assert.equal(imported.todos.length, 0);
  const recreated = edit(deleted, add("remove-me"), "A", 1000);
  assert.equal(both(recreated, deleted).todos.length, 1);
});
test("completion cancellation wins over a concurrent elapsed-time edit without removing unrelated task fields", () => {
  const base = edit(
    edit(fresh(), add("todo"), "seed", 10),
    (d) => completeTodo(d, "todo", day, 5),
    "seed",
    20,
  );
  const cancelled = edit(base, (d) => undoTodo(d, "todo"), "A", 100),
    timeEdit = edit(
      base,
      (d) => ({
        ...d,
        todos: d.todos.map((t) => ({
          ...t,
          completion: { ...t.completion, minutes: 15 },
        })),
      }),
      "B",
      101,
    );
  const merged = both(cancelled, timeEdit);
  assert.equal(merged.todos[0].completion, null);
  assert.equal(merged.todos[0].title, "todo");
  assert.equal(studySummary(dashboardTimeEntries(merged), day).today, 0);
});
test("nested long-project work sessions from separate devices both remain and time edits do not overwrite dates", () => {
  const base = fresh(),
    id = base.tasks[0].id;
  const record = (id, minutes) => (d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === base.tasks[0].id
        ? {
            ...t,
            records: [
              ...(t.records ?? []),
              { id, mode: "session", date: day, note: "", minutes },
            ],
          }
        : t,
    ),
  });
  let m = both(
    edit(base, record("pc-work", 40), "A", 100),
    edit(base, record("phone-work", 60), "B", 101),
  );
  assert.equal(m.tasks.find((t) => t.id === id).records.length, 2);
  assert.equal(studySummary(dashboardTimeEntries(m), day).today, 100);
  const patch = (field, value) => (d) => ({
    ...d,
    tasks: d.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            records: t.records.map((r) =>
              r.id === "phone-work" ? { ...r, [field]: value } : r,
            ),
          }
        : t,
    ),
  });
  m = both(
    edit(m, patch("date", "2026-10-30"), "A", 200),
    edit(m, patch("minutes", 25), "B", 201),
  );
  const r = m.tasks
    .find((t) => t.id === id)
    .records.find((r) => r.id === "phone-work");
  assert.equal(r.date, "2026-10-30");
  assert.equal(r.minutes, 25);
});
test("EBS primary, extra learning and cancellation survive record merges without duplicating time", () => {
  let base = fresh();
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    base = edit(
      base,
      (d) => recordEbsLearning(d, id, "2026-04-08", day, `listen-${id}`),
      "PC",
      100,
    );
  const phone = edit(
      base,
      (d) => recordDayReview(d, "vocabulary", 1, 25, "day25", day, 12),
      "phone",
      200,
    ),
    m = both(base, phone);
  assert.equal(studySummary(dashboardTimeEntries(m), day).today, 66);
  const cancelled = edit(
      m,
      (d) => toggleEbsLearning(d, "ebs-0", "2026-04-08", day, "unused"),
      "phone",
      300,
    ),
    other = edit(m, add("book"), "PC", 301),
    result = both(cancelled, other);
  assert.equal(studySummary(dashboardTimeEntries(result), day).today, 48);
  assert.ok(result.logs.some((l) => l.id === "listen-ebs-0" && l.voided));
});
test("hard-cancelled Day reviews cannot reappear from another device and next Day is recomputed from merged logs", () => {
  const base = edit(
      fresh(),
      (d) => recordDayReview(d, "vocabulary", 1, 1, "review1", day, 10),
      "PC",
      100,
    ),
    cancel = edit(base, (d) => cancelDayReview(d, "review1"), "PC", 200),
    other = edit(
      base,
      (d) => recordDayReview(d, "vocabulary", 1, 2, "review2", day, 12),
      "phone",
      201,
    ),
    m = both(cancel, other);
  assert.ok(!m.logs.some((l) => l.id === "review1"));
  assert.ok(m.logs.some((l) => l.id === "review2"));
  assert.equal(
    m.dayBooks
      .find((b) => b.materialId === "vocabulary")
      .rounds.find((r) => r.round === 1).nextDay,
    1,
  );
  assert.equal(studySummary(dashboardTimeEntries(m), day).today, 12);
});
test("concurrent first-use Day books preserve rounds, cursors and progress instead of replacing the whole book", () => {
  const base = fresh(),
    pc = edit(
      base,
      (d) => {
        let r = startDayRound(d, "vocabulary");
        r = startDayRound(r, "vocabulary");
        return recordDayReview(r, "vocabulary", 3, 7, "round3-review", day, 8);
      },
      "PC",
      100,
    ),
    phone = edit(
      base,
      (d) =>
        openDay(
          recordDayReview(d, "vocabulary", 1, 2, "round1-review", day, 12),
          "vocabulary",
          1,
          88,
        ),
      "phone",
      101,
    ),
    m = both(pc, phone),
    book = m.dayBooks.find((b) => b.materialId === "vocabulary");
  assert.deepEqual(
    book.rounds.map((r) => r.round),
    [1, 2, 3],
  );
  assert.equal(book.activeRound, 1);
  assert.equal(book.rounds.find((r) => r.round === 1).lastOpenedDay, 88);
  assert.equal(
    m.logs.filter((l) => ["round1-review", "round3-review"].includes(l.id))
      .length,
    2,
  );
});
test("concurrent Day extensions keep the larger registered range and never drop a valid last Day", () => {
  const base = fresh(),
    extend = (total) => (d) => ({
      ...d,
      materials: d.materials.map((m) =>
        m.id === "vocabulary" ? { ...m, total } : m,
      ),
    }),
    a = edit(base, extend(320), "PC", 100),
    b = edit(base, extend(310), "phone", 101),
    m = both(a, b);
  assert.equal(m.materials.find((m) => m.id === "vocabulary").total, 320);
});
test("legacy phone records merge with PC records without replacing PC-only additions or regressing untouched seed fields", () => {
  let pc = createInitialData();
  for (const id of ["ebs-0", "ebs-1", "ebs-2"])
    pc = recordEbsLearning(pc, id, "2026-04-08", day, `pc-${id}`);
  pc = addTodo(pc, { id: "pc-only", title: "PC record" });
  const remote = legacyDocument(pc, "legacy:server", 1),
    phone = recordDayReview(
      addTodo(createInitialData(), { id: "phone-only", title: "Phone record" }),
      "vocabulary",
      1,
      25,
      "phone-log",
      day,
      12,
    ),
    m = importLegacy(remote, phone, "legacy:recovered", 3);
  assert.ok(validData(m));
  assert.deepEqual(
    new Set(m.todos.map((t) => t.id)),
    new Set(["pc-only", "phone-only"]),
  );
  assert.equal(studySummary(dashboardTimeEntries(m), day).today, 66);
});
test("metadata round-trips through JSONB-style key ordering and malformed protocol/path data is rejected", () => {
  const document = edit(fresh(), add("thing"), "A", 100),
    reordered = JSON.parse(
      JSON.stringify(document, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.keys(value)
                .reverse()
                .map((k) => [k, value[k]]),
            )
          : value,
      ),
    );
  assert.ok(validData(reordered));
  assert.ok(equalData(renderDocument(reordered.syncState), document));
  for (const [path, op] of [
    ['["__proto__","polluted"]', { n: 1, actor: "bad", value: true }],
    ['["todos"]', { n: NaN, actor: "bad", value: [] }],
    ['["todos"]', { n: 1, actor: "bad", deleted: true, value: [] }],
  ]) {
    const bad = structuredClone(document);
    bad.syncState.changes[path] = op;
    assert.equal(validData(bad), false);
  }
  const future = structuredClone(document);
  future.syncState.protocol = 2;
  assert.equal(validData(future), false);
});

test("clearing an observed optional list deletes its known items while preserving another device new item", () => {
  const base = edit(fresh(), add("observed"), "seed", 10),
    cleared = edit(
      base,
      (d) => {
        const { todos, ...rest } = d;
        return rest;
      },
      "A",
      100,
    ),
    other = edit(base, add("concurrent"), "B", 101),
    m = both(cleared, other);
  assert.deepEqual(
    m.todos.map((t) => t.id),
    ["concurrent"],
  );
});

test("older app edits are captured without allowing an old metadata snapshot to erase unrelated newer records", () => {
  const base = edit(fresh(), add("existing"), "seed", 10);
  const rawOlderApp = {
    ...base,
    todos: [
      {
        id: "old-client-new",
        title: "older app addition",
        dueDate: "",
        note: "",
        completion: null,
      },
    ],
  };
  const captured = captureUntrackedDocument(
    rawOlderApp,
    "legacy:server-write",
    500,
  );
  const other = edit(base, add("newer-device"), "new-app", 600),
    m = both(captured, other);
  assert.deepEqual(
    new Set(m.todos.map((t) => t.id)),
    new Set(["old-client-new", "newer-device"]),
  );
});
