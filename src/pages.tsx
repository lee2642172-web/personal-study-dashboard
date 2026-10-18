import { TodayLearning } from "./TodayLearning";
import { DayBook } from "./DayBook";
import { isDayBook, getDayBook, dayRoundTotal } from "./dayLearning";
import { localDate, type TimePeriod } from "./dates";
import { learningTime } from "./studyTime";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Globe2,
  Plus,
  Pencil,
  Clock3,
  Target,
  Layers3,
} from "lucide-react";
import { useData } from "./state";
import { EbsCard } from "./Ebs";
import { isEbsCourse } from "./ebs";
import {
  PageHeading,
  Section,
  Empty,
  Progress,
  Stat,
  ActivityLabels,
} from "./ui";
import { MaterialForm, LogForm, GoalForm, TaskForm, createLog } from "./forms";
import {
  fields,
  fieldName,
  materialStatuses,
  episodes,
  unitItems,
  progress,
  completedRounds,
  companyExams,
  type Material,
  type Goal,
  type Task,
  type StudyLog,
  type FieldId,
} from "./model";

function MaterialSummary({ material: m }: { material: Material }) {
  const { data } = useData();
  const dayBook = isDayBook(m) ? getDayBook(data, m) : null;
  const displayRound =
    dayBook?.activeRound ??
    data.logs.reduce(
      (highest, l) =>
        l.materialId === m.id && l.activity !== "system"
          ? Math.max(highest, l.round)
          : highest,
      1,
    );
  const scope = dayBook ? dayRoundTotal(dayBook, displayRound) : m.total;
  const p = progress({ ...m, total: scope }, data.logs, displayRound);
  const initialCount = data.logs.filter(
    (l) =>
      l.materialId === m.id && l.initialLearning && l.completed && !l.voided,
  ).length;
  const isTracked =
    m.kind === "units" || m.kind === "days" || m.kind === "book";
  return (
    <Link className="v1-material-card blue" to={`/materials/${m.id}`}>
      <div className="v1-card-line">
        <span className="v1-icon">
          <BookOpen size={20} />
        </span>
        <span className="status-pill">{m.status}</span>
        <ArrowUpRight size={16} />
      </div>
      <h3>{m.title}</h3>
      <p className="muted">{m.routine || fieldName(m.area)}</p>
      {isTracked && m.total && p.entries.length > 0 ? (
        <Progress
          done={p.count}
          total={scope ?? m.total}
          label={`${displayRound}회독 ${m.kind === "units" ? "Unit" : m.kind === "days" ? "Day" : "페이지"}`}
        />
      ) : (
        <p className="material-fact">
          {m.kind === "audio"
            ? p.entries.length
              ? `완료 청취 ${p.entries.filter((l) => l.completed).length}회 · 실제 날짜 별도`
              : "청취 기록 전 · 실제 날짜 별도"
            : `${m.total ? `자료 규모 ${m.total} ${m.kind === "units" ? "Units" : m.kind === "days" ? "Days" : m.kind === "book" ? "페이지" : "개"} · ` : ""}${isDayBook(m) ? "복습" : "학습"} 진도 ${p.entries.length ? "기록 있음" : "미입력"}`}
        </p>
      )}
      {initialCount > 0 && (
        <p className="micro-note">
          자료 규모 {m.total} Days · 신규 학습 {initialCount}회
        </p>
      )}
      <p className="micro-note">
        {m.targetPasses
          ? `목표 ${m.targetPasses}회독 · ${p.entries.length ? `완료 ${completedRounds(m, data.logs, dayBook?.rounds)}회독` : "회독 기록 전"}`
          : "자료 규모와 실제 학습은 별도로 관리"}
      </p>
    </Link>
  );
}
function GoalCard({ goal: g, onEdit }: { goal: Goal; onEdit?: () => void }) {
  const { data } = useData();
  const prerequisite = data.goals.find((x) => x.id === g.prerequisiteId);
  return (
    <article className="v1-goal-card">
      <div className="v1-card-line">
        <span className="eyebrow">{fieldName(g.area)}</span>
        <span className="status-pill">{g.status}</span>
        {onEdit && (
          <button
            className="icon-button"
            aria-label={`${g.title} 목표 수정`}
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      <h3>
        {g.title} <span>{g.target || "목표 점수 미정"}</span>
      </h3>
      <p>
        현재 <strong>{g.current || "미입력"}</strong>
        <span className="goal-separator">·</span>사내 {g.recognized}
      </p>
      <dl className="goal-dates">
        <div>
          <dt>목표일</dt>
          <dd>{g.targetDate || "미정"}</dd>
        </div>
        <div>
          <dt>취득일</dt>
          <dd>{g.acquiredDate || "미입력"}</dd>
        </div>
        <div>
          <dt>유효기간</dt>
          <dd>{g.expiresOn ? `~ ${g.expiresOn}` : "미입력"}</dd>
        </div>
      </dl>
      <p className="micro-note">
        {prerequisite
          ? `선행 조건: ${prerequisite.title} ${g.prerequisiteGrade || prerequisite.target}`
          : "선행 조건 없음 · 독립 진행"}
      </p>
    </article>
  );
}
function TaskCard({ task: t, onEdit }: { task: Task; onEdit?: () => void }) {
  const { update } = useData();
  return (
    <article className="v1-task-card amber">
      <div className="v1-card-line">
        <span className="eyebrow">
          {t.kind} · {fieldName(t.area)}
        </span>
        <span className="status-pill">{t.status}</span>
        {onEdit && (
          <button
            className="icon-button"
            aria-label={`${t.title} 과업 수정`}
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      <h3>{t.title}</h3>
      <p className="muted">{t.note}</p>
      {t.items.length > 0 && (
        <Progress
          done={t.items.filter((i) => i.done).length}
          total={t.items.length}
          label="과업 체크 항목"
        />
      )}
      <div className="task-checks">
        {t.items.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => {
                const done = e.target.checked;
                update((d) => ({
                  ...d,
                  tasks: d.tasks.map((task) =>
                    task.id === t.id
                      ? {
                          ...task,
                          items: task.items.map((x) =>
                            x.id === item.id ? { ...x, done } : x,
                          ),
                        }
                      : task,
                  ),
                }));
              }}
            />
            {item.title}
          </label>
        ))}
      </div>
    </article>
  );
}
function FieldCards({
  category,
}: {
  category: "languages" | "certifications";
}) {
  const { data } = useData();
  return (
    <div className="v1-field-grid">
      {fields
        .filter((f) => f.category === category)
        .map((f) => {
          const materials = data.materials.filter((m) => m.area === f.id);
          const logs = data.logs.filter(
            (l) => l.area === f.id && l.activity !== "system" && !l.voided,
          );
          const Icon = f.category === "languages" ? Globe2 : GraduationCap;
          return (
            <Link
              className={`v1-field-card ${f.main ? "is-main" : ""} ${category === "languages" ? "blue" : "purple"}`}
              to={f.id === "english" ? "/english" : `/fields/${f.id}`}
              key={f.id}
            >
              <div className="v1-card-line">
                <span className="v1-icon">
                  <Icon size={20} />
                </span>
                {f.main && <span className="main-label">MAIN</span>}
                <ArrowUpRight size={16} />
              </div>
              <h3>{f.title}</h3>
              <p>
                {materials.length
                  ? `자료 ${materials.length}개 · 학습 이력 ${logs.length}건`
                  : "자료·학습 기록 등록 전"}
              </p>
              <small>
                {f.id === "english"
                  ? "출근길 EBS · 퇴근길 Grammar in Use"
                  : f.id === "customs"
                    ? "주요 자격 목표 · 세부 자료 등록 대기"
                    : "자료를 등록하고 기록을 시작하세요"}
              </small>
            </Link>
          );
        })}
    </div>
  );
}
export function Home() {
  const { data } = useData();
  const [period, setPeriod] = useState<TimePeriod>("all");
  const [selectedDate, setSelectedDate] = useState(localDate);
  const {
    study,
    measured,
    system,
    studyMinutes: time,
    hasStudyTime,
  } = learningTime(data.logs, period, selectedDate);
  const active = data.materials.filter((m) => m.status === "학습 중");
  return (
    <>
      <TodayLearning />
      <div className="v1-notice">
        <Target size={20} />
        <div>
          <strong>영어와 관세사, 두 개의 중심.</strong>
          <p>
            OPIc AL은 다른 교재 회독과 독립적으로 병행합니다. 아직 기록하지 않은
            진도와 시간은 비워둡니다.
          </p>
        </div>
      </div>
      <div className="home-time-filter">
        <label>
          시간 통계 기간
          <select
            aria-label="시간 통계 기간"
            value={period}
            onChange={(e) => setPeriod(e.target.value as TimePeriod)}
          >
            <option value="all">전체</option>
            <option value="today">오늘</option>
            <option value="week">이번 주</option>
            <option value="month">이번 달</option>
            <option value="date">날짜 선택</option>
          </select>
        </label>
        {period === "date" && (
          <label>
            실제 학습일
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
        )}
        <p>
          콘텐츠 발행일과 별도로, 실제 학습일 기준으로 집계합니다.
          <br />
          날짜·시간 미입력 이력은 보관하며 시간 합계에서 제외합니다.
        </p>
      </div>
      <section className="stats">
        <Stat
          label={
            period === "all"
              ? "전체 학습 · 복습시간"
              : "선택 기간 학습 · 복습시간"
          }
          value={hasStudyTime ? `${time}분` : "미기록"}
          note={`날짜·시간 기록 ${measured.length}건 · EBS 기본 18분 포함`}
        />
        <Stat
          label={period === "all" ? "전체 학습 이력" : "선택 기간 학습 이력"}
          value={`${study.length}건`}
          note={`날짜 미입력 ${study.filter((l) => !l.date).length}건 포함 · 사용자 제공 이력`}
        />
        <Stat
          label="자료 정비시간"
          value={
            system.length
              ? `${system.reduce((s, l) => s + (l.minutes ?? 0), 0)}분`
              : "미기록"
          }
          note="실제 활동일 기준 · 학습시간과 별도 집계"
        />
        <Stat
          label="진행 중 자료"
          value={`${active.length}개`}
          note="등록 자료 상태 기준 · 자동 할 일 생성 없음"
        />
      </section>
      <Section title="외국어별 학습 현황" tag="LANGUAGES" link="/languages">
        <FieldCards category="languages" />
      </Section>
      <Section
        title="자격증별 학습 현황"
        tag="CERTIFICATIONS"
        link="/certifications"
      >
        <FieldCards category="certifications" />
      </Section>
      <Section title="목표 진행 상태" tag="INDEPENDENT GOALS" link="/goals">
        <div className="v1-three-grid">
          {data.goals.length ? (
            data.goals.map((g) => <GoalCard key={g.id} goal={g} />)
          ) : (
            <Empty>등록한 목표가 없습니다.</Empty>
          )}
        </div>
      </Section>
      <Section title="진행 중인 학습 자료" tag="IN PROGRESS" link="/library">
        <div className="v1-three-grid">
          {active.length ? (
            <>
              {active.some(isEbsCourse) && (
                <div className="ebs-home-group">
                  <EbsCard />
                </div>
              )}
              {active
                .filter((m) => !isEbsCourse(m))
                .map((m) => (
                  <MaterialSummary key={m.id} material={m} />
                ))}
            </>
          ) : (
            <Empty>
              학습 중인 자료가 없습니다. 보관함에서 상태를 변경할 수 있습니다.
            </Empty>
          )}
        </div>
      </Section>
      <Section title="프로젝트성 과업" tag="PROJECTS" link="/tasks">
        <div className="v1-two-grid">
          {data.tasks
            .filter((t) => t.kind === "프로젝트" && t.status !== "완료")
            .map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          {!data.tasks.some(
            (t) => t.kind === "프로젝트" && t.status !== "완료",
          ) && <Empty>진행할 프로젝트가 없습니다.</Empty>}
        </div>
      </Section>
      <Section
        title="최근 날짜가 있는 활동"
        tag="RECENT ACTIVITY"
        link="/records"
      >
        <LogList
          logs={data.logs
            .filter((l) => l.date && !l.voided)
            .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
            .slice(0, 5)}
        />
      </Section>
    </>
  );
}
export function Category({
  category,
}: {
  category: "languages" | "certifications";
}) {
  return (
    <>
      <PageHeading
        eyebrow={category.toUpperCase()}
        title={category === "languages" ? "외국어" : "자격증"}
        description="MAIN 목표를 중심으로, 각 분야의 자료와 기록을 독립적으로 관리해요."
      />
      <FieldCards category={category} />
    </>
  );
}
export function English() {
  const { data } = useData();
  const [practice, setPractice] = useState<StudyLog | null>(null);
  const materials = data.materials.filter((m) => m.area === "english");
  return (
    <>
      <PageHeading
        eyebrow="ENGLISH · MAIN"
        title="영어, 문장으로 쌓는 실력"
        description="출근길에는 EBS, 퇴근길에는 예문 오디오. 자료와 실제 학습을 구분해 관리해요."
      />
      <div className="v1-notice">
        <Clock3 size={23} />
        <div>
          <strong>알려주신 이력부터 시작합니다.</strong>
          <p>
            EBS 3개 강좌는 2026년 4월 7일 회차까지, Basic은 1회독 Unit 6까지
            완료. 실제 청취 날짜·시간은 미입력입니다.
          </p>
        </div>
      </div>
      <Section title="출근길 · EBS 오디오어학당" tag="MORNING ROUTINE">
        <EbsCard />
        {materials.some((m) => m.kind === "audio" && !isEbsCourse(m)) && (
          <div className="v1-three-grid ebs-other-audio">
            {materials
              .filter((m) => m.kind === "audio" && !isEbsCourse(m))
              .map((m) => (
                <MaterialSummary key={m.id} material={m} />
              ))}
          </div>
        )}
      </Section>
      <Section title="퇴근길 · Grammar in Use" tag="EVENING ROUTINE">
        <div className="v1-two-grid">
          {materials
            .filter((m) => m.id === "basic" || m.id === "intermediate")
            .map((m) => (
              <MaterialSummary key={m.id} material={m} />
            ))}
        </div>
        <p className="micro-note">
          Basic 하루 약 4~6 Units 계획 · Intermediate는 Basic 목표 회독 이후
          시작 예정 · 목표 이후 추가 회독도 계속 기록할 수 있어요.
        </p>
      </Section>
      <Section title="예문 중심 단어 복습" tag="VOCABULARY">
        <div className="v1-two-grid">
          {materials
            .filter((m) => m.id === "vocabulary" || m.id === "phrases")
            .map((m) => (
              <MaterialSummary key={m.id} material={m} />
            ))}
        </div>
        <Link className="text-link inline-note" to="/tasks">
          일반 단어장 정비는 별도 프로젝트에서 관리 <ArrowUpRight size={14} />
        </Link>
      </Section>
      <Section title="독립적인 영어 시험 목표" tag="EXAM GOALS" link="/goals">
        <div className="v1-three-grid">
          {data.goals
            .filter((g) => g.area === "english")
            .map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
        </div>
        <div className="practice-panel">
          <div>
            <h3>OPIc 주제별 영작 · 말하기</h3>
            <p>
              전용 교재는 아직 없습니다. 교재 회독을 기다리지 않고 독립적으로
              연습하세요.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => setPractice({ ...createLog(), topic: "", note: "" })}
          >
            <Plus size={16} />
            연습 기록
          </button>
        </div>
        <LogList logs={data.logs.filter((l) => l.topic)} />
      </Section>
      <Section title="보관·검토 중인 자료" tag="LIBRARY" link="/library">
        <div className="v1-three-grid">
          {materials
            .filter((m) => !["audio", "units", "days"].includes(m.kind))
            .map((m) => (
              <MaterialSummary key={m.id} material={m} />
            ))}
        </div>
      </Section>
      {practice && (
        <LogForm value={practice} practice onClose={() => setPractice(null)} />
      )}
    </>
  );
}
export function FieldPage() {
  const { id } = useParams();
  const { data } = useData();
  const [adding, setAdding] = useState(false);
  const field = fields.find((f) => f.id === id);
  if (!field) return <Empty>분야를 찾을 수 없습니다.</Empty>;
  const materials = data.materials.filter((m) => m.area === id);
  const logs = data.logs.filter((l) => l.area === id);
  return (
    <>
      <PageHeading
        eyebrow={`${field.category.toUpperCase()}${field.main ? " · MAIN" : ""}`}
        title={field.title}
        description="세부 학습 자료와 진도는 실제로 등록한 내용만 표시합니다."
        action={
          <button className="primary-button" onClick={() => setAdding(true)}>
            <Plus size={16} />
            자료 등록
          </button>
        }
      />
      <Section title="등록한 자료">
        <div className="v1-three-grid">
          {materials.length ? (
            materials.map((m) => <MaterialSummary material={m} key={m.id} />)
          ) : (
            <Empty>
              아직 등록된 자료가 없습니다. 임의의 학습 자료나 진도율은 표시하지
              않습니다.
            </Empty>
          )}
        </div>
      </Section>
      <Section title="학습 기록">
        <LogList logs={logs} />
      </Section>
      {adding && (
        <MaterialForm
          value={{
            id: crypto.randomUUID(),
            title: "",
            area: field.id,
            kind: "reference",
            status: "보관 중",
            total: null,
            targetPasses: null,
            note: "",
            routine: "",
            schedule: [],
            startDate: "",
            duration: null,
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
export function Library() {
  const { data } = useData();
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("전체");
  const [area, setArea] = useState("전체");
  const [search, setSearch] = useState("");
  const list = data.materials.filter(
    (m) =>
      (status === "전체" || m.status === status) &&
      (area === "전체" || m.area === area) &&
      m.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="LIBRARY"
        title="보관함"
        description="자료는 보관함에, 학습은 나의 선택으로. 등록만으로 오늘 할 일이 생성되지 않습니다."
        action={
          <button className="primary-button" onClick={() => setAdding(true)}>
            <Plus size={16} />
            자료 등록
          </button>
        }
      />
      <div className="v1-filters">
        <label>
          자료명 검색
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="자료 찾기"
          />
        </label>
        <label>
          상태
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["전체", ...materialStatuses].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          분야
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option>전체</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="v1-three-grid">
        {list.length ? (
          list.map((m) => <MaterialSummary material={m} key={m.id} />)
        ) : (
          <Empty>조건에 맞는 자료가 없습니다.</Empty>
        )}
      </div>
      {adding && <MaterialForm onClose={() => setAdding(false)} />}
    </>
  );
}
export function MaterialPage() {
  const { id } = useParams();
  const { data, update } = useData();
  const material = data.materials.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState<StudyLog | null>(null);
  const [round, setRound] = useState(1);
  const [month, setMonth] = useState("2026-04");
  const [page, setPage] = useState(0);
  if (!material)
    return (
      <Empty>
        자료를 찾을 수 없습니다. <Link to="/library">보관함으로</Link>
      </Empty>
    );
  const m = material;
  if (isEbsCourse(m)) return <Navigate to="/english/ebs" replace />;
  if (isDayBook(m)) return <DayBook material={m} />;
  const p = progress(m, data.logs, round);
  const items = m.kind === "audio" ? episodes(m, month) : unitItems(m);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(items.length / 20) - 1),
  );
  const list = items.slice(currentPage * 20, (currentPage + 1) * 20);
  const rounds = completedRounds(m, data.logs);
  return (
    <>
      <Link className="back-link" to="/library">
        <ArrowLeft size={15} />
        보관함으로
      </Link>
      <PageHeading
        eyebrow={fieldName(m.area)}
        title={m.title}
        description={m.routine || "자료의 규모와 실제 학습 진도를 분리합니다."}
        action={
          <button className="secondary-button" onClick={() => setEditing(true)}>
            <Pencil size={15} />
            자료 설정 수정
          </button>
        }
      />
      <div className="v1-material-info">
        <div className="v1-card-line">
          <label>
            자료 상태
            <select
              aria-label="자료 상태"
              value={m.status}
              onChange={(e) => {
                const status = e.target.value as Material["status"];
                update((d) => ({
                  ...d,
                  materials: d.materials.map((x) =>
                    x.id === m.id ? { ...x, status } : x,
                  ),
                }));
              }}
            >
              {materialStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <span className="status-pill">기록은 상태 변경과 무관하게 유지</span>
        </div>
        <p>{m.note}</p>
        <div className="material-meta">
          {m.total && (
            <span>
              자료 전체량 {m.total.toLocaleString()}
              {m.kind === "units"
                ? " Units"
                : m.kind === "days"
                  ? " Days"
                  : m.kind === "book"
                    ? " 페이지"
                    : "개"}
            </span>
          )}
          {m.targetPasses && (
            <span>
              목표 {m.targetPasses}회독 · 완료 {rounds}회독 · 추가 회독 제한
              없음
            </span>
          )}
          {m.duration !== null && (
            <span>
              회차 약 {m.duration}분 · 실제 시간으로 자동 집계하지 않음
            </span>
          )}
        </div>
      </div>
      <Section title="회차별 학습 관리" tag="LEARNING RECORDS">
        <div className="record-controls">
          {m.kind === "audio" ? (
            <label>
              발행 월
              <input
                type="month"
                value={month}
                min={m.startDate.slice(0, 7)}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          ) : (
            <label>
              조회할 회독 번호
              <input
                type="number"
                aria-label="조회할 회독 번호"
                min="1"
                step="1"
                value={round}
                onChange={(e) => {
                  setRound(
                    Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  );
                  setPage(0);
                }}
              />
            </label>
          )}
          <button
            className="primary-button"
            onClick={() => setLog(createLog(m.area, m.id, "", round))}
          >
            <Plus size={15} />새 학습 기록
          </button>
        </div>
        {m.kind !== "audio" &&
          m.total &&
          p.entries.some((l) => l.round === round) && (
            <Progress
              done={p.count}
              total={m.total}
              label={`${round}회독 완료 ${m.kind === "units" ? "Units" : m.kind === "days" ? "Days" : m.kind === "book" ? "페이지" : "항목"}`}
            />
          )}
        <p className="micro-note">
          {m.kind === "audio"
            ? "발행 요일 기반 목록입니다. 휴방 등 실제 편성은 별도 확인해 주세요. 회차 발행일과 실제 청취일은 서로 다릅니다."
            : "완료한 Unit / Day / 페이지를 선택해 날짜와 시간을 입력하세요. 회독 번호는 목표 횟수를 초과할 수 있습니다."}
        </p>
        <div className="item-list">
          {list.map((item) => {
            const records = p.entries.filter(
              (l) => l.item === item && l.round === round,
            );
            const latest = records.at(-1);
            const complete = records.some((l) => l.completed);
            const count = p.entries.filter(
              (l) => l.item === item && l.completed,
            ).length;
            return (
              <div
                className={`unit-row ${complete ? "is-complete" : ""}`}
                key={item}
              >
                <div>
                  <strong>
                    {m.kind === "audio"
                      ? `${item} 회차`
                      : `${m.kind === "units" ? "Unit" : m.kind === "days" ? "Day" : m.kind === "book" ? "페이지" : "항목"} ${item}`}
                  </strong>
                  <small>
                    {latest
                      ? `${complete ? "완료" : "진행 중"} · 실제 학습일 ${latest.date ?? "미입력"} · 누적 ${count}회 완료 기록`
                      : "기록 전"}
                  </small>
                </div>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setLog(latest ?? createLog(m.area, m.id, item, round))
                  }
                >
                  {latest ? "기록 확인 / 수정" : "완료 기록"}
                </button>
                {latest && (
                  <button
                    className="text-button"
                    onClick={() => setLog(createLog(m.area, m.id, item, round))}
                  >
                    추가 반복
                  </button>
                )}
              </div>
            );
          })}
          {!items.length && (
            <Empty>
              전체량 또는 발행 시작일·요일을 자료 설정에 입력하면 항목별 관리가
              가능합니다. 자유 학습 기록은 바로 추가할 수 있습니다.
            </Empty>
          )}
        </div>
        {items.length > 20 && (
          <div className="pagination">
            <button
              className="secondary-button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              이전
            </button>
            <span>
              {currentPage + 1} / {Math.ceil(items.length / 20)}
            </span>
            <button
              className="secondary-button"
              disabled={(currentPage + 1) * 20 >= items.length}
              onClick={() => setPage(currentPage + 1)}
            >
              다음
            </button>
          </div>
        )}
      </Section>
      <Section title="이 자료의 전체 기록" tag="ALL ROUNDS">
        <LogList logs={p.entries} onEdit={setLog} />
      </Section>
      {editing && <MaterialForm value={m} onClose={() => setEditing(false)} />}
      {log && <LogForm value={log} onClose={() => setLog(null)} />}
    </>
  );
}
export function LogList({
  logs,
  onEdit,
}: {
  logs: StudyLog[];
  onEdit?: (log: StudyLog) => void;
}) {
  const { data } = useData();
  return (
    <div className="log-list">
      {!logs.length ? (
        <Empty>
          아직 기록된 활동이 없습니다. 학습 날짜와 실제 시간을 입력하면 여기에
          표시됩니다.
        </Empty>
      ) : (
        logs.map((l) => (
          <article
            className={`log-row ${l.voided ? "is-voided" : ""}`}
            key={l.id}
          >
            <span className={`log-type ${l.activity}`}>
              {l.initialLearning ? "신규 학습" : ActivityLabels[l.activity]}
            </span>
            <div>
              <h3>
                {l.topic
                  ? `OPIc · ${l.topic}`
                  : data.materials.find((m) => m.id === l.materialId)?.title ||
                    l.note ||
                    "자유 기록"}
              </h3>
              <p>
                {l.voided ? "완료 취소" : l.completed ? "완료" : "진행 중"} ·{" "}
                {fieldName(l.area)} ·{" "}
                {l.item
                  ? data.materials.some(
                      (m) => m.id === l.materialId && isEbsCourse(m),
                    )
                    ? `콘텐츠 발행일 ${l.contentDate ?? l.item} · `
                    : l.initialLearning
                      ? `Day ${l.item} · 신규 학습 · `
                      : `${l.item} · ${l.round}회독 · `
                  : ""}
                실제 학습일 {l.date || "미입력"} ·{" "}
                {l.minutes === null ? "시간 미입력" : `${l.minutes}분`}
                {l.voided ? " (집계 제외)" : ""}
              </p>
              {l.origin === "reported" && (
                <small>사용자 제공 기존 이력 · 발행일 ≠ 실제 청취일</small>
              )}
              {l.writing && <p className="log-content">영작: {l.writing}</p>}
              {l.speaking && (
                <p className="log-content">말하기: {l.speaking}</p>
              )}
              {l.note && <small>{l.note}</small>}
            </div>
            {onEdit && (
              <button
                className="icon-button"
                aria-label={`${l.topic || l.item || "활동"} 기록 수정`}
                onClick={() => onEdit(l)}
              >
                <Pencil size={16} />
              </button>
            )}
          </article>
        ))
      )}
    </div>
  );
}
export function Records() {
  const { data } = useData();
  const [editing, setEditing] = useState<StudyLog | null>(null);
  const [type, setType] = useState("all");
  const [area, setArea] = useState("all");
  const [date, setDate] = useState("");
  const filtered = data.logs.filter(
    (l) =>
      (type === "all" || l.activity === type) &&
      (area === "all" || l.area === area) &&
      (!date || l.date === date),
  );
  const sum = (activity: string) => {
    const timed = filtered.filter(
      (l) => l.activity === activity && l.minutes !== null,
    );
    const measured = timed.filter((l) => !l.voided);
    return timed.length
      ? `${measured.reduce((s, l) => s + (l.minutes ?? 0), 0)}분`
      : "미기록";
  };
  return (
    <>
      <PageHeading
        eyebrow="LEARNING LOG"
        title="학습 기록"
        description="학습·복습·자료 정비를 분리합니다. EBS 빠른 완료는 기본 18분으로 기록되며 수정할 수 있습니다."
        action={
          <button
            className="primary-button"
            onClick={() => setEditing(createLog())}
          >
            <Plus size={16} />
            기록 추가
          </button>
        }
      />
      <div className="v1-filters">
        <label>
          활동 구분
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">전체</option>
            {Object.entries(ActivityLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          분야
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">전체</option>
            {fields.map((f) => (
              <option value={f.id} key={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          실제 학습 날짜
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          className="text-button"
          onClick={() => {
            setType("all");
            setArea("all");
            setDate("");
          }}
        >
          필터 초기화
        </button>
      </div>
      <div className="stats activity-stats">
        <Stat
          label="학습시간"
          value={sum("study")}
          note="선택 조건 내 실제 입력 시간"
        />
        <Stat
          label="복습시간"
          value={sum("review")}
          note="선택 조건 내 실제 입력 시간"
        />
        <Stat
          label="자료 정비시간"
          value={sum("system")}
          note="학습시간에서 분리"
        />
      </div>
      <p className="micro-note">
        선택한 기록 {filtered.length}건 · 날짜 미입력{" "}
        {filtered.filter((l) => !l.date).length}건 · 시간 미입력{" "}
        {filtered.filter((l) => l.minutes === null).length}건. 자료별 진도와
        회독은 각 자료 상세 화면에서 확인할 수 있습니다.
      </p>
      <LogList
        logs={[...filtered].sort((a, b) =>
          (b.date ?? "").localeCompare(a.date ?? ""),
        )}
        onEdit={setEditing}
      />
      {editing && (
        <LogForm
          value={editing}
          practice={!!editing.topic}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
export function Goals() {
  const { data } = useData();
  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="GOALS"
        title="목표 관리"
        description="정해진 순서 없이, 나에게 필요한 시험을 독립적으로 준비해요."
        action={
          <button
            className="primary-button"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            목표 추가
          </button>
        }
      />
      <div className="v1-notice">
        <Target size={22} />
        <div>
          <strong>목표는 순서가 아닌 선택입니다.</strong>
          <p>
            OPIc AL은 교재 회독과 독립적으로 병행합니다. OPI 응시 조건이
            필요하면 목표 수정에서 OPIc · AL을 선택적으로 연결하세요.
          </p>
        </div>
      </div>
      <div className="v1-three-grid">
        {data.goals.map((g) => (
          <GoalCard
            goal={g}
            key={g.id}
            onEdit={() => {
              setEditing(g);
              setOpen(true);
            }}
          />
        ))}
      </div>
      <Section title="사내 인정 시험" tag="COMPANY RECOGNITION">
        <div className="v1-two-grid">
          {Object.entries(companyExams).map(([area, exams]) => (
            <article className="simple-panel" key={area}>
              <h3>{fieldName(area)}</h3>
              <p>{exams.join(" · ")}</p>
            </article>
          ))}
        </div>
      </Section>
      {open && <GoalForm value={editing} onClose={() => setOpen(false)} />}
    </>
  );
}
export function Tasks() {
  const { data } = useData();
  const [editing, setEditing] = useState<Task | undefined>();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="TASKS & PROJECTS"
        title="과업"
        description="자료 정비와 자유 과업을 관리합니다. 실제 학습 진도와 섞지 않아요."
        action={
          <button
            className="primary-button"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            과업 추가
          </button>
        }
      />
      <div className="v1-two-grid">
        {data.tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={() => {
              setEditing(t);
              setOpen(true);
            }}
          />
        ))}
      </div>
      <Section title="기존 SYSTEM 자료" tag="PRESERVED">
        <div className="simple-panel">
          <Layers3 size={20} />
          <p>
            기존 SYSTEM 프로젝트와 시제품 데이터는 별도 보존되어 있습니다. 아래
            화면은 가상 진도가 포함된 과거 시제품이며 현재 HOME 집계에 합산하지
            않습니다.
          </p>
          <a className="text-link" href="/prototype/system">
            기존 SYSTEM 화면 보기 <ArrowUpRight size={14} />
          </a>
        </div>
      </Section>
      {open && <TaskForm value={editing} onClose={() => setOpen(false)} />}
    </>
  );
}
