import { useEffect, useState } from "react";
import { localDate } from "./dates";

/** Refresh open tabs after local midnight and when the browser returns to the foreground. */
export function useLocalDate() {
  const [, setDate] = useState(localDate);
  useEffect(() => {
    const refresh = () => setDate(localDate());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return localDate();
}
