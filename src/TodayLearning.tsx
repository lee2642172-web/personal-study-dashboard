import { useLocalDate } from "./useLocalDate";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { useData } from "./state";
import { activityEntries } from "./activities";
import { timedStudyLogs } from "./dashboard";
import { workLabel } from "./taskWork";
import { fieldName, type Material, type StudyLog } from "./model";
import { isEbsCourse } from "./ebs";
import { ActivityLabels } from "./ui";

function itemLabel(log: StudyLog, material?: Material): string {
  if (!log.item) return "";
  if (material && isEbsCourse(material))
    return `발행일 ${(log.contentDate ?? log.item).replaceAll("-", ".")}`;
  const item =
    material?.kind === "lectures"
      ? `제 ${log.item}강`
      : material?.kind === "days"
        ? `Day ${log.item}`
        : material?.kind === "units"
          ? `Unit ${log.item}`
          : material?.kind === "book"
            ? `${log.item}페이지`
            : log.item;
  return log.initialLearning ? item : `${item} · ${log.round}회독`;
}

export function TodayLearning({ compact = false }: { compact?: boolean }) {
  const { data } = useData();
  const date = useLocalDate();
  const entries = activityEntries(data)
    .filter((entry) => !entry.voided && entry.date === date)
    .reverse();
  const measured = timedStudyLogs(entries, date);
  const entryCount = entries.length;
  const totalMinutes = measured.reduce((sum, entry) => sum + entry.minutes!, 0);
  const unknown = entries.filter((entry) => entry.minutes === null).length;
  return (
    <section
      className={`today-learning ${compact ? "is-compact" : ""}`}
      aria-labelledby="today-learning-title"
    >
      <header className="today-learning-heading">
        <div>
          <p className="eyebrow">
            TODAY · <time dateTime={date}>{date.replaceAll("-", ".")}</time>
          </p>
          {compact ? (
            <h2 id="today-learning-title">오늘의 기록</h2>
          ) : (
            <h1 id="today-learning-title">오늘의 기록</h1>
          )}
          <p className="today-learning-count">
            학습·할 일·작업 기록 {entryCount}건
          </p>
        </div>
        {!compact && (
          <div className="today-learning-total" aria-label="오늘 총 기록시간">
            <span>
              <Clock3 size={15} />총 기록시간
            </span>
            <strong>
              {measured.length
                ? `${totalMinutes}분`
                : entryCount
                  ? "시간 미입력"
                  : "미기록"}
            </strong>
          </div>
        )}
      </header>
      {entryCount ? (
        <ul
          className="today-learning-list"
          aria-label="오늘 기록 목록"
          tabIndex={0}
        >
          {entries.map((entry) => {
            if (entry.source !== "study") {
              const destination =
                entry.source === "todo"
                  ? `/tasks?todo=${encodeURIComponent(entry.todo.id)}`
                  : `/tasks/${entry.task.id}`;
              return (
                <li key={entry.id}>
                  <Link className="today-learning-entry" to={destination}>
                    <div className="today-learning-entry-copy">
                      <h2>{entry.title}</h2>
                      <p>
                        <span className="today-learning-type">
                          {entry.source === "todo" ? "완료" : "작업"}
                        </span>
                        {entry.source === "task"
                          ? `${fieldName(entry.task.area)} · ${workLabel(entry.task, entry.record)}`
                          : entry.date}
                      </p>
                    </div>
                    <span
                      className={`today-learning-time ${entry.minutes === null ? "is-unknown" : ""}`}
                    >
                      {entry.minutes === null
                        ? "시간 미입력"
                        : `${entry.minutes}분`}
                    </span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              );
            }
            const log = entry.log;
            const material = data.materials.find(
              (m) => m.id === log.materialId,
            );
            const destination = material
              ? isEbsCourse(material)
                ? "/english/ebs"
                : `/materials/${material.id}`
              : "/records";
            const item = itemLabel(log, material);
            return (
              <li key={`study:${log.id}`}>
                <Link className="today-learning-entry" to={destination}>
                  <div className="today-learning-entry-copy">
                    <h2>
                      {log.topic
                        ? `OPIc · ${log.topic}`
                        : material?.title || log.note || "자유 학습"}
                    </h2>
                    <p>
                      <span className="today-learning-type">
                        {log.initialLearning
                          ? "신규 학습"
                          : ActivityLabels[log.activity]}
                      </span>
                      {fieldName(log.area)}
                      {item && ` · ${item}`}
                      {!log.completed && " · 진행 중"}
                    </p>
                  </div>
                  <span
                    className={`today-learning-time ${log.minutes === null ? "is-unknown" : ""}`}
                  >
                    {log.minutes === null ? "시간 미입력" : `${log.minutes}분`}
                  </span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="today-learning-empty">
          <p>아직 오늘의 기록이 없습니다.</p>
          <span>
            학습·과업 작업을 기록하거나 할 일을 완료하면 목록과 시간이
            표시됩니다.
          </span>
          <Link className="text-link" to="/english">
            영어 학습으로
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <footer className="today-learning-footer">
        <div>
          <p>
            {unknown
              ? `시간 미입력 ${unknown}건은 합계에 포함되지 않았습니다.`
              : "실제 기록일 기준 · 학습·할 일·과업 작업시간을 합산합니다."}
          </p>
        </div>
        <Link className="text-link" to="/records">
          전체 학습 기록
          <ArrowUpRight size={14} />
        </Link>
      </footer>
    </section>
  );
}
