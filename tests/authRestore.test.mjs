import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthRestorer,
  authStorageKey,
  cachedAuthUser,
  loginPreferenceKey,
  readLoginPreference,
  rememberLogin,
} from "../src/authRestore.ts";

const user = { id: "test-user", email: "study@example.com" };
const url = "https://study-test.supabase.co";
const tick = () => new Promise((resolve) => queueMicrotask(resolve));

test("opening the app restores the saved session without a login request", async () => {
  const views = [];
  const auth = new AuthRestorer(
    async () => ({ user, error: null }),
    (v) => views.push(v),
    user,
  );
  await auth.start();
  assert.equal(views[0].mode, "checking");
  assert.equal(views[0].user, user);
  assert.deepEqual(auth.getSnapshot(), { user, mode: "ready", error: "" });
});
test("temporary refresh failure and null initial event retain the cached account and recover automatically", async () => {
  let offline = true,
    calls = 0;
  const auth = new AuthRestorer(
    async () => {
      calls++;
      return offline
        ? {
            user: null,
            error: { name: "AuthRetryableFetchError", status: 503 },
          }
        : { user, error: null };
    },
    () => {},
    user,
  );
  await auth.start();
  auth.event("INITIAL_SESSION", null);
  await tick();
  await auth.restore();
  assert.equal(auth.getSnapshot().mode, "retrying");
  assert.equal(auth.getSnapshot().user, user);
  offline = false;
  await auth.restore();
  assert.equal(auth.getSnapshot().mode, "ready");
  assert.ok(calls >= 2);
});
test("revoked or invalid refresh tokens cannot be treated as authenticated", async () => {
  const auth = new AuthRestorer(
    async () => ({
      user: null,
      error: { status: 400, code: "refresh_token_not_found" },
    }),
    () => {},
    user,
  );
  await auth.start();
  assert.equal(auth.getSnapshot().mode, "signedOut");
  assert.equal(auth.getSnapshot().user, null);
});
test("explicit sign-out cannot be reversed by an older in-flight session restore", async () => {
  let finish;
  const auth = new AuthRestorer(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {},
    user,
  );
  const pending = auth.start();
  assert.equal(auth.restore(), pending);
  auth.event("SIGNED_OUT", null);
  await tick();
  finish({ user, error: null });
  await pending;
  assert.equal(auth.getSnapshot().mode, "signedOut");
  assert.equal(auth.getSnapshot().user, null);
});
test("a new sign-in takes precedence over stale initial session results", async () => {
  let finish;
  const next = { id: "next-user", email: "next@example.com" };
  const auth = new AuthRestorer(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {},
    null,
  );
  const pending = auth.start();
  auth.event("SIGNED_IN", next);
  await tick();
  finish({ user: null, error: null });
  await pending;
  assert.equal(auth.getSnapshot().user, next);
  assert.equal(auth.getSnapshot().mode, "ready");
});
test("unmounted restorers ignore pending responses and auth events", async () => {
  let finish,
    changes = 0;
  const auth = new AuthRestorer(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {
      changes++;
    },
    null,
  );
  const pending = auth.start();
  auth.dispose();
  auth.event("SIGNED_IN", user);
  finish({ user, error: null });
  await pending;
  await tick();
  assert.equal(changes, 1);
});
test("browser network exceptions preserve the account for a later retry", async () => {
  const auth = new AuthRestorer(
    async () => {
      throw new TypeError("Failed to fetch");
    },
    () => {},
    user,
  );
  await auth.start();
  assert.equal(auth.getSnapshot().mode, "retrying");
  assert.equal(auth.getSnapshot().user, user);
  assert.doesNotMatch(auth.getSnapshot().error, /Failed to fetch/);
});
test("login preferences store only email and method, scoped to the project", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  rememberLogin(url, " study@example.com ", "password", storage);
  assert.deepEqual(JSON.parse(values.get(loginPreferenceKey(url))), {
    email: user.email,
    method: "password",
  });
  assert.deepEqual(readLoginPreference(url, storage), {
    email: user.email,
    method: "password",
  });
  assert.equal(readLoginPreference("https://other.supabase.co", storage), null);
  values.set(loginPreferenceKey(url), "invalid-json");
  assert.equal(readLoginPreference(url, storage), null);
  values.set(
    loginPreferenceKey(url),
    JSON.stringify({ email: user.email, method: "token" }),
  );
  assert.equal(readLoginPreference(url, storage), null);
});
test("malformed or inaccessible storage does not break login, and cached identity is not a session", () => {
  const denied = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(cachedAuthUser(url, denied), null);
  assert.equal(readLoginPreference(url, denied), null);
  assert.doesNotThrow(() => rememberLogin(url, user.email, "password", denied));
  assert.equal(cachedAuthUser(url, { getItem: () => "{}" }), null);
  const session = {
    user,
    access_token: "not-valid",
    refresh_token: "stored-refresh",
  };
  const identity = cachedAuthUser(url, {
    getItem: (key) =>
      key === authStorageKey(url) ? JSON.stringify(session) : null,
  });
  assert.deepEqual(identity, user);
  assert.equal(identity.access_token, undefined);
  assert.equal(identity.refresh_token, undefined);
});
