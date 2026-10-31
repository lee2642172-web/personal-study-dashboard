import { useMemo, useState } from "react";
import { useData } from "./state";
import { recoverySummary, type RecoverySource } from "./recovery";
import { exportJsonText } from "./storage";

export function RecoveryPanel({ working }: { working: boolean }) {
  const { data, backups, cloud, recoveryDraft, guestReviewNeeded } = useData();
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
        "복구 초안을 열었습니다. 설정 창을 닫고 HOME·상세 화면에서 누락됐던 내용을 확인해 주세요. 온라인 기록에는 아직 반영하지 않았습니다.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "복구 사본을 열지 못했습니다.",
      );
    }
  }
  return (
    <details
      className="sync-recovery"
      open={recoveryDraft || guestReviewNeeded ? true : undefined}
    >
      <summary>기록 복구 · 로그인 전 원본 및 교체 전 백업</summary>
      <p className="micro-note">
        사본을 먼저 JSON 파일로 내려받아 보관해 주세요. 복구 초안은 이 기기에만
        열며, 온라인 기록을 자동으로 바꾸거나 두 사본을 합치지 않습니다.
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
                  이 사본을 복구 초안으로 열기
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
