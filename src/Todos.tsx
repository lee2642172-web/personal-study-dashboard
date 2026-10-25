import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, RotateCcw, Check } from "lucide-react";
import { type TodoItem, newId } from "./model";
import { localDate } from "./dates";
import { useLocalDate } from "./useLocalDate";
import { useData } from "./state";
import { Dialog } from "./ui";
import { addTodo, editTodo, completeTodo, undoTodo, deleteTodo } from "./todos";

function TodoEditor({
  value,
  onClose,
}: {
  value: TodoItem;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [item, setItem] = useState(value),
    [minutes, setMinutes] = useState(String(value.completion?.minutes ?? "")),
    [error, setError] = useState("");
  const today = useLocalDate();
  function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      ...item,
      completion: item.completion
        ? {
            ...item.completion,
            minutes: minutes.trim() === "" ? 0 : Number(minutes),
          }
        : null,
    };
    if (editTodo(data, next, localDate()) === data) {
      setError(
        "제목과 날짜, 0 이상의 정수 분 단위 시간을 확인해 주세요. 완료 날짜는 오늘 이후로 지정할 수 없습니다.",
      );
      return;
    }
    update((d) => editTodo(d, next, localDate()));
    onClose();
  }
  return (
    <Dialog title="일반 할 일 수정" onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <label>
          제목
          <input
            required
            value={item.title}
            onChange={(e) => setItem({ ...item, title: e.target.value })}
          />
        </label>
        <label>
          마감일 (선택)
          <input
            type="date"
            value={item.dueDate}
            onChange={(e) => setItem({ ...item, dueDate: e.target.value })}
          />
        </label>
        <label>
          메모 (선택)
          <textarea
            rows={3}
            value={item.note}
            onChange={(e) => setItem({ ...item, note: e.target.value })}
          />
        </label>
        {item.completion && (
          <div className="form-grid">
            <label>
              완료 날짜
              <input
                required
                type="date"
                max={today}
                value={item.completion.date}
                onChange={(e) =>
                  setItem({
                    ...item,
                    completion: { ...item.completion!, date: e.target.value },
                  })
                }
              />
            </label>
            <label>
              소요시간 (분, 선택)
              <input
                type="number"
                min="0"
                step="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="미입력 시 0분"
              />
            </label>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button">변경 저장</button>
      </form>
    </Dialog>
  );
}

function TodoRow({
  item,
  today,
  focused,
  onEdit,
  onNotice,
}: {
  item: TodoItem;
  today: string;
  focused: boolean;
  onEdit: () => void;
  onNotice: (message: string) => void;
}) {
  const { data, update } = useData();
  const [minutes, setMinutes] = useState(""),
    [error, setError] = useState("");
  function complete(e: FormEvent) {
    e.preventDefault();
    const amount = minutes.trim() === "" ? 0 : Number(minutes),
      date = localDate();
    if (completeTodo(data, item.id, date, amount, date) === data) {
      setError("소요시간을 0 이상의 정수 분 단위로 입력해 주세요.");
      return;
    }
    update((d) => completeTodo(d, item.id, date, amount, date));
    setMinutes("");
    setError("");
    onNotice(`‘${item.title}’ 완료 · ${amount}분을 기록했습니다.`);
  }
  return (
    <article
      className={`todo-row ${item.completion ? "is-done" : ""} ${focused ? "is-focused" : ""}`}
      aria-label={item.title}
    >
      <div className="todo-row-heading">
        <div>
          <h3>
            {item.completion && <Check size={15} aria-hidden="true" />}
            {item.title}
          </h3>
          <div className="todo-meta">
            {item.completion && (
              <span className="todo-completed">
                완료 {item.completion.date} · {item.completion.minutes}분
              </span>
            )}
            {item.dueDate && (
              <span
                className={
                  !item.completion && item.dueDate < today ? "todo-overdue" : ""
                }
              >
                마감 {item.dueDate}
              </span>
            )}
          </div>
          {item.note && <p className="todo-note">{item.note}</p>}
        </div>
        <div className="todo-row-actions">
          {item.completion && (
            <button
              className="text-button"
              onClick={() => {
                update((d) => undoTodo(d, item.id));
                onNotice(`‘${item.title}’ 완료를 취소했습니다.`);
              }}
            >
              <RotateCcw size={14} />
              완료 취소
            </button>
          )}
          <button
            className="icon-button"
            aria-label={`${item.title} 수정`}
            onClick={onEdit}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button todo-delete"
            aria-label={`${item.title} 삭제`}
            onClick={() => {
              update((d) => deleteTodo(d, item.id));
              onNotice(`‘${item.title}’ 할 일을 삭제했습니다.`);
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {!item.completion && (
        <form className="todo-complete-form" onSubmit={complete}>
          <label>
            소요시간 (분, 선택)
            <input
              type="number"
              min="0"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="0"
            />
          </label>
          <button className="primary-button">완료</button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export function TodoBoard() {
  const { data, update } = useData(),
    today = useLocalDate();
  const [params] = useSearchParams(),
    target = params.get("todo");
  const [draftId, setDraftId] = useState(newId),
    [title, setTitle] = useState(""),
    [dueDate, setDueDate] = useState(""),
    [note, setNote] = useState("");
  const [filter, setFilter] = useState<"pending" | "done" | "all">(() =>
    target && data.todos?.some((t) => t.id === target && t.completion)
      ? "done"
      : "pending",
  );
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(20);
  const [editing, setEditing] = useState<TodoItem | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const items = data.todos ?? [],
    done = items.filter((t) => t.completion).length;
  const rows = [...items]
    .reverse()
    .filter(
      (t) =>
        (filter === "all" ||
          (filter === "done" ? !!t.completion : !t.completion)) &&
        `${t.title} ${t.note}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      a.id === target
        ? -1
        : b.id === target
          ? 1
          : filter === "done"
            ? b.completion!.date.localeCompare(a.completion!.date)
            : 0,
    );
  function add(e: FormEvent) {
    e.preventDefault();
    const input = { id: draftId, title, dueDate, note };
    if (addTodo(data, input) === data) {
      setError("할 일 제목과 마감일을 확인해 주세요.");
      return;
    }
    update((d) => addTodo(d, input));
    setDraftId(newId());
    setTitle("");
    setDueDate("");
    setNote("");
    setFilter("pending");
    setQuery("");
    setLimit(20);
    setError("");
    setNotice("일반 할 일을 등록했습니다.");
  }
  return (
    <section className="todo-board" aria-label="일반 할 일">
      <header className="todo-board-heading">
        <div>
          <h2>일반 할 일</h2>
          <p>한 번 완료하면 되는 일을 간단하게 기록하세요.</p>
        </div>
      </header>
      <form className="todo-add-form" onSubmit={add}>
        <div className="todo-add-line">
          <label>
            할 일 제목
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 교재 구매, 시험 접수"
            />
          </label>
          <button className="primary-button">
            <Plus size={16} />할 일 등록
          </button>
        </div>
        <details className="todo-optional">
          <summary>마감일·메모 추가 (선택)</summary>
          <div className="form-grid">
            <label>
              마감일 (선택)
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            <label>
              메모 (선택)
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="todo-controls">
        <div
          className="todo-status-filter"
          role="group"
          aria-label="일반 할 일 상태"
        >
          <button
            aria-pressed={filter === "pending"}
            onClick={() => {
              setFilter("pending");
              setLimit(20);
            }}
          >
            할 일 {items.length - done}
          </button>
          <button
            aria-pressed={filter === "done"}
            onClick={() => {
              setFilter("done");
              setLimit(20);
            }}
          >
            완료 내역 {done}
          </button>
          <button
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setLimit(20);
            }}
          >
            전체
          </button>
        </div>
        <label>
          <span className="sr-only">일반 할 일 검색</span>
          <input
            type="search"
            aria-label="일반 할 일 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(20);
            }}
            placeholder="제목·메모 검색"
          />
        </label>
      </div>
      <div className="todo-list">
        {rows.length ? (
          rows
            .slice(0, limit)
            .map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                today={today}
                focused={target === item.id}
                onEdit={() => setEditing(item)}
                onNotice={setNotice}
              />
            ))
        ) : (
          <p className="todo-empty">
            {filter === "done"
              ? "완료 내역이 없습니다."
              : "표시할 할 일이 없습니다."}
          </p>
        )}
        {rows.length > limit && (
          <button className="text-link" onClick={() => setLimit((n) => n + 20)}>
            더 보기 ({rows.length - limit}개)
          </button>
        )}
      </div>
      <p className="todo-notice" role="status" aria-live="polite">
        {notice}
      </p>
      {editing && (
        <TodoEditor value={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
