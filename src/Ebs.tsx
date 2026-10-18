import { localDate } from "./dates";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { useData } from "./state";
import { PageHeading, Progress, Empty } from "./ui";
import { LogForm, MaterialForm } from "./forms";
import { newId, type StudyLog, type Material } from "./model";
import {
  ebsCourses,
  courseEntries,
  courseDay,
  monthStats,
  defaultEbsDate,
  shiftMonth,
  calendarDates,
  scheduled,
  validDate,
  EBS_START,
  recordEbsLearning,
  toggleEbsLearning,
  EBS_DEFAULT_MINUTES,
} from "./ebs";
const monthLabel = (month: string) =>
  `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;
const durationLabel = (course: Material) =>
  course.duration === null ? "길이 미입력" : `약 ${course.duration}분`;
const courseColor = (id: string) =>
  id === "ebs-0" ? "start" : id === "ebs-1" ? "easy" : "power";
function Rate({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  return total > 0 && done > 0 ? (
    <Progress done={done} total={total} label={label} />
  ) : (
    <p className="ebs-rate-empty">
      {total > 0 ? `완료 기록 없음 · 발행 일정 ${total}회` : "발행된 회차 없음"}
      <small>기록이 없는 회차는 학습 여부를 추정하지 않습니다.</small>
    </p>
  );
}
export function EbsCard() {
  const { data } = useData();
  const courses = ebsCourses(data.materials);
  if (!courses.length) return null;
  const month = defaultEbsDate(courses, data.logs, localDate()).slice(0, 7);
  const stats = monthStats(courses, data.logs, month, localDate());
  return (
    <Link to="/english/ebs" className="ebs-group-card blue">
      <div className="ebs-group-header">
        <span className="v1-icon">
          <Headphones size={24} />
        </span>
        <div>
          <p className="eyebrow">MORNING ROUTINE</p>
          <h3>EBS 오디오어학당</h3>
          <p>세 강좌를 하나의 캘린더에서 · 출근길 학습 루틴</p>
        </div>
        <ArrowUpRight size={20} />
      </div>
      <div className="ebs-card-courses">
        {stats.byCourse.map(({ course, done, total }) => (
          <div
            key={course.id}
            className={`ebs-card-course ${courseColor(course.id)}`}
          >
            <span className="ebs-course-name">
              <i />
              {course.title}
            </span>
            <p className="ebs-course-runtime">{durationLabel(course)}</p>
            <Rate done={done} total={total} label="월간 완료 기록" />
          </div>
        ))}
      </div>
      <div className="ebs-card-footer">
        <span>{monthLabel(month)} · 마지막 완료 회차 기준</span>
        <strong>
          월간 캘린더 열기 <ArrowUpRight size={14} />
        </strong>
      </div>
    </Link>
  );
}
export function EbsPage() {
  const { data, update } = useData();
  const courses = ebsCourses(data.materials);
  const asOf = localDate();
  const [date, setDate] = useState(() =>
    defaultEbsDate(courses, data.logs, asOf),
  );
  const [month, setMonth] = useState(date.slice(0, 7));
  const [log, setLog] = useState<StudyLog | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const [notice, setNotice] = useState("");
  const [unplacedLog, setUnplacedLog] = useState<StudyLog | null>(null);
  const unplaced = courses.flatMap((course) =>
    courseEntries(course, data.logs)
      .filter((entry) => !validDate(entry.item) || entry.item < EBS_START)
      .map((entry) => ({ course, entry })),
  );
  const stats = monthStats(courses, data.logs, month, asOf);
  const days = calendarDates(month);
  const eligible = courses.filter((m) => scheduled(m, date) && date <= asOf);
  const pending = eligible.filter(
    (m) => !courseDay(m, data.logs, date, asOf).completed,
  );
  function changeMonth(next: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next) || next < "2026-04") return;
    setMonth(next);
    setDate(`${next}-01`);
  }
  function add(course: Material, replay = false) {
    const learnedDate = localDate();
    const id = newId();
    update((d) =>
      recordEbsLearning(d, course.id, date, learnedDate, id, replay),
    );
    setNotice(
      `${course.title} · ${replay ? "추가 학습" : "완료"} · ${learnedDate} · ${EBS_DEFAULT_MINUTES}분 기록`,
    );
  }
  function toggle(course: Material) {
    const learnedDate = localDate();
    const id = newId();
    const wasCompleted = courseDay(
      course,
      data.logs,
      date,
      learnedDate,
    ).completed;
    const restoring = courseDay(
      course,
      data.logs,
      date,
      learnedDate,
    ).entries.some((l) => l.voided);
    update((d) => toggleEbsLearning(d, course.id, date, learnedDate, id));
    setNotice(
      `${course.title} · ${wasCompleted ? "완료 취소 · 기록은 보관되며 시간 집계에서 제외됩니다" : restoring ? "학습 완료 복원 · 기존 날짜와 시간을 유지합니다" : `학습 완료 · ${learnedDate} · 기본 18분 기록`}`,
    );
  }
  function completeAll() {
    const learnedDate = localDate();
    const ids = new Map(courses.map((course) => [course.id, newId()]));
    update((d) =>
      ebsCourses(d.materials)
        .filter((course) => scheduled(course, date))
        .reduce(
          (next, course) =>
            recordEbsLearning(
              next,
              course.id,
              date,
              learnedDate,
              ids.get(course.id) ?? newId(),
            ),
          d,
        ),
    );
    setNotice(
      `${date} 발행 강좌 완료 · 실제 학습일 ${learnedDate} · 강좌당 기본 ${EBS_DEFAULT_MINUTES}분`,
    );
  }
  return (
    <>
      <Link className="back-link" to="/english">
        <ArrowLeft size={16} />
        영어 학습으로
      </Link>
      <PageHeading
        eyebrow="ENGLISH · MORNING ROUTINE"
        title="EBS 오디오어학당"
        description="출근길의 세 강좌, 하루의 작은 기록. 콘텐츠 발행일을 선택해 청취 이력을 관리하세요."
      />
      <div className="ebs-month-summary">
        <div>
          <span className="eyebrow">MONTHLY OVERVIEW</span>
          <h2>{monthLabel(month)}</h2>
          <p>
            완료 기록 {stats.done} / 발행 일정 {stats.total}회
            {stats.planned > 0 ? ` · 발행 예정 ${stats.planned}회` : ""}
          </p>
        </div>
        <div>
          <Rate
            done={stats.done}
            total={stats.total}
            label="월간 기록 기준 완료율"
          />
          <small>재청취는 완료율을 중복해서 올리지 않습니다.</small>
        </div>
      </div>
      <div className="ebs-course-overview">
        {stats.byCourse.map(({ course, done, total, planned }) => (
          <article
            key={course.id}
            className={`ebs-overview-course ${courseColor(course.id)}`}
          >
            <div className="v1-card-line">
              <span className="ebs-course-name">
                <i />
                {course.title}
              </span>
              <button
                className="icon-button"
                aria-label={`${course.title} 자료 설정`}
                onClick={() => setEditing(course)}
              >
                <Pencil size={15} />
              </button>
            </div>
            <p>
              {course.schedule
                .map((n) => ["일", "월", "화", "수", "목", "금", "토"][n])
                .join("·")}{" "}
              발행 · {durationLabel(course)}
            </p>
            <Rate done={done} total={total} label="강좌별 월간 진도" />
            {planned > 0 && (
              <small>미래 회차 {planned}회는 완료율 집계에서 제외</small>
            )}
          </article>
        ))}
      </div>
      <p className="ebs-save-notice" role="status" aria-live="polite">
        {notice ||
          `회차를 고르고 완료를 누르면 기기의 오늘 날짜와 기본 ${EBS_DEFAULT_MINUTES}분으로 기록합니다. 날짜·시간은 기록 수정에서 변경할 수 있습니다.`}
      </p>
      <div className="ebs-calendar-layout">
        <section
          className="ebs-calendar-panel"
          aria-label="콘텐츠 발행일 캘린더"
        >
          <div className="ebs-calendar-toolbar">
            <div>
              <button
                className="icon-button"
                aria-label="이전 달"
                disabled={month === "2026-04"}
                onClick={() => changeMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft size={20} />
              </button>
              <h2>{monthLabel(month)}</h2>
              <button
                className="icon-button"
                aria-label="다음 달"
                onClick={() => changeMonth(shiftMonth(month, 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <label className="ebs-month-picker">
              <span className="sr-only">조회할 발행 월</span>
              <input
                aria-label="조회할 발행 월"
                type="month"
                min="2026-04"
                value={month}
                onChange={(e) => changeMonth(e.target.value)}
              />
            </label>
          </div>
          <div className="ebs-legend">
            {courses.map((m) => (
              <span className={courseColor(m.id)} key={m.id}>
                <i />
                {m.title}
              </span>
            ))}
            <span className="ebs-legend-key">● 완료 기록　○ 기록 없음</span>
          </div>
          <div className="ebs-calendar-grid">
            <div className="ebs-weekdays">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="ebs-days">
              {days.map((day, index) => {
                if (!day)
                  return <div className="ebs-blank" key={`blank-${index}`} />;
                const before = day < EBS_START;
                const states = courses.map((course) => ({
                  course,
                  ...courseDay(course, data.logs, day, asOf),
                }));
                const label = `${day} 발행 회차, ${states.map((s) => `${s.course.title} ${s.future && s.scheduled ? "발행 예정" : s.completed ? "완료 기록 있음" : s.scheduled ? "기록 없음" : s.entries.length ? "기존 기록 있음" : "발행 없음"}`).join(", ")}`;
                return (
                  <button
                    type="button"
                    key={day}
                    className={`ebs-day ${day === date ? "selected" : ""} ${day > asOf ? "future" : ""} ${day === asOf ? "is-today" : ""}`}
                    disabled={before}
                    aria-label={label}
                    aria-pressed={day === date}
                    onClick={() => setDate(day)}
                  >
                    <span className="ebs-date-number">
                      {Number(day.slice(-2))}
                    </span>
                    <span className="ebs-day-markers" aria-hidden="true">
                      {states.map((s) => (
                        <i
                          key={s.course.id}
                          className={`${courseColor(s.course.id)} ${s.completed ? "complete" : s.scheduled ? "unrecorded" : s.entries.length ? "unrecorded" : "no-episode"}`}
                        />
                      ))}
                    </span>
                    {day === asOf && <small>오늘</small>}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="ebs-calendar-note">
            콘텐츠 발행일 기준 · 일요일은 기본 발행 없음 · 옅은 날짜는 미래 일정
            <br />
            요일 기반 목록으로, 실제 휴방·편성은 별도 확인이 필요합니다.
          </p>
        </section>
        <section className="ebs-day-panel" aria-label="선택한 발행일 학습 내역">
          <div className="ebs-selection-heading">
            <span className="eyebrow">SELECTED EPISODES</span>
            <h2>
              {date.replaceAll("-", ".")}{" "}
              <small>
                {
                  ["일", "월", "화", "수", "목", "금", "토"][
                    new Date(`${date}T12:00:00Z`).getUTCDay()
                  ]
                }
                요일
              </small>
            </h2>
            <p>
              {date > asOf
                ? "발행 예정입니다. 미리 완료 처리할 수 없습니다."
                : eligible.length
                  ? `발행 일정 ${eligible.length}개 강좌 · 실제 청취일은 별도 입력`
                  : "기본 발행 일정이 없는 날입니다."}
            </p>
          </div>
          <button
            className={`primary-button ebs-batch-button ${!pending.length && eligible.length > 0 ? "all-complete" : ""}`}
            disabled={!pending.length}
            onClick={completeAll}
          >
            {!pending.length && eligible.length > 0 && <Check size={17} />}
            {pending.length
              ? `미기록 ${pending.length}개 강좌 일괄 완료`
              : eligible.length
                ? "모든 강좌에 완료 기록이 있어요"
                : "일괄 완료할 발행 강좌 없음"}
          </button>
          {courses.map((course) => {
            const day = courseDay(course, data.logs, date, asOf);
            const available = day.scheduled || day.entries.length > 0;
            const latestDate = day.entries
              .filter((l) => l.date)
              .map((l) => l.date!)
              .sort()
              .at(-1);
            return (
              <article
                className={`ebs-daily-course ${courseColor(course.id)} ${available ? "" : "no-episode"}`}
                key={course.id}
              >
                <div className="v1-card-line">
                  <span className="ebs-course-name">
                    <i />
                    {course.title}
                  </span>
                  <span className={`ebs-state ${day.completed ? "done" : ""}`}>
                    {day.future && day.scheduled
                      ? "발행 예정"
                      : day.completed
                        ? "완료"
                        : day.entries.some((l) => l.voided)
                          ? "미완료"
                          : available
                            ? "기록 없음"
                            : "발행 없음"}
                  </span>
                </div>
                {available && (
                  <>
                    <p>
                      콘텐츠 발행일 {date} · {durationLabel(course)}
                    </p>
                    {day.entries.length > 0 && (
                      <p>
                        최근 실제 청취일 {latestDate ?? "미입력"} · 청취 기록{" "}
                        {day.entries.length}건
                      </p>
                    )}
                    {!day.scheduled && (
                      <p className="micro-note">
                        기본 발행 요일 외의 기존 기록을 보존해 표시합니다.
                      </p>
                    )}
                    <div className="ebs-daily-actions ebs-quick-actions">
                      <button
                        className={`primary-button ebs-complete-button ${day.completed ? "is-complete" : ""}`}
                        aria-label={
                          day.completed ? "✓ 학습 완료 ↩" : "학습 완료하기"
                        }
                        aria-pressed={day.completed}
                        title={
                          day.completed
                            ? "다시 누르면 완료 취소 · 기록과 날짜·시간은 보관됩니다"
                            : "기본 18분으로 학습 기록 생성"
                        }
                        disabled={day.future}
                        onClick={() => toggle(course)}
                      >
                        {day.completed && (
                          <Check size={17} aria-hidden="true" />
                        )}
                        {day.completed ? "학습 완료" : "학습 완료하기"}
                        {day.completed && <span aria-hidden="true">↩</span>}
                      </button>
                      <small className="ebs-quick-hint">
                        {day.completed
                          ? "다시 누르면 완료 취소 · 기록은 보관됩니다"
                          : day.entries.some((l) => l.voided)
                            ? "다시 누르면 기존 날짜·시간으로 복원됩니다"
                            : `버튼을 누른 날 · 기본 ${EBS_DEFAULT_MINUTES}분`}
                      </small>
                      {day.entries.length > 0 && (
                        <div className="ebs-secondary-actions">
                          <button
                            className="text-button"
                            title="최근 기록의 날짜와 시간 수정"
                            onClick={() => setLog(day.entries.at(-1)!)}
                          >
                            <Pencil size={13} />
                            기록 수정
                          </button>
                          {day.completed && (
                            <button
                              className="text-button"
                              disabled={day.future}
                              onClick={() => add(course, true)}
                            >
                              <Plus size={13} />
                              추가 학습{" "}
                              <span aria-hidden="true">
                                +{EBS_DEFAULT_MINUTES}분
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {day.entries.length > 0 && (
                      <details className="ebs-history">
                        <summary>청취 이력 {day.entries.length}건 보기</summary>
                        {day.entries.map((entry) => (
                          <div key={entry.id}>
                            <p>
                              {entry.voided
                                ? "완료 취소 · 집계 제외"
                                : entry.completed
                                  ? "완료"
                                  : "진행 중"}{" "}
                              · 실제 청취일 {entry.date ?? "미입력"}
                              <br />
                              {entry.minutes === null
                                ? "시간 미입력"
                                : `${entry.minutes}분`}{" "}
                              ·{" "}
                              {entry.activity === "review"
                                ? "재청취 / 복습"
                                : "청취"}
                            </p>
                            <button
                              className="icon-button"
                              aria-label={`${course.title} ${entry.id} 기록 수정`}
                              onClick={() => setLog(entry)}
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        ))}
                      </details>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </section>
      </div>
      {unplaced.length > 0 && (
        <details className="ebs-unplaced">
          <summary>
            발행일 미확인 / 시작일 이전 이력 {unplaced.length}건
          </summary>
          <p>
            기존 이력을 그대로 보존했습니다. 콘텐츠 발행일이 확인되면 수정해
            캘린더에 연결할 수 있습니다.
          </p>
          {unplaced.map(({ course, entry }) => (
            <div key={entry.id}>
              <span>
                {course.title} · 콘텐츠 발행일 {entry.item || "미입력"} · 실제
                청취일 {entry.date || "미입력"}
              </span>
              <button
                className="secondary-button"
                onClick={() => setUnplacedLog(entry)}
              >
                기존 기록 수정
              </button>
            </div>
          ))}
        </details>
      )}
      <div className="ebs-data-note">
        <CalendarDays size={19} />
        <p>
          완료 표시는 저장된 강좌별 청취 기록에만 근거합니다. 2026년 4월
          7일까지의 기존 이력은 유지하며, 실제 날짜·시간이 비어 있는 이력은
          그대로 미입력으로 표시합니다. 일반 단어장과 Grammar in Use의 학습
          구조는 바뀌지 않습니다.
        </p>
      </div>
      {!courses.length && <Empty>EBS 그룹에 연결된 강좌가 없습니다.</Empty>}
      {log && <LogForm value={log} lockMaterial onClose={() => setLog(null)} />}
      {unplacedLog && (
        <LogForm value={unplacedLog} onClose={() => setUnplacedLog(null)} />
      )}
      {editing && (
        <MaterialForm value={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
