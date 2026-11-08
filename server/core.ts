import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { configError } from "../src/cloud.ts";

export class ConnectError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export type ConnectConfig = {
  origin: string;
  resource: string;
  url: string;
  key: string;
  secret: Buffer;
};
export function readConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConnectConfig {
  const origin =
    env.DASHBOARD_CHAT_ORIGIN?.replace(/\/$/, "") ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(
      /\/$/,
      "",
    ),
    key =
      env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ConnectError("CONNECT_ORIGIN_REQUIRED", 503);
  }
  if (
    (parsed.protocol !== "https:" &&
      !(
        env.NODE_ENV !== "production" &&
        parsed.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(parsed.hostname)
      )) ||
    parsed.origin !== origin
  )
    throw new ConnectError("CONNECT_ORIGIN_REQUIRED", 503);
  if (configError({ url, key }))
    throw new ConnectError("CONNECT_SUPABASE_CONFIG_REQUIRED", 503);
  const raw = env.DASHBOARD_CHAT_SECRET ?? "",
    secret = /^[a-f0-9]{64}$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64url");
  if (secret.length !== 32 || raw.length < 43)
    throw new ConnectError("CONNECT_SECRET_REQUIRED", 503);
  return { origin, resource: origin + "/api/dashboard", url, key, secret };
}
export function backend(
  config: ConnectConfig,
  accessToken?: string,
): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const seconds = () => Math.floor(Date.now() / 1000);
export type Envelope = {
  kind: "session" | "preview";
  exp: number;
  sub: string;
  connection: string;
  [key: string]: unknown;
};
export function seal(config: ConnectConfig, payload: Envelope): string {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", config.secret, iv);
  cipher.setAAD(Buffer.from(config.resource));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ ...payload, aud: config.resource }), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function unseal(
  config: ConnectConfig,
  token: unknown,
  kind: Envelope["kind"],
): Envelope {
  try {
    if (typeof token !== "string" || token.length > 50000) throw new Error();
    const [version, nonce, ciphertext, tag, ...extra] = token.split(".");
    if (version !== "v1" || extra.length) throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      config.secret,
      Buffer.from(nonce, "base64url"),
    );
    decipher.setAAD(Buffer.from(config.resource));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const value = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      value.kind !== kind ||
      value.aud !== config.resource ||
      !Number.isSafeInteger(value.exp) ||
      value.exp <= seconds() ||
      typeof value.sub !== "string" ||
      typeof value.connection !== "string"
    )
      throw new Error();
    return value;
  } catch {
    throw new ConnectError("invalid_token", 401);
  }
}
export async function rpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client
    .rpc(name, args)
    .abortSignal(AbortSignal.timeout(15000));
  if (error)
    throw new ConnectError(
      error.code === "PGRST202" || error.code === "42P01"
        ? "CONNECT_DATABASE_SETUP_REQUIRED"
        : "CONNECT_DATABASE_ERROR",
      503,
    );
  return data as T;
}
export async function verifySupabase(config: ConnectConfig, token: unknown) {
  if (typeof token !== "string" || token.length > 20000)
    throw new ConnectError("invalid_token", 401);
  const api = backend(config, token),
    { data, error } = await api.auth.getUser(token);
  if (error || !data.user)
    throw new ConnectError(
      transientAuth(error) ? "CONNECT_AUTH_UNAVAILABLE" : "invalid_token",
      transientAuth(error) ? 503 : 401,
    );
  return { api, user: data.user };
}
function transientAuth(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  return (
    value.name === "AuthRetryableFetchError" ||
    value.name === "TypeError" ||
    value.status === 0 ||
    value.status === 429 ||
    (typeof value.status === "number" && value.status >= 500)
  );
}
export async function createConnection(
  config: ConnectConfig,
  currentToken: string,
  password: unknown,
  label: unknown,
) {
  const { user } = await verifySupabase(config, currentToken);
  if (
    typeof password !== "string" ||
    !password ||
    password.length > 1024 ||
    !user.email
  )
    throw new ConnectError("REAUTHENTICATION_REQUIRED", 401);
  if (typeof label !== "string" || !label.trim() || label.length > 80)
    throw new ConnectError("INVALID_LABEL");
  // Separate sign-in: renewing this connection never rotates the PC/iPad session.
  const login = backend(config),
    { data, error } = await login.auth.signInWithPassword({
      email: user.email,
      password,
    });
  if (error || !data.session || data.user?.id !== user.id)
    throw new ConnectError("REAUTHENTICATION_FAILED", 401);
  const token = "pstudy_" + randomBytes(32).toString("base64url"),
    id = randomUUID(),
    session = data.session;
  const sealed = seal(config, {
    kind: "session",
    exp: seconds() + 365 * 86400,
    sub: user.id,
    connection: id,
    backend_token: session.access_token,
    backend_refresh: session.refresh_token,
    backend_exp: session.expires_at,
  });
  try {
    await rpc(
      backend(config, session.access_token),
      "create_dashboard_chat_connection",
      { connection: id, label: label.trim(), digest: digest(token), sealed },
    );
  } catch (e) {
    await login.auth.signOut({ scope: "local" }).catch(() => {});
    throw e;
  }
  return {
    token,
    connection_id: id,
    api_url: config.origin,
    expires_in_days: 365,
  };
}
type ConnectionRow = {
  id: string;
  user_id: string;
  sealed_session: string;
  revision: number;
  expires_at: string;
};
export async function authenticate(config: ConnectConfig, token: unknown) {
  if (typeof token !== "string" || !/^pstudy_[A-Za-z0-9_-]{43}$/.test(token))
    throw new ConnectError("invalid_token", 401);
  const hash = digest(token);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await rpc<ConnectionRow | null>(
      backend(config),
      "resolve_dashboard_chat_connection",
      { digest: hash },
    );
    if (!row || Date.parse(row.expires_at) <= Date.now())
      throw new ConnectError("invalid_token", 401);
    const session = unseal(config, row.sealed_session, "session");
    if (session.sub !== row.user_id || session.connection !== row.id)
      throw new ConnectError("invalid_token", 401);
    if (Number(session.backend_exp) > seconds() + 60) {
      try {
        const verified = await verifySupabase(config, session.backend_token);
        if (verified.user.id !== row.user_id)
          throw new ConnectError("invalid_token", 401);
        return { ...verified, connection: row.id };
      } catch (e) {
        if (!(e instanceof ConnectError) || e.status !== 401) throw e;
      }
    }
    if (typeof session.backend_refresh !== "string")
      throw new ConnectError("CONNECTION_SIGN_IN_REQUIRED", 401);
    const { data, error } = await backend(config).auth.refreshSession({
      refresh_token: session.backend_refresh,
    });
    if (error || !data.session || data.user?.id !== row.user_id)
      throw new ConnectError(
        transientAuth(error)
          ? "CONNECT_AUTH_UNAVAILABLE"
          : "CONNECTION_SIGN_IN_REQUIRED",
        transientAuth(error) ? 503 : 401,
      );
    const next = data.session,
      sealed = seal(config, {
        ...session,
        kind: "session",
        backend_token: next.access_token,
        backend_refresh: next.refresh_token,
        backend_exp: next.expires_at,
      });
    await rpc<boolean>(backend(config), "refresh_dashboard_chat_connection", {
      digest: hash,
      expected_revision: row.revision,
      sealed,
    });
    // Read back the winning encrypted session after a concurrent refresh/CAS race.
  }
  throw new ConnectError("CONNECT_AUTH_UNAVAILABLE", 503);
}
