import { useState, type FormEvent } from "react";
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
import { PageHeading, Section, Progress, Empty, Dialog } from "./ui";
import { LogForm, MaterialForm, createLog } from "./forms";
import { today, type StudyLog, type Material } from "./model";
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
  const month = defaultEbsDate(courses, data.logs, today()).slice(0, 7);
  const stats = monthStats(courses, data.logs, month, today());
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
  const { data } = useData();
  const courses = ebsCourses(data.materials);
  const asOf = today();
  const [date, setDate] = useState(() =>
    defaultEbsDate(courses, data.logs, asOf),
  );
  const [month, setMonth] = useState(date.slice(0, 7));
  const [log, setLog] = useState<StudyLog | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const [batch, setBatch] = useState(false);
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
    const entries = courseDay(course, data.logs, date, asOf).entries;
    const round = entries.reduce((s, l) => Math.max(s, l.round), 0) + 1;
    setLog({
      ...createLog(course.area, course.id, date, round),
      activity: replay ? "review" : "study",
    });
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
            className="primary-button ebs-batch-button"
            disabled={!pending.length}
            onClick={() => setBatch(true)}
          >
            <Check size={17} />
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
                    <div className="ebs-daily-actions">
                      <button
                        className="secondary-button"
                        disabled={day.future}
                        onClick={() => {
                          const existing =
                            day.entries.find((l) => l.completed) ??
                            day.entries.at(-1);
                          if (existing) setLog(existing);
                          else add(course);
                        }}
                      >
                        {day.entries.length
                          ? "기록 확인 / 수정"
                          : "개별 완료 기록"}
                      </button>
                      {day.entries.length > 0 && (
                        <button
                          className="text-button"
                          disabled={day.future}
                          onClick={() => add(course, true)}
                        >
                          <Plus size={13} />
                          재청취
                        </button>
                      )}
                    </div>
                    {day.entries.length > 0 && (
                      <details className="ebs-history">
                        <summary>청취 이력 {day.entries.length}건 보기</summary>
                        {day.entries.map((entry) => (
                          <div key={entry.id}>
                            <p>
                              {entry.completed ? "완료" : "진행 중"} · 실제
                              청취일 {entry.date ?? "미입력"}
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
      {batch && <BatchComplete date={date} onClose={() => setBatch(false)} />}
    </>
  );
}
function BatchComplete({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [learnedDate, setLearnedDate] = useState(today());
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const pending = ebsCourses(data.materials).filter(
    (m) =>
      scheduled(m, date) &&
      !courseDay(m, data.logs, date, today()).completed &&
      date <= today(),
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !validDate(learnedDate) ||
      learnedDate > today() ||
      learnedDate < date
    ) {
      setError("실제 청취일은 콘텐츠 발행일부터 오늘 사이로 입력해 주세요.");
      return;
    }
    update((d) => ({
      ...d,
      logs: [
        ...d.logs,
        ...ebsCourses(d.materials)
          .filter(
            (m) =>
              scheduled(m, date) &&
              date <= today() &&
              !courseDay(m, d.logs, date, today()).completed,
          )
          .map((m) => ({
            ...createLog(m.area, m.id, date),
            date: learnedDate,
            minutes: minutes[m.id] ? Number(minutes[m.id]) : null,
            note,
          })),
      ],
    }));
    onClose();
  }
  return (
    <Dialog title="발행 강좌 일괄 완료" onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <div className="ebs-batch-info">
          콘텐츠 발행일 <strong>{date}</strong>
          <p>
            이미 완료한 강좌는 수정하지 않습니다. 미래 회차와 발행이 없는 강좌는
            제외합니다.
          </p>
        </div>
        <label>
          실제 청취일
          <input
            type="date"
            required
            min={date}
            max={today()}
            value={learnedDate}
            onChange={(e) => setLearnedDate(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>강좌별 실제 청취시간 (미측정 시 비워두기)</legend>
          <div className="ebs-batch-times">
            {pending.map((m) => (
              <label key={m.id}>
                {m.title}
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="미측정"
                  value={minutes[m.id] ?? ""}
                  onChange={(e) =>
                    setMinutes({ ...minutes, [m.id]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          공통 메모
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="form-help">
          강좌별 예상 길이는 실제 시간으로 자동 합산하지 않습니다. 선택한 강좌별
          기록을 별도로 저장합니다.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={!pending.length}>
          {pending.length}개 강좌 완료 저장
        </button>
      </form>
    </Dialog>
  );
}
