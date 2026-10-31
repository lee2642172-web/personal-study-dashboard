import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RotateCcw, Plus } from "lucide-react";
import { newId, type TodoItem } from "./model";
import { useData } from "./state";
import { useLocalDate } from "./useLocalDate";
import { localDate } from "./dates";
import {
  addTodo,
  completeTodo,
  undoTodo,
  setTodoPlannedMinutes,
} from "./todos";
import { MinuteStepper } from "./MinuteStepper";
import { DEFAULT_TODO_MINUTES, formatTimeT } from "./timeUnits";

function HomeTodoAdd({
  onAdded,
}: {
  onAdded: (id: string, title: string) => void;
}) {
  const { update } = useData();
  const [title, setTitle] = useState(""),
    [minutes, setMinutes] = useState(String(DEFAULT_TODO_MINUTES)),
    [error, setError] = useState("");
  const draft = useRef(newId()),
    submitting = useRef(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const text = title.trim(),
      amount = minutes.trim() === "" ? 0 : Number(minutes);
    if (!text || !Number.isSafeInteger(amount) || amount < 0) {
      setError("제목과 0 이상의 정수 분 단위 시간을 입력해 주세요.");
      return;
    }
    submitting.current = true;
    try {
      const id = draft.current;
      update((d) => addTodo(d, { id, title: text, plannedMinutes: amount }));
      setTitle("");
      setMinutes(String(DEFAULT_TODO_MINUTES));
      setError("");
      draft.current = newId();
      onAdded(id, text);
    } finally {
      queueMicrotask(() => {
        submitting.current = false;
      });
    }
  }
  return (
    <div className="home-todo-add">
      <form
        className="home-todo-add-form"
        aria-label="간단한 할 일 바로 등록"
        onSubmit={submit}
      >
        <label className="home-todo-add-title">
          <span className="sr-only">간단한 할 일 내용</span>
          <input
            aria-label="간단한 할 일 내용"
            type="text"
            required
            maxLength={300}
            placeholder="할 일을 바로 입력하세요"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
          />
        </label>
        <MinuteStepper
          label="새 할 일 기본 시간 (분)"
          value={minutes}
          onChange={(value) => {
            setMinutes(value);
            setError("");
          }}
          invalid={!!error}
        />
        <button
          type="submit"
          className="primary-button"
          disabled={!title.trim()}
        >
          <Plus size={14} />
          등록
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function HomeTodoRow({
  item,
  today,
  onComplete,
}: {
  item: TodoItem;
  today: string;
  onComplete: (item: TodoItem, minutes: number) => void;
}) {
  const { data, update } = useData();
  const [minutes, setMinutes] = useState(
      String(item.plannedMinutes ?? DEFAULT_TODO_MINUTES),
    ),
    [error, setError] = useState("");
  useEffect(
    () => setMinutes(String(item.plannedMinutes ?? DEFAULT_TODO_MINUTES)),
    [item.plannedMinutes],
  );
  function changeMinutes(value: string) {
    setMinutes(value);
    setError("");
    const amount = value.trim() === "" ? 0 : Number(value);
    if (Number.isSafeInteger(amount) && amount >= 0)
      update((d) => setTodoPlannedMinutes(d, item.id, amount));
  }
  function complete() {
    const amount = minutes.trim() === "" ? 0 : Number(minutes),
      date = localDate();
    if (completeTodo(data, item.id, date, amount, date) === data) {
      setError("0 이상의 정수 분 단위로 입력해 주세요.");
      return;
    }
    update((d) => completeTodo(d, item.id, date, amount, date));
    onComplete(item, amount);
  }
  return (
    <li className="home-todo-item">
      <div className="home-todo-row">
        <label className="home-todo-check">
          <input
            type="checkbox"
            checked={false}
            onChange={complete}
            aria-label={`${item.title} 완료하기`}
          />
        </label>
        <div className="home-todo-copy">
          <Link to={`/tasks?todo=${encodeURIComponent(item.id)}`}>
            {item.title}
          </Link>
          {item.dueDate && (
            <small className={item.dueDate < today ? "todo-overdue" : ""}>
              {item.dueDate === today
                ? "오늘 마감"
                : `마감 ${item.dueDate.replaceAll("-", ".")}`}
            </small>
          )}
        </div>
        <MinuteStepper
          label={`${item.title} 소요시간 (분, 선택)`}
          value={minutes}
          onChange={changeMinutes}
          invalid={!!error}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
export function HomeTodos() {
  const { data, update } = useData(),
    today = useLocalDate();
  const [last, setLast] = useState<{
      id: string;
      title: string;
      minutes: number;
    } | null>(null),
    [notice, setNotice] = useState(""),
    [newest, setNewest] = useState("");
  const pending = [...(data.todos ?? [])]
    .reverse()
    .filter((t) => !t.completion);
  const priority = (item: TodoItem) =>
    item.dueDate && item.dueDate <= today ? 0 : !item.dueDate ? 1 : 2;
  pending.sort((a, b) =>
    a.id === newest
      ? -1
      : b.id === newest
        ? 1
        : priority(a) - priority(b) ||
          (a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0),
  );
  const canUndo =
    last && data.todos?.some((t) => t.id === last.id && t.completion);
  return (
    <section className="home-todos" aria-labelledby="home-todos-title">
      <header className="home-todos-heading">
        <div>
          <h2 id="home-todos-title">간단한 할 일</h2>
          <span>미완료 {pending.length}개</span>
        </div>
        <Link className="text-link" to="/tasks">
          전체 보기
          <ArrowUpRight size={14} />
        </Link>
      </header>
      <HomeTodoAdd
        onAdded={(id, title) => {
          setNewest(id);
          setNotice(`‘${title}’ 할 일을 등록했습니다.`);
        }}
      />
      {pending.length ? (
        <ul className="home-todos-list" aria-label="HOME 일반 할 일">
          {pending.slice(0, 3).map((item) => (
            <HomeTodoRow
              key={item.id}
              item={item}
              today={today}
              onComplete={(done, minutes) => {
                setLast({ id: done.id, title: done.title, minutes });
                setNotice(`‘${done.title}’ 완료 · ${formatTimeT(minutes)}`);
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="home-todos-empty">
          <p>미완료 할 일이 없습니다.</p>
        </div>
      )}
      <footer className="home-todos-footer">
        <small>
          기본 5분 · 화살표 ±5분 · 직접 입력 가능 · 체크하면 시간 반영
        </small>
        {pending.length > 3 && (
          <Link className="text-link" to="/tasks">
            나머지 {pending.length - 3}개 보기 →
          </Link>
        )}
      </footer>
      <div className="home-todos-feedback">
        <p role="status" aria-live="polite">
          {notice}
        </p>
        {canUndo && (
          <button
            className="text-button"
            onClick={() => {
              update((d) => undoTodo(d, last.id));
              setNotice(`‘${last.title}’ 완료를 취소했습니다.`);
              setLast(null);
            }}
          >
            <RotateCcw size={13} />
            완료 취소
          </button>
        )}
      </div>
    </section>
  );
}
