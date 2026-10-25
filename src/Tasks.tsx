import { useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { useData } from "./state";
import { localDate } from "./dates";
import {
  fields,
  fieldName,
  newId,
  type FieldId,
  type Task,
  type TaskWorkRecord,
  type TaskStep,
} from "./model";
import { PageHeading, Progress, Dialog, Empty } from "./ui";
import { TaskForm } from "./forms";
import { TodoBoard } from "./Todos";
import {
  taskStatuses,
  trackingLabels,
  taskMode,
  taskProgress,
  recordError,
  saveTaskRecord,
  deleteTaskRecord,
  saveTaskStep,
  deleteTaskStep,
  toggleTaskStep,
  workLabel,
  taskWorkSummary,
  formatWorkMinutes,
  workModeLabels,
} from "./taskWork";

function TaskMetric({ task }: { task: Task }) {
  const p = taskProgress(task);
  return (
    <div className="task-work-metric">
      <strong>
        {p.done.toLocaleString()}
        <small>
          {p.unit}
          {p.mode === "rounds" ? " 완료" : " 처리"}
        </small>
      </strong>
      <span>
        {p.total === null
          ? p.mode === "rounds"
            ? "목표 미설정 · 추가 회독 가능"
            : "전체량 미설정"
          : `${p.total.toLocaleString()} ${p.unit} ${p.mode === "rounds" ? "목표" : "중"}`}
      </span>
      {p.percent !== null && (
        <Progress
          done={p.done}
          total={p.total!}
          label={p.mode === "rounds" ? "목표 회독" : "과업 진행"}
        />
      )}
      {p.overflow > 0 && (
        <small>
          목표 초과 {p.overflow.toLocaleString()} {p.unit} · 실제 기록은 모두
          보존
        </small>
      )}
    </div>
  );
}
export function TaskOverviewCard({ task }: { task: Task }) {
  const p = taskProgress(task);
  const work = taskWorkSummary(task);
  const latestStep = task.items
    .filter((i) => i.done && i.completedDate)
    .sort((a, b) => b.completedDate!.localeCompare(a.completedDate!))[0];
  return (
    <Link to={`/tasks/${task.id}`} className="task-overview-card">
      <div className="task-overview-meta">
        <span>
          {fieldName(task.area)} · {trackingLabels[taskMode(task)]}
        </span>
        <span className="status-pill">{task.status}</span>
      </div>
      <h3>{task.title}</h3>
      <TaskMetric task={task} />
      <p className="task-last-work">
        {work.latest
          ? `${work.latest.date} · ${workLabel(task, work.latest)}`
          : p.date
            ? `${p.date} · ${latestStep?.title ?? "단계 완료"}`
            : p.mode === "steps" && p.done > 0
              ? "완료 체크 기록 있음 · 실제 날짜 미입력"
              : "작업 기록 전"}
      </p>
      {work.measuredCount > 0 && (
        <small>누적 작업시간 {formatWorkMinutes(work.minutes)}</small>
      )}
      {task.targetDate && <small>목표 완료일 {task.targetDate}</small>}
    </Link>
  );
}
export function LanguageTasks({ area }: { area: FieldId }) {
  const { data } = useData(),
    navigate = useNavigate();
  const [adding, setAdding] = useState(false),
    [filter, setFilter] = useState("active"),
    [expanded, setExpanded] = useState(false);
  const tasks = data.tasks.filter(
    (t) =>
      t.area === area &&
      (filter === "all" || filter === "active"
        ? filter === "all" || ["예정", "진행 중"].includes(t.status)
        : t.status === filter),
  );
  return (
    <section
      className="language-tasks"
      aria-label={`${fieldName(area)} 진행 중인 과업`}
    >
      <div className="language-task-heading">
        <h2>진행 중인 과업</h2>
        <div>
          <label>
            <span className="sr-only">언어 과업 상태</span>
            <select
              aria-label="언어 과업 상태"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setExpanded(false);
              }}
            >
              <option value="active">예정·진행 중</option>
              <option value="all">모든 상태</option>
              <option>보류</option>
              <option>완료</option>
            </select>
          </label>
          <button className="secondary-button" onClick={() => setAdding(true)}>
            <Plus size={14} />
            과업 추가
          </button>
        </div>
      </div>
      {tasks.length ? (
        <div className="task-overview-grid">
          {tasks.slice(0, expanded ? tasks.length : 3).map((t) => (
            <TaskOverviewCard key={t.id} task={t} />
          ))}
        </div>
      ) : (
        <p className="task-empty-inline">
          표시할 과업이 없습니다. 실제 작업에 맞는 관리 방식으로 등록하세요.
        </p>
      )}
      <div className="language-task-footer">
        {tasks.length > 3 && (
          <button className="text-link" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "간단히 보기" : `나머지 ${tasks.length - 3}개 보기`}
          </button>
        )}
        <Link className="text-link" to={`/tasks?area=${area}`}>
          이 언어 과업 전체 →
        </Link>
      </div>
      {adding && (
        <TaskForm
          area={area}
          onClose={() => setAdding(false)}
          onSaved={(id) => navigate(`/tasks/${id}`)}
        />
      )}
    </section>
  );
}
export function TaskBoard() {
  const { data } = useData(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const area = fields.some((f) => f.id === params.get("area"))
    ? params.get("area")!
    : "all";
  const [status, setStatus] = useState("all"),
    [mode, setMode] = useState("all"),
    [search, setSearch] = useState(""),
    [adding, setAdding] = useState(false);
  const tasks = data.tasks.filter(
    (t) =>
      (area === "all" || t.area === area) &&
      (status === "all" || t.status === status) &&
      (mode === "all" || taskMode(t) === mode) &&
      `${t.title} ${t.note}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="TASKS & PROJECTS"
        title="과업"
        description="일반 할 일은 간단히 완료하고, 장기 과업은 진도를 기록하세요."
      />
      <TodoBoard />
      <section className="long-task-board" aria-label="장기 과업">
        <div className="language-task-heading">
          <div className="long-task-heading">
            <h2>장기 과업</h2>
            <p>
              Excel 단어장 정리·수정 등 지속적인 작업의 구간·수량·회독·단계를
              관리합니다.
            </p>
          </div>
          <button className="primary-button" onClick={() => setAdding(true)}>
            <Plus size={16} />
            장기 과업 추가
          </button>
        </div>
        <div className="task-board-filters">
          <label>
            분야
            <select
              aria-label="전체 과업 분야"
              value={area}
              onChange={(e) =>
                setParams(
                  e.target.value === "all" ? {} : { area: e.target.value },
                )
              }
            >
              <option value="all">모든 분야</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select
              aria-label="전체 과업 상태"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">모든 상태</option>
              {taskStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            관리 방식
            <select
              aria-label="전체 과업 관리 방식"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="all">모든 방식</option>
              {Object.entries(trackingLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            과업 검색
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="과업명 또는 메모"
            />
          </label>
        </div>
        <div className="task-overview-grid">
          {tasks.length ? (
            tasks.map((t) => <TaskOverviewCard key={t.id} task={t} />)
          ) : (
            <Empty>조건에 맞는 과업이 없습니다.</Empty>
          )}
        </div>
      </section>
      {adding && (
        <TaskForm
          area={area === "all" ? "english" : (area as FieldId)}
          onClose={() => setAdding(false)}
          onSaved={(id) => navigate(`/tasks/${id}`)}
        />
      )}
    </>
  );
}
export function WorkRecordForm({
  task,
  value,
  onClose,
}: {
  task: Task;
  value?: TaskWorkRecord;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [recordId] = useState(() => value?.id ?? newId());
  const nativeMode = taskMode(task);
  const [mode, setMode] = useState<TaskWorkRecord["mode"]>(
    () =>
      value?.mode ??
      (nativeMode === "steps"
        ? task.records?.some((r) => r.mode === "day-range")
          ? "day-range"
          : "session"
        : nativeMode),
  );
  const modes: TaskWorkRecord["mode"][] =
    nativeMode === "steps" ? ["session", "day-range"] : ["session", nativeMode];
  if (value && !modes.includes(value.mode)) modes.push(value.mode);
  const [date, setDate] = useState(value?.date ?? localDate()),
    [note, setNote] = useState(value?.note ?? ""),
    [scope, setScope] = useState(value?.scope ?? ""),
    [minutes, setMinutes] = useState(
      value?.minutes == null ? "" : String(value.minutes),
    ),
    [completed, setCompleted] = useState(
      value ? value.completed !== false && value.mode !== "session" : false,
    ),
    [start, setStart] = useState(
      value?.mode === "day-range" ? String(value.startDay) : "",
    ),
    [end, setEnd] = useState(
      value?.mode === "day-range" ? String(value.endDay) : "",
    ),
    [quantity, setQuantity] = useState(
      value?.mode === "quantity" ? String(value.quantity) : "",
    ),
    [error, setError] = useState("");
  const hasScope =
    mode === "rounds" ||
    (mode === "day-range" && !!start && !!end) ||
    (mode === "quantity" && !!quantity);
  function submit(e: FormEvent) {
    e.preventDefault();
    const base = {
      id: recordId,
      date,
      note,
      scope,
      minutes: minutes.trim() === "" ? null : Number(minutes),
      completed: hasScope && completed,
    };
    const record: TaskWorkRecord =
      mode === "day-range" && (start || end)
        ? { ...base, mode, startDay: Number(start), endDay: Number(end) }
        : mode === "quantity" && quantity
          ? { ...base, mode, quantity: Number(quantity) }
          : mode === "rounds"
            ? { ...base, mode }
            : { ...base, mode: "session", completed: false };
    const message = recordError(task, record, localDate());
    if (
      message ||
      saveTaskRecord(data, task.id, record, localDate()) === data
    ) {
      setError(
        message ||
          "작업 시간·범위 또는 내용을 확인해 주세요. 기존 기록의 범위 방식은 변경할 수 없습니다.",
      );
      return;
    }
    update((d) => saveTaskRecord(d, task.id, record, localDate()));
    onClose();
  }
  return (
    <Dialog
      title={value ? "작업 기록 수정" : "작업 기록 추가"}
      onClose={onClose}
    >
      <form className="v1-form" onSubmit={submit}>
        <p className="form-help">
          {task.title} · 완료하지 못한 작업도 시간과 내용을 기록할 수 있습니다.
        </p>
        <div className="form-grid">
          <label>
            작업 날짜
            <input
              type="date"
              required
              max={localDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            소요시간 (분)
            <input
              type="number"
              min="0"
              step="0.5"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="미측정 시 비우기"
            />
          </label>
        </div>
        <label>
          작업 범위 방식
          <select
            aria-label="작업 범위 방식"
            disabled={!!value}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as TaskWorkRecord["mode"]);
              setCompleted(false);
            }}
          >
            {modes.map((m) => (
              <option key={m} value={m}>
                {m === "session"
                  ? "범위 없이 기록 / 직접 설명"
                  : workModeLabels[m]}
              </option>
            ))}
          </select>
        </label>
        {mode === "day-range" && (
          <>
            <p className="form-help">
              시작·종료 Day를 자유롭게 지정하세요. 겹친 완료 구간은 한 번만
              집계하고, 작업시간은 기록마다 합산합니다. 범위를 비워두면 시간만
              기록합니다.
            </p>
            <div className="form-grid">
              <label>
                작업 시작 Day
                <input
                  type="number"
                  min={task.tracking?.dayStart ?? 1}
                  max={task.tracking?.dayEnd ?? undefined}
                  step="1"
                  required={!!value || !!start || !!end}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                작업 종료 Day
                <input
                  type="number"
                  min={task.tracking?.dayStart ?? 1}
                  max={task.tracking?.dayEnd ?? undefined}
                  step="1"
                  required={!!value || !!start || !!end}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        {mode === "quantity" && (
          <label>
            작업 수량 ({task.tracking?.unit || "개"}, 선택)
            <input
              aria-label="작업 수량"
              type="number"
              min="1"
              step="1"
              required={!!value}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        )}
        {mode === "rounds" && (
          <p className="form-help">
            {task.tracking?.subject || task.title} · 회독이 끝나지 않았어도
            시간을 기록하세요.
          </p>
        )}
        {mode !== "session" && (
          <label className="task-progress-check">
            <input
              type="checkbox"
              checked={completed && !!hasScope}
              disabled={!hasScope}
              onChange={(e) => setCompleted(e.target.checked)}
            />
            <span>
              {mode === "rounds"
                ? "이번 회독을 완료함"
                : "입력한 작업 범위의 정비를 완료함"}
              <small>
                체크한 범위만 완료 진도에 반영합니다. 작업시간은 체크 여부와
                관계없이 합산합니다.
              </small>
            </span>
          </label>
        )}
        <label>
          작업 범위 설명 (선택)
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="예: 다의어 분리, PDF 인덱스 2장 검토"
          />
        </label>
        <label>
          작업 내용 및 메모 (선택)
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button">
          {value ? "기록 수정 저장" : "작업 기록 저장"}
        </button>
        {value && (
          <button
            type="button"
            className="task-delete-button"
            onClick={() => {
              update((d) => deleteTaskRecord(d, task.id, value.id));
              onClose();
            }}
          >
            이 작업 기록 삭제
          </button>
        )}
      </form>
    </Dialog>
  );
}
function StepForm({
  task,
  value,
  onClose,
}: {
  task: Task;
  value?: TaskStep;
  onClose: () => void;
}) {
  const { update } = useData();
  const [stepId] = useState(() => value?.id ?? newId());
  const [title, setTitle] = useState(value?.title ?? ""),
    [note, setNote] = useState(value?.note ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    update((d) =>
      saveTaskStep(d, task.id, {
        ...value,
        id: stepId,
        done: value?.done ?? false,
        title: title.trim(),
        note,
      }),
    );
    onClose();
  }
  return (
    <Dialog title={value ? "단계 수정" : "단계 추가"} onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <label>
          단계명
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          단계 메모
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="primary-button">단계 저장</button>
        {value && (
          <button
            type="button"
            className="task-delete-button"
            onClick={() => {
              update((d) => deleteTaskStep(d, task.id, value.id));
              onClose();
            }}
          >
            이 단계 삭제
          </button>
        )}
      </form>
    </Dialog>
  );
}
export function TaskDetailPage() {
  const { id } = useParams(),
    { data, update } = useData();
  const task = data.tasks.find((t) => t.id === id);
  const [settings, setSettings] = useState(false),
    [record, setRecord] = useState<TaskWorkRecord | "new" | null>(null),
    [step, setStep] = useState<TaskStep | "new" | null>(null),
    [limit, setLimit] = useState(20),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [query, setQuery] = useState("");
  if (!task)
    return (
      <Empty>
        과업을 찾을 수 없습니다. <Link to="/tasks">전체 과업으로</Link>
      </Empty>
    );
  const p = taskProgress(task),
    work = taskWorkSummary(task),
    records = [...(task.records ?? [])]
      .reverse()
      .filter(
        (r) =>
          (!from || r.date >= from) &&
          (!to || r.date <= to) &&
          `${r.note} ${r.scope ?? ""} ${r.minutes ?? ""} ${workLabel(task, r)}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Link className="back-link" to={`/tasks?area=${task.area}`}>
        <ArrowLeft size={16} />
        과업 목록으로
      </Link>
      <PageHeading
        eyebrow={`${fieldName(task.area)} · ${trackingLabels[taskMode(task)]}`}
        title={task.title}
        description={task.note}
        action={
          <button
            className="secondary-button"
            onClick={() => setSettings(true)}
          >
            <Pencil size={15} />
            과업 설정
          </button>
        }
      />
      {data.vocabularies
        ?.filter((b) => b.taskId === task.id)
        .map((b) => (
          <Link
            key={b.id}
            className="text-link vocabulary-task-back"
            to={`/vocabulary/${b.id}`}
          >
            단어장 Day 번호 관리 →
          </Link>
        ))}
      <section className="task-detail-summary" aria-label="과업 진행 상황">
        <TaskMetric task={task} />
        <div className="task-detail-meta">
          <label>
            과업 상태
            <select
              aria-label="상세 과업 상태"
              value={task.status}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  tasks: d.tasks.map((t) =>
                    t.id === task.id
                      ? { ...t, status: e.target.value as Task["status"] }
                      : t,
                  ),
                }))
              }
            >
              {taskStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {p.mode === "day-range" && (
            <span>
              전체 Day {task.tracking?.dayStart}~{task.tracking?.dayEnd}
            </span>
          )}
          {p.remaining !== null && p.mode !== "rounds" && (
            <span>
              남은 작업량 {p.remaining.toLocaleString()} {p.unit}
            </span>
          )}
          {work.latestDate && <span>최근 작업 {work.latestDate}</span>}
          {task.targetDate && <span>목표 완료일 {task.targetDate}</span>}
          {task.tracking?.materialId && (
            <Link
              className="text-link"
              to={`/materials/${task.tracking.materialId}`}
            >
              관련 자료 보기 →
            </Link>
          )}
        </div>
        <div
          className="task-time-summary"
          role="group"
          aria-label="누적 작업시간"
        >
          <div>
            <span>누적 작업시간</span>
            <strong>
              {work.measuredCount || !task.records?.length
                ? formatWorkMinutes(work.minutes)
                : "시간 미입력"}
            </strong>
            {work.measuredCount > 0 && <small>총 {work.minutes}분</small>}
          </div>
          <div>
            <span>최근 작업 날짜</span>
            <strong>{work.latestDate || "기록 없음"}</strong>
          </div>
          {work.hasDayRecords && (
            <div>
              <span>정비 완료 Day</span>
              <strong>{work.completedDays} Days</strong>
              <small>완료로 표시한 구간의 합집합</small>
            </div>
          )}
        </div>
        <button className="primary-button" onClick={() => setRecord("new")}>
          <Plus size={16} />
          작업 기록 추가
        </button>
        <p className="micro-note">
          실제 작업일의 소요시간을 HOME과 학습 기록에 합산합니다. 작업한 구간과
          완료한 구간은 구분하며, 과업 상태·체크리스트·단어장 학습 진도는
          자동으로 변경하지 않습니다.
        </p>
      </section>
      <section className="task-detail-section" aria-label="작업 이력">
        <div className="language-task-heading">
          <h2>
            작업 이력 <small>{task.records?.length ?? 0}건</small>
          </h2>
          <span className="micro-note">최근 날짜 우선</span>
        </div>
        <div className="task-record-filters">
          <label>
            시작일
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setLimit(20);
              }}
            />
          </label>
          <label>
            종료일
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setLimit(20);
              }}
            />
          </label>
          <label>
            이력 검색
            <input
              type="search"
              placeholder="구간 또는 메모"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(20);
              }}
            />
          </label>
        </div>
        {records.length ? (
          <ul className="task-history-list">
            {records.slice(0, limit).map((r) => (
              <li key={r.id}>
                <div>
                  <time>{r.date}</time>
                  <strong>{workLabel(task, r)}</strong>
                  <span>
                    {workModeLabels[r.mode]} ·{" "}
                    {r.mode === "session"
                      ? "시간 기록"
                      : r.completed === false
                        ? "작업 중"
                        : "범위 완료"}
                  </span>
                  <span className="task-history-time">
                    {r.minutes == null ? "시간 미입력" : `${r.minutes}분`}
                  </span>
                  {r.scope && r.mode !== "session" && <p>{r.scope}</p>}
                  {r.note && <p>{r.note}</p>}
                </div>
                <button
                  className="icon-button"
                  aria-label={`${r.id} 작업 기록 수정`}
                  onClick={() => setRecord(r)}
                >
                  <Pencil size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="task-empty-inline">표시할 작업 기록이 없습니다.</p>
        )}
        {records.length > limit && (
          <button className="text-link" onClick={() => setLimit((n) => n + 20)}>
            과거 기록 더 보기 ({records.length - limit}건)
          </button>
        )}
      </section>

      {(p.mode === "steps" || task.items.length > 0) && (
        <section className="task-detail-section" aria-label="과업 단계">
          <div className="language-task-heading">
            <h2>세부사항 체크리스트</h2>
            <button className="secondary-button" onClick={() => setStep("new")}>
              <Plus size={14} />
              단계 추가
            </button>
          </div>
          {p.mode !== "steps" && (
            <p className="micro-note">
              이 체크 항목은 현재 관리 방식의 진도에는 합산하지 않습니다.
            </p>
          )}
          {task.items.length ? (
            <ul className="task-stage-list">
              {task.items.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() =>
                        update((d) =>
                          toggleTaskStep(d, task.id, item.id, localDate()),
                        )
                      }
                    />
                    <span>
                      {item.title}
                      {item.note && <small>{item.note}</small>}
                      {item.done && item.completedDate && (
                        <small>완료 {item.completedDate}</small>
                      )}
                    </span>
                  </label>
                  <button
                    className="icon-button"
                    aria-label={`${item.title} 단계 수정`}
                    onClick={() => setStep(item)}
                  >
                    <Pencil size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="task-empty-inline">
              필요한 단계부터 자유롭게 추가하세요.
            </p>
          )}
        </section>
      )}
      {settings && <TaskForm value={task} onClose={() => setSettings(false)} />}
      {record && (
        <WorkRecordForm
          key={record === "new" ? "new" : record.id}
          task={task}
          value={record === "new" ? undefined : record}
          onClose={() => setRecord(null)}
        />
      )}
      {step && (
        <StepForm
          key={step === "new" ? "new" : step.id}
          task={task}
          value={step === "new" ? undefined : step}
          onClose={() => setStep(null)}
        />
      )}
    </>
  );
}
