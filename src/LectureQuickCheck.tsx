import { useLayoutEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { type Material, type StudyLog, newId, progress } from "./model";
import { useData } from "./state";
import { localDate } from "./dates";
import { Progress } from "./ui";
import {
  lectureCompleted,
  lectureMinutes,
  nextLecture,
  recordLectureCompletion,
  cancelLectureCompletion,
} from "./lectureLearning";

export function LectureQuickCheck({
  material: m,
  round,
  onRoundChange,
  onEdit,
}: {
  material: Material;
  round: number;
  onRoundChange: (round: number) => void;
  onEdit: (log: StudyLog) => void;
}) {
  const { data, update } = useData();
  const [number, setNumber] = useState(() => nextLecture(m, data.logs, round));
  const [minutes, setMinutes] = useState("");
  const [notice, setNotice] = useState("");
  useLayoutEffect(() => {
    setNumber(nextLecture(m, data.logs, round));
    setNotice("");
  }, [m.id, round, m.total]);
  const complete = lectureCompleted(data.logs, m.id, round, number);
  const latest = [...data.logs]
    .reverse()
    .find(
      (l) =>
        l.materialId === m.id &&
        l.round === round &&
        Number(l.item) === number &&
        l.activity !== "system" &&
        l.completed &&
        !l.voided,
    );
  const lecture = m.lectures?.find((l) => l.number === number);
  const defaultMinutes = lectureMinutes(m, number);
  useLayoutEffect(
    () =>
      setMinutes(
        latest
          ? latest.minutes === null
            ? ""
            : String(latest.minutes)
          : defaultMinutes === null
            ? ""
            : String(defaultMinutes),
      ),
    [number, round, m.id, latest?.id, latest?.minutes, defaultMinutes],
  );
  if (!m.total) return null;
  function toggle() {
    if (complete) {
      update((d) => cancelLectureCompletion(d, m.id, round, number));
      setNotice(`제 ${number}강 완료 기록을 취소했습니다.`);
      return;
    }
    const time = minutes.trim() === "" ? defaultMinutes : Number(minutes);
    if (time === null || !Number.isFinite(time) || time < 0) {
      setNotice("학습시간은 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    const id = newId(),
      date = localDate();
    update((d) =>
      recordLectureCompletion(d, m.id, round, number, id, date, time),
    );
    setNotice(`제 ${number}강 수강 완료 · ${date} · ${time}분`);
  }
  return (
    <section className="lecture-quick-panel" aria-label="빠른 수강 체크">
      <div className="lecture-quick-heading">
        <div>
          <p className="eyebrow">QUICK CHECK</p>
          <h2>빠른 수강 체크</h2>
        </div>
        <label>
          학습 회독
          <input
            aria-label="빠른 체크 회독"
            type="number"
            min="1"
            step="1"
            value={round}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isSafeInteger(value) && value > 0)
                onRoundChange(value);
            }}
          />
        </label>
      </div>
      <div className="lecture-quick-focus">
        <p className="eyebrow">
          {round}회독 ·{" "}
          {m.lectureCatalogStatus === "ongoing" ? "현재 등록" : "총"} {m.total}
          강
        </p>
        <h3>
          제 <strong>{number}</strong>강
        </h3>
        <p className="lecture-quick-title">
          {lecture?.title ?? `제 ${number}강`}
        </p>
        {lecture && (
          <p className="micro-note">강의 길이 {lecture.duration}분</p>
        )}
        <div className="lecture-quick-time">
          <label>
            학습시간 (분, 수정 가능)
            <input
              aria-label="빠른 체크 학습시간"
              type="number"
              min="0"
              step="0.5"
              placeholder={
                defaultMinutes === null
                  ? "학습시간 입력"
                  : `기본 ${defaultMinutes}분`
              }
              disabled={complete}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          {lecture && !complete && (
            <button
              className="text-button"
              onClick={() => setMinutes(String(lecture.duration))}
            >
              {lecture.duration}분으로 초기화
            </button>
          )}
        </div>
        <button
          className={`primary-button lecture-check-button ${complete ? "is-complete" : ""}`}
          aria-pressed={complete}
          onClick={toggle}
        >
          {complete && <Check size={18} aria-hidden="true" />}
          {complete ? "수강 완료 · 취소하기" : "수강 완료하기"}
        </button>
        {latest && (
          <button className="text-button" onClick={() => onEdit(latest)}>
            <Pencil size={13} />
            날짜·시간 수정
          </button>
        )}
      </div>
      <div className="lecture-quick-navigation">
        <button
          className="secondary-button"
          disabled={number <= 1}
          onClick={() => setNumber(number - 1)}
        >
          <ChevronLeft size={16} />
          이전 강의
        </button>
        <label>
          강의 선택
          <select
            aria-label="빠른 체크 강의 선택"
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
          >
            {Array.from({ length: m.total }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                제 {n}강 ·{" "}
                {m.lectures?.find((l) => l.number === n)?.title ?? "강의"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={number >= m.total}
          onClick={() => setNumber(number + 1)}
        >
          다음 강의
          <ChevronRight size={16} />
        </button>
      </div>
      <p className="lecture-quick-notice" role="status">
        {notice ||
          "오늘 날짜와 강의 시간으로 기록합니다. 학습시간은 수정할 수 있으며, 완료 후 강의는 자동 이동하지 않습니다."}
      </p>
      <Progress
        done={progress(m, data.logs, round).count}
        total={m.total}
        label={`${round}회독 수강 완료`}
      />
    </section>
  );
}
