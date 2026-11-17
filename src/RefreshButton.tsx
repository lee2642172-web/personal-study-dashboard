import { RefreshCw } from "lucide-react";
import { useData } from "./state";

export function RefreshButton() {
  const { phase, storageError, cloud } = useData();
  const saving = ["pending", "saving", "checking"].includes(phase) || cloud.authLoading;
  const disabled = saving || !!storageError;
  const reason = storageError
    ? "기기 저장 오류를 해결한 뒤 새로고침할 수 있습니다."
    : saving ? "저장·연결 확인이 끝나면 새로고침할 수 있습니다." : "현재 화면을 다시 불러옵니다.";
  return (
    <button
      type="button"
      className="theme-toggle refresh-page-button"
      aria-label="화면 새로고침"
      title={reason}
      disabled={disabled}
      onClick={() => window.location.reload()}
    >
      <RefreshCw size={18} aria-hidden="true" />
      <span>새로고침</span>
    </button>
  );
}
