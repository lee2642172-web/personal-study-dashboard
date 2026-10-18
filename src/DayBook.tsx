import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  RotateCcw,
  Plus,
  Pencil,
} from "lucide-react";
import { useData } from "./state";
import { PageHeading, Progress, Empty } from "./ui";
import { MaterialForm, LogForm } from "./forms";
import {
  type Material,
  type StudyLog,
  newId,
  progress,
  materialStatuses,
} from "./model";
import { localDate } from "./dates";
import {
  getDayBook,
  ensureDayBook,
  selectDayRound,
  startDayRound,
  openDay,
  recordDayReview,
  cancelDayReview,
  dayCompleted,
} from "./dayLearning";
export function DayBook({ material: m }: { material: Material }) {
  const { data, update } = useData();
  const book = getDayBook(data, m);
  const round = book.rounds.find((r) => r.round === book.activeRound)!;
  const [dayInput, setDayInput] = useState(String(round.lastOpenedDay));
  const [roundInput, setRoundInput] = useState(String(book.activeRound));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState<StudyLog | null>(null);
  const panel = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    update((d) => ensureDayBook(d, m.id));
  }, [m.id, m.total, update]);
  useLayoutEffect(() => {
    setDayInput(String(round.lastOpenedDay));
    setRoundInput(String(book.activeRound));
    setError("");
  }, [book.activeRound, round.lastOpenedDay]);
  if (!m.total)
    return (
      <>
        <PageHeading
          eyebrow="VOCABULARY"
          title={m.title}
          description="자료 전체 Day 수를 입력하면 이어서 학습을 시작할 수 있습니다."
        />
        <button className="primary-button" onClick={() => setEditing(true)}>
          자료 설정 수정
        </button>
        {editing && (
          <MaterialForm value={m} onClose={() => setEditing(false)} />
        )}
      </>
    );
  const day = round.lastOpenedDay;
  const p = progress(m, data.logs, book.activeRound);
  const entries = data.logs.filter(
    (l) =>
      l.materialId === m.id &&
      Number(l.item) === day &&
      l.activity !== "system",
  );
  const count = entries.filter((l) => l.completed && !l.voided).length;
  const currentCount = entries.filter(
    (l) => l.round === book.activeRound && l.completed && !l.voided,
  ).length;
  const complete = dayCompleted(data.logs, m.id, book.activeRound, day);
  const last = data.logs.find(
    (l) =>
      l.id === round.lastReviewId &&
      l.materialId === m.id &&
      l.round === book.activeRound &&
      l.activity !== "system",
  );
  function browse(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > m.total!) {
      setError(`Day 1~${m.total} 사이의 번호를 입력해 주세요.`);
      return;
    }
    setError("");
    update((d) => openDay(d, m.id, book.activeRound, value));
  }
  function resume() {
    if (round.nextDay !== null) {
      browse(round.nextDay);
      panel.current?.focus();
    }
  }
  function review() {
    const id = newId();
    const date = localDate();
    update((d) => recordDayReview(d, m.id, book.activeRound, day, id, date));
    setNotice(
      `Day ${day} 복습을 기록했습니다. 다음 학습 Day와 화면 위치가 갱신되었습니다.`,
    );
  }
  function cancel(entry: StudyLog) {
    update((d) => cancelDayReview(d, entry.id));
    setNotice(
      `Day ${entry.item} 복습 기록을 삭제하고 해당 Day 화면으로 돌아왔습니다. 회독 진도는 남아 있는 기록을 기준으로 복원했습니다.`,
    );
  }
  return (
    <>
      <Link to="/english" className="back-link">
        <ArrowLeft size={15} />
        영어 학습으로
      </Link>
      <PageHeading
        eyebrow="ENGLISH · DAY REVIEW"
        title={m.title}
        description={`${m.total} Days · 탐색한 위치와 실제 학습 진도를 따로 관리합니다.`}
        action={
          <button className="secondary-button" onClick={() => setEditing(true)}>
            <Pencil size={15} />
            자료 설정
          </button>
        }
      />
      <section className="daybook-resume blue" aria-label="이어서 학습하기">
        <div className="daybook-resume-copy">
          <p className="eyebrow">CONTINUE LEARNING · {book.activeRound}회독</p>
          <h2>
            {round.nextDay === null ? (
              "이번 회독을 마쳤어요"
            ) : (
              <>
                다음 학습 <strong>Day {round.nextDay}</strong>
              </>
            )}
          </h2>
          <p>
            {round.nextDay === null
              ? "다음 회독은 준비되었을 때 시작하세요. 기존 기록은 모두 남습니다."
              : "마지막으로 열어본 Day와 관계없이, 아직 완료하지 않은 학습 위치에서 이어갑니다."}
          </p>
          <button
            className="primary-button daybook-resume-button"
            onClick={() => {
              if (round.nextDay === null) {
                update((d) => startDayRound(d, m.id));
                setNotice("새 회독을 시작했습니다.");
              } else resume();
            }}
          >
            <BookOpen size={18} />
            {round.nextDay === null
              ? "새 회독 시작하기"
              : `Day ${round.nextDay} 이어서 학습하기`}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="daybook-resume-progress">
          <span className="status-pill">{book.activeRound}회독 진행 현황</span>
          {p.entries.some((l) => l.round === book.activeRound) ? (
            <Progress done={p.count} total={m.total} label="완료한 Day" />
          ) : (
            <p className="daybook-no-progress">
              학습 기록 전
              <span>자료 규모 {m.total} Days · 실제 진도와 별개</span>
            </p>
          )}
          <small>이 회독의 다음 학습 위치는 별도로 저장됩니다.</small>
        </div>
      </section>
      <section className="daybook-rounds" aria-label="회독 관리">
        <div>
          <label>
            학습할 회독
            <select
              aria-label="학습할 회독"
              value={book.activeRound}
              onChange={(e) => {
                update((d) => selectDayRound(d, m.id, Number(e.target.value)));
                setNotice("선택한 회독의 학습 위치를 불러왔습니다.");
              }}
            >
              {book.rounds.map((r) => (
                <option value={r.round} key={r.round}>
                  {r.round}회독 ·{" "}
                  {r.nextDay === null ? "완료" : `다음 Day ${r.nextDay}`}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              update((d) => startDayRound(d, m.id));
              setNotice(
                "새 회독을 시작했습니다. 이전 회독은 그대로 보존합니다.",
              );
            }}
          >
            <Plus size={15} />새 회독 시작
          </button>
        </div>
        <details>
          <summary>회독 번호 직접 선택 · 횟수 제한 없음</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(roundInput);
              if (!Number.isSafeInteger(value) || value < 1) {
                setError("회독 번호는 1 이상의 정수로 입력해 주세요.");
                return;
              }
              update((d) => selectDayRound(d, m.id, value));
              setNotice(`${value}회독의 저장된 위치를 불러왔습니다.`);
            }}
          >
            <label>
              회독 번호
              <input
                type="number"
                min="1"
                step="1"
                required
                value={roundInput}
                onChange={(e) => setRoundInput(e.target.value)}
              />
            </label>
            <button className="secondary-button">회독 열기</button>
          </form>
        </details>
      </section>
      {last && (
        <div className="daybook-last-review" aria-label="최근 복습과 되돌리기">
          <div>
            <RotateCcw size={17} />
            <p>
              {`최근 기록: ${book.activeRound}회독 Day ${last.item} · ${last.date ?? "날짜 미입력"}`}
            </p>
          </div>
          {last.completed && (
            <button className="text-button" onClick={() => cancel(last)}>
              기록 취소 · Day {last.item}로 돌아가기
            </button>
          )}
        </div>
      )}
      <p className="daybook-notice" role="status" aria-live="polite">
        {notice ||
          "이전 Day를 열어보는 것만으로 학습 위치나 진도는 바뀌지 않습니다."}
      </p>
      <section className="daybook-current" aria-label="Day 탐색과 복습">
        <div className="daybook-current-heading">
          <div>
            <p className="eyebrow">BROWSING · {book.activeRound}회독</p>
            <h2 ref={panel} tabIndex={-1}>
              열어본 Day {day}
            </h2>
          </div>
          <span className={`status-pill ${complete ? "daybook-done" : ""}`}>
            {complete ? "이 회독에서 완료" : "기록 전"}
          </span>
        </div>
        <div className="daybook-navigation">
          <button
            className="secondary-button"
            disabled={day === 1}
            onClick={() => browse(day - 1)}
          >
            <ChevronLeft size={16} />
            이전 Day
          </button>
          <label>
            Day 바로가기
            <input
              aria-label="Day 바로가기"
              type="number"
              min="1"
              max={m.total}
              step="1"
              value={dayInput}
              onChange={(e) => {
                setDayInput(e.target.value);
                if (e.target.value !== "") browse(Number(e.target.value));
              }}
              onBlur={() => {
                setDayInput(String(day));
                setError("");
              }}
            />
          </label>
          <button
            className="secondary-button"
            disabled={day === m.total}
            onClick={() => browse(day + 1)}
          >
            다음 Day
            <ChevronRight size={16} />
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="daybook-current-body">
          <div>
            <h3>Day {day} 예문 복습</h3>
            <p>
              현재 회독 {currentCount}회 · 모든 회독 누적 복습 {count}회
            </p>
            <small>
              단어·Day 번호와 자료 순서는 그대로 유지합니다. 원문은 기존 Excel
              자료를 참고하세요.
            </small>
          </div>
          <button
            className="primary-button daybook-review-button"
            onClick={review}
          >
            Day {day} {complete ? "추가 복습 기록" : "복습 완료 기록"}
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="micro-note">
          오늘 날짜로 복습 기록을 남기고 다음 Day로 이동합니다. 학습시간은
          미입력으로 두며, 기록 수정에서 입력할 수 있습니다.
        </p>
        <details className="daybook-history">
          <summary>이 Day의 전체 회독 기록 {entries.length}건</summary>
          {entries.length ? (
            entries.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>
                    {entry.round}회독 · {entry.date ?? "날짜 미입력"}
                  </strong>
                  <p>
                    {entry.completed ? "복습 완료" : "진행 중"}{" "}
                    ·{" "}
                    {entry.minutes === null
                      ? "시간 미입력"
                      : `${entry.minutes}분`}
                  </p>
                </div>
                <div>
                  <button className="text-button" onClick={() => setLog(entry)}>
                    기록 수정
                  </button>
                  {entry.completed && (
                    <button
                      className="text-button"
                      onClick={() => cancel(entry)}
                    >
                      기록 취소
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <Empty>이 Day의 학습 기록이 없습니다.</Empty>
          )}
        </details>
      </section>
      <details className="daybook-info">
        <summary>자료 정보 · 상태 관리</summary>
        <label>
          자료 상태
          <select
            aria-label="자료 상태"
            value={m.status}
            onChange={(e) => {
              const status = e.target.value as Material["status"];
              update((d) => ({
                ...d,
                materials: d.materials.map((x) =>
                  x.id === m.id ? { ...x, status } : x,
                ),
              }));
            }}
          >
            {materialStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <p>{m.note}</p>
        <p>
          목표 {m.targetPasses ?? "미정"}회독 · 목표 이후에도 회독을 계속 추가할
          수 있습니다. 전체량 변경은 자료 설정에서 가능합니다.
        </p>
        <Link className="text-link" to="/records">
          전체 학습 기록 보기
          <ArrowRight size={14} />
        </Link>
      </details>
      {editing && <MaterialForm value={m} onClose={() => setEditing(false)} />}
      {log && <LogForm value={log} onClose={() => setLog(null)} />}
    </>
  );
}
