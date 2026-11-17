import test from "node:test";
import assert from "node:assert/strict";
import { notebookRows } from "../src/notebookRows.ts";
test("five sessions totaling 1.4T use exactly two T rows without modifying original records", () => {
  const entries = [30, 20, 18, 18, 40].map((minutes, i) => ({
    title: "학습 " + i,
    minutes,
  }));
  const before = JSON.stringify(entries);
  const rows = notebookRows(entries);
  assert.deepEqual(
    rows.map((r) => r.minutes),
    [90, 36],
  );
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(
    new Set(rows.flatMap((r) => r.titles)),
    new Set(entries.map((e) => e.title)),
  );
});
test("one-T titles keep one row each; long sessions and partial class times fill 90-minute rows", () => {
  assert.deepEqual(
    notebookRows(
      [1, 2, 3, 4].map((n) => ({ title: String(n), minutes: 90 })),
    ).map((r) => r.titles),
    [["1"], ["2"], ["3"], ["4"]],
  );
  assert.deepEqual(
    notebookRows([
      { title: "수업", minutes: 70 },
      { title: "다른 학습", minutes: 70 },
    ]).map((r) => r.minutes),
    [90, 50],
  );
  assert.deepEqual(
    notebookRows([{ title: "긴 학습", minutes: 270 }]).map((r) => r.minutes),
    [90, 90, 90],
  );
  assert.deepEqual(notebookRows([]), []);
});
test("untimed records remain accessible without inventing a T or adding unnecessary rows", () => {
  const rows = notebookRows([
    { title: "학습", minutes: 90 },
    { title: "미입력", minutes: null },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].minutes, 90);
  assert.ok(rows[0].titles[1].includes("시간 미입력"));
  assert.equal(
    notebookRows([{ title: "미입력", minutes: null }])[0].minutes,
    0,
  );
});
