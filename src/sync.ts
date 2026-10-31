import type { DashboardData } from "./model.ts";
import { createInitialData } from "./initialData.ts";
import { restoreData, STORAGE_KEY } from "./storage.ts";
import { recoverySources } from "./recovery.ts";

export type CloudSnapshot = {
  data: DashboardData;
  revision: number;
  updatedAt: string;
};
export interface CloudRepository {
  read(): Promise<CloudSnapshot | null>;
  write(data: DashboardData, expectedRevision: number): Promise<CloudSnapshot>;
}
export type SyncPhase =
  | "local"
  | "checking"
  | "choice"
  | "pending"
  | "saving"
  | "saved"
  | "offline"
  | "conflict"
  | "error";
export const syncLabels: Record<SyncPhase, string> = {
  local: "온라인 저장 연결하기",
  checking: "온라인 기록 확인 중",
  choice: "기존 기록 연결 필요",
  pending: "온라인 저장 대기",
  saving: "온라인 저장 중",
  saved: "온라인 저장 완료",
  offline: "연결 끊김 · 기기에 임시 저장",
  conflict: "다른 기기 변경 확인 필요",
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
};
export type SyncView = {
  data: DashboardData;
  storageError: string;
  phase: SyncPhase;
  message: string;
  remote: CloudSnapshot | null;
  lastSyncedAt: string;
  backups: Backup[];
  recoveryDraft: boolean;
  guestReviewNeeded: boolean;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export const accountStorageKey = (account: string) =>
  `${STORAGE_KEY}:account:${account}`;

/** One snapshot per account, optimistic server revisions, and durable local drafts.
 * A divergent device never overwrites another device's records automatically. */
export class DashboardStore {
  private listeners = new Set<() => void>();
  private cache: Cache | null = null;
  private remote: CloudRepository | null = null;
  private key = STORAGE_KEY;
  private epoch = 0;
  private busyEpoch: number | null = null;
  private protectedStorage = false;
  private view: SyncView;
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
    this.view = this.guest();
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
        "기존 저장 데이터를 읽지 못했습니다. 원본은 덮어쓰지 않습니다. 현재 데이터는 JSON 백업으로 보관해 주세요.";
    }
    return {
      data,
      storageError,
      phase: "local",
      message: "",
      remote: null,
      lastSyncedAt: "",
      backups: [],
      recoveryDraft: false,
      guestReviewNeeded: false,
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
  update = (fn: (data: DashboardData) => DashboardData) => {
    const next = fn(this.view.data);
    if (next === this.view.data) return;
    if (this.cache) this.cache = { ...this.cache, data: next };
    const blocked = ["checking", "choice", "conflict", "error"].includes(
      this.view.phase,
    );
    this.emit({
      data: next,
      ...(this.remote && !blocked ? { phase: "pending" as const } : {}),
    });
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
      const raw = this.storage.getItem(this.key);
      const saved = raw ? JSON.parse(raw) : null;
      const guest = this.view.data;
      if (
        saved &&
        (!Number.isSafeInteger(saved.revision) ||
          saved.revision < 0 ||
          !Array.isArray(saved.backups))
      )
        throw new Error("Invalid cache");
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
          }
        : {
            data: this.guest().data,
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
        recoveryDraft: !!this.cache.recoveryDraft,
        guestReviewNeeded:
          !!saved &&
          !same(guest, createInitialData()) &&
          !same(guest, this.cache.data) &&
          this.storage.getItem(`${this.key}:guest-reviewed`) !==
            JSON.stringify(guest),
      });
      // Never replace an unreadable legacy store. A new account cache is independent.
      this.protectedStorage = false;
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
    return !!this.cache && !same(this.cache.data, this.cache.base);
  }
  private adopt(snapshot: CloudSnapshot) {
    if (!this.cache) return;
    this.cache = {
      ...this.cache,
      data: snapshot.data,
      base: snapshot.data,
      revision: snapshot.revision,
      lastSyncedAt: new Date().toISOString(),
      recoveryDraft: false,
    };
    this.emit({
      data: snapshot.data,
      phase: "saved",
      message: "",
      remote: snapshot,
      lastSyncedAt: this.cache.lastSyncedAt,
      recoveryDraft: false,
    });
    this.persist();
  }
  private backup(data: DashboardData, label: string) {
    if (!this.cache) return false;
    this.cache = {
      ...this.cache,
      backups: [
        { data, label, at: new Date().toISOString() },
        ...this.cache.backups,
      ].slice(0, 4),
    };
    this.emit({ backups: this.cache.backups });
    return this.persist();
  }
  async sync() {
    const epoch = this.epoch,
      remote = this.remote;
    if (
      !remote ||
      !this.cache ||
      this.protectedStorage ||
      this.busyEpoch === epoch
    )
      return;
    this.busyEpoch = epoch;
    try {
      const snapshot = await remote.read();
      if (epoch !== this.epoch || !this.cache) return;
      this.emit({ remote: snapshot, message: "" });
      if (this.cache.recoveryDraft) {
        this.emit({
          phase: "conflict",
          recoveryDraft: true,
          message:
            "복구 초안을 이 기기에만 열었습니다. 온라인 기록은 아직 바꾸지 않았습니다. 내용을 확인한 뒤 반영할 수 있습니다.",
        });
        return;
      }
      if (this.view.guestReviewNeeded) {
        this.emit({
          phase: "choice",
          message:
            "로그인 전 이 브라우저에 별도 기록이 있습니다. ‘기록 복구’에서 먼저 최근 내용을 확인해 주세요.",
        });
        return;
      }
      if (snapshot && same(snapshot.data, this.cache.data)) {
        this.adopt(snapshot);
      } else if (!this.cache.base) {
        this.emit({ phase: "choice" });
      } else if (!snapshot || snapshot.revision !== this.cache.revision) {
        if (snapshot && !this.dirty()) this.adopt(snapshot);
        else this.emit({ phase: "conflict" });
      } else if (this.dirty()) {
        if (this.persist()) await this.send(remote, snapshot.revision, epoch);
      } else {
        this.emit({ phase: "saved" });
      }
    } catch {
      if (epoch === this.epoch)
        this.emit({
          phase: "offline",
          message:
            "온라인 저장소에 연결하지 못했습니다. 기기의 기록은 유지됩니다. 연결 설정을 확인한 뒤 다시 시도해 주세요.",
        });
    } finally {
      if (this.busyEpoch === epoch) this.busyEpoch = null;
    }
  }
  private async send(remote: CloudRepository, revision: number, epoch: number) {
    if (!this.cache) return;
    const sent = this.cache.data;
    this.emit({ phase: "saving" });
    try {
      const saved = await remote.write(sent, revision);
      if (epoch !== this.epoch || !this.cache) return;
      this.cache = {
        ...this.cache,
        base: saved.data,
        revision: saved.revision,
        lastSyncedAt: new Date().toISOString(),
        recoveryDraft: false,
      };
      this.emit({
        phase: this.dirty() ? "pending" : "saved",
        remote: saved,
        message: "",
        lastSyncedAt: this.cache.lastSyncedAt,
        recoveryDraft: false,
      });
      this.persist();
    } catch (error) {
      if (epoch !== this.epoch) return;
      const conflict =
        error instanceof Error && error.message === "DASHBOARD_CONFLICT";
      this.emit({
        phase: conflict ? "conflict" : "offline",
        remote: null,
        message:
          "온라인 저장을 완료하지 못했습니다. 기기의 기록은 유지됩니다. 다른 기기의 변경을 확인하거나 다시 시도해 주세요.",
      });
      if (conflict) {
        try {
          const latest = await remote.read();
          if (epoch === this.epoch) this.emit({ remote: latest });
        } catch {
          /* Keep both durable drafts; do not offer a stale cloud copy. */
        }
      }
    }
  }
  useCloud = () => {
    if (!this.view.remote || !this.cache || this.busyEpoch === this.epoch)
      return false;
    if (!this.backup(this.cache.data, "온라인 기록을 불러오기 전 이 기기 기록"))
      return false;
    if (!this.ackGuest()) return false;
    this.adopt(this.view.remote);
    return true;
  };
  useLocal = async () => {
    const remote = this.remote,
      epoch = this.epoch;
    if (
      !remote ||
      !this.cache ||
      this.protectedStorage ||
      this.busyEpoch === epoch
    )
      return;
    this.busyEpoch = epoch;
    try {
      // Re-read immediately before the explicit replacement and still use CAS.
      const latest = await remote.read();
      if (epoch !== this.epoch || !this.cache) return;
      this.emit({ remote: latest });
      if (
        latest &&
        !this.backup(latest.data, "이 기기 기록으로 교체하기 전 온라인 기록")
      )
        return;
      if (!this.backup(this.cache.data, "이 기기 기록 온라인 연결 시점"))
        return;
      if (!this.ackGuest()) return;
      await this.send(remote, latest?.revision ?? 0, epoch);
    } catch {
      if (epoch === this.epoch)
        this.emit({
          phase: "offline",
          message:
            "온라인 기록을 확인하지 못했습니다. 현재 기록을 보존했습니다. 다시 시도해 주세요.",
        });
    } finally {
      if (this.busyEpoch === epoch) this.busyEpoch = null;
    }
  };
  private ackGuest() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return true;
      const guest = restoreData(JSON.parse(raw));
      if (
        this.view.guestReviewNeeded &&
        !this.backup(guest, "로그인 전 별도 기기 기록 확인 시점")
      )
        return false;
      this.storage.setItem(`${this.key}:guest-reviewed`, JSON.stringify(guest));
      this.emit({ guestReviewNeeded: false });
      return true;
    } catch {
      this.emit({
        storageError:
          "로그인 전 기기 기록을 확인·보관하지 못해 교체를 중단했습니다. 원본을 먼저 내려받아 주세요.",
      });
      return false;
    }
  }
  getRecoverySources = () =>
    recoverySources(this.storage, this.cache?.backups ?? []);
  stageRecovery = (id: string, expectedRaw: string) => {
    if (
      !this.cache ||
      !this.remote ||
      this.protectedStorage ||
      this.busyEpoch === this.epoch
    )
      throw new Error("이 계정의 기록 확인이 끝난 뒤 복구 초안을 열어 주세요.");
    const source = this.getRecoverySources().find((source) => source.id === id);
    if (!source?.data || source.raw !== expectedRaw)
      throw new Error(
        "복구 사본을 읽지 못했거나 내용이 바뀌었습니다. 사본 목록을 새로 확인해 주세요.",
      );
    const recovered = restoreData(source.data);
    if (!this.backup(this.cache.data, "복구 초안을 열기 전 현재 기록"))
      throw new Error(
        "현재 기록을 백업하지 못해 복구를 중단했습니다. JSON 파일을 먼저 내려받아 주세요.",
      );
    const before = this.cache,
      previous = this.view;
    this.cache = { ...this.cache, data: recovered, recoveryDraft: true };
    this.emit({
      data: recovered,
      phase: "conflict",
      recoveryDraft: true,
      message:
        "복구 초안을 이 기기에만 열었습니다. 온라인 기록은 아직 바꾸지 않았습니다. HOME과 상세 화면에서 내용을 확인해 주세요.",
    });
    if (!this.persist()) {
      this.cache = before;
      this.emit({
        data: previous.data,
        phase: previous.phase,
        recoveryDraft: previous.recoveryDraft,
        message: previous.message,
      });
      throw new Error(
        "복구 초안을 기기에 저장하지 못했습니다. 원본 파일을 먼저 내려받아 주세요.",
      );
    }
  };
}
