import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";
import { useData } from "./state";
import { useLocalDate } from "./useLocalDate";
import { PageHeading, Dialog, Empty } from "./ui";
import { fields, fieldName, newId, type CalendarEvent } from "./model";
import { isDateString, calendarDates, shiftMonth } from "./dates";
import {
  eventCategories,
  eventError,
  saveCalendarEvent,
  deleteCalendarEvent,
  eventOnDate,
  eventDateLabel,
  eventCategoryLabel,
  upcomingEvents,
  dDay,
} from "./calendar";

export function UpcomingEvents() {
  const { data } = useData();
  const today = useLocalDate();
  const upcoming = upcomingEvents(data.events ?? [], today).slice(0, 5);
  return (
    <section
      className="dashboard-panel upcoming-events"
      aria-label="다가오는 일정"
    >
      <div className="dashboard-panel-heading">
        <h2>다가오는 일정</h2>
        <Link className="text-link" to="/calendar">
          캘린더 보기 →
        </Link>
      </div>
      {upcoming.length ? (
        <ul className="upcoming-list">
          {upcoming.map(({ event, date }) => (
            <li key={event.id}>
              <Link to={`/calendar?date=${date}`}>
                <div>
                  <span className="schedule-category">
                    {eventCategoryLabel(event)}
                  </span>
                  <strong>{event.title}</strong>
                  <small>{eventDateLabel(event)}</small>
                </div>
                <span
                  className={`schedule-dday ${event.category === "시험" ? "exam" : ""}`}
                >
                  {dDay(date, today)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-empty">
          등록된 예정 일정이 없습니다. <Link to="/calendar">일정 추가</Link>
        </p>
      )}
    </section>
  );
}

function EventForm({
  event,
  onClose,
  onSaved,
  isNew,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onSaved: (date: string) => void;
  isNew: boolean;
}) {
  const { data, update } = useData();
  const [value, setValue] = useState(event),
    [error, setError] = useState("");
  const patch = (p: Partial<CalendarEvent>) =>
    setValue((v) => ({ ...v, ...p }));
  function submit(e: FormEvent) {
    e.preventDefault();
    const error = eventError(value);
    if (error) {
      setError(error);
      return;
    }
    update((d) => saveCalendarEvent(d, value));
    onSaved(value.date);
    onClose();
  }
  return (
    <Dialog title={isNew ? "일정 추가" : "일정 수정"} onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <label>
          일정명
          <input
            required
            maxLength={200}
            value={value.title}
            onChange={(e) => patch({ title: e.target.value })}
            autoFocus
          />
        </label>
        <div className="form-grid">
          <label>
            날짜
            <input
              required
              type="date"
              value={value.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </label>
          <label>
            종료일 (선택)
            <input
              type="date"
              min={value.date}
              value={value.endDate}
              onChange={(e) => patch({ endDate: e.target.value })}
            />
          </label>
          <label>
            시작 시간 (선택)
            <input
              type="time"
              value={value.startTime}
              onChange={(e) => patch({ startTime: e.target.value })}
            />
          </label>
          <label>
            종료 시간 (선택)
            <input
              type="time"
              value={value.endTime}
              onChange={(e) => patch({ endTime: e.target.value })}
            />
          </label>
          <label>
            일정 분류
            <select
              aria-label="일정 분류"
              value={value.category}
              onChange={(e) =>
                patch({
                  category: e.target.value as CalendarEvent["category"],
                  registrationPhase: "",
                })
              }
            >
              {eventCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {value.category === "시험 접수" && (
            <label>
              접수 구분
              <select
                aria-label="접수 구분"
                value={value.registrationPhase}
                onChange={(e) =>
                  patch({
                    registrationPhase: e.target
                      .value as CalendarEvent["registrationPhase"],
                  })
                }
              >
                <option value="">접수 기간 / 일반</option>
                <option value="start">접수 시작</option>
                <option value="deadline">접수 마감</option>
              </select>
            </label>
          )}
          <label>
            관련 학습 분야 (선택)
            <select
              aria-label="관련 학습 분야 (선택)"
              value={value.area}
              onChange={(e) =>
                patch({ area: e.target.value as CalendarEvent["area"] })
              }
            >
              <option value="">연결 없음</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            관련 시험 목표 (선택)
            <select
              aria-label="관련 시험 목표 (선택)"
              value={value.goalId}
              onChange={(e) => {
                const goal = data.goals.find((g) => g.id === e.target.value);
                patch({
                  goalId: e.target.value,
                  ...(!value.area && goal ? { area: goal.area } : {}),
                });
              }}
            >
              <option value="">연결 없음</option>
              {value.goalId &&
                !data.goals.some((g) => g.id === value.goalId) && (
                  <option value={value.goalId}>
                    기존 목표 (현재 목록에 없음)
                  </option>
                )}
              {data.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          메모
          <textarea
            rows={3}
            value={value.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="form-help">
          시험 접수 시작·마감, 시험일, 성적 발표일은 각각 일정으로 등록할 수
          있습니다. 일정은 학습 완료나 학습시간으로 집계되지 않습니다.
        </p>
        <div className="schedule-form-actions">
          <button className="primary-button" type="submit">
            일정 저장
          </button>
          {!isNew && (
            <button
              className="schedule-delete"
              type="button"
              onClick={() => {
                update((d) => deleteCalendarEvent(d, value.id));
                onClose();
              }}
            >
              일정 삭제
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export function CalendarPage() {
  const { data } = useData(),
    today = useLocalDate();
  const [params, setParams] = useSearchParams();
  const selected = isDateString(params.get("date") ?? "")
    ? params.get("date")!
    : today;
  const month = selected.slice(0, 7);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const events = data.events ?? [];
  const selectedEvents = events
    .filter((e) => eventOnDate(e, selected))
    .sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) ||
        a.title.localeCompare(b.title),
    );
  const select = (date: string) => setParams({ date });
  function changeMonth(next: string) {
    if (
      /^\d{4}-(0[1-9]|1[0-2])$/.test(next) &&
      Number(next.slice(0, 4)) >= 1 &&
      Number(next.slice(0, 4)) <= 9999
    )
      select(`${next}-01`);
  }
  function add() {
    setEditing({
      id: newId(),
      title: "",
      date: selected,
      endDate: "",
      startTime: "",
      endTime: "",
      category: "기타",
      registrationPhase: "",
      note: "",
      area: "",
      goalId: "",
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="CALENDAR"
        title="캘린더"
        description="시험과 접수 일정, 학습 계획과 개인 일정을 함께 관리하세요."
        action={
          <button className="primary-button" onClick={add}>
            <Plus size={16} />
            일정 추가
          </button>
        }
      />
      <div className="schedule-layout">
        <section
          className="dashboard-panel schedule-calendar"
          aria-label="월간 일정 캘린더"
        >
          <div className="schedule-toolbar">
            <div>
              <button
                className="icon-button"
                aria-label="캘린더 이전 달"
                disabled={month === "0001-01"}
                onClick={() => changeMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft size={20} />
              </button>
              <h2>
                {Number(month.slice(0, 4))}년 {Number(month.slice(5))}월
              </h2>
              <button
                className="icon-button"
                aria-label="캘린더 다음 달"
                disabled={month === "9999-12"}
                onClick={() => changeMonth(shiftMonth(month, 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <label>
              <span className="sr-only">일정 조회 월</span>
              <input
                type="month"
                aria-label="일정 조회 월"
                min="0001-01"
                max="9999-12"
                value={month}
                onChange={(e) => changeMonth(e.target.value)}
              />
            </label>
            <button className="secondary-button" onClick={() => select(today)}>
              오늘
            </button>
          </div>
          <div className="schedule-weekdays">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="schedule-grid">
            {calendarDates(month).map((date, index) =>
              date ? (
                <button
                  className={`schedule-day ${date === today ? "is-today" : ""} ${date === selected ? "is-selected" : ""}`}
                  aria-label={`${date} 일정 ${events.filter((e) => eventOnDate(e, date)).length}개`}
                  aria-pressed={date === selected}
                  aria-current={date === today ? "date" : undefined}
                  key={date}
                  onClick={() => select(date)}
                >
                  <span className="schedule-number">
                    {Number(date.slice(-2))}
                  </span>
                  <span className="schedule-day-events">
                    {events
                      .filter((e) => eventOnDate(e, date))
                      .slice(0, 2)
                      .map((event) => (
                        <span
                          key={event.id}
                          className={`schedule-dot-label category-${eventCategories.indexOf(event.category)}`}
                        >
                          {event.title}
                        </span>
                      ))}
                    {events.filter((e) => eventOnDate(e, date)).length > 2 && (
                      <small>
                        +{events.filter((e) => eventOnDate(e, date)).length - 2}
                        개
                      </small>
                    )}
                  </span>
                </button>
              ) : (
                <div key={`blank-${index}`} className="schedule-blank" />
              ),
            )}
          </div>
          <div className="schedule-legend">
            {eventCategories.map((c, i) => (
              <span key={c} className={`category-${i}`}>
                ● {c}
              </span>
            ))}
          </div>
        </section>
        <section
          className="dashboard-panel schedule-detail"
          aria-label="선택한 날짜의 일정"
        >
          <div className="dashboard-panel-heading">
            <div>
              <p className="eyebrow">SELECTED DATE</p>
              <h2>{selected.replaceAll("-", ".")}</h2>
            </div>
            <button
              className="icon-button"
              aria-label="선택 날짜에 일정 추가"
              onClick={add}
            >
              <Plus size={20} />
            </button>
          </div>
          {selectedEvents.length ? (
            <ul className="schedule-detail-list">
              {selectedEvents.map((event) => {
                const goal = data.goals.find((g) => g.id === event.goalId);
                return (
                  <li key={event.id}>
                    <div className="schedule-event-heading">
                      <span className="schedule-category">
                        {eventCategoryLabel(event)}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`${event.title} 일정 수정`}
                        onClick={() => setEditing(event)}
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                    <h3>
                      <button
                        className="text-link"
                        onClick={() => setEditing(event)}
                      >
                        {event.title}
                      </button>
                    </h3>
                    <p>{eventDateLabel(event)}</p>
                    {event.category === "시험" && (
                      <strong className="schedule-dday exam">
                        {dDay(event.date, today)}
                      </strong>
                    )}
                    {event.area && <p>{fieldName(event.area)}</p>}
                    {goal && (
                      <Link className="text-link" to="/goals">
                        목표 · {goal.title}
                      </Link>
                    )}
                    {event.note && (
                      <p className="schedule-note">{event.note}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>
              <CalendarDays size={24} />
              <p>등록된 일정이 없습니다.</p>
              <button className="text-link" onClick={add}>
                이 날짜에 일정 추가
              </button>
            </Empty>
          )}
        </section>
      </div>
      {editing && (
        <EventForm
          key={editing.id}
          event={editing}
          onSaved={select}
          isNew={!events.some((e) => e.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
