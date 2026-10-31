import { useRef, useState, type FormEvent } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { useData } from "./state";
import { newId } from "./model";
import { localDate } from "./dates";
import { recordQuickActivity } from "./quickActivity";
import { deleteTodo } from "./todos";

export function QuickActivity() {
  const { data, update } = useData();
  const [title, setTitle] = useState(""),
    [minutes, setMinutes] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [last, setLast] = useState<string | null>(null);
  const draftId = useRef(newId()),
    submitting = useRef(false);
  const canUndo =
    !!last && data.todos?.some((todo) => todo.id === last && todo.completion);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const text = title.trim(),
      time = minutes.trim() === "" ? 0 : Number(minutes);
    if (!text) {
      setError("기록할 내용을 한 줄로 입력해 주세요.");
      return;
    }
    if (!Number.isSafeInteger(time) || time < 0) {
      setError("시간은 0 이상의 정수(분)로 입력해 주세요.");
      return;
    }
    submitting.current = true;
    try {
      const id = draftId.current,
        date = localDate();
      update((data) =>
        recordQuickActivity(data, { id, title: text, date, minutes: time }),
      );
      setLast(id);
      setTitle("");
      setMinutes("");
      setError("");
      setNotice(`‘${text}’ · ${time}분 기록을 추가했습니다.`);
      draftId.current = newId();
    } finally {
      queueMicrotask(() => {
        submitting.current = false;
      });
    }
  }
  return (
    <div className="today-quick-record">
      <form
        className="today-quick-form"
        aria-label="오늘 기록 바로 추가"
        onSubmit={submit}
      >
        <label className="today-quick-title">
          <span className="sr-only">오늘 기록 내용</span>
          <input
            type="text"
            aria-label="오늘 기록 내용"
            required
            maxLength={300}
            placeholder="무엇을 했나요? 한 줄로 기록하세요"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
          />
        </label>
        <label className="today-quick-minutes">
          <span className="sr-only">오늘 기록 시간 (분)</span>
          <input
            type="number"
            aria-label="오늘 기록 시간 (분)"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              setError("");
            }}
          />
          <span aria-hidden="true">분</span>
        </label>
        <button type="submit" className="primary-button" disabled={!title.trim()}>
          <Plus size={15} />
          기록 추가
        </button>
      </form>
      <div className="today-quick-feedback">
        <p role="status" aria-live="polite">
          {notice || "오늘 날짜로 기록합니다. 시간을 비우면 0분입니다."}
        </p>
        {canUndo && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              update((data) => deleteTodo(data, last!));
              setLast(null);
              setNotice("방금 추가한 기록을 취소했습니다.");
            }}
          >
            <RotateCcw size={12} />
            방금 기록 취소
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
