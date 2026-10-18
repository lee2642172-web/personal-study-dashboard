import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type DashboardData } from "./model";
import { createInitialData } from "./initialData";
import { browserRepository } from "./storage";
type State = {
  data: DashboardData;
  update: (fn: (data: DashboardData) => DashboardData) => void;
  storageError: string;
};
const Context = createContext<State | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(() => {
    try {
      return {
        data: browserRepository.load() ?? createInitialData(),
        error: "",
      };
    } catch {
      return {
        data: createInitialData(),
        error: `이 브라우저의 저장 데이터를 불러오지 못했습니다. 원본은 덮어쓰지 않습니다. 현재 변경은 임시이며 JSON 백업이 필요합니다.`,
      };
    }
  });
  const [data, setData] = useState(loaded.data);
  const [storageError, setStorageError] = useState(loaded.error);
  useEffect(() => {
    if (loaded.error) return;
    try {
      browserRepository.save(data);
      setStorageError("");
    } catch {
      setStorageError(
        "브라우저 저장에 실패했습니다. 현재 변경은 임시입니다. JSON 백업으로 보관해 주세요.",
      );
    }
  }, [data, loaded.error]);
  return (
    <Context.Provider value={{ data, update: setData, storageError }}>
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const state = useContext(Context);
  if (!state) throw new Error("DataProvider required");
  return state;
}
