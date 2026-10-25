import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "./state";
import { useLocalDate } from "./useLocalDate";
import { studySummary, studySeries, customsLectureProgress } from "./dashboard";
import { fields, type FieldId } from "./model";
import { getDayBook, isDayBook } from "./dayLearning";
import { Progress } from "./ui";

export function StudyTimeSummary() {
  const { data } = useData(),
    today = useLocalDate();
  const summary = studySummary(data.logs, today);
  return (
    <section className="study-time-summary" aria-label="학습시간 요약">
      {[
        ["오늘 학습시간", summary.today, today.replaceAll("-", ".")],
        ["최근 7일 학습시간", summary.week, "오늘 포함 · 최근 7일"],
        [
          "이번 달 학습시간",
          summary.month,
          `${Number(today.slice(5, 7))}월 1일 ~ 오늘`,
        ],
      ].map(([label, minutes, note]) => (
        <article key={label} className="dashboard-time-stat">
          <span>{label}</span>
          <strong>
            {minutes}
            <small>분</small>
          </strong>
          <p>{note}</p>
        </article>
      ))}
    </section>
  );
}

export function StudyTimeChart() {
  const { data } = useData(),
    today = useLocalDate();
  const [period, setPeriod] = useState<"7" | "30" | "month">("7"),
    [month, setMonth] = useState(today.slice(0, 7)),
    [area, setArea] = useState<FieldId | "">(""),
    [selection, setSelection] = useState("");
  const series = studySeries(
    data.logs,
    today,
    period,
    month,
    area || undefined,
  );
  const max = Math.max(0, ...series.map((p) => p.minutes)),
    sum = series.reduce((n, p) => n + p.minutes, 0);
  const selected =
    series.find((p) => p.date === selection) ??
    series.find((p) => p.date === today) ??
    series.at(-1);
  return (
    <section
      className="dashboard-panel study-chart"
      aria-label="날짜별 학습시간 그래프"
    >
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">ACTUAL STUDY TIME</p>
          <h2>날짜별 학습시간</h2>
        </div>
        <strong className="chart-total">{sum}분</strong>
      </div>
      <div className="study-chart-controls">
        <label>
          <span className="sr-only">학습시간 그래프 기간</span>
          <select
            aria-label="학습시간 그래프 기간"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="month">월별</option>
          </select>
        </label>
        {period === "month" && (
          <label>
            <span className="sr-only">학습시간 조회 월</span>
            <input
              aria-label="학습시간 조회 월"
              type="month"
              value={month}
              onChange={(e) => {
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
                  setMonth(e.target.value);
              }}
            />
          </label>
        )}
        <label>
          <span className="sr-only">학습시간 분야</span>
          <select
            aria-label="학습시간 분야"
            value={area}
            onChange={(e) => setArea(e.target.value as typeof area)}
          >
            <option value="">전체 분야</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chart-readout">
        <output aria-live="polite">
          {selected
            ? `${selected.date.replaceAll("-", ".")} · ${selected.minutes}분`
            : "기록 없음"}
        </output>
        <small>{max ? `최대 ${max}분` : "학습시간 기록 없음"}</small>
      </div>
      <div
        className={`study-bars ${series.length > 7 ? "is-dense" : ""}`}
        role="group"
        aria-label="날짜별 실제 학습시간"
      >
        {series.map((point, index) => (
          <button
            key={point.date}
            className={`study-bar ${selected?.date === point.date ? "is-selected" : ""}`}
            aria-label={`${point.date} 학습시간 ${point.minutes}분`}
            title={`${point.date} · ${point.minutes}분`}
            aria-pressed={selected?.date === point.date}
            onMouseEnter={() => setSelection(point.date)}
            onFocus={() => setSelection(point.date)}
            onClick={() => setSelection(point.date)}
            data-date={point.date}
            data-minutes={point.minutes}
          >
            <span className="study-bar-track">
              <span
                className={`study-bar-fill ${point.minutes === 0 ? "is-zero" : ""}`}
                style={{
                  height: max ? `${(point.minutes / max) * 100}%` : "0%",
                }}
              />
            </span>
            <span className="study-bar-date" aria-hidden="true">
              {series.length <= 7
                ? `${Number(point.date.slice(5, 7))}/${Number(point.date.slice(-2))}`
                : index === 0 ||
                    index === series.length - 1 ||
                    Number(point.date.slice(-2)) % 5 === 0
                  ? Number(point.date.slice(-2))
                  : ""}
            </span>
          </button>
        ))}
      </div>
      <p className="micro-note">
        {period === "month" ? "선택한 월의 일별 기록 · " : ""}실제 학습일 기준 ·
        시간 미입력·취소 기록·자료 정비 제외 · 막대를 누르면 상세 수치를 확인할
        수 있어요.
      </p>
    </section>
  );
}

export function CustomsDashboard() {
  const { data } = useData();
  const [round, setRound] = useState(1);
  const summary = customsLectureProgress(data, round);
  const rounds = [
    ...new Set([
      1,
      ...data.logs
        .filter(
          (l) =>
            summary.subjects.some((s) => s.material.id === l.materialId) &&
            !l.voided,
        )
        .map((l) => l.round),
    ]),
  ].sort((a, b) => a - b);
  return (
    <section
      className="dashboard-panel customs-dashboard"
      aria-label="관세사 강의 진도 현황"
    >
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">CERTIFICATION · MAIN</p>
          <h2>
            <Link to="/fields/customs">관세사 1차</Link>
          </h2>
        </div>
        <label>
          <span className="sr-only">HOME 관세사 회독</span>
          <select
            aria-label="HOME 관세사 회독"
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
          >
            {rounds.map((r) => (
              <option key={r} value={r}>
                {r}회독
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="customs-total">
        <strong>
          {Number(summary.percent.toFixed(1))}
          <small>%</small>
        </strong>
        <span>
          전체 완료 {summary.done} / {summary.total}강
        </span>
      </div>
      {summary.total ? (
        <>
          <Progress
            done={summary.done}
            total={summary.total}
            label="관세사 전체 강의 진도"
          />
          <ul className="customs-subjects">
            {summary.subjects.map(({ material, total, done }) => (
              <li key={material.id}>
                <Link to={`/materials/${material.id}?round=${round}`}>
                  <div>
                    <strong>{material.title}</strong>
                    <span>
                      {done} / {total}강
                    </span>
                  </div>
                  <Progress
                    done={done}
                    total={total}
                    label={`${material.title} ${round}회독`}
                  />
                  {material.lectureCatalogStatus === "ongoing" && (
                    <small>추가 예정 · 현재 등록 강의 기준</small>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="dashboard-empty">등록된 강의 목록이 없습니다.</p>
      )}
      <div className="dashboard-panel-footer">
        <span>전체 완료 수 ÷ 등록 강의 수 · {round}회독 기준</span>
        <Link className="text-link" to="/certifications">
          다른 자격증 →
        </Link>
      </div>
    </section>
  );
}

export function LanguageSnapshot() {
  const { data } = useData();
  const practice = [...data.logs]
    .reverse()
    .filter(
      (l) =>
        l.area === "english" &&
        !l.voided &&
        (l.topic || l.writing || l.speaking),
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  return (
    <section
      className="dashboard-panel language-snapshot"
      aria-label="외국어 학습 위치"
    >
      <div className="dashboard-panel-heading">
        <h2>학습 위치와 연습 기록</h2>
        <Link className="text-link" to="/languages">
          외국어 전체 →
        </Link>
      </div>
      <ul className="snapshot-list">
        {data.materials.filter(isDayBook).map((m) => {
          const book = getDayBook(data, m),
            round = book.rounds.find((r) => r.round === book.activeRound)!;
          const logs = data.logs.filter(
            (l) =>
              l.materialId === m.id &&
              l.activity !== "system" &&
              !l.voided &&
              l.completed,
          );
          return (
            <li key={m.id}>
              <Link to={`/materials/${m.id}`}>
                <strong>{m.title}</strong>
                <span>
                  {book.activeRound}회독 · 학습 위치 Day {round.lastOpenedDay}
                  <small>
                    {logs.length
                      ? `최근 복습 Day ${[...logs].reverse().find((l) => !l.initialLearning)?.item ?? "미기록"}`
                      : "아직 학습 기록 없음"}{" "}
                    · {m.status}
                  </small>
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link to="/english">
            <strong>OPIc 영작·말하기</strong>
            <span>
              {practice
                ? practice.topic || "연습 기록 있음"
                : "아직 연습 기록 없음"}
              <small>
                {practice
                  ? `실제 학습일 ${practice.date ?? "미입력"} · ${practice.writing ? "영작 " : ""}${practice.speaking ? "말하기" : ""}`
                  : "교재 회독과 독립적으로 관리"}
              </small>
            </span>
          </Link>
        </li>
        {fields
          .filter((f) => f.category === "languages" && f.id !== "english")
          .map((f) => {
            const latest = [...data.logs]
              .reverse()
              .filter(
                (l) => l.area === f.id && l.activity !== "system" && !l.voided,
              )
              .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
            const material = data.materials.find(
              (m) => m.id === latest?.materialId,
            );
            return (
              <li key={f.id}>
                <Link to={`/fields/${f.id}`}>
                  <strong>{f.title}</strong>
                  <span>
                    {latest
                      ? `${material?.title || latest.topic || "학습 기록"}${latest.item ? ` · ${latest.item}` : ""}`
                      : "아직 학습 기록 없음"}
                    {latest && (
                      <small>{latest.date ?? "실제 학습일 미입력"}</small>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
