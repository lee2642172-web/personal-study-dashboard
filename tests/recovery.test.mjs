import test from "node:test";
import assert from "node:assert/strict";
import { DashboardStore, accountStorageKey } from "../src/sync.ts";
import { recoverySources, recoverySummary } from "../src/recovery.ts";
import { createInitialData } from "../src/initialData.ts";
import { STORAGE_KEY } from "../src/storage.ts";
import { addTodo } from "../src/todos.ts";
import { recordDayReview } from "../src/dayLearning.ts";
const clone = structuredClone;
function memory(initial = createInitialData()) {
  const map = new Map([[STORAGE_KEY, JSON.stringify(initial)]]);
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
}
function server(data = createInitialData()) {
  let current = {
    data: clone(data),
    revision: 1,
    updatedAt: "2026-10-31T00:00:00Z",
  };
  const writes = [];
  return {
    writes,
    get current() {
      return clone(current);
    },
    read: async () => clone(current),
    async write(data, version) {
      assert.equal(version, current.revision);
      writes.push(clone(data));
      current = {
        data: clone(data),
        revision: version + 1,
        updatedAt: "2026-10-31T01:00:00Z",
      };
      return clone(current);
    },
  };
}
function phoneData() {
  return recordDayReview(
    addTodo(createInitialData(), {
      id: "phone-latest",
      title: "휴대폰에서 최근에 추가한 기록",
    }),
    "vocabulary",
    1,
    25,
    "phone-review",
    "2026-10-31",
    12,
  );
}

test("the reported incident is recoverable: choosing an older cloud snapshot preserves both guest original and a pre-replacement backup", async () => {
  const phone = phoneData(),
    storage = memory(phone),
    db = server(),
    store = new DashboardStore(storage);
  await store.connect("project:me", db);
  assert.equal(store.getSnapshot().phase, "choice");
  assert.ok(store.useCloud());
  assert.deepEqual(store.getSnapshot().data, db.current.data);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), phone);
  const sources = store.getRecoverySources(),
    backup = sources.find(
      (s) => s.label === "온라인 기록을 불러오기 전 이 기기 기록",
    );
  assert.ok(backup);
  assert.deepEqual(JSON.parse(backup.raw), phone);
  assert.deepEqual(sources.find((s) => s.id === "guest").data, phone);
  store.stageRecovery(backup.id, backup.raw);
  assert.deepEqual(store.getSnapshot().data, phone);
  assert.equal(store.getSnapshot().recoveryDraft, true);
  assert.equal(db.writes.length, 0);
  assert.ok(
    store
      .getSnapshot()
      .backups.some(
        (b) => JSON.stringify(b.data) === JSON.stringify(db.current.data),
      ),
  );
  await store.sync();
  assert.deepEqual(store.getSnapshot().data, phone);
  assert.equal(db.writes.length, 0);
  const reopened = new DashboardStore(storage);
  await reopened.connect("project:me", db);
  assert.equal(reopened.getSnapshot().recoveryDraft, true);
  assert.deepEqual(reopened.getSnapshot().data, phone);
  assert.equal(db.writes.length, 0);
});
test("recovery drafts remain local after edits, focus-style polls, reconnect and server revision changes until explicit publication", async () => {
  const storage = memory(phoneData()),
    db = server(),
    store = new DashboardStore(storage);
  await store.connect("p:u", db);
  store.useCloud();
  const source = store.getRecoverySources().find((s) => s.id === "guest");
  store.stageRecovery(source.id, source.raw);
  store.update((d) =>
    addTodo(d, { id: "draft-edit", title: "복구 내용 확인 중 추가" }),
  );
  await store.sync();
  assert.equal(db.writes.length, 0);
  await db.write(
    addTodo(db.current.data, { id: "pc-new", title: "PC의 별도 변경" }),
    1,
  );
  await store.sync();
  assert.ok(store.getSnapshot().data.todos.some((t) => t.id === "draft-edit"));
  assert.ok(!db.current.data.todos.some((t) => t.id === "draft-edit"));
  await store.useLocal();
  assert.equal(store.getSnapshot().recoveryDraft, false);
  assert.equal(store.getSnapshot().phase, "saved");
  assert.ok(db.current.data.todos.some((t) => t.id === "draft-edit"));
  assert.ok(
    store
      .getSnapshot()
      .backups.some((b) => b.data.todos?.some((t) => t.id === "pc-new")),
  );
});
test("an older account cache cannot silently hide newer logged-out phone records on a later login", async () => {
  const storage = memory(),
    db = server(),
    first = new DashboardStore(storage);
  await first.connect("p:u", db);
  first.disconnect();
  storage.setItem(STORAGE_KEY, JSON.stringify(phoneData()));
  const store = new DashboardStore(storage);
  await store.connect("p:u", db);
  assert.equal(store.getSnapshot().guestReviewNeeded, true);
  assert.equal(store.getSnapshot().phase, "choice");
  assert.equal(db.writes.length, 0);
  assert.deepEqual(
    store.getRecoverySources().find((s) => s.id === "guest").data,
    phoneData(),
  );
  assert.ok(store.useCloud());
  const resumed = new DashboardStore(storage);
  await resumed.connect("p:u", db);
  assert.equal(resumed.getSnapshot().guestReviewNeeded, false);
  assert.equal(resumed.getSnapshot().phase, "saved");
  assert.deepEqual(
    resumed.getRecoverySources().find((s) => s.id === "guest").data,
    phoneData(),
  );
});
test("failed recovery persistence rolls back visible state and retains the original phone and current account copies", async () => {
  const storage = memory(phoneData()),
    db = server(),
    store = new DashboardStore(storage);
  await store.connect("p:u", db);
  store.useCloud();
  const source = store.getRecoverySources().find((s) => s.id === "guest"),
    before = clone(store.getSnapshot().data),
    put = storage.setItem;
  let attempts = 0;
  storage.setItem = (key, value) => {
    if (key === accountStorageKey("p:u") && ++attempts === 2)
      throw new Error("QuotaExceeded");
    put(key, value);
  };
  assert.throws(
    () => store.stageRecovery(source.id, source.raw),
    /기기에 저장하지 못/,
  );
  assert.deepEqual(store.getSnapshot().data, before);
  assert.equal(store.getSnapshot().recoveryDraft, false);
  assert.ok(store.getSnapshot().storageError);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), phoneData());
  assert.deepEqual(
    JSON.parse(storage.getItem(accountStorageKey("p:u"))).data,
    before,
  );
  assert.equal(db.writes.length, 0);
});
test("stale source references and unrelated account caches cannot be restored or exposed by the recovery picker", async () => {
  const storage = memory(phoneData()),
    db = server(),
    store = new DashboardStore(storage);
  await store.connect("p:u", db);
  store.useCloud();
  const source = store.getRecoverySources().find((s) => s.id === "guest"),
    before = clone(store.getSnapshot().data);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      addTodo(phoneData(), {
        id: "later-guest",
        title: "브라우저의 다른 탭에서 추가한 기록",
      }),
    ),
  );
  assert.throws(
    () => store.stageRecovery(source.id, source.raw),
    /내용이 바뀌었/,
  );
  assert.deepEqual(store.getSnapshot().data, before);
  storage.setItem(
    accountStorageKey("other:user"),
    JSON.stringify({ data: { private: "do not expose" } }),
  );
  assert.ok(
    store.getRecoverySources().every((s) => !s.raw.includes("do not expose")),
  );
  assert.throws(
    () => store.stageRecovery("other:user", "anything"),
    /읽지 못했/,
  );
  assert.equal(db.writes.length, 0);
});
test("malformed guest JSON is downloadable verbatim for recovery but cannot replace validated account data", async () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY, "original broken JSON {");
  const sources = recoverySources(storage, []);
  assert.equal(sources[0].raw, "original broken JSON {");
  assert.equal(sources[0].data, null);
  assert.ok(sources[0].error);
  const store = new DashboardStore(storage),
    db = server();
  await store.connect("p:u", db);
  assert.throws(
    () => store.stageRecovery("guest", "original broken JSON {"),
    /읽지 못했/,
  );
  assert.equal(storage.getItem(STORAGE_KEY), "original broken JSON {");
  assert.equal(db.writes.length, 0);
});
test("preview dates use recorded activity, not planned goals/events or cancelled activity; raw source inspection does not change storage", () => {
  let data = phoneData();
  const base = data.logs[0];
  data.logs.push({
    ...base,
    id: "cancelled-later",
    date: "2026-11-30",
    voided: true,
  });
  data.goals[0].targetDate = "2030-01-01";
  const storage = memory(data),
    before = storage.getItem(STORAGE_KEY);
  const source = recoverySources(storage, [])[0],
    summary = recoverySummary(source.data);
  assert.equal(summary.latestActivityDate, "2026-10-31");
  assert.equal(summary.recentLogs[0].id, "phone-review");
  assert.equal(summary.todos, 1);
  assert.equal(summary.logs, data.logs.length - 1);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});
