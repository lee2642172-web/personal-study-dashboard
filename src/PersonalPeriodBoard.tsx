import { useState } from "react";
import { useData } from "./state";
import { Dialog } from "./ui";
import { ActivityList } from "./StudyTimeDetails";
import { studyActivityDays } from "./dashboard";
import { personalPeriod, movePersonalPeriod } from "./personalPeriods";
import { calendarWeekdays } from "./dates";
import { formatTimeT } from "./timeUnits";
import "./personalPeriods.css";

function circles(minutes: number | null) {
  if (minutes === null) return "?";
  if (minutes === 0) return "·";
  const whole = Math.floor(minutes / 90);
  return (
    "○".repeat(Math.min(whole, 8)) +
    (whole > 8 ? "+" : "") +
    (minutes % 90 ? "◔" : "")
  );
}
export function PersonalPeriodBoard({
  today,
  onClose,
}: {
  today: string;
  onClose: () => void;
}) {
  const { data } = useData();
  const current = personalPeriod(today);
  const [period, setPeriod] = useState(current);
  const [selectedDate, setSelectedDate] = useState(today);
  const days = studyActivityDays(data, today, period.start, period.count);
  const selected = days.find((d) => d.date === selectedDate) ?? days[0];
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  function move(direction: -1 | 1) {
    const next = movePersonalPeriod(period, direction);
    setPeriod(next);
    setSelectedDate(next.start === current.start ? today : next.start);
  }
  return (
    <Dialog
      title="나의 4주 기록"
      className="study-time-dialog is-week personal-period-dialog"
      onClose={onClose}
    >
      <div className="study-detail-body">
        <div className="study-detail-summary">
          <div>
            <h3>
              {period.label}
              {period.extra ? " · 번외 1주" : ""}
            </h3>
            <p>
              {period.start.replaceAll("-", ".")} ~{" "}
              {period.end.replaceAll("-", ".")}
            </p>
          </div>
          <strong aria-label="조회 기간 총 시간">{formatTimeT(total)}</strong>
        </div>
        <nav className="study-week-nav" aria-label="나의 달 이동">
          <button
            type="button"
            className="secondary-button"
            onClick={() => move(-1)}
          >
            이전 달
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setPeriod(current);
              setSelectedDate(today);
            }}
          >
            이번 달
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={period.end >= current.end}
            onClick={() => move(1)}
          >
            다음 달
          </button>
        </nav>
        <p className="micro-note">
          ○ 하나 = 1T(90분) · 작은 기록은 묶어서 표시 · 날짜를 누르면 전체 기록
        </p>
        <div
          className="personal-period-scroll"
          role="region"
          aria-label="28칸 학습 기록판"
          tabIndex={0}
        >
          <div className="personal-period-weekdays">
            {calendarWeekdays.map((day, i) => (
              <span
                key={day}
                className={i === 5 ? "is-saturday" : i === 6 ? "is-sunday" : ""}
              >
                {day}
              </span>
            ))}
          </div>
          <div className="personal-period-grid">
            {days.map((day, i) => (
              <button
                type="button"
                key={day.date}
                className={`personal-period-day ${day.date === today ? "is-today" : ""} ${day.date === selected.date ? "is-selected" : ""} ${i % 7 === 5 ? "is-saturday" : i % 7 === 6 ? "is-sunday" : ""}`}
                aria-label={`${day.date} · ${day.entries.length}건 · ${formatTimeT(day.minutes)}`}
                aria-pressed={day.date === selected.date}
                aria-current={day.date === today ? "date" : undefined}
                onClick={() => setSelectedDate(day.date)}
              >
                <span className="personal-period-day-heading">
                  <strong>
                    {Number(day.date.slice(5, 7))}/{Number(day.date.slice(-2))}
                  </strong>
                  <small>{day.date === today ? "오늘" : `${i + 1}일째`}</small>
                </span>
                <span className="personal-period-day-total">
                  {formatTimeT(day.minutes)}
                </span>
                {day.entries.length > 0 && (
                  <span className="personal-period-compact">
                    <span className="personal-period-preview-heading">
                      <span
                        className="personal-period-circles"
                        aria-hidden="true"
                      >
                        {circles(day.minutes)}
                      </span>
                      <small>{day.entries.length}건</small>
                    </span>
                    <span
                      className="personal-period-preview-text"
                      style={{
                        WebkitLineClamp: Math.min(
                          6,
                          Math.max(1, Math.ceil(day.minutes / 90)),
                        ),
                      }}
                    >
                      {[
                        ...new Set(day.entries.map((entry) => entry.title)),
                      ].join(" · ")}
                    </span>
                  </span>
                )}
                {!day.entries.length && (
                  <small className="personal-period-empty">
                    {day.date > today ? "" : "기록 없음"}
                  </small>
                )}
              </button>
            ))}
          </div>
        </div>
        <section
          className="study-selected-records"
          aria-labelledby="personal-selected-date"
        >
          <div className="study-selected-heading">
            <h3 id="personal-selected-date">
              {selected.date.replaceAll("-", ".")} ·{" "}
              {Math.floor(days.indexOf(selected) / 7) + 1}주째
            </h3>
            <span>{formatTimeT(selected.minutes)}</span>
          </div>
          <ActivityList entries={selected.entries} />
        </section>
      </div>
    </Dialog>
  );
}
