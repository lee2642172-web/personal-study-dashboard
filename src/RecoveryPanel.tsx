import { useMemo, useState } from "react";
import { useData } from "./state";
import { recoverySummary, type RecoverySource } from "./recovery";
import { exportJsonText } from "./storage";

export function RecoveryPanel({ working }: { working: boolean }) {
  const { data, backups, cloud } = useData();
  const sources = useMemo(
    () => cloud.getRecoverySources(),
    [cloud.getRecoverySources, data, backups],
  );
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const current = recoverySummary(data);
  function restore(source: RecoverySource) {
    setError("");
    setNotice("");
    try {
      cloud.stageRecovery(source.id, source.raw);
      setNotice(
        "이 사본의 기록을 현재 기록에 합쳤습니다. 같은 계정의 다른 기기에도 자동 반영합니다.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "복구 사본을 열지 못했습니다.",
      );
    }
  }
  return (
    <details className="sync-recovery">
      <summary>기록 백업·복구</summary>
      <p className="micro-note">
        기존 원본과 자동 병합 전 사본을 내려받을 수 있습니다. 사본의 누락된
        기록을 현재 기록에 합치면 다른 기기에도 자동 반영합니다. 이미
        취소·삭제한 기록은 자동으로 되살리지 않습니다.
      </p>
      <p className="sync-data-summary">
        현재 화면: 학습 이력 {current.logs}건 · 최근 실제 활동일{" "}
        {current.latestActivityDate ?? "날짜 기록 없음"}
      </p>
      <div className="sync-recovery-list">
        {sources.map((source) => {
          const summary = source.data ? recoverySummary(source.data) : null;
          return (
            <section
              key={source.id}
              className="sync-recovery-source"
              aria-label={source.label}
            >
              <h3>{source.label}</h3>
              {source.at && (
                <small>
                  사본 저장: {new Date(source.at).toLocaleString("ko-KR")}
                </small>
              )}
              {summary && (
                <>
                  <p>
                    학습 이력 {summary.logs}건 · 자료 {summary.materials}개 ·
                    과업 작업 {summary.taskSessions}건 · 할 일 {summary.todos}개
                  </p>
                  <p>
                    최근 실제 활동일:{" "}
                    {summary.latestActivityDate ?? "날짜 기록 없음"}
                  </p>
                  {summary.recentLogs.length > 0 && (
                    <details>
                      <summary>최근 학습 기록 확인</summary>
                      <ul>
                        {summary.recentLogs.map((log) => (
                          <li key={log.id}>
                            <span>
                              {log.date} ·{" "}
                              {source.data?.materials.find(
                                (m) => m.id === log.materialId,
                              )?.title ?? log.materialId}{" "}
                              · {log.item}
                            </span>
                            <small>
                              {log.minutes === null
                                ? "시간 미입력"
                                : `${log.minutes}분`}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
              {source.error && <p className="sync-caution">{source.error}</p>}
              <div className="sync-actions">
                <button
                  className="secondary-button"
                  disabled={!source.raw}
                  onClick={() =>
                    exportJsonText(source.raw, "study-dashboard-recovery.json")
                  }
                >
                  JSON 다운로드
                </button>
                <button
                  className="secondary-button"
                  disabled={working || !cloud.user || !source.data}
                  onClick={() => restore(source)}
                >
                  이 사본의 기록을 현재 기록에 합치기
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {!sources.length && (
        <p className="micro-note">
          이 브라우저에서 확인할 수 있는 사본이 없습니다. 기록을 입력했던 같은
          브라우저와 사이트 주소에서 확인해 주세요.
        </p>
      )}
      {notice && (
        <p role="status" className="sync-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </details>
  );
}
