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
        {p.latest
          ? `${p.latest.date} · ${workLabel(task, p.latest)}`
          : p.date
            ? `${p.date} · ${latestStep?.title ?? "단계 완료"}`
            : p.mode === "steps" && p.done > 0
              ? "완료 체크 기록 있음 · 실제 날짜 미입력"
              : "작업 기록 전"}
      </p>
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
        description="장기 과업의 실제 작업 구간·수량·회독·단계를 기록하세요."
        action={
          <button className="primary-button" onClick={() => setAdding(true)}>
            <Plus size={16} />
            과업 추가
          </button>
        }
      />
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
function WorkRecordForm({
  task,
  value,
  onClose,
}: {
  task: Task;
  value?: TaskWorkRecord;
  onClose: () => void;
}) {
  const { update } = useData();
  const [recordId] = useState(() => value?.id ?? newId());
  const mode = value?.mode ?? taskMode(task);
  const [date, setDate] = useState(value?.date ?? localDate()),
    [note, setNote] = useState(value?.note ?? ""),
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
  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "steps") return;
    const base = { id: recordId, date, note };
    const record: TaskWorkRecord =
      mode === "day-range"
        ? { ...base, mode, startDay: Number(start), endDay: Number(end) }
        : mode === "quantity"
          ? { ...base, mode, quantity: Number(quantity) }
          : { ...base, mode: "rounds" };
    const message = recordError(task, record, localDate());
    if (message) {
      setError(message);
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
          {task.title} · {trackingLabels[mode]}
        </p>
        <label>
          실제 작업 날짜
          <input
            type="date"
            required
            max={localDate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {mode === "day-range" && (
          <>
            <p className="form-help">
              전체 Day {task.tracking?.dayStart}~{task.tracking?.dayEnd} ·
              순서와 관계없이 입력하세요. 겹친 구간은 진도에서 한 번만
              계산합니다.
            </p>
            <div className="form-grid">
              <label>
                작업 시작 Day
                <input
                  autoFocus
                  required
                  type="number"
                  step="1"
                  min={task.tracking?.dayStart ?? 1}
                  max={task.tracking?.dayEnd ?? undefined}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                작업 종료 Day
                <input
                  required
                  type="number"
                  step="1"
                  min={task.tracking?.dayStart ?? 1}
                  max={task.tracking?.dayEnd ?? undefined}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        {mode === "quantity" && (
          <label>
            실제 처리 수량 ({task.tracking?.unit || "개"})
            <input
              aria-label="실제 처리 수량"
              autoFocus
              required
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        )}
        {mode === "rounds" && (
          <p className="form-help">
            {task.tracking?.subject || task.title} · 이번에 실제로 완료한
            1회독을 기록합니다. 목표 이후에도 제한 없이 추가할 수 있습니다.
          </p>
        )}
        <label>
          작업 메모
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
          {value
            ? "기록 수정 저장"
            : mode === "rounds"
              ? "회독 완료 기록"
              : "작업 기록 저장"}
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
    records = [...(task.records ?? [])]
      .reverse()
      .filter(
        (r) =>
          (!from || r.date >= from) &&
          (!to || r.date <= to) &&
          `${r.note} ${workLabel(task, r)}`
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
          {p.date && <span>최근 작업 {p.date}</span>}
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
        {p.mode !== "steps" && (
          <button className="primary-button" onClick={() => setRecord("new")}>
            <Plus size={16} />
            {p.mode === "rounds" ? "회독 완료 기록 추가" : "작업 기록 추가"}
          </button>
        )}
        <p className="micro-note">
          과업 기록은 학습시간·단어장 학습 진도에 자동 합산되지 않습니다. 목표
          달성과 과업 상태는 별도로 관리합니다.
        </p>
      </section>
      {(p.mode === "steps" || task.items.length > 0) && (
        <section className="task-detail-section" aria-label="과업 단계">
          <div className="language-task-heading">
            <h2>{p.mode === "steps" ? "단계별 진행" : "참고 체크 항목"}</h2>
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
      {(p.mode !== "steps" || !!task.records?.length) && (
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
                    <span>{trackingLabels[r.mode]}</span>
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
            <button
              className="text-link"
              onClick={() => setLimit((n) => n + 20)}
            >
              과거 기록 더 보기 ({records.length - limit}건)
            </button>
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
