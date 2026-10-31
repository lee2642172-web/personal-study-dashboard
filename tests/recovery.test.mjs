import test from "node:test";
import assert from "node:assert/strict";
import { DashboardStore, accountStorageKey } from "../src/sync.ts";
import { recoverySources, recoverySummary } from "../src/recovery.ts";
import { createInitialData } from "../src/initialData.ts";
import { STORAGE_KEY } from "../src/storage.ts";
import { addTodo, deleteTodo } from "../src/todos.ts";
import { recordDayReview } from "../src/dayLearning.ts";
import { recordEbsLearning } from "../src/ebs.ts";
import { studySummary, dashboardTimeEntries } from "../src/dashboard.ts";
import { plainData } from "../src/syncMerge.ts";
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
      if (version !== current.revision) throw new Error("DASHBOARD_CONFLICT");
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
      title: "휴대폰 최신 기록",
    }),
    "vocabulary",
    1,
    25,
    "phone-review",
    "2026-10-31",
    12,
  );
}
function pcData() {
  return recordEbsLearning(
    addTodo(createInitialData(), { id: "pc-only", title: "PC 별도 기록" }),
    "ebs-0",
    "2026-04-08",
    "2026-10-31",
    "pc-listen",
  );
}
function legacyCache(storage, data, cloud, recoveryDraft = false) {
  storage.setItem(
    accountStorageKey("p:u"),
    JSON.stringify({
      data,
      base: cloud,
      revision: 1,
      lastSyncedAt: "2026-10-30T00:00:00Z",
      backups: [
        {
          data: phoneData(),
          label: "온라인 기록을 불러오기 전 이 기기 기록",
          at: "2026-10-31T00:00:00Z",
        },
      ],
      ...(recoveryDraft ? { recoveryDraft: true } : {}),
    }),
  );
}

test("the already-recovered phone draft upgrades into automatic sync and combines both phone and PC records without a publishing step", async () => {
  const phone = phoneData(),
    pc = pcData(),
    storage = memory(phone),
    db = server(pc);
  legacyCache(storage, phone, pc, true);
  const store = new DashboardStore(storage);
  await store.connect("p:u", db);
  assert.equal(store.getSnapshot().phase, "saved");
  assert.deepEqual(
    new Set(store.getSnapshot().data.todos.map((t) => t.id)),
    new Set(["phone-latest", "pc-only"]),
  );
  assert.equal(
    studySummary(dashboardTimeEntries(store.getSnapshot().data), "2026-10-31")
      .today,
    30,
  );
  assert.equal(db.writes.length, 1);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), phone);
  const sources = store.getRecoverySources();
  assert.ok(
    sources.some(
      (s) =>
        s.label === "자동 병합 전 이 기기 기록" &&
        s.data.logs.some((l) => l.id === "phone-review"),
    ),
  );
  assert.ok(
    sources.some(
      (s) =>
        s.label === "자동 병합 전 온라인 기록" &&
        s.data.logs.some((l) => l.id === "pc-listen"),
    ),
  );
  const reopened = new DashboardStore(storage);
  await reopened.connect("p:u", db);
  assert.equal(reopened.getSnapshot().phase, "saved");
  assert.equal(
    studySummary(
      dashboardTimeEntries(reopened.getSnapshot().data),
      "2026-10-31",
    ).today,
    30,
  );
  assert.equal(db.writes.length, 1);
});
test("an older account cache and old reviewed flag cannot hide unsynced guest records; automatic import happens once", async () => {
  const phone = phoneData(),
    pc = pcData(),
    storage = memory(phone),
    db = server(pc);
  legacyCache(storage, pc, pc);
  storage.setItem(
    `${accountStorageKey("p:u")}:guest-reviewed`,
    JSON.stringify(phone),
  );
  const store = new DashboardStore(storage);
  await store.connect("p:u", db);
  assert.ok(store.getSnapshot().data.logs.some((l) => l.id === "phone-review"));
  assert.ok(store.getSnapshot().data.logs.some((l) => l.id === "pc-listen"));
  const count = db.writes.length;
  await store.sync();
  assert.equal(db.writes.length, count);
});
test("adding a historical source automatically syncs missing records while modern delete tombstones keep cancelled records deleted", async () => {
  const storage = memory(),
    db = server(),
    store = new DashboardStore(storage);
  await store.connect("p:u", db);
  store.update((d) => addTodo(d, { id: "deleted", title: "delete" }));
  await store.sync();
  store.update((d) => deleteTodo(d, "deleted"));
  await store.sync();
  const legacy = addTodo(phoneData(), { id: "deleted", title: "old copy" });
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
  const source = store.getRecoverySources().find((s) => s.id === "guest");
  store.stageRecovery(source.id, source.raw);
  assert.equal(store.getSnapshot().phase, "pending");
  await store.sync();
  assert.equal(store.getSnapshot().phase, "saved");
  assert.ok(store.getSnapshot().data.logs.some((l) => l.id === "phone-review"));
  assert.ok(!store.getSnapshot().data.todos.some((t) => t.id === "deleted"));
});
test("failed migration backup or merge persistence never uploads a partial replacement or overwrites the restored phone original", async () => {
  const phone = phoneData(),
    pc = pcData(),
    storage = memory(phone),
    db = server(pc);
  legacyCache(storage, phone, pc, true);
  const store = new DashboardStore(storage),
    put = storage.setItem;
  storage.setItem = (key, value) => {
    if (key.endsWith(":before-automatic-sync"))
      throw new Error("QuotaExceeded");
    put(key, value);
  };
  await store.connect("p:u", db);
  assert.ok(store.getSnapshot().storageError);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(plainData(store.getSnapshot().data), phone);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), phone);
});
test("stale references and foreign account originals are not merged through the recovery picker", async () => {
  const storage = memory(phoneData()),
    db = server(),
    store = new DashboardStore(storage);
  await store.connect("p:u", db);
  const source = store.getRecoverySources().find((s) => s.id === "guest"),
    before = clone(store.getSnapshot().data);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      addTodo(phoneData(), { id: "changed", title: "another tab" }),
    ),
  );
  assert.throws(
    () => store.stageRecovery(source.id, source.raw),
    /내용이 바뀌었/,
  );
  assert.deepEqual(store.getSnapshot().data, before);
  store.disconnect();
  await store.connect("other:user", server());
  assert.ok(!store.getRecoverySources().some((s) => s.id === "guest"));
  assert.throws(() => store.stageRecovery("p:u", "anything"), /읽지 못했/);
});
test("malformed original JSON remains downloadable verbatim and does not overwrite a valid account document", () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY, "original broken JSON {");
  const source = recoverySources(storage, [])[0];
  assert.equal(source.raw, "original broken JSON {");
  assert.equal(source.data, null);
  assert.ok(source.error);
  assert.equal(storage.getItem(STORAGE_KEY), "original broken JSON {");
});
test("preview dates reflect actual records, excluding cancelled activity and future goal dates", () => {
  const data = phoneData(),
    base = data.logs[0];
  data.logs.push({
    ...base,
    id: "cancelled-later",
    date: "2026-11-30",
    voided: true,
  });
  data.goals[0].targetDate = "2030-01-01";
  const storage = memory(data),
    raw = storage.getItem(STORAGE_KEY),
    summary = recoverySummary(recoverySources(storage, [])[0].data);
  assert.equal(summary.latestActivityDate, "2026-10-31");
  assert.equal(summary.recentLogs[0].id, "phone-review");
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
