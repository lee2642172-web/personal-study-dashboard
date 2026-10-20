import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { useData } from "./state";
import { localDate } from "./dates";
import { learningTime } from "./studyTime";
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

export function TodayLearning() {
  const { data } = useData();
  const [date, setDate] = useState(localDate);
  useEffect(() => {
    const refresh = () => setDate(localDate());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const today = learningTime(data.logs, "today", date, date);
  const entries = [...today.study].reverse();
  const unknown = entries.filter((log) => log.minutes === null).length;
  return (
    <section className="today-learning" aria-labelledby="today-learning-title">
      <header className="today-learning-heading">
        <div>
          <p className="eyebrow">
            TODAY · <time dateTime={date}>{date.replaceAll("-", ".")}</time>
          </p>
          <h1 id="today-learning-title">오늘의 학습</h1>
          <p className="today-learning-count">
            학습·복습 기록 {entries.length}건
          </p>
        </div>
        <div className="today-learning-total" aria-label="오늘 총 학습시간">
          <span>
            <Clock3 size={15} />총 학습시간
          </span>
          <strong>
            {today.hasStudyTime ? `${today.studyMinutes}분` : "미기록"}
          </strong>
        </div>
      </header>
      {entries.length ? (
        <ul
          className="today-learning-list"
          aria-label="오늘 학습 목록"
          tabIndex={0}
        >
          {entries.map((log) => {
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
              <li key={log.id}>
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
          <p>아직 오늘의 학습 기록이 없습니다.</p>
          <span>학습을 기록하면 여기에 목록과 시간이 표시됩니다.</span>
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
              : "실제 학습일 기준 · 자료 정비시간은 별도로 집계합니다."}
          </p>
          {today.system.length > 0 && (
            <p>오늘 자료 정비 {today.systemMinutes}분 · 학습시간과 별도</p>
          )}
        </div>
        <Link className="text-link" to="/records">
          전체 학습 기록
          <ArrowUpRight size={14} />
        </Link>
      </footer>
    </section>
  );
}
