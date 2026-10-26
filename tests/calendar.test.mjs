import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../src/initialData.ts";
import { calendarDates, calendarWeekdays } from "../src/dates.ts";
import {
  validCalendarEvent,
  eventError,
  saveCalendarEvent,
  deleteCalendarEvent,
  eventOnDate,
  upcomingEvents,
  dDay,
} from "../src/calendar.ts";
import { browserRepository, STORAGE_KEY, validData } from "../src/storage.ts";
const event = (patch = {}) => ({
  id: "exam",
  title: "시험 일정",
  date: "2026-11-02",
  endDate: "",
  startTime: "",
  endTime: "",
  category: "시험",
  registrationPhase: "",
  note: "",
  area: "",
  goalId: "",
  ...patch,
});
test("Monday-first month grids keep dates in the correct weekday columns across Sunday starts, full weeks and leap years", () => {
  assert.deepEqual(calendarWeekdays, [
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
    "일",
  ]);
  for (const [month, offset, count, rows] of [
    ["2026-04", 2, 30, 5],
    ["2026-11", 6, 30, 6],
    ["2027-02", 0, 28, 4],
    ["2028-02", 1, 29, 5],
  ]) {
    const cells = calendarDates(month);
    assert.equal(cells.length, rows * 7);
    assert.deepEqual(cells.slice(0, offset), Array(offset).fill(null));
    assert.equal(cells[offset], `${month}-01`);
    assert.equal(cells.filter(Boolean).length, count);
    cells.forEach((date, column) => {
      if (date)
        assert.equal(
          column % 7,
          (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7,
        );
    });
    assert.equal(cells[offset + count - 1], `${month}-${count}`);
    assert.ok(cells.slice(offset + count).every((date) => date === null));
  }
});
test("calendar accepts optional times, personal events, linked goals, multi-day intervals and all required categories", () => {
  for (const category of ["시험", "시험 접수", "성적 발표", "학습", "기타"])
    assert.ok(validCalendarEvent(event({ category })));
  const e = event({
    date: "2026-12-31",
    endDate: "2027-01-02",
    startTime: "23:00",
    endTime: "01:00",
    category: "기타",
    area: "english",
    goalId: "goal-opi",
    note: "개인 메모",
  });
  assert.ok(validCalendarEvent(e));
  assert.equal(eventOnDate(e, "2026-12-30"), false);
  assert.equal(eventOnDate(e, "2026-12-31"), true);
  assert.equal(eventOnDate(e, "2027-01-01"), true);
  assert.equal(eventOnDate(e, "2027-01-02"), true);
  assert.equal(eventOnDate(e, "2027-01-03"), false);
  assert.equal(dDay("2026-11-02", "2026-10-25"), "D-8");
  assert.equal(dDay("2026-11-02", "2026-11-02"), "D-Day");
  assert.equal(dDay("2026-11-02", "2026-11-03"), "D+1");
});
test("invalid dates, reversed ranges/times, categories and malformed stored schedules are rejected", () => {
  for (const patch of [
    { id: "" },
    { title: "  " },
    { date: "2026-02-29" },
    { endDate: "2026-11-01" },
    { startTime: "25:00" },
    { startTime: "14:00", endTime: "13:00" },
    { area: "fake" },
    { registrationPhase: "deadline" },
    { category: "unknown" },
    { goalId: 15 },
  ]) {
    assert.equal(
      validCalendarEvent(event(patch)),
      false,
      JSON.stringify(patch),
    );
  }
  const d = createInitialData();
  assert.equal(saveCalendarEvent(d, event({ date: "bad" })), d);
  assert.equal(validCalendarEvent(null), false);
  assert.match(
    eventError(event({ startTime: "14:00", endTime: "13:00" })),
    /종료 시간/,
  );
});
test("add edit delete are immutable and never create study logs, goals or tasks", () => {
  const d = createInitialData(),
    before = structuredClone(d);
  let updated = saveCalendarEvent(d, event());
  assert.equal(updated.events.length, 1);
  assert.deepEqual(d, before);
  updated = saveCalendarEvent(
    updated,
    event({
      title: "수정한 시험",
      date: "2026-11-05",
      startTime: "10:00",
      endTime: "12:00",
    }),
  );
  assert.equal(updated.events.length, 1);
  assert.equal(updated.events[0].date, "2026-11-05");
  assert.equal(updated.events[0].title, "수정한 시험");
  for (const key of ["materials", "logs", "goals", "tasks"])
    assert.deepEqual(updated[key], d[key]);
  const removed = deleteCalendarEvent(updated, "exam");
  assert.equal(removed.events.length, 0);
  assert.equal(updated.events.length, 1);
  assert.equal(deleteCalendarEvent(removed, "missing"), removed);
});
test("upcoming events use registered schedules only and expose registration deadlines, ongoing ranges and date navigation targets", () => {
  const events = [
    event({ id: "past", date: "2026-10-20" }),
    event({
      id: "deadline",
      title: "접수 기간",
      date: "2026-10-21",
      endDate: "2026-10-27",
      category: "시험 접수",
    }),
    event({ id: "today", date: "2026-10-25", category: "기타" }),
    event({ id: "exam", date: "2026-11-02" }),
  ];
  assert.deepEqual(
    upcomingEvents(events, "2026-10-25").map((x) => [x.event.id, x.date]),
    [
      ["today", "2026-10-25"],
      ["deadline", "2026-10-27"],
      ["exam", "2026-11-02"],
    ],
  );
  assert.deepEqual(upcomingEvents([], "2026-10-25"), []);
});
test("optional event storage is compatible with old browsers and roundtrips all existing records unchanged", () => {
  const entries = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => entries.get(k) ?? null,
      setItem: (k, v) => entries.set(k, v),
    },
  });
  const old = createInitialData();
  browserRepository.save(old);
  assert.deepEqual(browserRepository.load(), old);
  assert.equal(browserRepository.load().events, undefined);
  const saved = saveCalendarEvent(
    old,
    event({ area: "customs", goalId: old.goals[0].id, note: "유지할 메모" }),
  );
  browserRepository.save(saved);
  assert.deepEqual(browserRepository.load(), saved);
  assert.ok(validData(saved));
  const duplicate = { ...saved, events: [event(), event()] };
  assert.equal(validData(duplicate), false);
  const malformed = { ...saved, events: [event({ date: "invalid" })] };
  const raw = JSON.stringify(malformed);
  entries.set(STORAGE_KEY, raw);
  assert.throws(() => browserRepository.load());
  assert.equal(entries.get(STORAGE_KEY), raw);
});
