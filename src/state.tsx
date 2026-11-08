import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { DashboardData } from "./model";
import { emailLoginError } from "./loginEmail";
import { loginWithPassword, setAccountPassword } from "./passwordAuth";
import {
  AuthRestorer,
  cachedAuthUser,
  readLoginPreference,
  rememberLogin,
} from "./authRestore";
import { DashboardStore, type SyncView } from "./sync";
import type { RecoverySource } from "./recovery";
import {
  CLOUD_CONFIG_KEY,
  loadCloudConfig,
  configError,
  makeCloudClient,
  cloudRepository,
  type CloudConfig,
} from "./cloud";

type State = SyncView & {
  update: (fn: (data: DashboardData) => DashboardData) => void;
  cloud: {
    config: CloudConfig | null;
    user: User | null;
    authLoading: boolean;
    authError: string;
    accessToken: () => Promise<string>;
    configure: (config: CloudConfig) => void;
    clearConfig: () => void;
    login: (email: string) => Promise<void>;
    loginPassword: (email: string, password: string) => Promise<void>;
    setPassword: (password: string, confirmation: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    getRecoverySources: () => RecoverySource[];
    stageRecovery: (id: string, expectedRaw: string) => void;
  };
};
const Context = createContext<State | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const [store] = useState(
    () =>
      new DashboardStore({
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [config, setConfig] = useState<CloudConfig | null>(() => {
    try {
      return loadCloudConfig(
        {
          url: import.meta.env.VITE_SUPABASE_URL ?? "",
          key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        localStorage,
      );
    } catch {
      return null;
    }
  });
  const [client, setClient] = useState<ReturnType<
    typeof makeCloudClient
  > | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(!!config);
  const [authError, setAuthError] = useState("");
  const manualLogout = useRef(false);
  useEffect(() => {
    if (!config) {
      setClient(null);
      setUser(null);
      setAuthLoading(false);
      return;
    }
    // Read the identity before the SDK refreshes an expired session. This only
    // opens that account's device cache; remote access requires a valid session.
    const cachedUser = cachedAuthUser(config.url);
    if (cachedUser?.email && !readLoginPreference(config.url))
      rememberLogin(config.url, cachedUser.email, "password");
    const api = makeCloudClient(config);
    setClient(api);
    let active = true,
      account = "",
      online = false;
    const restorer = new AuthRestorer(
      async () => {
        const { data, error } = await api.auth.getSession();
        return { user: data.session?.user ?? null, error };
      },
      (view) => {
        if (!active) return;
        const next = view.user;
        setUser(next);
        setAuthLoading(view.mode === "checking" || view.mode === "retrying");
        setAuthError(manualLogout.current ? "" : view.error);
        if (view.mode === "ready" && next) {
          manualLogout.current = false;
          if (next.email)
            rememberLogin(
              config.url,
              next.email,
              readLoginPreference(config.url)?.method ?? "password",
            );
          if (account !== next.id || !online) {
            account = next.id;
            online = true;
            void store.connect(
              `${new URL(config.url).hostname}:${next.id}`,
              cloudRepository(api),
            );
          }
        } else if (view.mode === "signedOut" && manualLogout.current) {
          account = "";
          online = false;
          store.disconnect();
        } else if (next && account !== next.id) {
          account = next.id;
          online = false;
          void store.connect(
            `${new URL(config.url).hostname}:${next.id}`,
            null,
          );
        } else if (account) {
          online = false;
          store.pauseConnection();
        }
      },
      cachedUser,
    );
    const { data: subscription } = api.auth.onAuthStateChange(
      (event, session) => restorer.event(event, session?.user ?? null),
    );
    void restorer.start();
    const restore = () => {
      if (document.visibilityState !== "hidden") void restorer.restore();
    };
    const retry = setInterval(() => {
      if (restorer.getSnapshot().mode === "retrying") restore();
    }, 15000);
    window.addEventListener("focus", restore);
    window.addEventListener("online", restore);
    document.addEventListener("visibilitychange", restore);
    return () => {
      active = false;
      restorer.dispose();
      subscription.subscription.unsubscribe();
      clearInterval(retry);
      window.removeEventListener("focus", restore);
      window.removeEventListener("online", restore);
      document.removeEventListener("visibilitychange", restore);
      // The shared SDK client owns refresh/visibility for the entire page.
      // Stopping it here breaks automatic login after a StrictMode remount.
      store.disconnect();
    };
  }, [config, store]);
  useEffect(() => {
    if (state.phase !== "pending") return;
    const timer = setTimeout(() => void store.sync(), 700);
    return () => clearTimeout(timer);
  }, [state.data, state.phase, store]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void store.sync();
    };
    const timer = setInterval(refresh, 3000);
    const storageChanged = (event: StorageEvent) =>
      store.onStorageChanged(event.key);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", storageChanged);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, store]);
  const cloud: State["cloud"] = {
    config,
    user,
    authLoading,
    authError,
    async accessToken() {
      if (!client || !user || authLoading)
        throw new Error("로그인 연결을 확인한 뒤 다시 시도해 주세요.");
      const { data, error } = await client.auth.getSession();
      if (error || !data.session || data.session.user.id !== user.id)
        throw new Error("같은 계정으로 다시 로그인해 주세요.");
      return data.session.access_token;
    },
    configure(value) {
      const clean = {
        url: value.url.trim().replace(/\/$/, ""),
        key: value.key.trim(),
      };
      const error = configError(clean);
      if (error) throw new Error(error);
      localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(clean));
      setAuthError("");
      setConfig(clean);
    },
    clearConfig() {
      if (user) throw new Error("먼저 로그아웃해 주세요.");
      localStorage.removeItem(CLOUD_CONFIG_KEY);
      setConfig(null);
      setClient(null);
      setAuthError("");
    },
    async login(email) {
      if (!client) throw new Error("먼저 온라인 저장 연결을 설정해 주세요.");
      const { error } = await client.auth
        .signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: window.location.origin + "/" },
        })
        .catch((error: unknown) => {
          throw emailLoginError(error);
        });
      if (error) throw emailLoginError(error);
      if (config) rememberLogin(config.url, email, "email");
    },
    async loginPassword(email, password) {
      if (!client) throw new Error("먼저 온라인 저장 연결을 설정해 주세요.");
      await loginWithPassword(client, email, password);
      if (config) rememberLogin(config.url, email, "password");
    },
    async setPassword(password, confirmation) {
      if (!client || !user)
        throw new Error("로그인 중인 기기에서 비밀번호를 설정해 주세요.");
      await setAccountPassword(client, password, confirmation);
      if (config && user.email)
        rememberLogin(config.url, user.email, "password");
    },
    async logout() {
      if (!client) return;
      manualLogout.current = true;
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
      } catch {
        manualLogout.current = false;
        throw new Error(
          "로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
        );
      }
      setUser(null);
      store.disconnect();
    },
    refresh: () => store.sync(),
    getRecoverySources: store.getRecoverySources,
    stageRecovery: store.stageRecovery,
  };
  return (
    <Context.Provider value={{ ...state, update: store.update, cloud }}>
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const state = useContext(Context);
  if (!state) throw new Error("DataProvider required");
  return state;
}
