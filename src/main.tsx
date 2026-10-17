import React, { useState } from "react";
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
  BriefcaseBusiness,
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
  type Metric,
  type Area,
} from "./data";
import "./styles.css";
const icons = [BriefcaseBusiness, BookOpen, GraduationCap, Globe2, Layers3];
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
          {areas.map((a, i) => {
            const Icon = icons[i];
            return (
              <NavLink key={a.id} to={`/${a.id}`}>
                <Icon size={19} />
                {a.title}
                <span className={`nav-dot ${a.color}`} />
              </NavLink>
            );
          })}
          <div className="nav-divider" />
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
                      value="3"
                      unit="개 영역"
                      note="커리어 · 영어 · 관세사"
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
                    right="다섯 개의 영역, 하나의 성장"
                  />
                  <section className="area-grid">
                    {areas.map((a, i) => (
                      <AreaCard key={a.id} area={a} index={i} />
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
function AreaCard({ area: a, index }: { area: Area; index: number }) {
  const Icon = icons[index];
  const metric =
    a.id === "english"
      ? a.metrics[1]
      : a.id === "customs"
        ? { done: 20, total: 360 }
        : a.id === "system"
          ? a.metrics[0]
          : undefined;
  return (
    <Link to={`/${a.id}`} className={`area-card ${a.color}`}>
      <div className="card-top">
        <span className="area-icon">
          <Icon size={22} />
        </span>
        <span className="badge">{a.status}</span>
        <ArrowUpRight size={17} className="card-arrow" />
      </div>
      <p className="area-name">{a.name}</p>
      <h3>{a.title}</h3>
      <p className="area-goal">{a.goal}</p>
      {a.id === "english" ? (
        <div className="card-detail">
          OPIc{" "}
          <span>
            IM2 <ArrowRight size={12} /> <strong>AL</strong>
          </span>
        </div>
      ) : a.id === "languages" ? (
        <div className="language-chips">
          <span>
            中 <small>LIGHT</small>
          </span>
          <span>
            日 <small>LIGHT</small>
          </span>
          <span>
            ES <small>PARKED</small>
          </span>
        </div>
      ) : (
        <div className="card-detail">
          {a.id === "customs"
            ? "해커스 관세사 1차"
            : a.id === "career"
              ? "포워딩 실무 · 7개 학습 분야"
              : "영어 단어장 DB 정비"}
          <span>
            {a.id === "customs"
              ? "6과목"
              : a.id === "system"
                ? "자료 정리"
                : ""}
          </span>
        </div>
      )}
      {metric && metric.done !== undefined && metric.total !== undefined ? (
        <Progress done={metric.done} total={metric.total} color={a.color} />
      ) : (
        <div className="unmeasured">
          <span>
            {a.id === "career" ? "진행량 미입력" : "각 언어의 속도에 맞춰"}
          </span>
          <ArrowRight size={15} />
        </div>
      )}
      <div className="card-bottom">
        {a.id === "english"
          ? "예문 학습 기준 · 가상 데이터"
          : a.id === "customs"
            ? "전체 20 / 360강 · 가상 데이터"
            : a.id === "system"
              ? "DB 정비 기준 · 가상 데이터"
              : "자세히 살펴보기"}
      </div>
    </Link>
  );
}
function Detail({ area: a }: { area: Area }) {
  return (
    <>
      <Link
        className="back-link"
        to={languages.includes(a) ? "/languages" : "/"}
      >
        <ArrowLeft size={16} />
        {languages.includes(a) ? "외국어" : "전체 보기"}로 돌아가기
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
              학습(STUDY) 시간과 자료 정리(SYSTEM) 시간은 구분합니다. 오늘 샘플
              계획: 학습 110분 · 정리 20분.
            </small>
          </p>
        </div>
      )}
      {a.id === "languages" ? (
        <div className="language-grid">
          {languages.map((l, i) => (
            <Link
              to={`/languages/${l.id}`}
              className={`language-card ${l.color}`}
              key={l.id}
            >
              <div className="flex justify-between">
                <span className="language-symbol">
                  {["中", "あ", "Ñ", "字"][i]}
                </span>
                <span className="badge">{l.status}</span>
              </div>
              <p className="eyebrow">{l.name}</p>
              <h2>{l.title}</h2>
              <p>{l.goal}</p>
              <small>
                {
                  [
                    "HSK 1~5급 DB 2,500단어 · HSK6 준비",
                    "가나 · 기초 어휘 · JLPT N5부터",
                    "DELE A2 취득 · B1 → B2 장기 목표",
                    "중국어·일본어 연계 · 808자 기준",
                  ][i]
                }
              </small>
              <div className="language-bottom">
                자세히 보기 <ArrowUpRight size={18} />
              </div>
            </Link>
          ))}
        </div>
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
            {[
              ["01", "무역영어 1급", "2026년 11월 목표"],
              ["02", "원산지관리사", "시험 일정에 맞춰 준비"],
              ["03", "보세사", "시험 일정에 맞춰 준비"],
            ].map(([n, title, note]) => (
              <article key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{note}</p>
                  <small>관세사 공부와 연결된 하위 목표</small>
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
