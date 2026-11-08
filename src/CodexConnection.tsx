import { useEffect, useState, type FormEvent } from "react";
import { useData } from "./state";
import { PageHeading } from "./ui";
import { SyncSettings } from "./SyncSettings";
import sql from "../supabase/codex.sql?raw";

type Status = {
  serverReady?: boolean;
  databaseReady?: boolean;
  error?: string;
};
type Connection = {
  id: string;
  label: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};
function errorText(error: string) {
  const messages: Record<string, string> = {
    CONNECT_ORIGIN_REQUIRED: "서버의 대시보드 주소 설정이 필요합니다.",
    CONNECT_SUPABASE_CONFIG_REQUIRED:
      "서버의 Supabase 공개 연결 설정이 필요합니다.",
    CONNECT_SECRET_REQUIRED: "서버 암호화 설정키가 필요합니다.",
    CONNECT_DATABASE_SETUP_REQUIRED:
      "Supabase에 연결 저장소 설정문을 실행해 주세요.",
    REAUTHENTICATION_FAILED: "현재 계정의 비밀번호를 확인해 주세요.",
    REAUTHENTICATION_REQUIRED: "현재 계정의 비밀번호를 입력해 주세요.",
    invalid_token: "로그인 상태를 확인하고 다시 시도해 주세요.",
    invalid_origin:
      "현재 주소와 서버의 DASHBOARD_CHAT_ORIGIN 설정을 확인해 주세요.",
  };
  return (
    messages[error] ??
    "연결을 처리하지 못했습니다. 서버 설정과 인터넷 연결을 확인해 주세요."
  );
}
export function CodexConnectionPage() {
  const { cloud } = useData();
  const [status, setStatus] = useState<Status | null>(null),
    [login, setLogin] = useState(false),
    [password, setPassword] = useState(""),
    [label, setLabel] = useState("Codex 학습 대시보드"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]),
    [issued, setIssued] = useState<{
      token: string;
      connection_id: string;
    } | null>(null),
    [setupKey, setSetupKey] = useState("");
  async function refreshStatus() {
    try {
      const response = await fetch("/api/chat-access", { cache: "no-store" });
      setStatus(await response.json());
    } catch {
      setStatus({ error: "CONNECT_REQUEST_FAILED" });
    }
  }
  async function request(method: string, body?: unknown) {
    const response = await fetch(
      "/api/chat-access" + (method === "GET" ? "?connections=1" : ""),
      {
        method,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await cloud.accessToken()}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const value = await response.json();
    if (!response.ok) throw new Error(errorText(value.error));
    return value;
  }
  async function loadConnections() {
    try {
      setConnections((await request("GET")).connections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결 목록을 읽지 못했습니다.");
    }
  }
  useEffect(() => {
    void refreshStatus();
  }, []);
  useEffect(() => {
    if (cloud.user && !cloud.authLoading && status?.databaseReady)
      void loadConnections();
    else setConnections([]);
  }, [cloud.user?.id, cloud.authLoading, status?.databaseReady]);
  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setError(
        "자동 복사가 되지 않았습니다. 입력값을 선택해 직접 복사해 주세요.",
      );
    }
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setIssued(null);
    try {
      const value = await request("POST", { password, label });
      setIssued(value);
      setNotice(
        "연결키를 발급했습니다. 아래 Codex 환경 설정을 마치면 채팅으로 전체 대시보드를 관리할 수 있습니다.",
      );
      await loadConnections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결하지 못했습니다.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  const ready = status?.serverReady && status.databaseReady;
  return (
    <>
      <PageHeading
        eyebrow="CODEX CONNECTION"
        title="채팅으로 대시보드 관리"
        description="학습 기록·교재·진도·할 일·장기 과업·일정·목표를 Codex에서 조회하고 수정합니다."
      />
      <section className="dashboard-panel connect-page">
        <h2>처음 한 번, 연결 설정</h2>
        <p className="micro-note">
          연결된 계정의 기록만 다룹니다. 변경은 미리보기와 최신 버전 확인을 거쳐
          저장하며, 기존 기기의 학습·자동 동기화 기능은 그대로 사용합니다.
        </p>
        {!status ? (
          <p role="status">연결 서버를 확인하고 있습니다.</p>
        ) : !ready ? (
          <>
            <p className="form-error">
              {status.error
                ? errorText(status.error)
                : "서버 설정은 완료했습니다. Supabase 연결 저장소 설정이 필요합니다."}
            </p>
            <details open className="connect-setup">
              <summary>서버 준비 안내 (운영자 · 처음 한 번)</summary>
              <ol>
                <li>
                  <a
                    className="text-link"
                    href="https://vercel.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Vercel 프로젝트
                  </a>
                  의 Environment Variables에 아래 값을 등록하고 다시 배포합니다.
                  <dl className="connect-values">
                    <dt>SUPABASE_URL</dt>
                    <dd>{cloud.config?.url ?? "기존 Supabase Project URL"}</dd>
                    <dt>SUPABASE_PUBLISHABLE_KEY</dt>
                    <dd>
                      {cloud.config?.key ?? "기존 Publishable key (공개 키)"}
                    </dd>
                    <dt>DASHBOARD_CHAT_ORIGIN</dt>
                    <dd>{window.location.origin}</dd>
                    <dt>DASHBOARD_CHAT_SECRET</dt>
                    <dd>아래 버튼으로 생성한 서버 설정키</dd>
                  </dl>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      const bytes = crypto.getRandomValues(new Uint8Array(32));
                      setSetupKey(
                        [...bytes]
                          .map((b) => b.toString(16).padStart(2, "0"))
                          .join(""),
                      );
                      setNotice(
                        "서버 설정키를 생성했습니다. DASHBOARD_CHAT_SECRET 값으로 등록해 주세요.",
                      );
                    }}
                  >
                    서버 설정키 생성
                  </button>
                  {setupKey && (
                    <div className="connect-copy">
                      <input
                        type="password"
                        aria-label="서버 설정키"
                        value={setupKey}
                        readOnly
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          void copy(setupKey, "서버 설정키를 복사했습니다.")
                        }
                      >
                        설정키 복사
                      </button>
                    </div>
                  )}
                  <p className="micro-note">
                    서버 설정키는 처음 한 번만 등록합니다. 기존 설정키를 바꾸면
                    연결키를 다시 발급해야 합니다.
                  </p>
                </li>
                <li>
                  Supabase SQL Editor에서 연결 저장소 설정문을 한 번 실행합니다.
                  기존 학습 자료와 기록은 변경하지 않습니다.
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void copy(sql, "연결 저장소 설정문을 복사했습니다.")
                    }
                  >
                    연결 저장소 설정문 복사
                  </button>
                </li>
              </ol>
            </details>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void refreshStatus()}
            >
              설정 다시 확인
            </button>
          </>
        ) : (
          <p className="sync-state phase-saved">연결 서버 준비 완료</p>
        )}
        {!cloud.user ? (
          <button className="primary-button" onClick={() => setLogin(true)}>
            대시보드 계정으로 로그인
          </button>
        ) : ready ? (
          <form className="v1-form" onSubmit={connect}>
            <label>
              계정
              <input
                name="username"
                type="email"
                autoComplete="username"
                value={cloud.user.email ?? ""}
                readOnly
              />
            </label>
            <label>
              연결 이름
              <input
                value={label}
                maxLength={80}
                required
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label>
              대시보드 비밀번호
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="micro-note">
              같은 계정으로 Codex 전용 연결을 만듭니다. PC·iPad의 기존 로그인은
              유지하며, 비밀번호를 저장하지 않습니다.
            </p>
            <button
              className="primary-button"
              disabled={busy || cloud.authLoading}
            >
              {busy ? "연결 중…" : "Codex 연결키 발급"}
            </button>
          </form>
        ) : null}
        {issued && (
          <section className="connect-issued" aria-label="발급된 Codex 연결키">
            <h3>Codex 환경에 등록하기</h3>
            <p className="micro-note">
              연결키는 이 화면에서 한 번만 표시됩니다. 채팅이나 GitHub 파일에
              넣지 않고 Codex 환경의 비밀 설정에 등록합니다.
            </p>
            <dl className="connect-values">
              <dt>DASHBOARD_CHAT_URL</dt>
              <dd>{window.location.origin}</dd>
              <dt>DASHBOARD_CHAT_TOKEN</dt>
              <dd>아래에서 복사한 연결키</dd>
            </dl>
            <div className="connect-copy">
              <input
                type="password"
                value={issued.token}
                readOnly
                autoComplete="off"
                aria-label="Codex 연결키"
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void copy(
                    issued.token,
                    "Codex 연결키를 복사했습니다. 환경의 비밀 설정에 등록해 주세요.",
                  )
                }
              >
                연결키 복사
              </button>
            </div>
            <p className="micro-note">
              Codex 환경의 인터넷 접근 허용 목록에도{" "}
              <strong>{window.location.hostname}</strong>을 추가합니다. 환경
              설정을 적용한 뒤 이 대화에서 계속 요청해 주세요.
            </p>
          </section>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="micro-note" role="status">
            {notice}
          </p>
        )}
      </section>
      {connections.length > 0 && (
        <section className="dashboard-panel connect-page">
          <h2>내 연결 관리</h2>
          <ul className="connect-list">
            {connections.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.label}</strong>
                  <p className="micro-note">
                    {c.revoked_at
                      ? "해제됨"
                      : `유효기간 ${c.expires_at.slice(0, 10)}`}
                  </p>
                </div>
                {!c.revoked_at && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await request("DELETE", { id: c.id });
                        if (issued?.connection_id === c.id) setIssued(null);
                        await loadConnections();
                        setNotice(
                          "연결을 해제했습니다. 이 연결키로는 기록을 읽거나 수정할 수 없습니다.",
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "해제하지 못했습니다.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    연결 해제
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {login && <SyncSettings onClose={() => setLogin(false)} />}
    </>
  );
}
