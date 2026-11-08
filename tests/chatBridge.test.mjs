import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import accessHandler from "../api/chat-access.ts";
import dashboardHandler from "../api/dashboard.ts";
import { createInitialData } from "../src/initialData.ts";
import { digest, readConfig, seal, unseal, seconds } from "../server/core.ts";

const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const publishable = "sb_publishable_test_12345678901234567890";
const json = (value) =>
  JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
const response = (value, status = 200) =>
  new Response(json(value), {
    status,
    headers: {
      "content-type": "application/json",
      "x-supabase-api-version": "2024-01-01",
    },
  });

test("authenticated full-dashboard bridge, actual SQL permissions and CLI workflow", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${A}'),('${B}');`,
  );
  await db.exec(
    await readFile(new URL("../supabase/setup.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    await readFile(new URL("../supabase/codex.sql", import.meta.url), "utf8"),
  );
  const seedA = createInitialData(),
    seedB = createInitialData();
  seedB.goals[0].target = "B-private";
  await db.query(
    "insert into public.dashboard_snapshots(user_id,payload) values($1,$2),($3,$4)",
    [A, json(seedA), B, json(seedB)],
  );
  const users = new Map([
      [`browser-${A}`, A],
      [`browser-${B}`, B],
    ]),
    refreshes = new Map();
  let sequence = 0,
    refreshCalls = 0,
    logoutCalls = 0;
  const user = (id) => ({
    id,
    aud: "authenticated",
    role: "authenticated",
    email: id === A ? "a@example.test" : "b@example.test",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  });
  function session(id) {
    const n = ++sequence,
      exp = seconds() + 3600;
    const access = [
      Buffer.from('{"alg":"HS256"}').toString("base64url"),
      Buffer.from(json({ sub: id, exp })).toString("base64url"),
      "test-signature-" + n,
    ].join(".");
    const refresh = "private-refresh-" + id + "-" + n;
    users.set(access, id);
    refreshes.set(refresh, id);
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: "bearer",
      expires_at: exp,
      expires_in: 3600,
      user: user(id),
    };
  }
  async function query(id, sql, args = []) {
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${id ? "authenticated" : "anon"}`);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id ?? "",
      ]);
      return tx.query(sql, args);
    });
  }
  const functions = {
    create_dashboard_chat_connection: [
      "connection",
      "label",
      "digest",
      "sealed",
    ],
    resolve_dashboard_chat_connection: ["digest"],
    refresh_dashboard_chat_connection: [
      "digest",
      "expected_revision",
      "sealed",
    ],
    revoke_dashboard_chat_connection: ["connection"],
    save_dashboard: ["expected_revision", "document"],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === "string" ? input : (input.url ?? String(input)),
    );
    if (url.hostname !== "bridge-test.supabase.co")
      return realFetch(input, init);
    const headers = new Headers(init.headers),
      id = users.get(
        (headers.get("authorization") ?? "").replace(/^Bearer /, ""),
      );
    const payload = init.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === "/auth/v1/user")
      return id
        ? response(user(id))
        : response({ code: "bad_jwt", msg: "Invalid token" }, 401);
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "password") {
        if (payload.password !== "QA-only-password!")
          return response(
            { code: "invalid_credentials", msg: "Invalid login credentials" },
            400,
          );
        return response(session(payload.email === "a@example.test" ? A : B));
      }
      refreshCalls++;
      const owner = refreshes.get(payload.refresh_token);
      if (!owner)
        return response(
          { code: "refresh_token_not_found", msg: "Invalid refresh" },
          400,
        );
      return response(session(owner));
    }
    if (url.pathname === "/auth/v1/logout") {
      logoutCalls++;
      return response({});
    }
    try {
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").at(-1),
          keys = functions[name];
        assert.ok(keys, `RPC ${name}`);
        const args = keys.map((k) =>
          k === "document" ? json(payload[k]) : payload[k],
        );
        const params = keys.map(
          (_k, i) => "$" + (i + 1) + (keys[i] === "document" ? "::jsonb" : ""),
        );
        const result = await query(
          id,
          `select ${name === "save_dashboard" ? "*" : `public.${name}(${params.join(",")}) as value`} ${name === "save_dashboard" ? `from public.save_dashboard(${params.join(",")})` : ""}`,
          args,
        );
        return response(
          name === "save_dashboard"
            ? result.rows
            : (result.rows[0]?.value ?? null),
        );
      }
      if (url.pathname === "/rest/v1/dashboard_snapshots")
        return response(
          (
            await query(
              id,
              "select payload,revision,updated_at from public.dashboard_snapshots",
            )
          ).rows,
        );
      if (url.pathname === "/rest/v1/dashboard_chat_connections")
        return response(
          (
            await query(
              id,
              "select id,user_id,label,created_at,expires_at,revoked_at from public.dashboard_chat_connections",
            )
          ).rows,
        );
      throw new Error("Unexpected API path");
    } catch (e) {
      return response({ code: e.code ?? "P0001", message: e.message }, 400);
    }
  };
  const original = { ...process.env };
  let server;
  try {
    server = createServer((req, res) => {
      const handler =
        new URL(req.url, "http://local").pathname === "/api/chat-access"
          ? accessHandler
          : dashboardHandler;
      void handler(req, res);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    process.env.NODE_ENV = "test";
    process.env.DASHBOARD_CHAT_ORIGIN = origin;
    process.env.DASHBOARD_CHAT_SECRET = "31".repeat(32);
    process.env.SUPABASE_URL = "https://bridge-test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = publishable;
    const config = readConfig();
    async function call(
      path,
      token,
      body,
      method = body ? "POST" : "GET",
      browser = false,
    ) {
      const res = await realFetch(origin + path, {
        method,
        headers: {
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : { "x-test-no-auth": "1" }),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(browser ? { Origin: origin } : {}),
        },
        ...(body ? { body: json(body) } : {}),
      });
      return { status: res.status, value: await res.json() };
    }
    let keyA, keyB, connectionA, preview;
    const operations = [
      {
        op: "ebs_listen",
        id: "requested-history",
        sessions: [
          { contentDate: "2026-04-14", learnedDate: "2026-11-02" },
          { contentDate: "2026-04-15", learnedDate: "2026-11-03" },
          { contentDate: "2026-04-16", learnedDate: "2026-11-04" },
        ],
      },
    ];
    await t.test(
      "setup detection, same-origin authenticated creation and no browser session rotation",
      async () => {
        assert.equal(
          (await call("/api/chat-access")).value.databaseReady,
          true,
        );
        assert.equal(
          (
            await call(
              "/api/chat-access",
              `browser-${A}`,
              { password: "QA-only-password!", label: "A" },
              "POST",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              "/api/chat-access",
              "invalid",
              { password: "QA-only-password!", label: "A" },
              "POST",
              true,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await call(
              "/api/chat-access",
              `browser-${A}`,
              { password: "wrong", label: "A" },
              "POST",
              true,
            )
          ).status,
          401,
        );
        const created = await call(
          "/api/chat-access",
          `browser-${A}`,
          { password: "QA-only-password!", label: "A" },
          "POST",
          true,
        );
        assert.equal(created.status, 201);
        keyA = created.value.token;
        connectionA = created.value.connection_id;
        keyB = (
          await call(
            "/api/chat-access",
            `browser-${B}`,
            { password: "QA-only-password!", label: "B" },
            "POST",
            true,
          )
        ).value.token;
        assert.match(keyA, /^pstudy_[\w-]{43}$/);
        assert.equal(logoutCalls, 0);
        assert.equal(refreshCalls, 0);
        const row = (
          await db.query(
            "select * from public.dashboard_chat_connections where id=$1",
            [connectionA],
          )
        ).rows[0];
        assert.equal(row.token_hash, digest(keyA));
        assert.ok(!json(row).includes(keyA));
        assert.ok(!row.sealed_session.includes("private-refresh"));
        assert.equal(unseal(config, row.sealed_session, "session").sub, A);
        assert.throws(() =>
          unseal(
            { ...config, resource: "https://different.example/api/dashboard" },
            row.sealed_session,
            "session",
          ),
        );
        assert.throws(() => unseal(config, row.sealed_session, "preview"));
        await assert.rejects(() =>
          query(
            null,
            "select sealed_session from public.dashboard_chat_connections",
          ),
        );
        await assert.rejects(() =>
          query(
            A,
            "select sealed_session from public.dashboard_chat_connections",
          ),
        );
        assert.equal(
          (await query(A, "select id from public.dashboard_chat_connections"))
            .rows.length,
          1,
        );
      },
    );
    await t.test(
      "read is owner-scoped; preview/apply records the requested nine sessions once",
      async () => {
        assert.equal(
          (await call("/api/dashboard", `browser-${A}`)).status,
          401,
        );
        const read = await call("/api/dashboard", keyA);
        assert.equal(read.status, 200);
        assert.equal(read.value.account.id, A);
        assert.equal(read.value.data.goals[0].target, "AL");
        assert.equal(
          (await call("/api/dashboard", keyB)).value.data.goals[0].target,
          "B-private",
        );
        const p = await call("/api/dashboard", keyA, {
          action: "preview",
          expected_revision: read.value.revision,
          operations,
        });
        assert.equal(p.status, 200);
        preview = p.value;
        assert.deepEqual(preview.summary, { added: 9, updated: 0, deleted: 0 });
        assert.equal(
          (await call("/api/dashboard", keyA)).value.revision,
          read.value.revision,
        );
        assert.equal(
          (
            await call("/api/dashboard", keyB, {
              action: "apply",
              preview_token: preview.preview_token,
              operations,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await call("/api/dashboard", keyA, {
              action: "apply",
              preview_token: preview.preview_token,
              operations: [
                { op: "delete", collection: "goals", entityId: "opic" },
              ],
            })
          ).status,
          403,
        );
        const saved = await call("/api/dashboard", keyA, {
          action: "apply",
          preview_token: preview.preview_token,
          operations,
        });
        assert.equal(saved.status, 200);
        assert.equal(saved.value.saved, true);
        const retry = await call("/api/dashboard", keyA, {
          action: "apply",
          preview_token: preview.preview_token,
          operations,
        });
        assert.equal(retry.value.wrote, false);
        assert.equal(retry.value.revision, saved.value.revision);
        const after = await call("/api/dashboard", keyA);
        assert.equal(after.value.data.logs.length, seedA.logs.length + 9);
        assert.equal(after.value.summary.month, 162);
        assert.equal(
          (await call("/api/dashboard", keyB)).value.data.logs.length,
          seedB.logs.length,
        );
      },
    );
    await t.test(
      "all entity operations, concurrent revisions, schema rejection and full-data preservation",
      async () => {
        let read = await call("/api/dashboard", keyA);
        const ops = [
          {
            op: "set",
            collection: "goals",
            entityId: "opic",
            path: ["current"],
            value: "IH",
          },
          {
            op: "append",
            collection: "todos",
            value: {
              id: "new-task",
              title: "교재 구매",
              dueDate: "",
              note: "",
              completion: { date: "2026-11-05", minutes: 7 },
            },
          },
        ];
        const p = await call("/api/dashboard", keyA, {
          action: "preview",
          expected_revision: read.value.revision,
          operations: ops,
        });
        assert.equal(p.status, 200);
        const serverRow = (
          await db.query(
            "select payload,revision from public.dashboard_snapshots where user_id=$1",
            [A],
          )
        ).rows[0];
        serverRow.payload.goals[1].current = "PC edit";
        await db.query(
          "update public.dashboard_snapshots set payload=$2,revision=revision+1 where user_id=$1",
          [A, json(serverRow.payload)],
        );
        assert.equal(
          (
            await call("/api/dashboard", keyA, {
              action: "apply",
              preview_token: p.value.preview_token,
              operations: ops,
            })
          ).status,
          409,
        );
        read = await call("/api/dashboard", keyA);
        const fresh = await call("/api/dashboard", keyA, {
          action: "preview",
          expected_revision: read.value.revision,
          operations: ops,
        });
        assert.equal(
          (
            await call("/api/dashboard", keyA, {
              action: "apply",
              preview_token: fresh.value.preview_token,
              operations: ops,
            })
          ).status,
          200,
        );
        const after = await call("/api/dashboard", keyA);
        assert.equal(after.value.data.goals[0].current, "IH");
        assert.equal(after.value.data.goals[1].current, "PC edit");
        assert.equal(after.value.summary.month, 169);
        assert.equal(
          (
            await call("/api/dashboard", keyA, {
              action: "preview",
              expected_revision: after.value.revision,
              operations: [
                {
                  op: "set",
                  collection: "goals",
                  entityId: "opic",
                  path: ["status"],
                  value: "invalid",
                },
              ],
            })
          ).status,
          400,
        );
        const expired = seal(config, {
          kind: "preview",
          exp: seconds() - 1,
          sub: A,
          connection: connectionA,
          revision: after.value.revision,
          operations_hash: digest(json(ops)),
        });
        assert.equal(
          (
            await call("/api/dashboard", keyA, {
              action: "apply",
              preview_token: expired,
              operations: ops,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "the inherited-environment CLI reads, previews and writes without leaking credentials in output or argv",
      async () => {
        const dir = await mkdtemp(join(tmpdir(), "dashboard-chat-test-"));
        async function cli(args) {
          const child = spawn(
            process.execPath,
            ["scripts/dashboard-chat.mjs", ...args],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                NO_PROXY: [process.env.NO_PROXY, "localhost", "127.0.0.1"]
                  .filter(Boolean)
                  .join(","),
                no_proxy: [process.env.no_proxy, "localhost", "127.0.0.1"]
                  .filter(Boolean)
                  .join(","),
                DASHBOARD_CHAT_URL: origin,
                DASHBOARD_CHAT_TOKEN: keyA,
              },
            },
          );
          let stdout = "",
            stderr = "";
          child.stdout.on("data", (c) => (stdout += c));
          child.stderr.on("data", (c) => (stderr += c));
          const code = await new Promise((resolve) =>
            child.on("close", resolve),
          );
          assert.equal(code, 0, stderr);
          assert.ok(!stdout.includes(keyA) && !stderr.includes(keyA));
          return JSON.parse(stdout);
        }
        try {
          await cli(["read", "--out", join(dir, "current.json")]);
          const current = JSON.parse(
            await readFile(join(dir, "current.json"), "utf8"),
          );
          assert.equal(
            (await stat(join(dir, "current.json"))).mode & 0o777,
            0o600,
          );
          await writeFile(
            join(dir, "ops.json"),
            json({
              expected_revision: current.revision,
              operations: [
                {
                  op: "set",
                  collection: "todos",
                  entityId: "new-task",
                  path: ["note"],
                  value:
                    'quotes " and newline\nremain literal $(not-a-command)',
                },
              ],
            }),
          );
          await cli([
            "preview",
            "--file",
            join(dir, "ops.json"),
            "--out",
            join(dir, "preview.json"),
          ]);
          assert.equal(
            (
              await cli([
                "apply",
                "--file",
                join(dir, "ops.json"),
                "--preview",
                join(dir, "preview.json"),
              ])
            ).saved,
            true,
          );
          assert.match(
            (await call("/api/dashboard", keyA)).value.data.todos[0].note,
            /\$\(not-a-command\)/,
          );
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      },
    );
    await t.test(
      "session renewal uses CAS and revocation immediately disables the connection",
      async () => {
        const row = (
            await db.query(
              "select sealed_session,revision from public.dashboard_chat_connections where id=$1",
              [connectionA],
            )
          ).rows[0],
          session = unseal(config, row.sealed_session, "session");
        await db.query(
          "update public.dashboard_chat_connections set sealed_session=$2 where id=$1",
          [
            connectionA,
            seal(config, {
              ...session,
              kind: "session",
              backend_exp: seconds() - 1,
            }),
          ],
        );
        assert.equal((await call("/api/dashboard", keyA)).status, 200);
        assert.equal(refreshCalls, 1);
        const newest = (
          await db.query(
            "select revision from public.dashboard_chat_connections where id=$1",
            [connectionA],
          )
        ).rows[0];
        assert.equal(Number(newest.revision), Number(row.revision) + 1);
        await query(B, "select public.revoke_dashboard_chat_connection($1)", [
          connectionA,
        ]);
        assert.equal((await call("/api/dashboard", keyA)).status, 200);
        assert.equal(
          (
            await call(
              "/api/chat-access",
              `browser-${A}`,
              { id: connectionA },
              "DELETE",
              true,
            )
          ).status,
          200,
        );
        assert.equal((await call("/api/dashboard", keyA)).status, 401);
        assert.equal((await call("/api/dashboard", keyB)).status, 200);
        assert.equal(logoutCalls, 0);
      },
    );
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env))
      if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
