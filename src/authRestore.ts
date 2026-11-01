import type { User } from "@supabase/supabase-js";

export type AuthView = {
  user: User | null;
  mode: "checking" | "ready" | "retrying" | "signedOut";
  error: string;
};
export function retryableAuthError(error: unknown): boolean {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  return (
    value.name === "AuthRetryableFetchError" ||
    value.name === "TypeError" ||
    value.isAcquireTimeout === true ||
    (typeof value.name === "string" &&
      value.name.includes("LockAcquireTimeout")) ||
    value.status === 0 ||
    value.status === 429 ||
    (typeof value.status === "number" && value.status >= 500)
  );
}
/** INITIAL_SESSION:null can mean a temporary refresh failure, not an actual sign-out. */
export class AuthRestorer {
  private view: AuthView;
  private disposed = false;
  private generation = 0;
  private busy: Promise<void> | null = null;
  constructor(
    privateLoad: () => Promise<{ user: User | null; error: unknown }>,
    privateChange: (view: AuthView) => void,
    cachedUser: User | null,
  ) {
    this.load = privateLoad;
    this.change = privateChange;
    this.view = { user: cachedUser, mode: "checking", error: "" };
  }
  private load: () => Promise<{ user: User | null; error: unknown }>;
  private change: (view: AuthView) => void;
  getSnapshot = () => this.view;
  private emit(view: AuthView) {
    if (this.disposed) return;
    this.view = view;
    this.change(view);
  }
  start() {
    this.emit(this.view);
    return this.restore();
  }
  restore = (): Promise<void> => {
    if (this.disposed) return Promise.resolve();
    if (this.busy) return this.busy;
    const generation = this.generation;
    const perform = async () => {
      try {
        const result = await this.load();
        if (this.disposed || generation !== this.generation) return;
        if (result.error) {
          if (retryableAuthError(result.error))
            this.emit({
              ...this.view,
              mode: "retrying",
              error:
                "로그인을 갱신하지 못했습니다. 기기의 기록은 유지하며 연결이 돌아오면 자동으로 다시 확인합니다.",
            });
          else
            this.emit({
              user: null,
              mode: "signedOut",
              error:
                "이전 로그인이 만료되었거나 해제되었습니다. 같은 이메일과 비밀번호로 다시 로그인해 주세요.",
            });
        } else if (result.user)
          this.emit({ user: result.user, mode: "ready", error: "" });
        else
          this.emit({
            user: null,
            mode: "signedOut",
            error: this.view.user
              ? "저장된 로그인을 사용할 수 없습니다. 같은 계정으로 한 번 다시 로그인해 주세요."
              : "",
          });
      } catch (error) {
        if (!this.disposed && generation === this.generation)
          this.emit({
            ...this.view,
            mode: "retrying",
            error:
              "로그인 연결을 확인하지 못했습니다. 기기의 기록은 유지하며 연결 복구 후 다시 확인합니다.",
          });
      }
    };
    this.busy = perform().finally(() => {
      this.busy = null;
    });
    return this.busy;
  };
  event = (event: string, user: User | null) => {
    // Return to the SDK before any callback can start another SDK request.
    queueMicrotask(() => {
      if (this.disposed) return;
      if (user) {
        ++this.generation;
        this.emit({ user, mode: "ready", error: "" });
      } else if (event === "SIGNED_OUT") {
        ++this.generation;
        this.emit({
          user: null,
          mode: "signedOut",
          error: this.view.user
            ? "기존 로그인이 해제되었습니다. 비밀번호를 설정·변경했다면 이 기기에서 새 비밀번호로 한 번 로그인해 주세요."
            : "",
        });
      } else if (event === "INITIAL_SESSION") void this.restore();
    });
  };
  dispose() {
    this.disposed = true;
    ++this.generation;
  }
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;
const browserRead: ReadStorage = {
  getItem: (key) => window.localStorage.getItem(key),
};
const browserWrite: WriteStorage = {
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
export const authStorageKey = (url: string) =>
  `study-dashboard-auth:${new URL(url).hostname}`;
export const loginPreferenceKey = (url: string) =>
  `study-dashboard-login:${new URL(url).hostname}`;
export function cachedAuthUser(
  url: string,
  storage: ReadStorage = browserRead,
): User | null {
  try {
    const raw = storage.getItem(authStorageKey(url));
    if (!raw) return null;
    const session = JSON.parse(raw);
    return typeof session?.user?.id === "string" &&
      typeof session?.user?.email === "string" &&
      typeof session?.refresh_token === "string"
      ? (session.user as User)
      : null;
  } catch {
    return null;
  }
}
export type LoginPreference = { email: string; method: "email" | "password" };
export function readLoginPreference(
  url: string,
  storage: ReadStorage = browserRead,
): LoginPreference | null {
  try {
    const value = JSON.parse(
      storage.getItem(loginPreferenceKey(url)) ?? "null",
    );
    return typeof value?.email === "string" &&
      value.email.length <= 320 &&
      /^[^\s@]+@[^\s@]+$/.test(value.email) &&
      ["email", "password"].includes(value.method)
      ? { email: value.email, method: value.method }
      : null;
  } catch {
    return null;
  }
}
export function rememberLogin(
  url: string,
  email: string,
  method: LoginPreference["method"],
  storage: WriteStorage = browserWrite,
) {
  try {
    storage.setItem(
      loginPreferenceKey(url),
      JSON.stringify({ email: email.trim(), method }),
    );
  } catch {
    /* A preference must not fail a successful sign-in; auth storage errors are handled by the SDK. */
  }
}
