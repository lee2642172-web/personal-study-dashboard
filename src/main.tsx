import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  BookOpen,
  GraduationCap,
  Globe2,
  Layers3,
  ChartNoAxesColumnIncreasing,
  Sparkles,
  Clock3,
  Check,
  CheckCheck,
  Target,
  ChevronRight,
  Leaf,
} from "lucide-react";
import {
  areas,
  languages,
  initialTasks,
  subjects,
  week,
  learningCategories,
  certificationCheckpoints,
  type Metric,
  type Area,
} from "./data";
import "./styles.css";

function Progress({
  done,
  total,
  color = "blue",
}: {
  done: number;
  total: number;
  color?: string;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  return (
    <div className={`progress-wrap ${color}`}>
      <div className="progress-caption">
        <span>진행률</span>
        <strong>{Number(percent.toFixed(1))}%</strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="진행률"
        aria-valuenow={Number(percent.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
function MetricCard({ item, color }: { item: Metric; color: string }) {
  return (
    <article
      className={`metric-card ${color} ${item.status === "FOCUS" ? "focused" : ""}`}
    >
      <div className="flex justify-between gap-3">
        <h3>{item.label}</h3>
        {item.status && <span className="badge">{item.status}</span>}
      </div>
      {item.done !== undefined && item.total !== undefined ? (
        <>
          <p className="metric-count">
            <strong>{item.done.toLocaleString()}</strong> /{" "}
            {item.total.toLocaleString()}
            {item.unit}
          </p>
          <Progress done={item.done} total={item.total} color={color} />
        </>
      ) : (
        <div className="no-record">
          {item.note?.includes("기록") || item.note?.includes("미입력")
            ? "기록 전"
            : "계획 및 자료 현황"}
        </div>
      )}
      {item.note && <p className="muted metric-note">{item.note}</p>}
    </article>
  );
}
function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState("all");
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash, location.key]);

  const completed = tasks.filter((t) => t.done);
  const study = completed
    .filter((t) => t.type === "study")
    .reduce((s, t) => s + t.minutes, 0);
  const dayIndex =
    (new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    ).getDay() +
      6) %
    7;
  const weeklyMinutes = week.reduce(
    (s, d, i) => s + (i === dayIndex ? study : d.study + d.review),
    0,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Layers3 size={21} />
          </span>
          <span>
            MY DASHBOARD<small>나의 배움 지도</small>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <NavLink to="/" end>
            <LayoutGrid size={19} />
            전체 보기
          </NavLink>
          {learningCategories.map((category) => {
            const Icon = category.id === "languages" ? Globe2 : GraduationCap;
            const isCurrent =
              location.pathname.startsWith(`/${category.id}`) ||
              location.pathname === `/${category.mainId}`;
            return (
              <NavLink
                key={category.id}
                to={`/${category.id}`}
                className={() => (isCurrent ? "active" : "")}
              >
                <Icon size={19} />
                {category.title}
              </NavLink>
            );
          })}
          <div className="nav-divider" />
          <NavLink to="/system">
            <Layers3 size={19} />
            자료 · Task 준비
          </NavLink>
          <NavLink to="/activity">
            <ChartNoAxesColumnIncreasing size={19} />
            학습 활동
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <Leaf size={22} />
          <p>
            조금씩, 꾸준히.
            <br />
            <strong>쌓이는 배움의 힘.</strong>
          </p>
          <span>나만의 속도로 나아가요.</span>
        </div>
        <div className="profile">
          <span className="avatar">M</span>
          <div>
            My workspace<small>Personal · Prototype v1</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            나의 워크스페이스 <ChevronRight size={13} />{" "}
            <strong>
              {location.pathname === "/"
                ? "전체 보기"
                : location.pathname === "/activity"
                  ? "학습 활동"
                  : location.pathname === "/certifications"
                    ? "자격증"
                    : [...areas, ...languages].find((a) =>
                        location.pathname.endsWith(a.id),
                      )?.title || "상세 보기"}
            </strong>
          </span>
          <span className="sample">
            <span />
            샘플 데이터
          </span>
        </header>
        <div className="page" key={location.pathname}>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">YOUR LEARNING, AT A GLANCE</p>
                      <h1>
                        오늘도, 한 걸음 더 <span className="greeting">✦</span>
                      </h1>
                      <p className="subtitle">
                        배움의 방향은 선명하게, 나의 속도는 꾸준하게.
                      </p>
                    </div>
                    <div className="date-block">
                      <span>
                        {new Intl.DateTimeFormat("ko-KR", {
                          timeZone: "Asia/Seoul",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "long",
                        }).format(new Date())}
                      </span>
                      <small>작은 실천이 큰 변화를 만듭니다</small>
                    </div>
                  </div>
                  <section className="focus-banner">
                    <div className="focus-icon">
                      <Target size={26} />
                    </div>
                    <div>
                      <p className="eyebrow">CURRENT FOCUS</p>
                      <h2>영어는 더 유창하게, 무역은 더 전문적으로.</h2>
                      <p>
                        OPIc AL & 관세사 1차 · 지금 가장 중요한 두 가지 목표
                      </p>
                    </div>
                    <Link to="/customs" className="focus-link">
                      목표 살펴보기 <ArrowUpRight size={17} />
                    </Link>
                    <div className="orb orb-one" />
                    <div className="orb orb-two" />
                  </section>
                  <section className="stats">
                    <Stat
                      icon={Clock3}
                      label="Today's Study"
                      value={study.toString()}
                      unit="분"
                      note="오늘 완료한 학습"
                    />
                    <Stat
                      icon={ChartNoAxesColumnIncreasing}
                      label="Weekly Study"
                      value={`${Math.floor(weeklyMinutes / 60)}h ${weeklyMinutes % 60}`}
                      unit="m"
                      note="이번 주 학습 + 복습 · 샘플"
                    />
                    <Stat
                      icon={Target}
                      label="Active Projects"
                      value={String(learningCategories.length)}
                      unit="개 집중 목표"
                      note="영어 · 관세사"
                    />
                    <Stat
                      icon={CheckCheck}
                      label="Completed Tasks"
                      value={String(completed.length)}
                      unit={`/ ${tasks.length}`}
                      note="오늘의 작은 성취"
                    />
                  </section>
                  <SectionTitle
                    title="나의 배움 지도"
                    english="MASTER MAP"
                    right="두 개의 축, 나만의 성장"
                  />
                  <section
                    className="learning-grid"
                    aria-label="최상위 학습 카테고리"
                  >
                    {learningCategories.map((category) => (
                      <LearningCategory key={category.id} category={category} />
                    ))}
                  </section>
                  <section className="today">
                    <SectionTitle
                      title="오늘의 작은 실천"
                      english="TODAY"
                      right={`${completed.length} / ${tasks.length} 완료`}
                    />
                    <div className="today-box">
                      <div className="today-toolbar">
                        <div
                          className="segmented"
                          role="group"
                          aria-label="활동 유형 필터"
                        >
                          {[
                            ["all", "전체"],
                            ["study", "학습"],
                            ["system", "자료 정리"],
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              aria-pressed={filter === id}
                              className={filter === id ? "selected" : ""}
                              onClick={() => setFilter(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <span className="muted">오늘의 집중을 차곡차곡</span>
                      </div>
                      {tasks
                        .filter((t) => filter === "all" || t.type === filter)
                        .map((t) => (
                          <label
                            className={`task ${t.done ? "done" : ""}`}
                            key={t.id}
                          >
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() =>
                                setTasks((old) =>
                                  old.map((x) =>
                                    x.id === t.id ? { ...x, done: !x.done } : x,
                                  ),
                                )
                              }
                            />
                            <span className="custom-check">
                              {t.done && <Check size={13} />}
                            </span>
                            <span className="task-text">
                              <strong>{t.label}</strong>
                              <small>{t.detail}</small>
                            </span>
                            <span className={`type-label ${t.type}`}>
                              {t.type === "study" ? "STUDY" : "SYSTEM"}
                            </span>
                            <span className="task-duration">
                              <Clock3 size={13} />
                              {t.minutes}분
                            </span>
                          </label>
                        ))}
                    </div>
                  </section>
                </>
              }
            />
            {[...areas, ...languages].map((a) => (
              <Route
                key={a.id}
                path={languages.includes(a) ? `/languages/${a.id}` : `/${a.id}`}
                element={<Detail area={a} />}
              />
            ))}
            <Route
              path="/certifications"
              element={
                <>
                  <Link className="back-link" to="/">
                    <ArrowLeft size={16} />
                    전체 보기로 돌아가기
                  </Link>
                  <div className="detail-heading purple">
                    <p className="eyebrow">CERTIFICATIONS</p>
                    <h1>자격증</h1>
                    <p className="subtitle">
                      관세사를 중심으로, 무역 전문성을 쌓아요.
                    </p>
                  </div>
                  <LearningCategory
                    category={learningCategories[1]}
                    showHeading={false}
                  />
                </>
              }
            />
            <Route path="/activity" element={<Activity tasks={tasks} />} />
            <Route
              path="*"
              element={
                <>
                  <h1>페이지를 찾을 수 없어요</h1>
                  <Link to="/">전체 보기로 돌아가기</Link>
                </>
              }
            />
          </Routes>
          <footer>
            <span>
              <Sparkles size={14} /> 나의 가능성을 넓혀가는 공간
            </span>
            <span>
              PROTOTYPE V1 · 모든 활동 수치와 진행량은 UI 테스트용 샘플입니다
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  unit,
  note,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  unit: string;
  note: string;
}) {
  return (
    <article className="stat">
      <div className="stat-label">
        {label}
        <Icon size={16} />
      </div>
      <p>
        <strong>{value}</strong>
        <span>{unit}</span>
      </p>
      <small>{note}</small>
    </article>
  );
}
function SectionTitle({
  title,
  english,
  right,
}: {
  title: string;
  english: string;
  right?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <span>{english}</span>
      </div>
      <small>{right}</small>
    </div>
  );
}
function LearningCategory({
  category,
  showHeading = true,
}: {
  category: (typeof learningCategories)[number];
  showHeading?: boolean;
}) {
  const main = areas.find((area) => area.id === category.mainId)!;
  const isLanguage = category.id === "languages";
  return (
    <section className={`learning-category ${main.color}`}>
      {showHeading && (
        <div className="category-heading">
          <div>
            <p className="eyebrow">{category.name}</p>
            <h2>{category.title}</h2>
          </div>
          <Link
            to={`/${category.id}`}
            aria-label={`${category.title} 전체 보기`}
          >
            전체 보기 <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <AreaCard area={main} />
      <div className="secondary-heading">
        <span>함께 이어가는 {isLanguage ? "언어" : "자격증"}</span>
        <small>SUPPORTING</small>
      </div>
      <div className="supporting-list">
        {isLanguage
          ? languages
              .filter((language) => language.id !== "hanzi")
              .map((language) => (
                <Link
                  key={language.id}
                  to={`/languages/${language.id}`}
                  className={`supporting-card ${language.color}`}
                >
                  <span className="supporting-icon">
                    <Globe2 size={18} />
                  </span>
                  <div>
                    <h3>{language.title}</h3>
                    <p>{language.goal}</p>
                  </div>
                  <span className="badge">{language.status}</span>
                  <ChevronRight size={16} />
                </Link>
              ))
          : certificationCheckpoints.map((checkpoint) => (
              <Link
                key={checkpoint.id}
                to={`/customs#${checkpoint.id}`}
                className="supporting-card purple"
              >
                <span className="supporting-icon">
                  <GraduationCap size={18} />
                </span>
                <div>
                  <h3>{checkpoint.title}</h3>
                  <p>{checkpoint.note}</p>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))}
      </div>
      {isLanguage && (
        <Link className="category-footnote" to="/languages/hanzi">
          공용한자 808 · 중국어와 일본어 연결 <ArrowRight size={14} />
        </Link>
      )}
    </section>
  );
}
function AreaCard({ area: a }: { area: Area }) {
  const Icon = a.id === "english" ? BookOpen : GraduationCap;
  const metric =
    a.id === "english"
      ? a.metrics[1]
      : {
          done: subjects.reduce((sum, subject) => sum + (subject.done ?? 0), 0),
          total: subjects.reduce(
            (sum, subject) => sum + (subject.total ?? 0),
            0,
          ),
        };
  return (
    <Link to={`/${a.id}`} className={`area-card main-learning-card ${a.color}`}>
      <div className="card-top">
        <span className="area-icon">
          <Icon size={26} />
        </span>
        <span className="main-label">MAIN</span>
        <span className="badge">{a.status}</span>
        <ArrowUpRight size={18} className="card-arrow" />
      </div>
      <p className="area-name">{a.name}</p>
      <h3>{a.title}</h3>
      <p className="area-goal">{a.goal}</p>
      <div className="card-detail">
        {a.id === "english" ? (
          <>
            OPIc{" "}
            <span>
              IM2 <ArrowRight size={14} /> <strong>AL</strong>
            </span>
          </>
        ) : (
          <>
            해커스 관세사 1차 <span>{subjects.length}과목</span>
          </>
        )}
      </div>
      {metric.done !== undefined && metric.total !== undefined && (
        <Progress done={metric.done} total={metric.total} color={a.color} />
      )}
      <div className="card-bottom">
        {a.id === "english"
          ? "예문 학습 기준 · 기존 가상 데이터"
          : `전체 ${metric.done} / ${metric.total}강 · 기존 가상 데이터`}
      </div>
    </Link>
  );
}
function Detail({ area: a }: { area: Area }) {
  return (
    <>
      <Link
        className="back-link"
        to={
          languages.includes(a) || a.id === "english"
            ? "/languages"
            : a.id === "customs"
              ? "/certifications"
              : "/"
        }
      >
        <ArrowLeft size={16} />
        {languages.includes(a) || a.id === "english"
          ? "외국어"
          : a.id === "customs"
            ? "자격증"
            : "전체 보기"}
        로 돌아가기
      </Link>
      <div className={`detail-heading ${a.color}`}>
        <span className="eyebrow">{a.name}</span>
        <div className="flex items-center gap-4">
          <h1>{a.title}</h1>
          <span className="badge">{a.status}</span>
        </div>
        <p className="subtitle">{a.goal}</p>
      </div>
      {a.id === "english" && (
        <>
          <div className="goal-strip">
            <Target size={23} />
            <div>
              <strong>
                OPIc IM2 <span>→</span> AL
              </strong>
              <p>최우선 외국어 · 이후 OPI 또는 TOEFL</p>
            </div>
            <span className="badge blue">CURRENT FOCUS</span>
          </div>
          <div className="info-box">
            <BookOpen size={20} />
            <p>
              단어 → 구동사 → 패턴 → 구문 →{" "}
              <strong>문장으로 완성하는 영어</strong>
              <br />
              <small>
                Day 303은 보유한 자료의 규모입니다. DB 정비와 실제 예문 학습
                진도를 별도로 관리합니다.
              </small>
            </p>
          </div>
        </>
      )}
      {a.id === "customs" && (
        <div className="summary-panel purple">
          <div>
            <span className="eyebrow">TOTAL LECTURES</span>
            <h2>한 강씩, 전문성에 가까워지기</h2>
            <p>
              전체 <strong>20 / 360강</strong> · 가상 수강 데이터
            </p>
          </div>
          <div className="summary-progress">
            <Progress
              done={20}
              total={subjects.reduce((s, x) => s + (x.total || 0), 0)}
              color="purple"
            />
          </div>
        </div>
      )}
      {a.id === "system" && (
        <div className="info-box">
          <Layers3 size={22} />
          <p>
            <strong>자료 정리도 성장의 한 부분입니다.</strong>
            <br />
            <small>
              SYSTEM 프로젝트 구조는 향후 Task 관리에서도 활용합니다.
              학습(STUDY) 시간과 자료 정리(SYSTEM) 시간은 구분합니다. 오늘 샘플
              계획: 학습 110분 · 정리 20분.
            </small>
          </p>
        </div>
      )}
      {a.id === "languages" ? (
        <LearningCategory
          category={learningCategories[0]}
          showHeading={false}
        />
      ) : (
        <section className="detail-grid">
          {a.metrics.map((m, i) => (
            <MetricCard key={i} item={m} color={a.color} />
          ))}
        </section>
      )}
      {a.id === "customs" && (
        <>
          <SectionTitle title="여정 속 체크포인트" english="MILESTONES" />
          <div className="milestones">
            {certificationCheckpoints.map((checkpoint, index) => (
              <article key={checkpoint.id} id={checkpoint.id} tabIndex={-1}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{checkpoint.title}</h3>
                  <p>{checkpoint.note}</p>
                  <small>관세사 공부와 연결된 하위 목표 · 진행량 미입력</small>
                </div>
              </article>
            ))}
          </div>
          <p className="muted mt-5">
            회계 전체 125강은 예상값(최종 120~130강 예상)입니다. 현재 114강
            공개. 진행량은 모두 가상 데이터입니다.
          </p>
        </>
      )}
      {a.id === "japanese" && (
        <Link className="related-link" to="/languages/hanzi">
          한중일 공용한자 808 함께 보기 <ArrowRight size={16} />
        </Link>
      )}
    </>
  );
}
function Activity({ tasks }: { tasks: typeof initialTasks }) {
  const [range, setRange] = useState("week");
  const completed = tasks.filter((t) => t.done);
  const todayStudy = completed
    .filter((t) => t.type === "study")
    .reduce((s, t) => s + t.minutes, 0);
  const todaySystem = completed
    .filter((t) => t.type === "system")
    .reduce((s, t) => s + t.minutes, 0);
  const todayIndex =
    (new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    ).getDay() +
      6) %
    7;
  const days = week.map((d, i) =>
    i === todayIndex
      ? { ...d, study: todayStudy, review: 0, system: todaySystem }
      : d,
  );
  const selected = range === "week" ? days : [days[todayIndex]];
  const sum = (key: "study" | "review" | "system") =>
    selected.reduce((s, d) => s + d[key], 0);
  return (
    <>
      <p className="eyebrow">ACTIVITY</p>
      <h1>배움이 쌓인 시간</h1>
      <p className="subtitle">학습과 정리를 구분하고, 꾸준함을 발견해요.</p>
      <div
        className="activity-tabs segmented"
        role="group"
        aria-label="활동 기간"
      >
        <button
          className={range === "today" ? "selected" : ""}
          aria-pressed={range === "today"}
          onClick={() => setRange("today")}
        >
          Today
        </button>
        <button
          className={range === "week" ? "selected" : ""}
          aria-pressed={range === "week"}
          onClick={() => setRange("week")}
        >
          This Week
        </button>
      </div>
      <section className="stats activity-stats">
        <Stat
          icon={BookOpen}
          label="Study Time"
          value={String(sum("study"))}
          unit="분"
          note="새로운 내용을 배우는 시간"
        />
        <Stat
          icon={CheckCheck}
          label="Review Time"
          value={String(sum("review"))}
          unit="분"
          note="배운 내용을 다시 내 것으로"
        />
        <Stat
          icon={Layers3}
          label="DB Organization Time"
          value={String(sum("system"))}
          unit="분"
          note="학습 자료를 정리하는 시간"
        />
      </section>
      <section className="chart-panel">
        <SectionTitle
          title={range === "week" ? "이번 주의 리듬" : "오늘의 활동"}
          english="LEARNING RHYTHM"
          right="단위: 분 · 샘플 기록"
        />
        <div className="legend">
          <span>
            <i className="study-dot" />
            학습
          </span>
          <span>
            <i className="review-dot" />
            복습
          </span>
          <span>
            <i className="system-dot" />
            자료 정리
          </span>
        </div>
        <div className="chart">
          {selected.map((d) => (
            <div className="chart-column" key={d.day}>
              <span>{d.study + d.review + d.system}분</span>
              <div
                className="bar-stack"
                role="img"
                aria-label={`${d.day}요일 학습 ${d.study}분, 복습 ${d.review}분, 정리 ${d.system}분`}
              >
                <div
                  className="system-bar"
                  style={{ height: d.system * 1.5 }}
                />
                <div
                  className="review-bar"
                  style={{ height: d.review * 1.5 }}
                />
                <div className="study-bar" style={{ height: d.study * 1.5 }} />
              </div>
              <strong>{d.day}</strong>
            </div>
          ))}
        </div>
      </section>
      <SectionTitle title="오늘의 활동 기록" english="TODAY'S LOG" />
      <div className="today-box">
        {completed.length ? (
          completed.map((t) => (
            <div className="task" key={t.id}>
              <span className="log-icon">
                <Check size={18} />
              </span>
              <span className="task-text">
                <strong>{t.label}</strong>
                <small>
                  {t.type === "study" ? "학습 활동" : "자료 정리 활동"} · 샘플
                  체크 완료
                </small>
              </span>
              <span>{t.minutes}분</span>
            </div>
          ))
        ) : (
          <p className="empty-state">
            아직 완료한 활동이 없어요. 오늘의 작은 실천을 체크해 보세요.
          </p>
        )}
      </div>
      <p className="muted mt-5">
        오늘 기록은 HOME의 체크 상태와 연결됩니다. 그 외 주간 기록은 가상
        데이터이며 새로고침 시 초기화됩니다.
      </p>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
