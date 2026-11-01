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
  stageTodo,
  unstageTodo,
  todoGroup,
  todoGroupItems,
} from "./todos";
import { DEFAULT_RECORD_MINUTES, formatTimeT } from "./timeUnits";

function HomeTodoAdd({
  onAdded,
}: {
  onAdded: (id: string, title: string) => void;
}) {
  const { update } = useData();
  const [title, setTitle] = useState("");
  const draft = useRef(newId()),
    submitting = useRef(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !title.trim()) return;
    submitting.current = true;
    const id = draft.current,
      text = title.trim();
    try {
      update((d) => addTodo(d, { id, title: text }));
      setTitle("");
      draft.current = newId();
      onAdded(id, text);
    } finally {
      queueMicrotask(() => {
        submitting.current = false;
      });
    }
  }
  return (
    <form
      className="home-todo-add-form is-batched"
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
          placeholder="할 일 입력 · 시간은 마지막에 한 번"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <button type="submit" className="primary-button" disabled={!title.trim()}>
        <Plus size={14} />
        등록
      </button>
    </form>
  );
}

function GroupDraft({
  group,
  onRecorded,
}: {
  group: TodoItem;
  onRecorded: (id: string) => void;
}) {
  const { data, update } = useData();
  const members = todoGroupItems(data.todos, group.id);
  const today = useLocalDate();
  const [minutes, setMinutes] = useState(
      String(group.plannedMinutes ?? DEFAULT_RECORD_MINUTES),
    ),
    [error, setError] = useState("");
  const submitting = useRef(false);
  useEffect(
    () => setMinutes(String(group.plannedMinutes ?? DEFAULT_RECORD_MINUTES)),
    [group.plannedMinutes],
  );
  const amount = minutes.trim() === "" ? NaN : Number(minutes);
  const valid = Number.isSafeInteger(amount) && amount >= 0;
  function change(value: string) {
    setMinutes(value);
    setError("");
    const next = value.trim() === "" ? NaN : Number(value);
    if (Number.isSafeInteger(next) && next >= 0)
      update((d) => setTodoPlannedMinutes(d, group.id, next));
  }
  function record(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!valid) {
      setError("총 시간을 0 이상의 정수(분)로 입력해 주세요.");
      return;
    }
    const date = group.recordDate!;
    if (completeTodo(data, group.id, date, amount, localDate()) === data) {
      setError("처리한 목록과 날짜를 다시 확인해 주세요.");
      return;
    }
    submitting.current = true;
    try {
      update((d) => completeTodo(d, group.id, date, amount, localDate()));
      onRecorded(group.id);
    } finally {
      queueMicrotask(() => {
        submitting.current = false;
      });
    }
  }
  return (
    <section
      className="todo-group-draft"
      aria-label={`${group.recordDate} 처리한 목록`}
    >
      <div className="todo-group-heading">
        <h3>
          처리한 목록 <span>{members.length}개</span>
        </h3>
        <small>{group.recordDate} · 기록 대기</small>
      </div>
      <ul
        className="home-todos-list todo-staged-list"
        aria-label="처리한 할 일"
      >
        {members.map((item) => (
          <li className="home-todo-item" key={item.id}>
            <label className="todo-staged-item">
              <input
                type="checkbox"
                checked
                onChange={() => update((d) => unstageTodo(d, item.id))}
                aria-label={`${item.title} 처리 취소`}
              />
              <span>{item.title}</span>
            </label>
          </li>
        ))}
      </ul>
      <form
        className="todo-group-record"
        aria-label="할 일 묶음 시간 기록"
        onSubmit={record}
      >
        <div className="todo-group-time">
          <span>이번 묶음 총 시간</span>
          <strong>{valid ? formatTimeT(amount) : "시간을 입력하세요"}</strong>
        </div>
        <div
          className="todo-group-presets"
          role="group"
          aria-label="묶음 시간 선택"
        >
          {[45, 90, 135, 180].map((value) => (
            <button
              type="button"
              key={value}
              className="secondary-button"
              aria-pressed={amount === value}
              onClick={() => change(String(value))}
            >
              {value / 90}T
            </button>
          ))}
        </div>
        <div className="todo-group-submit">
          <label>
            총 시간 (분)
            <input
              type="number"
              min="0"
              step="1"
              required
              inputMode="numeric"
              value={minutes}
              onChange={(e) => change(e.target.value)}
              aria-label="묶음 총 시간 (분)"
            />
          </label>
          <button className="primary-button" type="submit">
            {group.recordDate === today
              ? "오늘의 기록으로 넘기기"
              : `${group.recordDate} 기록으로 넘기기`}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

export function HomeTodos() {
  const { data, update } = useData(),
    today = useLocalDate();
  const [last, setLast] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [newest, setNewest] = useState("");
  const pending = [...(data.todos ?? [])]
    .reverse()
    .filter((t) => !t.isGroup && !t.completion && !todoGroup(data, t));
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
  const drafts = (data.todos ?? [])
    .filter(
      (t) =>
        t.isGroup && !t.completion && todoGroupItems(data.todos, t.id).length,
    )
    .sort((a, b) => a.recordDate!.localeCompare(b.recordDate!));
  const canUndo =
    last && data.todos?.some((t) => t.id === last && t.completion);
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
        <ul
          className="home-todos-list home-todos-pending"
          aria-label="HOME 일반 할 일"
        >
          {pending.slice(0, 5).map((item) => (
            <li className="home-todo-item" key={item.id}>
              <div className="home-todo-row is-batched">
                <label className="home-todo-check">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => {
                      update((d) => stageTodo(d, item.id, localDate()));
                      setNotice(
                        `‘${item.title}’ 처리한 목록에 담았습니다. 시간은 마지막에 한 번 기록하세요.`,
                      );
                    }}
                    aria-label={`${item.title} 처리하기`}
                  />
                </label>
                <div className="home-todo-copy">
                  <Link to={`/tasks?todo=${encodeURIComponent(item.id)}`}>
                    {item.title}
                  </Link>
                  {item.dueDate && (
                    <small
                      className={item.dueDate < today ? "todo-overdue" : ""}
                    >
                      {item.dueDate === today
                        ? "오늘 마감"
                        : `마감 ${item.dueDate.replaceAll("-", ".")}`}
                    </small>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="home-todos-empty">
          <p>미완료 할 일이 없습니다.</p>
        </div>
      )}
      {pending.length > 5 && (
        <Link className="text-link" to="/tasks">
          나머지 {pending.length - 5}개 보기 →
        </Link>
      )}
      <div className="todo-group-drafts">
        {drafts.map((group) => (
          <GroupDraft
            key={group.id}
            group={group}
            onRecorded={(id) => {
              setLast(id);
              setNotice("처리한 할 일을 묶음 기록 한 건으로 저장했습니다.");
            }}
          />
        ))}
      </div>
      <footer className="home-todos-footer">
        <small>
          체크해서 모으기 → 총 시간 입력 → 기록 한 건으로 저장 · 1T = 90분
        </small>
      </footer>
      <div className="home-todos-feedback">
        <p role="status" aria-live="polite">
          {notice}
        </p>
        {canUndo && (
          <button
            className="text-button"
            onClick={() => {
              update((d) => undoTodo(d, last));
              setLast(null);
              setNotice("묶음 기록을 취소하고 처리한 목록으로 되돌렸습니다.");
            }}
          >
            <RotateCcw size={13} />
            묶음 기록 취소
          </button>
        )}
      </div>
    </section>
  );
}
