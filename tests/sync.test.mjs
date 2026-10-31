import test from "node:test";
import assert from "node:assert/strict";
import { DashboardStore, accountStorageKey } from "../src/sync.ts";
import { addTodo } from "../src/todos.ts";
import { createInitialData } from "../src/initialData.ts";
import { STORAGE_KEY } from "../src/storage.ts";
import { configError, loadCloudConfig } from "../src/cloud.ts";
const clone = structuredClone;
function memory(initial = createInitialData()) {
  const map = new Map([[STORAGE_KEY, JSON.stringify(initial)]]);
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
const localData = (store) => store.getSnapshot().data;
const add = (id) => (d) => addTodo(d, { id, title: id });
function server(initial = null) {
  let current = initial
    ? { data: clone(initial), revision: 1, updatedAt: "2026-10-31T01:00:00Z" }
    : null;
  const writes = [];
  return {
    writes,
    get current() {
      return clone(current);
    },
    read: async () => clone(current),
    async write(data, revision) {
      if ((current?.revision ?? 0) !== revision)
        throw new Error("DASHBOARD_CONFLICT");
      writes.push(clone(data));
      current = {
        data: clone(data),
        revision: revision + 1,
        updatedAt: "2026-10-31T02:00:00Z",
      };
      return clone(current);
    },
  };
}

test("first connection never silently uploads or replaces existing local/cloud records; explicit cloud choice backs up the local copy", async () => {
  const initial = add("local-book")(createInitialData()),
    db = server(add("cloud-book")(createInitialData())),
    storage = memory(initial),
    store = new DashboardStore(storage);
  await store.connect("project:me", db);
  assert.equal(store.getSnapshot().phase, "choice");
  assert.equal(db.writes.length, 0);
  assert.deepEqual(localData(store), initial);
  store.useCloud();
  assert.equal(store.getSnapshot().phase, "saved");
  assert.deepEqual(localData(store), db.current.data);
  assert.deepEqual(store.getSnapshot().backups[0].data, initial);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), initial);
});
test("new online account explicitly uploads the full existing document and a second device reads it without inventing data", async () => {
  const initial = add("buy-book")(createInitialData()),
    a = new DashboardStore(memory(initial)),
    b = new DashboardStore(memory()),
    db = server();
  await a.connect("project:me", db);
  assert.equal(db.current, null);
  await a.useLocal();
  assert.equal(db.writes.length, 1);
  assert.deepEqual(db.current.data, initial);
  await b.connect("project:me", db);
  assert.equal(b.getSnapshot().phase, "choice");
  b.useCloud();
  assert.deepEqual(localData(b), initial);
  a.update(add("exam-registration"));
  await a.sync();
  await b.sync();
  assert.deepEqual(localData(b), localData(a));
  assert.equal(db.current.revision, 2);
});
test("two divergent devices stop on a conflict, retain both drafts, and preserve original local data and explicit choice backup", async () => {
  const db = server(),
    a = new DashboardStore(memory()),
    storageB = memory(),
    b = new DashboardStore(storageB);
  await a.connect("project:me", db);
  await a.useLocal();
  await b.connect("project:me", db);
  a.update(add("PC"));
  b.update(add("iPad"));
  await a.sync();
  await b.sync();
  assert.equal(b.getSnapshot().phase, "conflict");
  assert.ok(localData(b).todos.some((t) => t.id === "iPad"));
  assert.ok(db.current.data.todos.some((t) => t.id === "PC"));
  assert.equal(db.writes.length, 2);
  const reload = new DashboardStore(storageB);
  await reload.connect("project:me", db);
  assert.equal(reload.getSnapshot().phase, "conflict");
  const draft = clone(localData(reload));
  reload.useCloud();
  assert.deepEqual(localData(reload), db.current.data);
  assert.deepEqual(reload.getSnapshot().backups[0].data, draft);
});
test("explicitly choosing this device backs up the online version and replaces via checked revision", async () => {
  const storage = memory(add("local")(createInitialData())),
    db = server(add("online")(createInitialData())),
    store = new DashboardStore(storage),
    before = db.current.data;
  await store.connect("project:me", db);
  await store.useLocal();
  assert.ok(db.current.data.todos.some((t) => t.id === "local"));
  assert.ok(!db.current.data.todos.some((t) => t.id === "online"));
  assert.equal(db.current.revision, 2);
  assert.ok(
    store
      .getSnapshot()
      .backups.some((b) => JSON.stringify(b.data) === JSON.stringify(before)),
  );
});
test("offline edits survive reload, sync after reconnect, and do not upload the untouched guest document", async () => {
  const db = server(),
    storage = memory(),
    store = new DashboardStore(storage);
  await store.connect("project:me", db);
  await store.useLocal();
  const offline = {
    read: async () => {
      throw new Error("offline");
    },
    write: db.write,
  };
  await store.connect("project:me", offline);
  store.update(add("offline-work"));
  await store.sync();
  assert.equal(store.getSnapshot().phase, "offline");
  const restored = new DashboardStore(storage);
  await restored.connect("project:me", db);
  assert.ok(db.current.data.todos.some((t) => t.id === "offline-work"));
  assert.equal(restored.getSnapshot().phase, "saved");
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).todos?.length ?? 0, 0);
});
test("edits made while an upload is in flight remain pending and are sent in the next version", async () => {
  const db = server(),
    store = new DashboardStore(memory());
  await store.connect("project:me", db);
  await store.useLocal();
  let release, entered;
  const gate = new Promise((r) => (release = r)),
    started = new Promise((r) => (entered = r));
  await store.connect("project:me", {
    read: db.read,
    async write(d, v) {
      entered();
      await gate;
      return db.write(d, v);
    },
  });
  store.update(add("first"));
  const saving = store.sync();
  await started;
  store.update(add("second"));
  release();
  await saving;
  assert.equal(store.getSnapshot().phase, "pending");
  assert.ok(!db.current.data.todos.some((t) => t.id === "second"));
  await store.sync();
  assert.ok(db.current.data.todos.some((t) => t.id === "second"));
  assert.equal(store.getSnapshot().phase, "saved");
});
test("server revision conflict between read and write cannot silently overwrite a newer device snapshot", async () => {
  const db = server(),
    store = new DashboardStore(memory());
  await store.connect("project:me", db);
  await store.useLocal();
  const race = {
    read: db.read,
    async write(d, v) {
      await db.write(add("other-device")(db.current.data), v);
      return db.write(d, v);
    },
  };
  await store.connect("project:me", race);
  store.update(add("my-draft"));
  await store.sync();
  assert.equal(store.getSnapshot().phase, "conflict");
  assert.ok(
    store.getSnapshot().remote.data.todos.some((t) => t.id === "other-device"),
  );
  assert.ok(localData(store).todos.some((t) => t.id === "my-draft"));
  assert.ok(!db.current.data.todos.some((t) => t.id === "my-draft"));
});
test("logout and account/project switches keep account caches isolated and ignore delayed responses", async () => {
  const storage = memory(add("guest")(createInitialData())),
    store = new DashboardStore(storage),
    db = server(add("account-a")(createInitialData()));
  await store.connect("one:a", db);
  store.useCloud();
  store.update(add("unsent"));
  store.disconnect();
  assert.ok(localData(store).todos.some((t) => t.id === "guest"));
  assert.ok(!localData(store).todos.some((t) => t.id === "account-a"));
  await store.connect("two:a", server());
  assert.ok(!localData(store).todos.some((t) => t.id === "unsent"));
  store.disconnect();
  let release;
  const delayed = new Promise((r) => (release = r));
  const connecting = store.connect("one:b", {
    read: () => delayed,
    write: db.write,
  });
  store.disconnect();
  release(db.current);
  await connecting;
  assert.equal(store.getSnapshot().phase, "local");
  assert.ok(localData(store).todos.some((t) => t.id === "guest"));
  await store.connect("one:a", db);
  assert.ok(localData(store).todos.some((t) => t.id === "unsent"));
  storage.map.set(accountStorageKey("one:broken"), "broken-account");
  await store.connect("one:broken", server());
  assert.equal(store.getSnapshot().phase, "error");
  assert.ok(!localData(store).todos.some((t) => t.id === "account-a"));
});
test("record deletions, time edits and cancellations travel as the full validated document without resurrecting removed records", async () => {
  const db = server(),
    a = new DashboardStore(memory()),
    b = new DashboardStore(memory());
  await a.connect("p:u", db);
  await a.useLocal();
  await b.connect("p:u", db);
  const removed = localData(a).logs[0].id;
  a.update((d) => ({
    ...d,
    logs: d.logs
      .filter((l) => l.id !== removed)
      .map((l, i) => (i === 0 ? { ...l, date: "2026-10-31", minutes: 7 } : l)),
  }));
  await a.sync();
  await b.sync();
  assert.deepEqual(localData(b), localData(a));
  assert.ok(!localData(b).logs.some((l) => l.id === removed));
  assert.equal(localData(b).logs[0].minutes, 7);
});
test("corrupt guest/account caches and full local storage are preserved and never overwrite cloud data", async () => {
  const storage = memory();
  storage.map.set(STORAGE_KEY, "broken");
  const store = new DashboardStore(storage);
  store.update(add("temporary"));
  assert.equal(storage.getItem(STORAGE_KEY), "broken");
  assert.ok(store.getSnapshot().storageError);
  storage.map.set(accountStorageKey("p:u"), "broken-account");
  const db = server();
  await store.connect("p:u", db);
  assert.equal(store.getSnapshot().phase, "error");
  assert.equal(storage.getItem(accountStorageKey("p:u")), "broken-account");
  await store.useLocal();
  assert.equal(db.current, null);
  const full = memory(),
    a = new DashboardStore(full);
  await a.connect("p:u", db);
  full.setItem = () => {
    throw new Error("QuotaExceeded");
  };
  await a.useLocal();
  assert.equal(db.current, null);
  assert.ok(a.getSnapshot().storageError);
});
test("public client configuration rejects secret keys and foreign URLs", () => {
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
