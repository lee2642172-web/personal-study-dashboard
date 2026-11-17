import { Link } from "react-router-dom";
import { useState } from "react";
import { useData } from "./state";
import { Dialog } from "./ui";

import { studyActivityDays } from "./dashboard";
import { personalPeriod, movePersonalPeriod } from "./personalPeriods";
import { calendarWeekdays } from "./dates";
import { formatTimeT, formatT } from "./timeUnits";
import { notebookRows } from "./notebookRows";
import { notebookLabel } from "./notebookLabels";
import "./personalPeriods.css";

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
          한 줄 = 1T(90분) · ◔는 남은 시간 · 날짜를 누르면 하루 기록 페이지로
          이동
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
              <Link
                to={`/days/${day.date}`}
                key={day.date}
                className={`personal-period-day ${day.date === today ? "is-today" : ""} ${day.date === selected.date ? "is-selected" : ""} ${i % 7 === 5 ? "is-saturday" : i % 7 === 6 ? "is-sunday" : ""}`}
                aria-label={`${day.date} · ${day.entries.length}건 · ${formatTimeT(day.minutes)}`}
                title={day.entries.map((entry) => entry.title).join("\n")}
                aria-current={day.date === today ? "date" : undefined}
                onClick={onClose}
              >
                <span className="personal-period-day-heading">
                  <strong>
                    {Number(day.date.slice(5, 7))}/{Number(day.date.slice(-2))}
                  </strong>
                  <small>
                    {day.date === today ? "오늘 · " : ""}
                    {formatT(day.minutes)}
                  </small>
                </span>
                {day.entries.length > 0 && (
                  <span className="personal-period-t-rows">
                    {notebookRows(
                      day.entries.map((entry) => ({
                        ...entry,
                        title: notebookLabel(entry, data.materials),
                      })),
                    ).map((row, index) => (
                      <span
                        className="personal-period-t-row"
                        key={index}
                        title={`${formatTimeT(row.minutes)} · ${row.titles.join(" · ")}`}
                      >
                        <span
                          className="personal-period-circles"
                          aria-hidden="true"
                        >
                          {row.minutes >= 90 - 1e-8
                            ? "○"
                            : row.minutes > 0
                              ? "◔"
                              : "·"}
                        </span>
                        <span className="personal-period-t-text">
                          {row.titles[0]}
                        </span>
                        {row.titles.length > 1 && (
                          <small className="personal-period-more">
                            +{row.titles.length - 1}
                          </small>
                        )}
                      </span>
                    ))}
                  </span>
                )}
                {!day.entries.length && (
                  <small className="personal-period-empty">
                    {day.date > today ? "" : "기록 없음"}
                  </small>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
