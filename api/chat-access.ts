import type { ApiRequest, ApiResponse } from "../server/http.ts";
import {
  backend,
  ConnectError,
  createConnection,
  readConfig,
  rpc,
  verifySupabase,
} from "../server/core.ts";
import { bearer, body, json, originAllowed } from "../server/http.ts";
export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const config = readConfig();
    originAllowed(req, config);
    if (
      req.method === "GET" &&
      !new URL(req.url ?? "/", config.origin).searchParams.has("connections")
    ) {
      let databaseReady = false;
      try {
        await rpc(backend(config), "resolve_dashboard_chat_connection", {
          digest: "0".repeat(64),
        });
        databaseReady = true;
      } catch {}
      return json(res, 200, {
        serverReady: true,
        databaseReady,
        apiUrl: config.origin,
      });
    }
    const token = bearer(req);
    if (req.method === "GET") {
      const { api } = await verifySupabase(config, token);
      const { data, error } = await api
        .from("dashboard_chat_connections")
        .select("id,label,created_at,expires_at,revoked_at")
        .order("created_at", { ascending: false })
        .abortSignal(AbortSignal.timeout(15000));
      if (error) throw new ConnectError("CONNECT_DATABASE_SETUP_REQUIRED", 503);
      return json(res, 200, { connections: data });
    }
    if (req.method !== "POST" && req.method !== "DELETE") {
      res.setHeader("Allow", "GET, POST, DELETE");
      return json(res, 405, { error: "method_not_allowed" });
    }
    if (req.headers.origin !== config.origin)
      throw new ConnectError("invalid_origin", 403);
    const input = await body(req);
    if (req.method === "POST")
      return json(
        res,
        201,
        await createConnection(config, token, input.password, input.label),
      );
    const { api } = await verifySupabase(config, token);
    if (typeof input.id !== "string" || !/^[a-f0-9-]{36}$/i.test(input.id))
      throw new ConnectError("INVALID_CONNECTION_ID");
    await rpc(api, "revoke_dashboard_chat_connection", {
      connection: input.id,
    });
    return json(res, 200, { revoked: true });
  } catch (e) {
    const error =
      e instanceof ConnectError
        ? e
        : new ConnectError("CONNECT_REQUEST_FAILED", 503);
    return json(res, error.status, { error: error.code });
  }
}
