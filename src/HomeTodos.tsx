import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { type TodoItem } from "./model";
import { useData } from "./state";
import { useLocalDate } from "./useLocalDate";
import { localDate } from "./dates";
import { completeTodo, undoTodo } from "./todos";

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
  const [minutes, setMinutes] = useState(""),
    [error, setError] = useState("");
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
        <label className="home-todo-minutes">
          <span className="sr-only">{item.title} 소요시간 (분, 선택)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              setError("");
            }}
            placeholder="0"
            aria-invalid={!!error}
          />
          <span aria-hidden="true">분</span>
        </label>
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
  } | null>(null);
  const [notice, setNotice] = useState("");
  const pending = [...(data.todos ?? [])]
    .reverse()
    .filter((t) => !t.completion);
  const priority = (item: TodoItem) =>
    item.dueDate && item.dueDate <= today ? 0 : !item.dueDate ? 1 : 2;
  pending.sort(
    (a, b) =>
      priority(a) - priority(b) ||
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
      {pending.length ? (
        <ul className="home-todos-list" aria-label="HOME 일반 할 일">
          {pending.slice(0, 3).map((item) => (
            <HomeTodoRow
              key={item.id}
              item={item}
              today={today}
              onComplete={(done, minutes) => {
                setLast({ id: done.id, title: done.title, minutes });
                setNotice(`‘${done.title}’ 완료 · ${minutes}분`);
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="home-todos-empty">
          <p>미완료 할 일이 없습니다.</p>
          <Link className="text-link" to="/tasks">
            할 일 등록
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <footer className="home-todos-footer">
        <small>시간을 비우고 체크하면 0분으로 완료합니다.</small>
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
