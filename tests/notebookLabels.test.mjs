import test from "node:test";
import assert from "node:assert/strict";
import { notebookLabel } from "../src/notebookLabels.ts";
import { notebookRows } from "../src/notebookRows.ts";
import { createInitialData } from "../src/initialData.ts";
import { activityEntries } from "../src/activities.ts";
test("EBS uses publication date and groups course labels without changing actual dates/time", () => {
  const d = createInitialData(),
    base = d.logs[0];
  d.tasks = [];
  d.todos = [];
  d.logs = [0, 1, 2].map((n) => ({
    ...base,
    id: "qa" + n,
    materialId: "ebs-" + n,
    item: "2026-04-20",
    contentDate: "2026-04-20",
    date: "2026-11-17",
    minutes: 18,
  }));
  const before = JSON.stringify(d);
  const entries = activityEntries(d);
  const labels = entries.map((e) => ({
    ...e,
    title: notebookLabel(e, d.materials),
  }));
  assert.ok(labels.every((e) => e.title === "EBS 어학당 4/20"));
  const rows = notebookRows(labels);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].minutes, 54);
  assert.deepEqual(rows[0].titles, ["EBS 어학당 4/20"]);
  assert.equal(JSON.stringify(d), before);
  const review = {
    ...entries[0],
    log: { ...entries[0].log, activity: "review" },
  };
  assert.equal(notebookLabel(review, d.materials), "EBS 어학당 4/20 복습");
});
test("customs lectures, Basic and EEA have short labels while original record titles stay intact", () => {
  const d = createInitialData(),
    base = d.logs[0];
  const entries = [
    ["customs-trade-english-theory", "2"],
    ["basic", "1"],
    ["eea-reading", "3"],
  ].map(([materialId, item], n) => ({
    source: "study",
    activity: "study",
    id: String(n),
    title: "원래 긴 제목",
    date: "2026-11-17",
    minutes: 90,
    log: { ...base, materialId, item },
  }));
  assert.deepEqual(
    entries.map((e) => notebookLabel(e, d.materials)),
    ["관세사 무역영어 2강", "Basic GIU U1", "EEA 낭독 D3"],
  );
  assert.ok(entries.every((e) => e.title === "원래 긴 제목"));
});
test("known task names compact only for notebook and arbitrary titles remain untouched", () => {
  const task = {
    source: "task",
    title: "영단어 D53 재정리 (classify, identify)",
  };
  assert.equal(notebookLabel(task, []), "영단어 D53 정리");
  assert.equal(task.title, "영단어 D53 재정리 (classify, identify)");
  assert.equal(
    notebookLabel(
      { source: "todo", title: "한자 학습 관련 대시보드 작성" },
      [],
    ),
    "한자 대시보드 작성",
  );
  assert.equal(
    notebookLabel({ source: "todo", title: "직접 입력한 제목" }, []),
    "직접 입력한 제목",
  );
});
