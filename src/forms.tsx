import {
  taskStatuses,
  trackingLabels,
  taskMode,
  taskTemplates,
  saveTask,
  taskSettingsError,
} from "./taskWork";
import { lectureMinutes } from "./lectureLearning";
import { nextEbsReviewDate } from "./ebsReview";
import { isDayBook, saveDayAwareLog } from "./dayLearning";
import { localDate } from "./dates";
import { isEbsCourse, scheduled, validDate } from "./ebs";
import { useState, type FormEvent } from "react";
import { useData } from "./state";
import { Dialog, FieldSelect, ActivityLabels } from "./ui";
import {
  materialStatuses,
  newId,
  companyExams,
  type Material,
  type StudyLog,
  type Goal,
  type Task,
  type TaskTracking,
  type FieldId,
} from "./model";
const numberValue = (value: string) => (value === "" ? null : Number(value));
export function MaterialForm({
  value,
  onClose,
}: {
  value?: Material;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [error, setError] = useState("");
  const [m, setM] = useState<Material>(
    value ?? {
      id: newId(),
      title: "",
      area: "english",
      kind: "reference",
      status: "보관 중",
      total: null,
      targetPasses: null,
      note: "",
      routine: "",
      schedule: [],
      startDate: "",
      duration: null,
    },
  );
  const patch = (p: Partial<Material>) => setM({ ...m, ...p });
  function submit(e: FormEvent) {
    e.preventDefault();
    const vocabulary = data.vocabularies?.find(
      (b) => b.id === m.vocabularyId && b.materialId === m.id,
    );
    if (vocabulary) {
      const minimum = Math.max(
        vocabulary.baselineLastDay ?? 0,
        0,
        ...vocabulary.entries
          .filter((e) => e.status === "imported")
          .map((e) => e.day!),
      );
      if (
        m.kind !== "days" ||
        m.area !== vocabulary.area ||
        (m.total ?? 0) < minimum
      ) {
        setError(
          `연결된 단어장은 Day 단위와 언어를 유지하고, 기존·편입 Day ${minimum}보다 전체량을 줄일 수 없습니다.`,
        );
        return;
      }
    }
    update((d) => ({
      ...d,
      materials: d.materials.some((x) => x.id === m.id)
        ? d.materials.map((x) => (x.id === m.id ? m : x))
        : [...d.materials, m],
    }));
    onClose();
  }
  return (
    <Dialog
      title={value ? "자료 설정 수정" : "학습 자료 등록"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="v1-form">
        <label>
          자료명
          <input
            required
            value={m.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <FieldSelect value={m.area} onChange={(area) => patch({ area })} />
          <label>
            상태
            <select
              aria-label="자료 상태"
              value={m.status}
              onChange={(e) =>
                patch({ status: e.target.value as Material["status"] })
              }
            >
              {materialStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            관리 단위
            <select
              aria-label="관리 단위"
              value={m.kind}
              onChange={(e) =>
                patch({ kind: e.target.value as Material["kind"] })
              }
            >
              <option value="reference">참고 자료 / 항목</option>
              <option value="audio">요일별 오디오 회차</option>
              <option value="units">Unit</option>
              <option value="lectures">강의</option>
              <option value="days">Day</option>
              <option value="book">페이지</option>
            </select>
          </label>
          <label>
            전체량 (미정이면 비워두기)
            <input
              type="number"
              min="1"
              max="10000"
              step="1"
              value={m.total ?? ""}
              onChange={(e) => patch({ total: numberValue(e.target.value) })}
            />
          </label>
          <label>
            목표 회독 수
            <input
              type="number"
              min="1"
              max="10000"
              step="1"
              value={m.targetPasses ?? ""}
              onChange={(e) =>
                patch({ targetPasses: numberValue(e.target.value) })
              }
            />
          </label>
          <label>
            회차 예상 시간 (분)
            <input
              type="number"
              min="0"
              step="0.5"
              value={m.duration ?? ""}
              onChange={(e) => patch({ duration: numberValue(e.target.value) })}
            />
          </label>
        </div>
        {m.kind === "audio" && (
          <>
            <label>
              발행 시작일
              <input
                type="date"
                required
                value={m.startDate}
                onChange={(e) => patch({ startDate: e.target.value })}
              />
            </label>
            <fieldset>
              <legend>발행 요일</legend>
              <div className="weekday-inputs">
                {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={m.schedule.includes(i)}
                      onChange={(e) =>
                        patch({
                          schedule: e.target.checked
                            ? [...m.schedule, i]
                            : m.schedule.filter((d) => d !== i),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <label>
          학습 루틴
          <input
            value={m.routine}
            onChange={(e) => patch({ routine: e.target.value })}
          />
        </label>
        <label>
          자료 규모 · 계획 · 메모
          <textarea
            rows={4}
            value={m.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>
        <p className="form-help">
          설정·상태 변경은 기존 기록을 삭제하지 않습니다. 전체량을 줄여도 이전
          기록은 학습 기록 화면에 남습니다. 자료 등록은 할 일을 자동 생성하지
          않습니다. 자료 등록만으로 학습시간을 추가하지 않습니다.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" type="submit">
          자료 저장
        </button>
      </form>
    </Dialog>
  );
}
export function createLog(
  area: FieldId = "english",
  materialId = "",
  item = "",
  round = 1,
): StudyLog {
  return {
    id: newId(),
    area,
    materialId,
    item,
    round,
    date: localDate(),
    minutes: null,
    activity: "study",
    note: "",
    topic: "",
    writing: "",
    speaking: "",
    origin: "entered",
    completed: true,
  };
}
export function LogForm({
  value,
  onClose,
  practice = false,
  lockMaterial = false,
}: {
  value: StudyLog;
  onClose: () => void;
  practice?: boolean;
  lockMaterial?: boolean;
}) {
  const { data, update } = useData();
  const isNew = !data.logs.some((entry) => entry.id === value.id);
  const [log, setLog] = useState(() => {
    const material = data.materials.find((m) => m.id === value.materialId);
    return isNew &&
      material?.kind === "lectures" &&
      value.item &&
      value.activity !== "system"
      ? {
          ...value,
          minutes:
            value.minutes ?? lectureMinutes(material, Number(value.item)),
        }
      : value;
  });
  const [error, setError] = useState("");
  const fixedMaterial =
    lockMaterial || !!value.initialLearning || !!value.reviewOf;
  const patch = (p: Partial<StudyLog>) => {
    const next = { ...log, ...p };
    if (
      isNew &&
      (p.item !== undefined || p.materialId !== undefined) &&
      p.minutes === undefined &&
      next.activity !== "system"
    ) {
      const material = data.materials.find((m) => m.id === next.materialId);
      if (material?.kind === "lectures")
        next.minutes = next.item
          ? lectureMinutes(material, Number(next.item))
          : null;
    }
    setLog(next);
  };
  const m = data.materials.find((m) => m.id === log.materialId);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!log.materialId && !log.note.trim() && !log.topic.trim()) {
      setError("자료를 선택하거나 활동 메모 / 연습 주제를 입력해 주세요.");
      return;
    }
    if (
      m &&
      log.item &&
      m.kind !== "audio" &&
      (!/^\d+$/.test(log.item) || Number(log.item) < 1)
    ) {
      setError("진도 번호는 1 이상의 정수여야 합니다.");
      return;
    }
    if (
      m?.kind === "audio" &&
      log.item &&
      !/^\d{4}-\d{2}-\d{2}$/.test(log.item)
    ) {
      setError("회차는 YYYY-MM-DD 형식으로 입력해 주세요.");
      return;
    }
    if (m && isEbsCourse(m) && log.activity !== "system") {
      const existing = data.logs.find((entry) => entry.id === log.id);
      if (!validDate(log.item) || (!existing && !scheduled(m, log.item))) {
        setError(
          "EBS 회차의 실제 발행일을 선택해 주세요. 기본 발행 요일 외 기존 이력은 유지됩니다.",
        );
        return;
      }
      if (log.completed && log.item > localDate()) {
        setError("아직 발행되지 않은 미래 회차는 완료 처리할 수 없습니다.");
        return;
      }
      if (log.date && (log.date < log.item || log.date > localDate())) {
        setError("실제 청취일은 콘텐츠 발행일부터 오늘 사이로 입력해 주세요.");
        return;
      }
      if (log.reviewOf && log.date) {
        const source = data.logs.find((entry) => entry.id === log.reviewOf);
        const due = source?.date ? nextEbsReviewDate(source.date) : "";
        if (due && log.date < due) {
          setError(
            `다음 날 복습일은 원래 학습일의 다음 날(${due})부터 입력할 수 있습니다.`,
          );
          return;
        }
      }
    }
    const nextLog = {
      ...log,
      minutes:
        isNew &&
        m?.kind === "lectures" &&
        log.completed &&
        log.activity !== "system" &&
        log.item
          ? (log.minutes ?? lectureMinutes(m, Number(log.item)))
          : log.minutes,
      contentDate:
        m && isEbsCourse(m) && validDate(log.item) ? log.item : undefined,
    };
    update((d) => saveDayAwareLog(d, nextLog));
    onClose();
  }
  return (
    <Dialog
      title={practice ? "OPIc 주제별 연습 기록" : "학습 기록 입력 / 수정"}
      onClose={onClose}
    >
      <form className="v1-form" onSubmit={submit}>
        {fixedMaterial && (
          <div className="ebs-batch-info">
            <strong>{m?.title}</strong>
            <p>
              {log.initialLearning ? (
                `Day ${log.item} · 신규 학습`
              ) : (
                <>
                  콘텐츠 발행일 {log.item} ·{" "}
                  {log.activity === "review" ? "재청취 / 복습" : "청취"}
                </>
              )}
            </p>
          </div>
        )}
        {!fixedMaterial && (
          <div className="form-grid">
            <FieldSelect
              value={log.area}
              onChange={(area) => patch({ area, materialId: "", item: "" })}
            />
            <label>
              활동 구분
              <select
                aria-label="활동 구분"
                value={log.activity}
                onChange={(e) =>
                  patch({ activity: e.target.value as StudyLog["activity"] })
                }
              >
                {Object.entries(ActivityLabels).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {!practice && !fixedMaterial && (
          <>
            <label>
              학습 자료 (선택)
              <select
                aria-label="학습 자료 (선택)"
                value={log.materialId}
                onChange={(e) => {
                  const material = data.materials.find(
                    (m) => m.id === e.target.value,
                  );
                  patch({
                    materialId: e.target.value,
                    item: "",
                    area: material?.area ?? log.area,
                  });
                }}
              >
                <option value="">자료 없이 자유 기록</option>
                {data.materials
                  .filter((m) => m.area === log.area)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
              </select>
            </label>
            {m && (
              <div className="form-grid">
                <label>
                  {m.kind === "audio"
                    ? "회차 발행일 (학습일과 별도)"
                    : "Unit / Day / 강의 / 페이지 / 항목 번호"}
                  <input
                    type={m.kind === "audio" ? "date" : "number"}
                    min={m.kind === "audio" ? undefined : 1}
                    step={m.kind === "audio" ? undefined : 1}
                    value={log.item}
                    onChange={(e) => patch({ item: e.target.value })}
                  />
                </label>
                <label>
                  회독 번호 (추가 회독 가능)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={log.round}
                    onChange={(e) => patch({ round: Number(e.target.value) })}
                  />
                </label>
              </div>
            )}
          </>
        )}
        {m?.kind === "lectures" && log.item && (
          <p className="form-help">
            {
              m.lectures?.find((lesson) => lesson.number === Number(log.item))
                ?.title
            }
            {" · "}강의 길이{" "}
            {m.lectures?.find((lesson) => lesson.number === Number(log.item))
              ?.duration ?? "미입력"}
            분 · 학습시간은 아래에서 수정할 수 있습니다.
          </p>
        )}
        <div className="form-grid">
          <label>
            실제 학습일
            <input
              type="date"
              required={log.origin !== "reported"}
              min={
                m && isEbsCourse(m) && log.activity !== "system"
                  ? log.item
                  : undefined
              }
              max={m && isEbsCourse(m) ? localDate() : undefined}
              value={log.date ?? ""}
              onChange={(e) => patch({ date: e.target.value || null })}
            />
          </label>
          <label>
            {m?.kind === "lectures"
              ? "학습시간 (분, 수정 가능)"
              : "실제 활동시간 (분, 미측정 시 비우기)"}
            <input
              type="number"
              min="0"
              step="0.5"
              value={log.minutes ?? ""}
              onChange={(e) => patch({ minutes: numberValue(e.target.value) })}
            />
          </label>
        </div>
        {(practice || log.topic) && (
          <>
            <label>
              OPIc 연습 주제
              <input
                required
                value={log.topic}
                onChange={(e) => patch({ topic: e.target.value })}
                placeholder="예: 자기소개, 여행, 돌발 질문"
              />
            </label>
            <label>
              주제별 영작
              <textarea
                rows={5}
                value={log.writing}
                onChange={(e) => patch({ writing: e.target.value })}
              />
            </label>
            <label>
              말하기 연습 기록
              <textarea
                rows={3}
                value={log.speaking}
                onChange={(e) => patch({ speaking: e.target.value })}
                placeholder="말한 내용, 어려운 표현, 피드백 등"
              />
            </label>
          </>
        )}
        <label className="completion-input">
          <input
            type="checkbox"
            checked={log.completed}
            onChange={(e) =>
              patch({
                completed: e.target.checked,
                voided:
                  m && (isEbsCourse(m) || isDayBook(m))
                    ? !e.target.checked
                    : log.voided,
              })
            }
          />{" "}
          {m && isDayBook(m) && log.activity !== "system"
            ? `학습 완료 (해제 후 저장하면 ${log.initialLearning ? "신규 학습" : "복습"} 기록 삭제)`
            : m && isEbsCourse(m)
              ? "학습 완료 (해제하면 완료 취소 · 시간 집계 제외)"
              : "학습 완료 (해제해도 기록과 시간은 유지)"}
        </label>
        <label>
          활동 메모
          <textarea
            rows={3}
            value={log.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="form-help">
          회차 날짜와 실제 학습일은 별개입니다. 입력한 시간만 집계하며, 자료
          정비는 학습·복습 시간과 분리합니다. 같은 Unit / Day를 반복해서 새
          기록으로 남길 수 있습니다.
        </p>
        <button className="primary-button">기록 저장</button>
      </form>
    </Dialog>
  );
}
export function GoalForm({
  value,
  onClose,
}: {
  value?: Goal;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [g, setG] = useState<Goal>(
    value ?? {
      id: newId(),
      area: "english",
      title: "",
      target: "",
      current: "",
      status: "계획",
      targetDate: "",
      acquiredDate: "",
      expiresOn: "",
      recognized: "확인 필요",
      prerequisiteId: "",
      prerequisiteGrade: "",
    },
  );
  const [error, setError] = useState("");
  const patch = (p: Partial<Goal>) => setG({ ...g, ...p });
  function submit(e: FormEvent) {
    e.preventDefault();
    const visited = new Set([g.id]);
    let id = g.prerequisiteId;
    while (id) {
      if (visited.has(id)) {
        setError("선행 조건이 서로 순환할 수 없습니다.");
        return;
      }
      visited.add(id);
      id = data.goals.find((x) => x.id === id)?.prerequisiteId ?? "";
    }
    update((d) => ({
      ...d,
      goals: value
        ? d.goals.map((x) => (x.id === g.id ? g : x))
        : [...d.goals, g],
    }));
    onClose();
  }
  return (
    <Dialog title="독립 목표 관리" onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <FieldSelect
          value={g.area}
          onChange={(area) => patch({ area, recognized: "확인 필요" })}
        />
        <label>
          목표명 / 시험명
          <input
            required
            value={g.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <p className="form-help">
          사내 인정 시험:{" "}
          {(companyExams[g.area] ?? []).join(", ") ||
            "제공된 인정 시험 정보 없음"}
          . TOEFL은 제공된 사내 인정 목록에 포함되지 않습니다.
        </p>
        <div className="form-grid">
          <label>
            목표 점수 / 등급
            <input
              value={g.target}
              onChange={(e) => patch({ target: e.target.value })}
              placeholder="미정이면 비워두세요"
            />
          </label>
          <label>
            현재 점수 / 등급
            <input
              value={g.current}
              onChange={(e) => patch({ current: e.target.value })}
            />
          </label>
          <label>
            상태
            <select
              aria-label="목표 상태"
              value={g.status}
              onChange={(e) =>
                patch({ status: e.target.value as Goal["status"] })
              }
            >
              {["계획", "진행 중", "장기 목표", "취득"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            목표일
            <input
              type="date"
              value={g.targetDate}
              onChange={(e) => patch({ targetDate: e.target.value })}
            />
          </label>
          <label>
            실제 취득일
            <input
              type="date"
              value={g.acquiredDate}
              onChange={(e) => patch({ acquiredDate: e.target.value })}
            />
          </label>
          <label>
            유효기간 종료일
            <input
              type="date"
              value={g.expiresOn}
              min={g.acquiredDate || undefined}
              onChange={(e) => patch({ expiresOn: e.target.value })}
            />
          </label>
          <label>
            사내 인정 여부
            <select
              aria-label="사내 인정 여부"
              value={g.recognized}
              onChange={(e) =>
                patch({ recognized: e.target.value as Goal["recognized"] })
              }
            >
              {["인정", "미인정", "확인 필요"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            선행 목표 (선택)
            <select
              aria-label="선행 목표 (선택)"
              value={g.prerequisiteId}
              onChange={(e) => patch({ prerequisiteId: e.target.value })}
            >
              <option value="">없음 · 독립 진행</option>
              {data.goals
                .filter((x) => x.id !== g.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title} {x.target}
                  </option>
                ))}
            </select>
          </label>
          {g.prerequisiteId && (
            <label>
              선행 목표 요구 등급
              <input
                value={g.prerequisiteGrade}
                onChange={(e) => patch({ prerequisiteGrade: e.target.value })}
                placeholder="예: AL"
              />
            </label>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="form-help">
          목표는 순서 없이 독립 관리합니다. OPIc은 교재 회독 완료와 무관하게
          병행합니다. OPI 목표에는 선택적으로 OPIc AL 선행 조건을 연결할 수
          있습니다.
        </p>
        <button className="primary-button">목표 저장</button>
      </form>
    </Dialog>
  );
}
export function TaskForm({
  value,
  area = "english",
  onClose,
  onSaved,
}: {
  value?: Task;
  area?: FieldId;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { data, update } = useData();
  const [t, setT] = useState<Task>(
    value ?? {
      id: newId(),
      title: "",
      area,
      kind: "자유 과업",
      status: "예정",
      items: [],
      note: "",
    },
  );
  const [lines, setLines] = useState(t.items.map((i) => i.title).join("\n"));
  const [error, setError] = useState("");
  const patch = (p: Partial<Task>) => setT((prev) => ({ ...prev, ...p }));
  const config = t.tracking;
  const mode = taskMode(t);
  const track = (p: Partial<TaskTracking>) =>
    patch({ tracking: { mode, ...config, ...p } });
  function submit(e: FormEvent) {
    e.preventDefault();
    const usedIds = new Set<string>();
    const items = lines
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((title, index) => {
        const old =
          t.items.find((x) => x.title === title && !usedIds.has(x.id)) ??
          (t.items[index] && !usedIds.has(t.items[index].id)
            ? t.items[index]
            : undefined);
        if (old) usedIds.add(old.id);
        return {
          ...old,
          id: old?.id ?? newId(),
          title,
          done: old?.done ?? false,
        };
      });
    const next = { ...t, items };
    const message = taskSettingsError(next);
    if (message) {
      setError(message);
      return;
    }
    update((d) => saveTask(d, next));
    onSaved?.(t.id);
    onClose();
  }
  return (
    <Dialog title={value ? "과업 설정 수정" : "과업 추가"} onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        {!value && (
          <label>
            등록 양식 (선택)
            <select
              aria-label="과업 등록 양식"
              defaultValue=""
              onChange={(e) => {
                const template = taskTemplates.find(
                  (p) => p.id === e.target.value,
                );
                if (template)
                  patch({
                    title: template.title,
                    area: template.area,
                    kind: "프로젝트",
                    tracking: { ...template.tracking },
                    note: template.note,
                  });
              }}
            >
              <option value="">직접 입력</option>
              {taskTemplates
                .filter((p) => p.area === t.area)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          과업명
          <input
            required
            value={t.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <FieldSelect value={t.area} onChange={(area) => patch({ area })} />
        <div className="form-grid">
          <label>
            과업 구분
            <select
              aria-label="과업 유형"
              value={t.kind}
              onChange={(e) => patch({ kind: e.target.value as Task["kind"] })}
            >
              <option>자유 과업</option>
              <option>프로젝트</option>
            </select>
          </label>
          <label>
            상태
            <select
              aria-label="과업 상태"
              value={t.status}
              onChange={(e) =>
                patch({ status: e.target.value as Task["status"] })
              }
            >
              {taskStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            관리 방식
            <select
              aria-label="과업 관리 방식"
              value={mode}
              onChange={(e) => {
                const next = e.target.value as TaskTracking["mode"];
                track({
                  mode: next,
                  ...(next === "rounds" && !config?.subject
                    ? { subject: t.title }
                    : {}),
                });
              }}
            >
              {Object.entries(trackingLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            목표 완료일 (선택)
            <input
              type="date"
              value={t.targetDate ?? ""}
              onChange={(e) => patch({ targetDate: e.target.value })}
            />
          </label>
        </div>
        {mode === "day-range" && (
          <div className="form-grid">
            <label>
              전체 시작 Day
              <input
                type="number"
                min="1"
                step="1"
                required
                value={config?.dayStart ?? ""}
                onChange={(e) =>
                  track({
                    dayStart:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              전체 종료 Day
              <input
                type="number"
                min={config?.dayStart ?? 1}
                step="1"
                required
                value={config?.dayEnd ?? ""}
                onChange={(e) => track({ dayEnd: numberValue(e.target.value) })}
              />
            </label>
          </div>
        )}
        {mode === "quantity" && (
          <div className="form-grid">
            <label>
              전체 대상 수량 (미정이면 비우기)
              <input
                type="number"
                min="1"
                step="1"
                value={config?.total ?? ""}
                onChange={(e) => track({ total: numberValue(e.target.value) })}
              />
            </label>
            <label>
              수량 단위
              <input
                value={config?.unit ?? "개"}
                onChange={(e) => track({ unit: e.target.value })}
                placeholder="단어, 페이지, 개"
              />
            </label>
          </div>
        )}
        {mode === "rounds" && (
          <div className="form-grid">
            <label>
              회독 대상
              <input
                required
                value={config?.subject ?? ""}
                onChange={(e) => track({ subject: e.target.value })}
              />
            </label>
            <label>
              목표 회독 수 (선택)
              <input
                type="number"
                min="1"
                step="1"
                value={config?.roundTarget ?? ""}
                onChange={(e) =>
                  track({ roundTarget: numberValue(e.target.value) })
                }
              />
            </label>
          </div>
        )}
        <label>
          관련 자료 (선택)
          <select
            aria-label="과업 관련 자료"
            value={config?.materialId ?? ""}
            onChange={(e) => track({ materialId: e.target.value })}
          >
            <option value="">연결 없음</option>
            {config?.materialId &&
              !data.materials.some((m) => m.id === config.materialId) && (
                <option value={config.materialId}>기존 연결 자료</option>
              )}
            {data.materials
              .filter((m) => m.area === t.area || m.id === config?.materialId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
          </select>
        </label>
        {mode === "steps" ? (
          <label>
            단계 / 체크 항목 (줄마다 하나, 선택)
            <textarea
              rows={4}
              value={lines}
              onChange={(e) => setLines(e.target.value)}
            />
          </label>
        ) : (
          <details>
            <summary>참고 체크 항목 (선택)</summary>
            <label>
              <span className="sr-only">참고 체크 항목</span>
              <textarea
                aria-label="참고 체크 항목"
                rows={3}
                value={lines}
                onChange={(e) => setLines(e.target.value)}
              />
            </label>
          </details>
        )}
        <label>
          메모
          <textarea
            rows={3}
            value={t.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        </label>
        {t.records?.length ? (
          <p className="form-help">
            관리 방식을 바꾸어도 기존 이력을 보존하며 현재 방식의 기록만 진도에
            집계합니다.
          </p>
        ) : null}
        <p className="form-help">
          정리 과업과 자료의 학습·복습 진도는 별도입니다. 회독 목표에 도달해도
          추가 기록할 수 있으며 과업 상태는 직접 변경합니다.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button">과업 저장</button>
      </form>
    </Dialog>
  );
}
