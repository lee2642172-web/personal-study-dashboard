import test from "node:test";
import assert from "node:assert/strict";
import {
  personalPeriod,
  personalYearStart,
  movePersonalPeriod,
} from "../src/personalPeriods.ts";
import { dateDistance, shiftDate } from "../src/dates.ts";
import { studyActivityDays } from "../src/dashboard.ts";
import { createInitialData } from "../src/initialData.ts";
test("personal 28-day months match the notebook and current 12th month", () => {
  assert.equal(personalYearStart(2026), "2025-12-29");
  const p = personalPeriod("2026-11-17");
  assert.equal(p.label, "2026년 12달");
  assert.equal(p.start, "2026-11-02");
  assert.equal(p.end, "2026-11-29");
  assert.equal(p.week, 3);
  assert.equal(p.day, 16);
  assert.equal(p.count, 28);
  assert.equal(personalPeriod("2026-08-10").index, 8);
  assert.equal(personalPeriod("2026-09-06").index, 8);
  assert.equal(personalPeriod("2025-12-29").year, 2026);
  assert.equal(personalPeriod("2026-12-28").label, "2027년 1달");
});
test("periods cover every day exactly once, including leap years, extra weeks and navigation", () => {
  for (let year = 2025; year <= 2040; year++) {
    let p = personalPeriod(personalYearStart(year)),
      covered = 0;
    while (p.year === year) {
      assert.equal(new Date(p.start + "T12:00Z").getUTCDay(), 1);
      assert.equal(dateDistance(p.start, p.end) + 1, p.count);
      covered += p.count;
      const next = movePersonalPeriod(p, 1);
      assert.equal(next.start, shiftDate(p.end, 1));
      assert.equal(movePersonalPeriod(next, -1).start, p.start);
      p = next;
    }
    assert.equal(
      covered,
      dateDistance(personalYearStart(year), personalYearStart(year + 1)),
    );
    assert.ok([364, 371].includes(covered));
  }
  const extra = personalPeriod("2028-12-25");
  assert.equal(extra.label, "2028년 13.5달");
  assert.equal(extra.count, 7);
  assert.equal(extra.end, "2028-12-31");
});
test("28-day totals use actual dates, include cross-calendar-month days and exclude future/cancelled entries", () => {
  const d = createInitialData(),
    base = d.logs[0];
  d.tasks = [];
  d.todos = [];
  d.logs = [
    ["2026-10-04", 10],
    ["2026-10-05", 20],
    ["2026-11-01", 30],
    ["2026-11-02", 40],
  ].map(([date, minutes], i) => ({ ...base, id: String(i), date, minutes }));
  const p = personalPeriod("2026-11-01");
  assert.equal(p.start, "2026-10-05");
  const days = studyActivityDays(d, "2026-11-01", p.start, p.count);
  assert.equal(days.length, 28);
  assert.equal(
    days.reduce((s, d) => s + d.minutes, 0),
    50,
  );
  d.logs[1].voided = true;
  assert.equal(
    studyActivityDays(d, "2026-11-01", p.start, p.count).reduce(
      (s, d) => s + d.minutes,
      0,
    ),
    30,
  );
});
