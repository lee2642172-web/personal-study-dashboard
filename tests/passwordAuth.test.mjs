import test from "node:test";
import assert from "node:assert/strict";
import {
  passwordInputError,
  passwordAuthError,
  loginWithPassword,
  setAccountPassword,
} from "../src/passwordAuth.ts";

test("password creation validates length, whitespace and confirmation before contacting Auth", async () => {
  assert.ok(passwordInputError("short", "short"));
  assert.ok(passwordInputError("        ", "        "));
  assert.ok(passwordInputError("StrongExample1!", "OtherExample1!"));
  assert.equal(passwordInputError("StrongExample1!", "StrongExample1!"), "");
  let calls = 0;
  const client = {
    auth: {
      async updateUser() {
        calls++;
        return { error: null };
      },
    },
  };
  await assert.rejects(
    () => setAccountPassword(client, "StrongExample1!", "OtherExample1!"),
    /일치하지/,
  );
  assert.equal(calls, 0);
});
test("a logged-in account gains a password through updateUser without replacing its email or creating another account", async () => {
  const calls = [];
  const client = {
    auth: {
      async updateUser(payload) {
        calls.push(payload);
        return { error: null };
      },
    },
  };
  await setAccountPassword(client, "StrongExample1!", "StrongExample1!");
  assert.deepEqual(calls, [{ password: "StrongExample1!" }]);
});
test("password login uses the same trimmed email and exact password, without requesting email or signup", async () => {
  const calls = [];
  const client = {
    auth: {
      async signInWithPassword(payload) {
        calls.push(payload);
        return { error: null };
      },
      async signInWithOtp() {
        throw new Error("Must not request email");
      },
      async signUp() {
        throw new Error("Must not create another account");
      },
    },
  };
  await loginWithPassword(client, " study@example.com ", "  ExactExample1!  ");
  assert.deepEqual(calls, [
    { email: "study@example.com", password: "  ExactExample1!  " },
  ]);
});
test("invalid credentials, verification and recent-session requirements give safe actionable errors", () => {
  assert.match(
    passwordAuthError({ code: "invalid_credentials" }).message,
    /먼저 비밀번호/,
  );
  assert.match(
    passwordAuthError({ code: "email_not_confirmed" }).message,
    /이메일 확인/,
  );
  assert.match(
    passwordAuthError({ code: "reauthentication_needed" }, true).message,
    /최근 로그인/,
  );
  assert.match(
    passwordAuthError({ code: "weak_password" }, true).message,
    /더 강한/,
  );
  assert.match(
    passwordAuthError({ code: "same_password" }, true).message,
    /현재 비밀번호/,
  );
  assert.match(passwordAuthError({ status: 429 }).message, /일시적으로 제한/);
});
test("Auth failure responses and network exceptions cannot be reported as a successful password operation", async () => {
  await assert.rejects(
    () =>
      loginWithPassword(
        {
          auth: {
            async signInWithPassword() {
              return {
                error: {
                  code: "invalid_credentials",
                  message: "secret-password",
                },
              };
            },
          },
        },
        "study@example.com",
        "secret-password",
      ),
    (error) =>
      /invalid_credentials/.test(error.message) &&
      !error.message.includes("secret-password"),
  );
  await assert.rejects(
    () =>
      setAccountPassword(
        {
          auth: {
            async updateUser() {
              throw new TypeError("private request details");
            },
          },
        },
        "StrongExample1!",
        "StrongExample1!",
      ),
    (error) =>
      /인터넷 연결/.test(error.message) && !error.message.includes("private"),
  );
});
test("provider errors never echo passwords, user email, token or untrusted code text", () => {
  const error = passwordAuthError(
    {
      code: "unexpected_failure",
      message: "private@example.com password=Secret! token=abc",
    },
    true,
  );
  assert.doesNotMatch(error.message, /private@|Secret|token=/);
  assert.doesNotMatch(
    passwordAuthError({ code: "<script>secret</script>", message: "private" })
      .message,
    /script|secret|private/,
  );
});
