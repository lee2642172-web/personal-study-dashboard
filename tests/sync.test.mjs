import test from "node:test";
import assert from "node:assert/strict";
import { DashboardStore, accountStorageKey } from "../src/sync.ts";
import { createInitialData } from "../src/initialData.ts";
import { STORAGE_KEY } from "../src/storage.ts";
import { addTodo, completeTodo, undoTodo, deleteTodo } from "../src/todos.ts";
import { recordDayReview, cancelDayReview } from "../src/dayLearning.ts";
import { equalData, plainData } from "../src/syncMerge.ts";
import { configError, loadCloudConfig } from "../src/cloud.ts";
const clone = structuredClone;
const add = (id) => (d) => addTodo(d, { id, title: id });
function memory(initial = createInitialData()) {
  const map = new Map([[STORAGE_KEY, JSON.stringify(initial)]]);
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
function server(initial = null) {
  let current = initial
    ? { data: clone(initial), revision: 1, updatedAt: "2026-10-31T00:00:00Z" }
    : null;
  const writes = [];
  let reads = 0,
    heads = 0;
  return {
    writes,
    get current() {
      return clone(current);
    },
    get reads() {
      return reads;
    },
    get heads() {
      return heads;
    },
    read: async () => {
      reads++;
      return clone(current);
    },
    revision: async () => {
      heads++;
      return current?.revision ?? 0;
    },
    async write(data, version) {
      if ((current?.revision ?? 0) !== version)
        throw new Error("DASHBOARD_CONFLICT");
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
const data = (s) => s.getSnapshot().data;
const ids = (s) => new Set((data(s).todos ?? []).map((t) => t.id));

test("first login automatically merges existing local and online records without a snapshot-choice step", async () => {
  const local = add("phone")(createInitialData()),
    storage = memory(local),
    db = server(add("pc")(createInitialData())),
    store = new DashboardStore(storage);
  await store.connect("project:me", db);
  assert.equal(store.getSnapshot().phase, "saved");
  assert.deepEqual(ids(store), new Set(["phone", "pc"]));
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), local);
  assert.ok(
    store
      .getRecoverySources()
      .some(
        (s) =>
          s.label === "자동 병합 전 이 기기 기록" &&
          s.data.todos.some((t) => t.id === "phone"),
      ),
  );
});
test("PC, iPad and Android concurrent changes converge automatically after revision races", async () => {
  const db = server(),
    devices = [
      new DashboardStore(memory()),
      new DashboardStore(memory()),
      new DashboardStore(memory()),
    ];
  for (const s of devices) await s.connect("p:u", db);
  devices.forEach((s, i) => s.update(add(`device-${i}`)));
  await Promise.all(devices.map((s) => s.sync()));
  for (const s of devices) await s.sync();
  for (const s of devices) {
    assert.equal(s.getSnapshot().phase, "saved");
    assert.deepEqual(ids(s), new Set(["device-0", "device-1", "device-2"]));
    assert.ok(equalData(data(s), db.current.data));
  }
  const count = db.writes.length;
  await Promise.all(devices.map((s) => s.sync()));
  assert.equal(db.writes.length, count);
});
test("offline drafts survive reload and reconnect while another device adds independent records", async () => {
  const db = server(),
    storage = memory(),
    a = new DashboardStore(storage),
    b = new DashboardStore(memory());
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  await a.connect("p:u", {
    read: async () => {
      throw new Error("offline");
    },
    write: db.write,
  });
  a.update(add("offline-phone"));
  await a.sync();
  assert.equal(a.getSnapshot().phase, "offline");
  b.update(add("online-pc"));
  await b.sync();
  const reopened = new DashboardStore(storage);
  await reopened.connect("p:u", db);
  await b.sync();
  assert.deepEqual(ids(reopened), new Set(["offline-phone", "online-pc"]));
  assert.ok(equalData(data(reopened), data(b)));
});
test("deletion and completion cancellation propagate without stale replicas resurrecting history or duplicating time", async () => {
  const db = server(),
    a = new DashboardStore(memory()),
    b = new DashboardStore(memory());
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update(add("book"));
  await a.sync();
  await b.sync();
  a.update((d) => completeTodo(d, "book", "2026-10-31", 15));
  await a.sync();
  await b.sync();
  a.update((d) => undoTodo(d, "book"));
  b.update(add("unrelated"));
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  assert.equal(data(b).todos.find((t) => t.id === "book").completion, null);
  a.update((d) => deleteTodo(d, "book"));
  b.update((d) => ({
    ...d,
    todos: d.todos.map((t) =>
      t.id === "book" ? { ...t, note: "stale edit" } : t,
    ),
  }));
  await Promise.all([a.sync(), b.sync()]);
  await a.sync();
  await b.sync();
  assert.ok(!ids(a).has("book"));
  assert.ok(!ids(b).has("book"));
  assert.ok(ids(a).has("unrelated"));
});
test("edits made during an in-flight upload remain pending and are automatically sent without loss", async () => {
  const db = server(),
    store = new DashboardStore(memory());
  await store.connect("p:u", db);
  let release, entered;
  const gate = new Promise((r) => (release = r)),
    started = new Promise((r) => (entered = r));
  let first = true;
  await store.connect("p:u", {
    read: db.read,
    revision: db.revision,
    async write(d, v) {
      if (first) {
        first = false;
        entered();
        await gate;
      }
      return db.write(d, v);
    },
  });
  store.update(add("first"));
  const saving = store.sync();
  await started;
  store.update(add("second"));
  release();
  await saving;
  assert.deepEqual(ids(store), new Set(["first", "second"]));
  assert.equal(store.getSnapshot().phase, "saved");
  assert.ok(equalData(data(store), db.current.data));
});
test("an update racing between read and write is retried and merged without requiring user intervention", async () => {
  const db = server(),
    store = new DashboardStore(memory());
  await store.connect("p:u", db);
  let once = true;
  await store.connect("p:u", {
    read: db.read,
    revision: db.revision,
    async write(d, v) {
      if (once) {
        once = false;
        const competitor = new DashboardStore(memory());
        await competitor.connect("p:u", db);
        competitor.update(add("other-device"));
        await competitor.sync();
      }
      return db.write(d, v);
    },
  });
  store.update(add("my-device"));
  await store.sync();
  assert.equal(store.getSnapshot().phase, "saved");
  assert.deepEqual(ids(store), new Set(["my-device", "other-device"]));
});
test("quiet polling uses only the revision probe and does not repeatedly transfer or write full documents", async () => {
  const db = server(),
    store = new DashboardStore(memory());
  await store.connect("p:u", db);
  const reads = db.reads,
    writes = db.writes.length;
  await store.sync();
  await store.sync();
  assert.equal(db.reads, reads);
  assert.equal(db.writes.length, writes);
  assert.ok(db.heads >= 2);
});
test("new logged-out edits from the same owner automatically import once, including explicit deletions", async () => {
  const db = server(),
    storage = memory(),
    store = new DashboardStore(storage);
  await store.connect("p:u", db);
  store.disconnect();
  store.update(add("guest-task"));
  await store.connect("p:u", db);
  assert.ok(ids(store).has("guest-task"));
  store.disconnect();
  store.update((d) => deleteTodo(d, "guest-task"));
  await store.connect("p:u", db);
  assert.ok(!ids(store).has("guest-task"));
  const count = db.writes.length;
  await store.sync();
  assert.equal(db.writes.length, count);
});
test("account/project switches isolate drafts and never auto-upload another account owned guest data", async () => {
  const storage = memory(add("private-a")(createInitialData())),
    a = new DashboardStore(storage),
    dbA = server(),
    dbB = server();
  await a.connect("project:a", dbA);
  a.update(add("a-edit"));
  await a.sync();
  a.disconnect();
  await a.connect("project:b", dbB);
  assert.ok(!ids(a).has("private-a"));
  assert.ok(!ids(a).has("a-edit"));
  a.disconnect();
  await a.connect("project:a", dbA);
  assert.ok(ids(a).has("private-a"));
  assert.ok(ids(a).has("a-edit"));
});
test("late network responses after logout cannot replace the guest screen or a different account cache", async () => {
  const storage = memory(add("guest")(createInitialData())),
    store = new DashboardStore(storage);
  let release;
  const delayed = new Promise((r) => (release = r));
  const connecting = store.connect("p:u", {
    read: () => delayed,
    write: async () => {
      throw new Error("Must not write after logout");
    },
  });
  store.disconnect();
  release({
    data: add("private")(createInitialData()),
    revision: 1,
    updatedAt: "2026-10-31",
  });
  await connecting;
  assert.equal(store.getSnapshot().phase, "local");
  assert.ok(ids(store).has("guest"));
  assert.ok(!ids(store).has("private"));
});
test("same-browser storage changes and sequential tab edits preserve the union of pending changes", async () => {
  const db = server(),
    storage = memory(),
    a = new DashboardStore(storage),
    b = new DashboardStore(storage);
  await a.connect("p:u", db);
  await b.connect("p:u", db);
  a.update(add("tab-a"));
  b.update(add("tab-b"));
  a.onStorageChanged(accountStorageKey("p:u"));
  await a.sync();
  await b.sync();
  assert.deepEqual(ids(a), new Set(["tab-a", "tab-b"]));
  assert.deepEqual(ids(b), ids(a));
});
test("corrupt caches, full storage and uncertain network saves never erase originals or report a false successful upload", async () => {
  const storage = memory();
  storage.map.set(STORAGE_KEY, "broken-original");
  const store = new DashboardStore(storage);
  store.update(add("temporary"));
  assert.equal(storage.getItem(STORAGE_KEY), "broken-original");
  assert.ok(store.getSnapshot().storageError);
  storage.map.set(accountStorageKey("p:u"), "broken-account");
  const db = server();
  await store.connect("p:u", db);
  assert.equal(store.getSnapshot().phase, "error");
  assert.equal(storage.getItem(accountStorageKey("p:u")), "broken-account");
  assert.equal(db.current, null);
  const full = memory(add("preserve")(createInitialData())),
    s = new DashboardStore(full);
  full.setItem = () => {
    throw new Error("QuotaExceeded");
  };
  await s.connect("p:u", db);
  assert.equal(db.current, null);
  assert.ok(s.getSnapshot().storageError);
  assert.ok(ids(s).has("preserve"));
});
test("public client configuration still rejects private keys and foreign endpoints", () => {
  const config = {
    url: "https://study-test.supabase.co",
    key: "sb_publishable_12345678901234567890",
  };
  assert.equal(configError(config), "");
  assert.deepEqual(loadCloudConfig(config, { getItem: () => null }), config);
  for (const patch of [
    { key: "sb_secret_123" },
    { url: "http://study-test.supabase.co" },
    { url: "https://supabase.co.attacker.test" },
    { url: "https://study-test.supabase.co/other" },
  ])
    assert.ok(configError({ ...config, ...patch }));
  const key = (role) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.equal(configError({ ...config, key: key("anon") }), "");
  assert.ok(configError({ ...config, key: key("service_role") }));
});
