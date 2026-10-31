import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { restoreData } from "./storage.ts";
import type { CloudRepository, CloudSnapshot } from "./sync.ts";
import { captureUntrackedDocument } from "./syncMerge.ts";

export type CloudConfig = { url: string; key: string };
export const CLOUD_CONFIG_KEY = "personal-study-dashboard:cloud-config";
export function configError(config: CloudConfig) {
  try {
    const url = new URL(config.url);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".supabase.co") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return "Supabase의 Project URL(https://…supabase.co)을 입력해 주세요.";
  } catch {
    return "올바른 Project URL을 입력해 주세요.";
  }
  if (config.key.startsWith("sb_secret_"))
    return "서버 비밀 키는 입력하지 마세요. Publishable key를 사용해 주세요.";
  if (config.key.startsWith("sb_publishable_") && config.key.length > 25)
    return "";
  try {
    const payload = JSON.parse(
      atob(config.key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role === "anon") return "";
  } catch {
    /* Only the public publishable/anon key belongs in a browser. */
  }
  return "Supabase의 Publishable key 또는 기존 anon public key를 입력해 주세요.";
}
export function loadCloudConfig(
  env: CloudConfig,
  storage: Pick<Storage, "getItem">,
): CloudConfig | null {
  const saved = storage.getItem(CLOUD_CONFIG_KEY);
  const value = saved ? JSON.parse(saved) : env;
  return typeof value?.url === "string" &&
    typeof value?.key === "string" &&
    !configError(value)
    ? value
    : null;
}
export function makeCloudClient(config: CloudConfig) {
  return createClient(config.url, config.key, {
    auth: {
      storageKey: `study-dashboard-auth:${new URL(config.url).hostname}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
function snapshot(row: {
  payload: unknown;
  revision: number;
  updated_at: string;
}): CloudSnapshot {
  if (
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.updated_at))
  )
    throw new Error("Invalid cloud snapshot");
  return {
    data: restoreData(
      captureUntrackedDocument(
        restoreData(row.payload),
        "legacy:server-write",
        Date.parse(row.updated_at),
      ),
    ),
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}
async function requestWithin<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
export function cloudRepository(client: SupabaseClient): CloudRepository {
  return {
    async revision() {
      const { data, error } = await requestWithin((signal) =>
        client
          .from("dashboard_snapshots")
          .select("revision")
          .abortSignal(signal)
          .maybeSingle()
          .retry(false),
      );
      if (error) throw new Error("온라인 변경을 확인하지 못했습니다.");
      if (data && (!Number.isSafeInteger(data.revision) || data.revision < 1))
        throw new Error("Invalid cloud revision");
      return data?.revision ?? 0;
    },
    async read() {
      const { data, error } = await requestWithin((signal) =>
        client
          .from("dashboard_snapshots")
          .select("payload, revision, updated_at")
          .abortSignal(signal)
          .maybeSingle()
          .retry(false),
      );
      if (error) throw new Error("온라인 기록을 읽지 못했습니다.");
      return data ? snapshot(data) : null;
    },
    async write(data, expectedRevision) {
      const { data: saved, error } = await requestWithin((signal) =>
        client
          .rpc("save_dashboard", {
            expected_revision: expectedRevision,
            document: data,
          })
          .abortSignal(signal)
          .retry(false),
      );
      if (error)
        throw new Error(
          error.message.includes("DASHBOARD_CONFLICT")
            ? "DASHBOARD_CONFLICT"
            : "온라인 기록을 저장하지 못했습니다.",
        );
      if (!Array.isArray(saved) || saved.length !== 1)
        throw new Error("Invalid cloud response");
      return snapshot(saved[0]);
    },
  };
}
