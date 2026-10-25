import { VocabularyPage } from "./Vocabulary";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  LayoutGrid,
  CalendarDays,
  Globe2,
  GraduationCap,
  Library,
  ListTodo,
  ChartNoAxesColumnIncreasing,
  Target,
  Layers3,
  Leaf,
  Download,
  ChevronRight,
} from "lucide-react";
import LegacyApp from "./LegacyApp";
import { EbsPage } from "./Ebs";
import { TaskDetailPage } from "./Tasks";
import { CalendarPage } from "./Calendar";
import { DataProvider, useData } from "./state";
import {
  Home,
  Category,
  English,
  FieldPage,
  Library as LibraryPage,
  MaterialPage,
  Tasks,
  Records,
  Goals,
} from "./pages";
import { exportData } from "./storage";
import { fieldName } from "./model";
import "./styles.css";
const navigation = [
  { path: "/", label: "HOME", icon: LayoutGrid },
  { path: "/calendar", label: "캘린더", icon: CalendarDays },
  { path: "/languages", label: "외국어", icon: Globe2 },
  { path: "/certifications", label: "자격증", icon: GraduationCap },
  { path: "/library", label: "보관함", icon: Library },
  { path: "/tasks", label: "과업", icon: ListTodo },
  { path: "/records", label: "학습 기록", icon: ChartNoAxesColumnIncreasing },
  { path: "/goals", label: "목표 관리", icon: Target },
];
function App() {
  const { data, storageError } = useData();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const fieldId = location.pathname.split("/")[2];
  const activePath =
    location.pathname.startsWith("/english") ||
    location.pathname.startsWith("/vocabulary/") ||
    ["chinese", "japanese", "spanish"].includes(fieldId)
      ? "/languages"
      : location.pathname.startsWith("/fields/")
        ? "/certifications"
        : location.pathname.startsWith("/tasks/")
          ? "/tasks"
          : location.pathname.startsWith("/materials/")
            ? "/library"
            : location.pathname;
  const title =
    navigation.find((n) => n.path === activePath)?.label ??
    fieldName(fieldId ?? "");
  return (
    <div className="app-shell dashboard-v1">
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="HOME으로 이동">
          <span className="brand-icon">
            <Layers3 size={21} />
          </span>
          <span>
            MY DASHBOARD<small>나의 배움 지도 · V1</small>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={() => (activePath === path ? "active" : "")}
              aria-label={label}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
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
        <button
          className="backup-button"
          aria-label="JSON 백업 다운로드"
          onClick={() => exportData(data)}
        >
          <Download size={15} />
          <span>JSON 백업 다운로드</span>
        </button>
        <div className="profile">
          <span className="avatar">M</span>
          <div>
            My workspace<small>개인용 · 이 브라우저에 저장</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            나의 워크스페이스 <ChevronRight size={13} />
            <strong>{title}</strong>
          </span>
          <span className="sample">
            <span />
            {storageError ? "저장 주의" : "로컬 저장 · 온라인 동기화 없음"}
          </span>
        </header>
        <div className="page">
          {storageError && (
            <div className="storage-alert" role="alert">
              {storageError}
              <button
                className="secondary-button"
                onClick={() => exportData(data)}
              >
                현재 데이터 백업
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/english" element={<English />} />
            <Route path="/english/ebs" element={<EbsPage />} />
            <Route
              path="/languages"
              element={<Category category="languages" />}
            />
            <Route
              path="/certifications"
              element={<Category category="certifications" />}
            />
            <Route path="/fields/:id" element={<FieldPage key={fieldId} />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route
              path="/materials/:id"
              element={<MaterialPage key={fieldId} />}
            />
            <Route
              path="/vocabulary/:id"
              element={<VocabularyPage key={fieldId} />}
            />
            <Route path="/tasks" element={<Tasks />} />
            <Route
              path="/tasks/:id"
              element={<TaskDetailPage key={fieldId} />}
            />
            <Route path="/records" element={<Records />} />
            <Route path="/goals" element={<Goals />} />
            <Route
              path="/customs"
              element={<Navigate to="/fields/customs" replace />}
            />
            <Route path="/system" element={<Navigate to="/tasks" replace />} />
            <Route
              path="/activity"
              element={<Navigate to="/records" replace />}
            />
            {["chinese", "japanese", "spanish"].map((id) => (
              <Route
                key={id}
                path={`/languages/${id}`}
                element={<Navigate to={`/fields/${id}`} replace />}
              />
            ))}
            <Route
              path="*"
              element={
                <div className="v1-empty">
                  페이지를 찾을 수 없습니다.{" "}
                  <Link to="/">HOME으로 돌아가기</Link>
                </div>
              }
            />
          </Routes>
          <footer>
            <span>
              기존 이력 보존 · EBS 빠른 완료는 기본 18분 · 실제 학습일 기준 집계
            </span>
            <a href="/prototype">이전 시제품 보기 (샘플 데이터)</a>
          </footer>
        </div>
      </main>
    </div>
  );
}
const legacy =
  location.pathname === "/prototype" ||
  location.pathname.startsWith("/prototype/");
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {legacy ? (
      <BrowserRouter basename="/prototype">
        <div className="legacy-banner">
          이전 시제품 · 가상 진도와 시간이 포함되어 있습니다. 현재 실제 집계에
          합산하지 않습니다. <a href="/">V1 HOME으로 돌아가기</a>
        </div>
        <LegacyApp />
      </BrowserRouter>
    ) : (
      <BrowserRouter>
        <DataProvider>
          <App />
        </DataProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>,
);
