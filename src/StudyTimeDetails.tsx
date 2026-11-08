import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "./state";
import { type ActivityEntry } from "./activities";
import { studyActivityDays } from "./dashboard";
import { calendarWeekdays, shiftDate, weekStart } from "./dates";
import { ActivityLabels, Dialog } from "./ui";
import { fieldName } from "./model";
import { isEbsCourse } from "./ebs";
import { itemLabel } from "./TodayLearning";
import { workLabel } from "./taskWork";
import { todoGroupItems } from "./todos";
import { formatTimeT } from "./timeUnits";
import "./studyTimeDetails.css";

function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  const { data } = useData();
  if (!entries.length)
    return <p className="study-detail-empty">이 날짜에는 기록이 없습니다.</p>;
  return (
    <ul className="study-detail-list" aria-label="선택한 날짜의 기록 목록">
      {entries.map((entry) => {
        let href: string, detail: string;
        if (entry.source === "study") {
          const material = data.materials.find(
            (m) => m.id === entry.log.materialId,
          );
          href = material
            ? isEbsCourse(material)
              ? "/english/ebs"
              : `/materials/${material.id}`
            : "/records";
          detail = [
            entry.log.initialLearning
              ? "신규 학습"
              : ActivityLabels[entry.activity],
            fieldName(entry.log.area),
            itemLabel(entry.log, material),
            !entry.log.completed ? "진행 중" : "",
          ]
            .filter(Boolean)
            .join(" · ");
        } else if (entry.source === "task") {
          href = `/tasks/${entry.task.id}`;
          detail = `과업 작업 · ${workLabel(entry.task, entry.record)}`;
        } else {
          href = `/tasks?todo=${encodeURIComponent(entry.todo.id)}`;
          detail = entry.todo.isGroup
            ? todoGroupItems(data.todos, entry.todo.id)
                .map((todo) => todo.title)
                .join(" · ")
            : "할 일 완료";
        }
        return (
          <li key={entry.id}>
            <Link to={href} className="study-detail-entry">
              <span className="study-detail-copy">
                <strong>{entry.title}</strong>
                <small>{detail}</small>
              </span>
              <span className="study-detail-time">
                {entry.minutes === null
                  ? "시간 미입력"
                  : formatTimeT(entry.minutes)}
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function StudyTimeDetails({
  mode,
  today,
  onClose,
}: {
  mode: "today" | "week";
  today: string;
  onClose: () => void;
}) {
  const { data } = useData();
  const [offset, setOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const start =
    mode === "today" ? today : shiftDate(weekStart(today), offset * 7);
  const days = studyActivityDays(data, today, start, mode === "today" ? 1 : 7);
  const selected = days.find((day) => day.date === selectedDate) ?? days[0];
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const count = days.reduce((sum, day) => sum + day.entries.length, 0);
  function moveWeek(next: number) {
    setOffset(next);
    setSelectedDate(next === 0 ? today : shiftDate(weekStart(today), next * 7));
  }
  return (
    <Dialog
      title={mode === "today" ? "오늘의 학습 기록" : "주간 학습 캘린더"}
      onClose={onClose}
      className={`study-time-dialog ${mode === "week" ? "is-week" : ""}`}
    >
      <div className="study-detail-body">
        <div className="study-detail-summary">
          <div>
            <p>
              {mode === "today"
                ? today.replaceAll("-", ".")
                : `${start.replaceAll("-", ".")} ~ ${days[6].date.replaceAll("-", ".")}`}
            </p>
            <span>학습·할 일·과업 작업 {count}건</span>
          </div>
          <strong aria-label="조회 기간 총 시간">{formatTimeT(total)}</strong>
        </div>
        {mode === "week" && (
          <>
            <nav className="study-week-nav" aria-label="학습 주간 이동">
              <button
                type="button"
                className="secondary-button"
                aria-label="이전 주"
                onClick={() => moveWeek(offset - 1)}
              >
                <ChevronLeft size={16} /> 이전 주
              </button>
              <button
                type="button"
                className="text-button"
                disabled={offset === 0}
                onClick={() => moveWeek(0)}
              >
                이번 주
              </button>
              <button
                type="button"
                className="secondary-button"
                aria-label="다음 주"
                disabled={offset >= 0}
                onClick={() => moveWeek(offset + 1)}
              >
                다음 주 <ChevronRight size={16} />
              </button>
            </nav>
            <div
              className="study-week-scroll"
              role="region"
              aria-label="월요일부터 일요일 학습 캘린더"
              tabIndex={0}
            >
              <div className="study-week-grid">
                {days.map((day, index) => (
                  <button
                    type="button"
                    key={day.date}
                    className={`study-week-day ${index === 5 ? "is-saturday" : index === 6 ? "is-sunday" : ""} ${day.date === today ? "is-today" : ""} ${day.date === selected.date ? "is-selected" : ""}`}
                    aria-label={`${day.date} ${calendarWeekdays[index]}요일 · ${day.entries.length}건 · ${formatTimeT(day.minutes)}`}
                    aria-pressed={day.date === selected.date}
                    aria-current={day.date === today ? "date" : undefined}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <span className="study-week-weekday">
                      {calendarWeekdays[index]}
                    </span>
                    <span className="study-week-date">
                      {Number(day.date.slice(5, 7))}/
                      {Number(day.date.slice(-2))}
                      {day.date === today && <small>오늘</small>}
                    </span>
                    <strong className="study-week-total">
                      {formatTimeT(day.minutes)}
                    </strong>
                    <span className="study-week-previews">
                      {day.entries.slice(0, 3).map((entry) => (
                        <span key={entry.id}>
                          {entry.title}
                          <small>
                            {entry.minutes === null
                              ? "시간 미입력"
                              : formatTimeT(entry.minutes)}
                          </small>
                        </span>
                      ))}
                      {day.entries.length > 3 && (
                        <small>
                          외 {day.entries.length - 3}건 · 눌러서 전체 보기
                        </small>
                      )}
                      {!day.entries.length && <small>기록 없음</small>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <section
          className="study-selected-records"
          aria-labelledby="study-selected-date"
        >
          <div className="study-selected-heading">
            <h3 id="study-selected-date">
              {selected.date.replaceAll("-", ".")} 기록
            </h3>
            <span>
              {selected.entries.length}건 · {formatTimeT(selected.minutes)}
            </span>
          </div>
          <ActivityList entries={selected.entries} />
          {selected.unknown > 0 && (
            <p className="micro-note">
              시간 미입력 {selected.unknown}건은 합계에서 제외됩니다.
            </p>
          )}
        </section>
        <p className="micro-note">
          실제 기록일 기준 · 1T = 90분 · 기록을 누르면 해당 학습 또는 과업
          화면으로 이동합니다.
        </p>
      </div>
    </Dialog>
  );
}
