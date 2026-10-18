import { useEffect, useLayoutEffect, useState } from "react";
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
  useEffect(() => {
    update((d) => ensureDayBook(d, m.id));
  }, [m.id, m.total, update]);
  useLayoutEffect(() => {
    setDayInput(String(round.lastOpenedDay));
    setRoundInput(String(book.activeRound));
    setError("");
  }, [m.id, book.activeRound, round.lastOpenedDay]);
  if (!m.total)
    return (
      <>
        <PageHeading
          eyebrow="VOCABULARY"
          title={m.title}
          description="자료 전체 Day 수를 입력하면 이어서 학습을 시작할 수 있습니다."
        />
        <button
          className="primary-button"
          onClick={() => setEditing(true)}
        >
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
  const last = [...data.logs]
    .reverse()
    .find(
      (l) =>
        l.materialId === m.id &&
        l.round === book.activeRound &&
        l.activity !== "system" &&
        l.completed &&
        !l.voided,
    );
  function browse(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > m.total!) {
      setError(`Day 1~${m.total} 사이의 번호를 입력해 주세요.`);
      return;
    }
    setError("");
    update((d) => openDay(d, m.id, book.activeRound, value));
  }
  function review() {
    const id = newId();
    const date = localDate();
    update((d) =>
      recordDayReview(d, m.id, book.activeRound, day, id, date),
    );
    setNotice(
      `Day ${day} 복습을 기록했습니다. 선택한 Day는 그대로 유지됩니다.`,
    );
  }
  function cancel(entry: StudyLog) {
    update((d) => cancelDayReview(d, entry.id));
    setNotice(
      `Day ${entry.item} 복습 기록을 삭제했습니다. 선택한 Day는 그대로 유지됩니다.`,
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
        description={`${m.total} Days · 회독을 선택하고 Day별 복습을 기록하세요.`}
        action={
          <button
            className="secondary-button"
            onClick={() => setEditing(true)}
          >
            <Pencil size={15} />
            자료 설정
          </button>
        }
      />
      <section
        className="daybook-panel"
        aria-label="단어장 통합 학습 패널"
      >
        <div className="daybook-toolbar">
          <label>
            학습 회독
            <select
              aria-label="학습 회독"
              value={book.activeRound}
              onChange={(e) => {
                update((d) =>
                  selectDayRound(d, m.id, Number(e.target.value)),
                );
                setNotice("선택한 회독의 저장된 Day를 불러왔습니다.");
              }}
            >
              {book.rounds.map((r) => (
                <option value={r.round} key={r.round}>
                  {r.round}회독{r.nextDay === null ? " · 완료" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              update((d) => startDayRound(d, m.id));
              setNotice("새 회독을 시작했습니다.");
            }}
          >
            <Plus size={15} />새 회독
          </button>
        </div>
        <div className="daybook-focus">
          <p className="eyebrow">
            {book.activeRound}회독 · 총 {m.total} Days
          </p>
          <h2>
            Day <strong>{day}</strong>
          </h2>
          <p className="daybook-count">
            누적 복습 <strong>{count}회</strong> · 현재 회독 {currentCount}
            회
          </p>
          <span
            className={`status-pill ${complete ? "daybook-done" : ""}`}
          >
            {complete ? "이 회독에서 복습 완료" : "이 회독에서 기록 전"}
          </span>
          <button
            className="primary-button daybook-review-button"
            onClick={review}
          >
            <BookOpen size={18} />
            복습 기록하기
          </button>
        </div>
        <div className="daybook-navigation" aria-label="Day 이동">
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
        {last && (
          <div className="daybook-last-review" aria-label="최근 복습 기록">
            <span>
              최근 기록 · {book.activeRound}회독 Day {last.item} ·{" "}
              {last.date ?? "날짜 미입력"}
            </span>
            <button className="text-button" onClick={() => cancel(last)}>
              <RotateCcw size={14} />
              최근 기록 취소
            </button>
          </div>
        )}
        <p className="daybook-notice" role="status" aria-live="polite">
          {notice ||
            "오늘 날짜로 기록합니다. 기록 후에도 현재 Day를 유지합니다."}
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
                    {entry.completed ? "복습 완료" : "진행 중"} ·{" "}
                    {entry.minutes === null
                      ? "시간 미입력"
                      : `${entry.minutes}분`}
                  </p>
                </div>
                <div>
                  <button
                    className="text-button"
                    onClick={() => setLog(entry)}
                  >
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
        <summary>회독 현황 · 자료 설정</summary>
        <Progress
          done={p.count}
          total={m.total}
          label={`${book.activeRound}회독 완료한 Day`}
        />
        <p>
          {round.nextDay === null
            ? "이번 회독의 모든 Day를 완료했습니다."
            : `다음 미완료 Day ${round.nextDay}`}
          {round.nextDay !== null && round.nextDay !== day && (
            <button
              className="text-button"
              onClick={() => browse(round.nextDay!)}
            >
              해당 Day 열기
            </button>
          )}
        </p>
        <form
          className="daybook-round-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(roundInput);
            if (!Number.isSafeInteger(value) || value < 1) {
              setError("회독 번호는 1 이상의 정수로 입력해 주세요.");
              return;
            }
            update((d) => selectDayRound(d, m.id, value));
            setNotice(`${value}회독의 저장된 Day를 불러왔습니다.`);
          }}
        >
          <label>
            회독 번호 · 횟수 제한 없음
            <input
              aria-label="회독 번호"
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
          실제 예문은 기존 Excel 자료를 참고하세요. 학습시간은 기록
          수정에서 입력할 수 있습니다.
        </p>
        <p>
          목표 {m.targetPasses ?? "미정"}회독 · 목표 이후에도 회독을 계속
          추가할 수 있습니다. 전체량 변경은 자료 설정에서 가능합니다.
        </p>
        <Link className="text-link" to="/records">
          전체 학습 기록 보기
          <ArrowRight size={14} />
        </Link>
      </details>
      {editing && (
        <MaterialForm value={m} onClose={() => setEditing(false)} />
      )}
      {log && <LogForm value={log} onClose={() => setLog(null)} />}
    </>
  );
}
