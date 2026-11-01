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
  fieldName,
} from "./model";
import { DayLearningForm } from "./DayLearningForm";
import { localDate, isDateString } from "./dates";
import { isEeaMaterial } from "./catalogs/eea";
import { defaultStudyMinutes, isBasicStudyBook } from "./studyBooks";
import {
  getDayBook,
  ensureDayBook,
  selectDayRound,
  startDayRound,
  openDay,
  recordDayReview,
  cancelDayReview,
  dayCompleted,
  dayRoundTotal,
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
  const [newLearning, setNewLearning] = useState<"append" | "current" | null>(
    null,
  );
  const numberedVocabulary =
    !!m.vocabularyId && ["chinese", "spanish"].includes(m.area);
  const eea = isEeaMaterial(m);
  const unitBook = isBasicStudyBook(m);
  const studyBook = eea || unitBook;
  const itemLabel = unitBook ? "Unit" : "Day";
  const itemPlural = unitBook ? "Units" : "Days";
  const datedLearning = numberedVocabulary || studyBook;
  const initialMinutes = defaultStudyMinutes(m);
  const minuteDefault = initialMinutes === null ? "" : String(initialMinutes);
  const [reviewDate, setReviewDate] = useState(localDate);
  const [reviewMinutes, setReviewMinutes] = useState(minuteDefault);
  useEffect(() => {
    setReviewMinutes(minuteDefault);
    setReviewDate(localDate());
  }, [m.id, minuteDefault]);
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
          eyebrow={studyBook ? "STUDY BOOK" : "VOCABULARY"}
          title={m.title}
          description={`자료 전체 ${itemLabel} 수를 입력하면 이어서 학습을 시작할 수 있습니다.`}
        />
        {m.vocabularyId ? (
          <Link className="primary-button" to={`/vocabulary/${m.vocabularyId}`}>
            Day 번호 설정
          </Link>
        ) : (
          <button className="primary-button" onClick={() => setEditing(true)}>
            자료 설정 수정
          </button>
        )}
        {editing && (
          <MaterialForm value={m} onClose={() => setEditing(false)} />
        )}
      </>
    );
  const day = round.lastOpenedDay;
  const scope = dayRoundTotal(book, book.activeRound);
  const p = progress({ ...m, total: scope }, data.logs, book.activeRound);
  const entries = data.logs.filter(
    (l) =>
      l.materialId === m.id &&
      Number(l.item) === day &&
      l.activity !== "system" &&
      !l.voided,
  );
  const count = entries.filter(
    (l) => l.completed && !l.voided && !l.initialLearning,
  ).length;
  const initialCount = entries.filter(
    (l) => l.completed && !l.voided && l.initialLearning,
  ).length;
  const currentCount = entries.filter(
    (l) =>
      l.round === book.activeRound &&
      l.completed &&
      !l.voided &&
      !l.initialLearning,
  ).length;
  const complete =
    day <= scope && dayCompleted(data.logs, m.id, book.activeRound, day);
  const last = [...data.logs]
    .reverse()
    .find(
      (l) =>
        l.materialId === m.id &&
        (l.initialLearning || l.round === book.activeRound) &&
        l.activity !== "system" &&
        l.completed &&
        !l.voided,
    );
  function browse(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > m.total!) {
      setError(`${itemLabel} 1~${m.total} 사이의 번호를 입력해 주세요.`);
      return;
    }
    setError("");
    update((d) => openDay(d, m.id, book.activeRound, value));
  }
  function review() {
    const id = newId();
    const date = datedLearning ? reviewDate : localDate();
    const minutes =
      datedLearning && reviewMinutes.trim() !== ""
        ? Number(reviewMinutes)
        : null;
    if (
      !isDateString(date) ||
      date > localDate() ||
      (minutes !== null && (!Number.isFinite(minutes) || minutes < 0))
    ) {
      setError(
        "실제 학습 날짜와 0 이상의 학습시간을 입력해 주세요. 미래 날짜는 기록할 수 없습니다.",
      );
      return;
    }
    setError("");
    update((d) =>
      recordDayReview(d, m.id, book.activeRound, day, id, date, minutes),
    );
    setReviewMinutes(minuteDefault);
    setNotice(
      `${itemLabel} ${day} · ${date}${minutes === null ? " · 시간 미입력" : ` · ${minutes}분`} ${studyBook ? "학습" : "복습"}을 기록했습니다. 선택한 ${itemLabel} 위치는 그대로 유지됩니다.`,
    );
  }
  function cancel(entry: StudyLog) {
    update((d) => cancelDayReview(d, entry.id));
    setNotice(
      `${itemLabel} ${entry.item} ${entry.initialLearning ? "신규 학습" : studyBook ? "학습" : "복습"} 기록을 삭제했습니다. ${entry.initialLearning ? `${itemLabel} 위치는 유지됩니다.` : `선택한 ${itemLabel} 위치는 그대로 유지됩니다.`}`,
    );
  }
  return (
    <>
      <Link
        to={m.area === "english" ? "/english" : `/fields/${m.area}`}
        className="back-link"
      >
        <ArrowLeft size={15} />
        {fieldName(m.area)} 학습으로
      </Link>
      <PageHeading
        eyebrow={`${fieldName(m.area)} · ${unitBook ? "UNIT" : "DAY"} STUDY`}
        title={m.title}
        description={`${m.total} ${itemPlural} · 회독을 선택하고 ${itemLabel}별 ${studyBook ? "학습" : "복습"}을 기록하세요.`}
        action={
          <button className="secondary-button" onClick={() => setEditing(true)}>
            <Pencil size={15} />
            자료 설정
          </button>
        }
      />
      <section
        className="daybook-panel"
        aria-label={
          studyBook
            ? `${itemLabel} 통합 회독 학습 패널`
            : "단어장 통합 학습 패널"
        }
      >
        <div className="daybook-toolbar">
          <label>
            학습 회독
            <select
              aria-label="학습 회독"
              value={book.activeRound}
              onChange={(e) => {
                update((d) => selectDayRound(d, m.id, Number(e.target.value)));
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
          <div className="daybook-toolbar-actions">
            {m.vocabularyId ? (
              <Link
                className="secondary-button"
                to={`/vocabulary/${m.vocabularyId}`}
              >
                Day 추가·관리
              </Link>
            ) : !studyBook ? (
              <button
                className="secondary-button"
                disabled={m.total >= 10000}
                onClick={() => setNewLearning("append")}
              >
                <Plus size={15} />새 Day 학습
              </button>
            ) : null}
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
        </div>
        <div className="daybook-focus">
          <p className="eyebrow">
            {book.activeRound}회독 · 총 {m.total} {itemPlural}
          </p>
          <h2>
            {itemLabel} <strong>{day}</strong>
          </h2>
          <p className="daybook-count">
            {!studyBook && (
              <>
                신규 학습 <strong>{initialCount}회</strong> ·{" "}
              </>
            )}
            {studyBook ? "누적 학습 " : "복습 "}
            <strong>{count}회</strong>
          </p>
          <p className="daybook-round-count">
            현재 회독 {studyBook ? "학습" : "복습"} {currentCount}회
          </p>
          <span className={`status-pill ${complete ? "daybook-done" : ""}`}>
            {day > scope
              ? `이전 회독 범위 밖의 ${itemLabel}`
              : complete
                ? `이 회독에서 ${studyBook ? "학습" : "복습"} 완료`
                : "이 회독에서 기록 전"}
          </span>
          {datedLearning && (
            <div className="daybook-record-inputs">
              <label>
                학습 날짜
                <input
                  aria-label="학습 날짜"
                  type="date"
                  required
                  max={localDate()}
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                />
              </label>
              <label>
                학습시간 (분, 선택)
                <input
                  aria-label="학습시간 (분)"
                  type="number"
                  min="0"
                  step="0.5"
                  value={reviewMinutes}
                  onChange={(e) => setReviewMinutes(e.target.value)}
                  placeholder="미입력"
                />
              </label>
            </div>
          )}
          <button
            className="primary-button daybook-review-button"
            onClick={review}
            disabled={day > scope}
          >
            <BookOpen size={18} />
            {studyBook ? "학습 기록하기" : "복습 기록하기"}
          </button>
          {day > scope && (
            <p className="micro-note">
              이 회독의 범위는 {itemLabel} 1~{scope}입니다. 추가한 항목은 새
              회독에서 학습하세요.
            </p>
          )}
        </div>
        <div className="daybook-navigation" aria-label={`${itemLabel} 이동`}>
          <button
            className="secondary-button"
            disabled={day === 1}
            onClick={() => browse(day - 1)}
          >
            <ChevronLeft size={16} />
            이전 {itemLabel}
          </button>
          <label>
            {itemLabel} 바로가기
            <input
              aria-label={`${itemLabel} 바로가기`}
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
            다음 {itemLabel}
            <ChevronRight size={16} />
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {last && (
          <div className="daybook-last-review" aria-label="최근 학습 기록">
            <span>
              최근 기록 ·{" "}
              {last.initialLearning
                ? "신규 학습"
                : `${last.round}회독 ${studyBook ? "학습" : "복습"}`}{" "}
              {itemLabel} {last.item} · {last.date ?? "날짜 미입력"}
            </span>
            <button className="text-button" onClick={() => cancel(last)}>
              <RotateCcw size={14} />
              최근 기록 취소
            </button>
          </div>
        )}
        <p className="daybook-notice" role="status" aria-live="polite">
          {notice ||
            (datedLearning
              ? `선택한 날짜와 시간으로 기록합니다. 기록 후에도 현재 ${itemLabel}를 유지합니다.`
              : `오늘 날짜로 기록합니다. 기록 후에도 현재 ${itemLabel}를 유지합니다.`)}
        </p>
        <details className="daybook-history">
          <summary>
            이 {itemLabel}의 전체 학습 기록 {entries.length}건
          </summary>
          {!studyBook && (
            <button
              className="text-button"
              onClick={() => setNewLearning("current")}
            >
              이 Day 신규 학습 기록
            </button>
          )}
          {entries.length ? (
            entries.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>
                    {entry.initialLearning ? "신규 학습" : `${entry.round}회독`}{" "}
                    · {entry.date ?? "날짜 미입력"}
                  </strong>
                  <p>
                    {entry.completed
                      ? entry.initialLearning
                        ? "신규 학습 완료"
                        : studyBook
                          ? "학습 완료"
                          : "복습 완료"
                      : "진행 중"}{" "}
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
            <Empty>이 {itemLabel}의 학습 기록이 없습니다.</Empty>
          )}
        </details>
      </section>
      <details className="daybook-info">
        <summary>회독 현황 · 자료 설정</summary>
        <Progress
          done={p.count}
          total={scope}
          label={`${book.activeRound}회독 완료한 ${itemLabel}`}
        />
        <p>
          {round.nextDay === null
            ? `이번 회독의 모든 ${itemLabel}를 완료했습니다.`
            : `다음 미완료 ${itemLabel} ${round.nextDay}`}
          {round.nextDay !== null && round.nextDay !== day && (
            <button
              className="text-button"
              onClick={() => browse(round.nextDay!)}
            >
              해당 {itemLabel} 열기
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
        {!numberedVocabulary && <p>{m.note}</p>}
        <p>
          {studyBook
            ? "학습 내용은 교재를 참고하세요."
            : "단어 내용은 기존 Excel 자료를 참고하세요."}{" "}
          학습 날짜와 시간은 기록 수정에서도 변경할 수 있습니다.
        </p>
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
      {log && (
        <LogForm
          value={log}
          lockMaterial={!!log.initialLearning}
          onClose={() => setLog(null)}
        />
      )}
      {newLearning && (
        <DayLearningForm
          material={m}
          day={newLearning === "append" ? m.total + 1 : day}
          append={newLearning === "append"}
          onClose={() => setNewLearning(null)}
          onSaved={(savedDay) => {
            setNewLearning(null);
            setNotice(
              `Day ${savedDay} 신규 학습을 기록했습니다. 복습 횟수는 별도로 관리됩니다.`,
            );
          }}
        />
      )}
    </>
  );
}
