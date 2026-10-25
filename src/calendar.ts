import { fields, type CalendarEvent, type DashboardData } from "./model.ts";
import { isDateString, dateDistance } from "./dates.ts";
export const eventCategories = [
  "시험",
  "시험 접수",
  "성적 발표",
  "학습",
  "기타",
] as const;
const timeValid = (time: string) =>
  time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
export function eventError(event: CalendarEvent): string {
  if (!event.id.trim() || !event.title.trim()) return "일정명을 입력해 주세요.";
  if (
    !isDateString(event.date) ||
    (event.endDate && !isDateString(event.endDate))
  )
    return "올바른 날짜를 입력해 주세요.";
  if (event.endDate && event.endDate < event.date)
    return "종료일은 시작 날짜 이후여야 합니다.";
  if (!timeValid(event.startTime) || !timeValid(event.endTime))
    return "시간을 HH:MM 형식으로 입력해 주세요.";
  if (
    (!event.endDate || event.endDate === event.date) &&
    event.startTime &&
    event.endTime &&
    event.endTime < event.startTime
  )
    return "종료 시간은 시작 시간 이후여야 합니다. 다음 날 끝나는 일정은 종료일을 지정해 주세요.";
  if (
    !eventCategories.includes(event.category) ||
    !["", "start", "deadline"].includes(event.registrationPhase)
  )
    return "일정 분류를 확인해 주세요.";
  if (event.category !== "시험 접수" && event.registrationPhase)
    return "접수 구분은 시험 접수 일정에서만 설정할 수 있습니다.";
  if (event.area && !fields.some((f) => f.id === event.area))
    return "학습 분야를 확인해 주세요.";
  return "";
}
export function validCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (
    ![
      "id",
      "title",
      "date",
      "endDate",
      "startTime",
      "endTime",
      "category",
      "registrationPhase",
      "note",
      "area",
      "goalId",
    ].every((k) => typeof v[k] === "string")
  )
    return false;
  return !eventError(value as CalendarEvent);
}
export function saveCalendarEvent(
  data: DashboardData,
  event: CalendarEvent,
): DashboardData {
  if (!validCalendarEvent(event)) return data;
  const events = data.events ?? [];
  return {
    ...data,
    events: events.some((e) => e.id === event.id)
      ? events.map((e) =>
          e.id === event.id ? { ...event, title: event.title.trim() } : e,
        )
      : [...events, { ...event, title: event.title.trim() }],
  };
}
export function deleteCalendarEvent(
  data: DashboardData,
  id: string,
): DashboardData {
  if (!data.events?.some((e) => e.id === id)) return data;
  return { ...data, events: data.events.filter((e) => e.id !== id) };
}
export const eventOnDate = (event: CalendarEvent, date: string) =>
  event.date <= date && (event.endDate || event.date) >= date;
export const eventDateLabel = (event: CalendarEvent) =>
  `${event.date}${event.endDate && event.endDate !== event.date ? ` ~ ${event.endDate}` : ""}${event.startTime ? ` · ${event.startTime}` : ""}${event.endTime ? `${event.startTime ? "–" : " · 종료 "}${event.endTime}` : ""}`;
export const eventCategoryLabel = (event: CalendarEvent) =>
  event.category === "시험 접수"
    ? `${event.category}${event.registrationPhase === "start" ? " 시작" : event.registrationPhase === "deadline" ? " 마감" : ""}`
    : event.category;
export function upcomingEvents(events: CalendarEvent[], today: string) {
  return events
    .filter((e) => (e.endDate || e.date) >= today)
    .map((event) => ({
      event,
      date:
        event.category === "시험 접수" &&
        event.endDate &&
        event.registrationPhase !== "start"
          ? event.endDate
          : event.date < today
            ? today
            : event.date,
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.event.startTime.localeCompare(b.event.startTime) ||
        a.event.title.localeCompare(b.event.title),
    );
}
export function dDay(date: string, today: string) {
  const distance = dateDistance(today, date);
  return distance === 0
    ? "D-Day"
    : distance > 0
      ? `D-${distance}`
      : `D+${-distance}`;
}
