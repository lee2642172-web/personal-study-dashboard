import { useState, type FormEvent } from "react";
import { type DashboardData, type Material, newId } from "./model";
import { useData } from "./state";
import { Dialog } from "./ui";
import { localDate } from "./dates";
import { addDayLearning, recordInitialDayLearning } from "./dayLearning";

export function DayLearningForm({
  material,
  day,
  append,
  onClose,
  onSaved,
}: {
  material: Material;
  day: number;
  append: boolean;
  onClose: () => void;
  onSaved: (day: number) => void;
}) {
  const { data, update } = useData();
  const [targetDay] = useState(day);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const duration = minutes.trim() === "" ? null : Number(minutes);
    if (duration !== null && (!Number.isFinite(duration) || duration < 0)) {
      setError("학습시간은 0 이상의 분 단위로 입력해 주세요.");
      return;
    }
    const id = newId();
    const date = localDate();
    const apply = (current: DashboardData) =>
      append
        ? addDayLearning(
            current,
            material.id,
            targetDay,
            id,
            date,
            duration,
            note,
          )
        : recordInitialDayLearning(
            current,
            material.id,
            targetDay,
            id,
            date,
            duration,
            note,
          );
    if (apply(data) === data) {
      setError(
        "Day가 변경되어 저장하지 못했습니다. 창을 닫고 다시 열어 주세요.",
      );
      return;
    }
    update(apply);
    onSaved(targetDay);
  }
  return (
    <Dialog title={append ? "새 Day 학습" : "신규 학습 기록"} onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <div className="daybook-learning-info">
          <strong>
            {material.title} · Day {targetDay}
          </strong>
          <p>
            {append ? "새 Day를 추가하고" : "선택한 Day에"} 오늘 날짜로 신규
            학습을 기록합니다.
          </p>
          <p>신규 학습과 복습 횟수는 별도로 관리합니다.</p>
        </div>
        <label>
          실제 학습시간 (분, 선택)
          <input
            type="number"
            min="0"
            step="0.5"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="미측정 시 비우기"
          />
        </label>
        <label>
          학습 메모 (선택)
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 새로운 단어와 예문을 정리하며 학습"
          />
        </label>
        <p className="micro-note">
          입력한 시간은 HOME 학습시간에 반영합니다. Excel 서식 정리만 한 시간은
          과업에서 따로 기록하세요.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button" type="submit">
          {append ? "Day 추가하고 학습 기록" : "신규 학습 저장"}
        </button>
      </form>
    </Dialog>
  );
}
