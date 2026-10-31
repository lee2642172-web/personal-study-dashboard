import type { DashboardData } from "./model.ts";
import { createInitialData } from "./initialData.ts";
import { restoreData, STORAGE_KEY } from "./storage.ts";
import { recoverySources } from "./recovery.ts";
import {
  plainData,
  equalData,
  legacyDocument,
  changeDocument,
  mergeDocuments,
  importLegacy,
  applyDelta,
  renderDocument,
} from "./syncMerge.ts";

export type CloudSnapshot = {
  data: DashboardData;
  revision: number;
  updatedAt: string;
};
export interface CloudRepository {
  read(): Promise<CloudSnapshot | null>;
  write(data: DashboardData, expectedRevision: number): Promise<CloudSnapshot>;
  revision?(): Promise<number>;
}
export type SyncPhase =
  "local" | "checking" | "pending" | "saving" | "saved" | "offline" | "error";
export const syncLabels: Record<SyncPhase, string> = {
  local: "온라인 저장 연결하기",
  checking: "온라인 기록 연결 중",
  pending: "동기화 대기",
  saving: "자동 동기화 중",
  saved: "온라인 저장 완료",
  offline: "연결 끊김 · 기기에 임시 저장",
  error: "동기화 확인 필요",
};
type Backup = { data: DashboardData; at: string; label: string };
type Cache = {
  data: DashboardData;
  base: DashboardData | null;
  revision: number;
  lastSyncedAt: string;
  backups: Backup[];
  recoveryDraft?: boolean;
  autoSyncVersion?: 1;
};
export type SyncView = {
  data: DashboardData;
  storageError: string;
  phase: SyncPhase;
  message: string;
  remote: CloudSnapshot | null;
  lastSyncedAt: string;
  backups: Backup[];
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export const accountStorageKey = (account: string) =>
  `${STORAGE_KEY}:account:${account}`;
const OWNER_KEY = `${STORAGE_KEY}:guest-owner`;
const DEVICE_KEY = `${STORAGE_KEY}:device-id`;

/** Changes merge by record/field identity; the SQL revision only serializes commits.
 * Local checkpoints and tombstones survive offline editing and stale devices. */
export class DashboardStore {
  private listeners = new Set<() => void>();
  private cache: Cache | null = null;
  private remote: CloudRepository | null = null;
  private key = STORAGE_KEY;
  private epoch = 0;
  private busyEpoch: number | null = null;
  private queued = false;
  private protectedStorage = false;
  private view: SyncView;
  private storage: Storage;
  private actor: string;
  constructor(storage: Storage) {
    this.storage = storage;
    this.view = this.guest();
    this.actor = `device:${globalThis.crypto.randomUUID()}`;
    try {
      const known = storage.getItem(DEVICE_KEY);
      if (known) this.actor = known;
      else storage.setItem(DEVICE_KEY, this.actor);
    } catch {
      /* Changes retain their embedded unique actor even without a durable device ID. */
    }
    this.persist();
  }
  private guest(): SyncView {
    let data = createInitialData(),
      storageError = "";
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) data = restoreData(JSON.parse(raw));
      this.protectedStorage = false;
    } catch {
      this.protectedStorage = true;
      storageError =
        "기존 저장 데이터를 읽지 못했습니다. 원본은 덮어쓰지 않습니다. JSON 백업으로 보관해 주세요.";
    }
    return {
      data,
      storageError,
      phase: "local",
      message: "",
      remote: null,
      lastSyncedAt: "",
      backups: [],
    };
  }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<SyncView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private persist() {
    if (this.protectedStorage) return false;
    try {
      this.storage.setItem(
        this.key,
        JSON.stringify(this.cache ?? this.view.data),
      );
      if (this.view.storageError) this.emit({ storageError: "" });
      return true;
    } catch {
      this.emit({
        storageError:
          "기기에 저장하지 못했습니다. 현재 기록을 JSON 백업으로 보관하고 저장 공간을 확인해 주세요.",
      });
      return false;
    }
  }
  private peerData() {
    if (!this.cache) return;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return;
      const saved = JSON.parse(raw) as Cache;
      if (!saved.data?.syncState || !this.cache.data.syncState) return;
      const peer = restoreData(saved.data),
        data = restoreData(mergeDocuments(this.cache.data, peer));
      if (equalData(data, this.cache.data)) return;
      this.cache = {
        ...this.cache,
        data,
        ...(saved.revision > this.cache.revision
          ? {
              base: saved.base ? restoreData(saved.base) : null,
              revision: saved.revision,
            }
          : {}),
      };
      this.emit({ data, phase: "pending" });
    } catch {
      /* A malformed other tab cannot replace this tab's validated draft. */
    }
  }
  update = (fn: (data: DashboardData) => DashboardData) => {
    this.peerData();
    const before = this.view.data,
      next = fn(before);
    if (next === before) return;
    const data = restoreData(changeDocument(before, next, this.actor));
    if (this.cache) this.cache = { ...this.cache, data };
    this.emit({ data, ...(this.remote ? { phase: "pending" as const } : {}) });
    this.persist();
  };
  async connect(account: string, remote: CloudRepository) {
    ++this.epoch;
    this.remote = remote;
    this.key = accountStorageKey(account);
    this.cache = null;
    this.view = { ...this.guest(), phase: "checking" };
    this.emit({});
    this.protectedStorage = false;
    try {
      const raw = this.storage.getItem(this.key),
        saved = raw ? JSON.parse(raw) : null;
      if (
        saved &&
        (!Number.isSafeInteger(saved.revision) ||
          saved.revision < 0 ||
          !Array.isArray(saved.backups))
      )
        throw new Error("Invalid cache");
      const owner = this.storage.getItem(OWNER_KEY),
        canImportGuest = !owner || owner === this.key;
      this.cache = saved
        ? {
            data: restoreData(saved.data),
            base: saved.base === null ? null : restoreData(saved.base),
            revision: saved.revision,
            lastSyncedAt:
              typeof saved.lastSyncedAt === "string" ? saved.lastSyncedAt : "",
            backups: saved.backups.map((b: Backup) => ({
              ...b,
              data: restoreData(b.data),
            })),
            ...(saved.recoveryDraft === true ? { recoveryDraft: true } : {}),
            ...(saved.autoSyncVersion === 1
              ? { autoSyncVersion: 1 as const }
              : {}),
          }
        : {
            data: canImportGuest ? this.view.data : createInitialData(),
            base: null,
            revision: 0,
            lastSyncedAt: "",
            backups: [],
          };
      this.emit({
        data: this.cache.data,
        storageError: "",
        phase: "checking",
        message: "",
        remote: null,
        lastSyncedAt: this.cache.lastSyncedAt,
        backups: this.cache.backups,
      });
      if (!this.persist()) return;
      await this.sync();
    } catch {
      this.protectedStorage = true;
      this.emit({
        phase: "error",
        storageError:
          "이 계정의 기기 저장 데이터를 읽지 못했습니다. 원본을 보존하고 동기화를 중단했습니다.",
      });
    }
  }
  disconnect = () => {
    ++this.epoch;
    this.remote = null;
    this.cache = null;
    this.key = STORAGE_KEY;
    this.view = this.guest();
    this.emit({});
  };
  private dirty() {
    return !!this.cache && !equalData(this.cache.data, this.cache.base);
  }
  private writeLocal(key: string, raw: string) {
    try {
      this.storage.setItem(key, raw);
    } catch {
      this.emit({
        storageError:
          "기기 저장 공간이 부족하거나 접근이 차단되어 동기화를 멈췄습니다. 현재 기록을 JSON으로 보관해 주세요.",
      });
      throw new Error("LOCAL_WRITE_FAILED");
    }
  }
  private pinMigration(
    snapshot: CloudSnapshot | null,
    guest: DashboardData | null,
  ) {
    const key = `${this.key}:before-automatic-sync`;
    if (!this.cache || this.storage.getItem(key)) return;
    const at = new Date().toISOString();
    const backups: Backup[] = [
      { data: this.cache.data, at, label: "자동 병합 전 이 기기 기록" },
    ];
    if (snapshot)
      backups.push({
        data: snapshot.data,
        at,
        label: "자동 병합 전 온라인 기록",
      });
    if (guest && !equalData(guest, this.cache.data))
      backups.push({ data: guest, at, label: "자동 병합 전 로그인 전 원본" });
    this.writeLocal(key, JSON.stringify(backups));
  }
  private guestInput() {
    const owner = this.storage.getItem(OWNER_KEY);
    if (owner && owner !== this.key) return null;
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    let data: DashboardData;
    try {
      data = restoreData(JSON.parse(raw));
    } catch {
      return null;
    }
    const checkpoint = this.storage.getItem(`${this.key}:guest-imported`);
    if (checkpoint && equalData(JSON.parse(checkpoint), data)) return null;
    return {
      data,
      checkpoint: checkpoint ? restoreData(JSON.parse(checkpoint)) : null,
    };
  }
  private prepare(
    snapshot: CloudSnapshot | null,
    guest: ReturnType<DashboardStore["guestInput"]>,
  ) {
    const cache = this.cache!;
    let remote = snapshot
      ? legacyDocument(snapshot.data, "legacy:server", 1)
      : legacyDocument(createInitialData(), "legacy:server", 1);
    let data: DashboardData;
    if (cache.data.syncState) {
      data = mergeDocuments(renderDocument(cache.data.syncState), remote);
      // Older tabs can still have made untracked edits against their exact base.
      if (
        cache.base?.syncState &&
        equalData(cache.base.syncState, cache.data.syncState) &&
        !equalData(plainData(cache.base), plainData(cache.data))
      )
        data = applyDelta(
          data,
          cache.base,
          cache.data,
          this.actor,
          undefined,
          true,
        );
    } else if (cache.base && !cache.recoveryDraft) {
      data = equalData(cache.base, cache.data)
        ? remote
        : applyDelta(
            remote,
            cache.base,
            cache.data,
            this.actor,
            undefined,
            true,
          );
      if (!snapshot && equalData(cache.base, cache.data))
        data = importLegacy(
          remote,
          cache.data,
          `legacy:device:${this.actor}`,
          2,
        );
    } else
      data = importLegacy(
        remote,
        cache.data,
        `legacy:${cache.recoveryDraft ? "recovered" : "device"}:${this.actor}`,
        cache.recoveryDraft ? 3 : 2,
      );
    if (guest) {
      if (guest.data.syncState) data = mergeDocuments(data, guest.data);
      else if (guest.checkpoint)
        data = applyDelta(
          data,
          guest.checkpoint,
          guest.data,
          this.actor,
          undefined,
          true,
        );
      else
        data = importLegacy(data, guest.data, `legacy:guest:${this.actor}`, 2);
    }
    const normalized = restoreData(data);
    if (!equalData(plainData(normalized), plainData(data)))
      return restoreData(
        applyDelta(data, data, normalized, "system:normalization"),
      );
    return normalized;
  }
  async sync() {
    const epoch = this.epoch,
      remote = this.remote;
    if (!remote || !this.cache || this.protectedStorage) return;
    if (this.busyEpoch === epoch) {
      this.queued = true;
      return;
    }
    this.busyEpoch = epoch;
    this.queued = false;
    try {
      this.peerData();
      for (let attempt = 0; attempt < 4; attempt++) {
        const guest = this.guestInput();
        if (
          attempt === 0 &&
          this.cache.autoSyncVersion === 1 &&
          !this.cache.recoveryDraft &&
          !this.dirty() &&
          !guest &&
          remote.revision
        ) {
          const revision = await remote.revision();
          if (epoch !== this.epoch || !this.cache) return;
          if (revision === this.cache.revision) {
            if (this.view.phase !== "saved")
              this.emit({ phase: "saved", message: "" });
            return;
          }
        }
        const snapshot = await remote.read();
        if (epoch !== this.epoch || !this.cache) return;
        const migration =
          this.cache.autoSyncVersion !== 1 || !!this.cache.recoveryDraft;
        if (migration) this.pinMigration(snapshot, guest?.data ?? null);
        const combined = this.prepare(snapshot, guest),
          previous = this.cache,
          previousView = this.view;
        this.cache = {
          ...this.cache,
          data: combined,
          base: snapshot?.data ?? null,
          revision: snapshot?.revision ?? 0,
          autoSyncVersion: 1,
          recoveryDraft: false,
        };
        this.emit({
          data: combined,
          remote: snapshot,
          phase: "pending",
          message: "",
        });
        if (!this.persist()) {
          this.cache = previous;
          this.emit({ data: previousView.data, phase: "error" });
          return;
        }
        if (guest) {
          this.writeLocal(OWNER_KEY, this.key);
          this.writeLocal(
            `${this.key}:guest-imported`,
            JSON.stringify(guest.data),
          );
        }
        if (snapshot && equalData(combined, snapshot.data)) {
          this.cache = {
            ...this.cache,
            lastSyncedAt: new Date().toISOString(),
          };
          this.persist();
          this.emit({ phase: "saved", lastSyncedAt: this.cache.lastSyncedAt });
          return;
        }
        const sent = combined;
        this.emit({ phase: "saving" });
        let saved: CloudSnapshot;
        try {
          saved = await remote.write(sent, snapshot?.revision ?? 0);
        } catch (error) {
          if (epoch !== this.epoch) return;
          if (error instanceof Error && error.message === "DASHBOARD_CONFLICT")
            continue;
          throw error;
        }
        if (epoch !== this.epoch || !this.cache) return;
        const latest = restoreData(mergeDocuments(this.cache.data, saved.data));
        this.cache = {
          ...this.cache,
          data: latest,
          base: saved.data,
          revision: saved.revision,
          lastSyncedAt: new Date().toISOString(),
        };
        this.persist();
        this.emit({
          data: latest,
          remote: saved,
          phase: equalData(latest, saved.data) ? "saved" : "pending",
          message: "",
          lastSyncedAt: this.cache.lastSyncedAt,
        });
        if (!this.dirty()) return;
      }
      this.emit({ phase: "pending", message: "" });
    } catch {
      if (epoch === this.epoch)
        this.emit({
          phase: "offline",
          message:
            "연결이 복구되면 이 기기의 변경과 다른 기기의 변경을 자동으로 합칩니다. 현재 기록은 기기에 보관됩니다.",
        });
    } finally {
      if (this.busyEpoch === epoch) this.busyEpoch = null;
      if (this.queued && epoch === this.epoch) {
        this.queued = false;
        queueMicrotask(() => void this.sync());
      }
    }
  }
  onStorageChanged = (key: string | null) => {
    if (key === this.key) {
      this.peerData();
      void this.sync();
    } else if (key === STORAGE_KEY && this.remote) void this.sync();
  };
  getRecoverySources = () => {
    let owner: string | null = null;
    try {
      owner = this.storage.getItem(OWNER_KEY);
    } catch {
      /* Recovery shows the existing storage access error. */
    }
    const sources = recoverySources(
      this.storage,
      this.cache?.backups ?? [],
    ).filter((s) => s.id !== "guest" || !owner || owner === this.key);
    if (this.cache) {
      try {
        const raw = this.storage.getItem(`${this.key}:before-automatic-sync`);
        if (raw) {
          const entries = JSON.parse(raw) as Backup[];
          entries.forEach((b, i) =>
            sources.push({
              id: `migration:${i}`,
              label: b.label,
              at: b.at,
              raw: JSON.stringify(b.data),
              data: restoreData(b.data),
              error: "",
            }),
          );
        }
      } catch {
        /* Other valid recovery sources remain available. */
      }
    }
    return sources;
  };
  stageRecovery = (id: string, expectedRaw: string) => {
    if (
      !this.cache ||
      !this.remote ||
      this.protectedStorage ||
      this.busyEpoch === this.epoch
    )
      throw new Error("기록 연결이 끝난 뒤 다시 시도해 주세요.");
    const source = this.getRecoverySources().find((s) => s.id === id);
    if (!source?.data || source.raw !== expectedRaw)
      throw new Error(
        "사본을 읽지 못했거나 내용이 바뀌었습니다. 목록을 다시 확인해 주세요.",
      );
    const previous = this.cache;
    const data = restoreData(
      importLegacy(
        legacyDocument(previous.data, "legacy:local", 2),
        source.data,
        `legacy:recovery:${this.actor}`,
        3,
      ),
    );
    const backups = [
      {
        data: previous.data,
        label: "기록 추가 병합 전 이 기기 기록",
        at: new Date().toISOString(),
      },
      ...previous.backups,
    ].slice(0, 4);
    this.cache = {
      ...previous,
      data,
      backups,
      recoveryDraft: false,
      autoSyncVersion: 1,
    };
    if (!this.persist()) {
      this.cache = previous;
      throw new Error(
        "기기에 저장하지 못해 병합을 중단했습니다. 원본은 보존했습니다.",
      );
    }
    this.emit({ data, backups, phase: "pending", message: "" });
  };
}
