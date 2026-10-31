import { useState, type FormEvent } from "react";
import { Cloud, RefreshCw, Download } from "lucide-react";
import { useData } from "./state";
import { syncLabels } from "./sync";
import { exportData } from "./storage";
import type { DashboardData } from "./model";
import { Dialog } from "./ui";
import setupSql from "../supabase/setup.sql?raw";

export function SyncButton({ onOpen }: { onOpen: () => void }) {
  const { phase, storageError, cloud } = useData();
  const label = storageError
    ? "저장 주의"
    : cloud.authLoading
      ? "로그인 확인 중"
      : cloud.config && !cloud.user
        ? "로그인하여 기록 연결"
        : syncLabels[phase];
  return (
    <button
      type="button"
      className="sync-trigger"
      data-phase={cloud.user ? phase : "local"}
      onClick={onOpen}
      aria-label={`온라인 저장 설정: ${label}`}
    >
      <Cloud size={14} />
      <span>{label}</span>
    </button>
  );
}
export function SyncBanner({ onOpen }: { onOpen: () => void }) {
  const { phase, cloud } = useData();
  if (
    !cloud.user ||
    !["choice", "conflict", "offline", "error"].includes(phase)
  )
    return null;
  return (
    <div className="sync-banner" role="status">
      <span>
        {phase === "choice"
          ? "처음 연결할 기록을 선택해 주세요. 기존 기록은 아직 온라인에 반영하지 않았습니다."
          : phase === "conflict"
            ? "다른 기기의 변경과 겹칩니다. 양쪽 기록을 확인해 주세요."
            : "온라인 저장을 완료하지 못했습니다. 기기의 기록은 유지됩니다."}
      </span>
      <button className="secondary-button" onClick={onOpen}>
        기록 확인
      </button>
    </div>
  );
}
function Summary({ data }: { data: DashboardData }) {
  return (
    <p className="sync-data-summary">
      학습 이력 {data.logs.filter((l) => !l.voided).length}건 · 과업{" "}
      {data.tasks.length}개 · 할 일 {data.todos?.length ?? 0}개 · 일정{" "}
      {data.events?.length ?? 0}개
    </p>
  );
}
export function SyncSettings({ onClose }: { onClose: () => void }) {
  const {
    data,
    phase,
    message,
    lastSyncedAt,
    remote,
    backups,
    cloud,
    storageError,
  } = useData();
  const [url, setUrl] = useState(cloud.config?.url ?? ""),
    [key, setKey] = useState("");
  const [email, setEmail] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  async function action(fn: () => void | Promise<void>, success = "") {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      setNotice(success);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "처리하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  function configure(e: FormEvent) {
    e.preventDefault();
    void action(
      () => cloud.configure({ url, key }),
      "연결 설정을 저장했습니다. 같은 이메일로 로그인해 주세요.",
    );
  }
  const working =
    busy || cloud.authLoading || ["checking", "saving"].includes(phase);
  return (
    <Dialog title="온라인 저장 및 기기 연결" onClose={onClose}>
      <div className="sync-settings">
        <p className="sync-intro">
          같은 계정으로 로그인하면 PC와 iPad에서 학습 기록·진도·과업·일정을 함께
          사용합니다.
        </p>
        {!cloud.config ? (
          <>
            <div className="sync-setup-steps">
              <h3>처음 한 번, 저장소 연결</h3>
              <ol>
                <li>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supabase 열기
                  </a>
                  에서 로그인 후 새 프로젝트를 만드세요.
                </li>
                <li>
                  프로젝트의 <b>SQL Editor</b>에서 아래 설정문을 한 번
                  실행하세요.
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void action(
                        () => navigator.clipboard.writeText(setupSql),
                        "설정문을 복사했습니다.",
                      )
                    }
                  >
                    저장소 설정문 복사
                  </button>
                  <details>
                    <summary>설정문 직접 보기</summary>
                    <pre className="sync-sql">{setupSql}</pre>
                  </details>
                </li>
                <li>
                  <b>Authentication → URL Configuration</b>의 Site URL과
                  Redirect URLs에 현재 대시보드 주소{" "}
                  <code>{window.location.origin}</code>를 등록하세요.
                </li>
                <li>
                  프로젝트의 <b>Connect</b> 또는 <b>Settings → API Keys</b>에서
                  URL과 Publishable key를 찾아 아래에 입력하세요. PC와 iPad에
                  같은 값을 사용합니다.
                </li>
              </ol>
            </div>
            <form onSubmit={configure} className="sync-form">
              <label>
                Project URL
                <input
                  type="url"
                  required
                  placeholder="https://…supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <label>
                Publishable key
                <input
                  type="text"
                  autoComplete="off"
                  required
                  placeholder="sb_publishable_…"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              <button className="primary-button" disabled={working}>
                연결 설정 저장
              </button>
            </form>
          </>
        ) : !cloud.user ? (
          <>
            <form
              className="sync-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  () => cloud.login(email),
                  "로그인 메일을 보냈습니다. 이 기기에서 이메일의 로그인 링크를 열어 주세요.",
                );
              }}
            >
              <label>
                이메일
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="PC·iPad에서 사용할 같은 이메일"
                />
              </label>
              <button className="primary-button" disabled={working}>
                이메일로 로그인
              </button>
            </form>
            <p className="micro-note">
              로그인 전의 기록도 기기에 보관됩니다. 로그인 후 기존 기록을 연결할
              수 있습니다.
            </p>
            <button
              className="text-button"
              disabled={working}
              onClick={() => void action(cloud.clearConfig)}
            >
              저장소 연결 설정 변경
            </button>
          </>
        ) : (
          <>
            <div className="sync-account">
              <strong>{cloud.user.email}</strong>
              <span className={`sync-state phase-${phase}`}>
                {syncLabels[phase]}
              </span>
            </div>
            {lastSyncedAt && (
              <p className="micro-note">
                최근 온라인 확인:{" "}
                {new Date(lastSyncedAt).toLocaleString("ko-KR")}
              </p>
            )}
            {["choice", "conflict"].includes(phase) && (
              <div className="sync-choice">
                <h3>
                  {phase === "conflict"
                    ? "양쪽 기록이 달라 자동으로 덮어쓰지 않았습니다."
                    : "처음 연결할 기록을 선택하세요."}
                </h3>
                <div className="sync-record-choice">
                  <strong>현재 이 기기의 기록</strong>
                  <Summary data={data} />
                  <button
                    className="text-button"
                    onClick={() => exportData(data)}
                  >
                    <Download size={13} /> JSON 백업
                  </button>
                </div>
                {remote ? (
                  <div className="sync-record-choice">
                    <strong>온라인에 저장된 기록</strong>
                    <Summary data={remote.data} />
                    <button
                      className="text-button"
                      onClick={() => exportData(remote.data)}
                    >
                      <Download size={13} /> JSON 백업
                    </button>
                    <button
                      className="primary-button"
                      disabled={working}
                      onClick={() =>
                        void action(() => {
                          if (!cloud.useCloud())
                            throw new Error(
                              "이 기기의 기록을 백업하지 못해 교체를 중단했습니다. 저장 공간을 확인해 주세요.",
                            );
                        }, "온라인 기록을 불러왔습니다. 이전 기기 기록은 아래 백업에서 확인할 수 있습니다.")
                      }
                    >
                      온라인 기록 불러오기
                    </button>
                  </div>
                ) : (
                  <p>
                    아직 온라인 기록이 없습니다. 기록이 가장 많이 남아 있는
                    기기에서 먼저 연결해 주세요.
                  </p>
                )}
                {remote && !replace ? (
                  <button
                    className="secondary-button"
                    disabled={working}
                    onClick={() => setReplace(true)}
                  >
                    이 기기 기록을 온라인에 반영하려면
                  </button>
                ) : (
                  <>
                    {remote && (
                      <p className="sync-caution">
                        온라인 기록 전체가 현재 이 기기 기록으로 교체됩니다. 두
                        기록을 자동으로 합치지 않습니다. 교체 전 양쪽 기록을 이
                        기기에 백업합니다.
                      </p>
                    )}
                    <button
                      className="primary-button"
                      disabled={working}
                      onClick={() =>
                        void action(async () => {
                          await cloud.useLocal();
                          setReplace(false);
                        })
                      }
                    >
                      {remote
                        ? "백업 후 이 기기 기록으로 교체"
                        : "이 기기 기록으로 온라인 저장 시작"}
                    </button>
                  </>
                )}
              </div>
            )}
            {message && <p className="sync-caution">{message}</p>}
            <div className="sync-actions">
              <button
                className="secondary-button"
                disabled={working}
                onClick={() => void action(cloud.refresh)}
              >
                <RefreshCw size={14} />
                지금 동기화
              </button>
              <button
                className="text-button"
                disabled={working}
                onClick={() => void action(cloud.logout)}
              >
                이 기기 로그아웃
              </button>
            </div>
            <p className="micro-note">
              변경은 자동 저장합니다. 다른 기기의 기록은 화면 복귀 시 또는 약
              30초마다 확인합니다. 연결이 끊기면 기기에 보관하고 재연결 시
              확인합니다.
            </p>
            <p className="micro-note">
              로그아웃해도 이 계정의 기기 보관 기록은 삭제하지 않습니다. 공용
              기기에서는 사용 후 로그아웃하고 브라우저 사이트 데이터도 지워
              주세요.
            </p>
          </>
        )}
        {cloud.config && (
          <details className="sync-setup-steps">
            <summary>처음 연결 안내 및 저장소 설정문</summary>
            <p className="micro-note">현재 연결: {cloud.config.url}</p>
            <button
              className="secondary-button"
              onClick={() =>
                void action(
                  () => navigator.clipboard.writeText(setupSql),
                  "설정문을 복사했습니다.",
                )
              }
            >
              저장소 설정문 복사
            </button>
            <a
              href="https://github.com/lee2642172-web/personal-study-dashboard/blob/personal-study-dashboard/docs/online-storage.md"
              target="_blank"
              rel="noreferrer"
            >
              단계별 연결 안내 보기
            </a>
          </details>
        )}
        {backups.length > 0 && (
          <details className="sync-backups">
            <summary>연결·교체 전 기록 백업 {backups.length}개</summary>
            {backups.map((backup, i) => (
              <div key={`${backup.at}-${i}`}>
                <span>
                  {backup.label}
                  <small>{new Date(backup.at).toLocaleString("ko-KR")}</small>
                </span>
                <button
                  className="text-button"
                  onClick={() => exportData(backup.data)}
                >
                  JSON 다운로드
                </button>
              </div>
            ))}
            <p className="micro-note">
              이 계정의 최근 4개 백업을 이 기기에 보관합니다. 중요한 기록은
              파일로 내려받아 주세요.
            </p>
          </details>
        )}
        {(error || cloud.authError || storageError) && (
          <p role="alert" className="form-error">
            {error || cloud.authError || storageError}
          </p>
        )}
        {notice && (
          <p role="status" className="sync-notice">
            {notice}
          </p>
        )}
      </div>
    </Dialog>
  );
}
