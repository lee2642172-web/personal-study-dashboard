import type { IncomingMessage, ServerResponse } from "node:http";
export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiResponse = ServerResponse;
import { ConnectError, type ConnectConfig } from "./core.ts";
export function json(res: ApiResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(value));
}
export function bearer(req: ApiRequest) {
  const value = req.headers.authorization;
  return typeof value === "string" && value.startsWith("Bearer ")
    ? value.slice(7)
    : "";
}
export function originAllowed(req: ApiRequest, config: ConnectConfig) {
  const origin = req.headers.origin;
  if (origin && origin !== config.origin)
    throw new ConnectError("invalid_origin", 403);
}
export async function body(req: ApiRequest): Promise<Record<string, unknown>> {
  let value = req.body;
  if (value === undefined) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const b = Buffer.from(chunk);
      size += b.length;
      if (size > 262144) throw new ConnectError("request_too_large", 413);
      chunks.push(b);
    }
    value = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") {
    if (value.length > 262144) throw new ConnectError("request_too_large", 413);
    try {
      value = req.headers["content-type"]?.startsWith(
        "application/x-www-form-urlencoded",
      )
        ? Object.fromEntries(new URLSearchParams(value))
        : JSON.parse(value);
    } catch {
      throw new ConnectError("invalid_request");
    }
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(value).length > 262144
  )
    throw new ConnectError("invalid_request");
  return value as Record<string, unknown>;
}
