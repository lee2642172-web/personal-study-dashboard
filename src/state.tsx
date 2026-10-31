import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { DashboardData } from "./model";
import { emailLoginError } from "./loginEmail";
import { DashboardStore, type SyncView } from "./sync";
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
    configure: (config: CloudConfig) => void;
    clearConfig: () => void;
    login: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    useLocal: () => Promise<void>;
    useCloud: () => boolean;
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
  useEffect(() => {
    if (!config) {
      setClient(null);
      setAuthLoading(false);
      return;
    }
    const api = makeCloudClient(config);
    setClient(api);
    setAuthLoading(true);
    let active = true,
      account = "";
    const onUser = (next: User | null) => {
      if (!active) return;
      setUser(next);
      setAuthLoading(false);
      if (next && account !== next.id) {
        account = next.id;
        queueMicrotask(() => {
          if (active && account === next.id)
            void store.connect(
              `${new URL(config.url).hostname}:${next.id}`,
              cloudRepository(api),
            );
        });
      } else if (!next && account) {
        account = "";
        store.disconnect();
      }
    };
    const { data: subscription } = api.auth.onAuthStateChange(
      (_event, session) => onUser(session?.user ?? null),
    );
    void api.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuthError(
            "로그인을 확인하지 못했습니다. 연결을 확인하고 다시 로그인해 주세요.",
          );
          setAuthLoading(false);
        } else onUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (active) {
          setAuthLoading(false);
          setAuthError(
            "로그인을 확인하지 못했습니다. 연결을 확인하고 다시 로그인해 주세요.",
          );
        }
      });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      api.auth.stopAutoRefresh();
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
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, store]);
  const cloud: State["cloud"] = {
    config,
    user,
    authLoading,
    authError,
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
    },
    async logout() {
      if (!client) return;
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error)
        throw new Error(
          "로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
        );
      setUser(null);
      store.disconnect();
    },
    refresh: () => store.sync(),
    useLocal: store.useLocal,
    useCloud: store.useCloud,
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
