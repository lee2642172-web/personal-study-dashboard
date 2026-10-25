import { useState, useMemo, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Pencil,
  BookOpen,
  ListPlus,
  ArrowRight,
} from "lucide-react";
import { useData } from "./state";
import { PageHeading, Dialog, Empty } from "./ui";
import {
  fieldName,
  newId,
  type VocabularyBook,
  type VocabularyEntry,
  type VocabularySheet,
} from "./model";
import { taskProgress } from "./taskWork";
import { getDayBook } from "./dayLearning";
import {
  vocabularyPlan,
  vocabularyEvidence,
  configureVocabulary,
  parseVocabularyText,
  addVocabularyEntries,
  duplicateCandidates,
  vocabularyDuplicateIndex,
  normalizeTerm,
  setVocabularyReview,
  editVocabularyEntry,
  deleteVocabularyEntry,
  appendVocabularyDays,
  prepTaskCandidates,
  connectVocabularyTask,
} from "./vocabulary";
const statusLabels = {
  pending: "검토 대기",
  ready: "편입 대상",
  excluded: "중복·제외",
  imported: "편입 완료",
  reference: "기존 단어 색인",
};

export function VocabularySummary({
  area,
  management = false,
}: {
  area: "chinese" | "spanish";
  management?: boolean;
}) {
  const { data } = useData();
  const book = data.vocabularies?.find((b) => b.area === area);
  if (!book) return null;
  const material = data.materials.find(
      (m) =>
        m.id === book.materialId && m.kind === "days" && m.area === book.area,
    ),
    plan = vocabularyPlan(data, book),
    task = data.tasks.find((t) => t.id === book.taskId),
    p = task ? taskProgress(task) : null;
  if (!management) {
    const study = material?.total ? getDayBook(data, material) : null;
    const round = study?.rounds.find((r) => r.round === study.activeRound);
    return (
      <section
        className="vocabulary-hub"
        aria-label={`${fieldName(area)} 단어장 현황`}
      >
        <article className="vocabulary-action-card" aria-label="Day 학습">
          <div className="vocabulary-card-heading">
            <BookOpen size={18} />
            <h2>Day 학습</h2>
          </div>
          <p>등록된 Day를 선택해 회독과 복습을 기록하세요.</p>
          <strong className="vocabulary-card-value">
            {material?.total
              ? `Day 1~${material.total}`
              : "학습할 기존 단어장 연결"}
          </strong>
          <small>
            {study && round
              ? `학습 위치 · ${study.activeRound}회독 · Day ${round.lastOpenedDay}`
              : "기존 자료의 학습·회독 기록을 유지합니다."}
          </small>
          <Link
            className="primary-button"
            to={
              material?.total
                ? `/materials/${material.id}`
                : `/vocabulary/${book.id}?setup=learning`
            }
          >
            {material?.total ? "Day 학습하기" : "Day 학습 연결"}
            <ArrowRight size={15} />
          </Link>
        </article>
        <article className="vocabulary-action-card" aria-label="새 Day 입력">
          <div className="vocabulary-card-heading">
            <ListPlus size={18} />
            <h2>새 Day 입력</h2>
          </div>
          <p>새 단어를 입력·검토하고 기존 Day 뒤에 추가하세요.</p>
          <strong className="vocabulary-card-value">
            {plan.next === null
              ? "기존 마지막 Day 확인 필요"
              : `다음 편입 Day ${plan.next}`}
          </strong>
          <small>
            {book.dayPlan
              ? `추가 정리 범위 · Day ${book.dayPlan.remainingStartDay}~${book.dayPlan.remainingEndDay} (${book.dayPlan.remainingEndDay - book.dayPlan.remainingStartDay + 1} Days)`
              : `추가 정리 대상 약 ${book.incomingWordEstimate.toLocaleString()}개 · Day당 10개`}
          </small>
          <Link className="secondary-button" to={`/vocabulary/${book.id}`}>
            새 Day 입력하기
            <ArrowRight size={15} />
          </Link>
          {task && p && (
            <Link className="text-link" to={`/tasks/${task.id}`}>
              정리 과업 · {p.done.toLocaleString()} /{" "}
              {p.total?.toLocaleString() ?? "미정"} {p.unit}
            </Link>
          )}
        </article>
      </section>
    );
  }
  return (
    <section
      className="vocabulary-summary"
      aria-label={`${fieldName(area)} 단어장 현황`}
    >
      <div>
        <h2>{fieldName(area)} 단어장</h2>
        <p>
          {book.dayPlan
            ? `기존 Day 1~${book.dayPlan.organizedThroughDay} 정리 완료 · `
            : `기존 약 ${book.existingWordEstimate.toLocaleString()}개 · `}
          {plan.last === null
            ? "실제 마지막 Day 확인 필요"
            : `현재 마지막 Day ${plan.last}`}{" "}
          · Day당 10개
        </p>
        <small>
          {book.dayPlan
            ? `추가 정리 Day ${book.dayPlan.remainingStartDay}~${book.dayPlan.remainingEndDay} (${book.dayPlan.remainingEndDay - book.dayPlan.remainingStartDay + 1} Days) · `
            : `추가 정리 대상 약 ${book.incomingWordEstimate.toLocaleString()}개 · `}
          실제 원본 입력{" "}
          {book.entries
            .filter((e) => e.status !== "reference")
            .length.toLocaleString()}
          개
        </small>
      </div>
      <div className="vocabulary-summary-links">
        {material?.total ? (
          <Link className="secondary-button" to={`/materials/${material.id}`}>
            Day 학습하기
          </Link>
        ) : null}
        {task && p ? (
          <Link className="text-link" to={`/tasks/${task.id}`}>
            정리 과업 · {p.done.toLocaleString()} /{" "}
            {p.total?.toLocaleString() ?? "미정"} {p.unit}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
function VocabularySetup({
  book,
  onClose,
}: {
  book: VocabularyBook;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [materialId, setMaterial] = useState(book.materialId),
    [last, setLast] = useState(
      String(book.baselineLastDay ?? book.dayPlan?.organizedThroughDay ?? ""),
    ),
    [existing, setExisting] = useState(String(book.existingWordEstimate)),
    [incoming, setIncoming] = useState(String(book.incomingWordEstimate)),
    [sheets, setSheets] = useState(book.sheets),
    [error, setError] = useState("");
  const imported = book.entries.some((e) => e.status === "imported");
  const choices = data.materials.filter(
    (m) => m.area === book.area && m.kind === "days",
  );
  function patchSheet(id: string, p: Partial<VocabularySheet>) {
    setSheets((all) => all.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const config = {
      materialId,
      baselineLastDay: last === "" ? null : Number(last),
      existingWordEstimate: Number(existing),
      incomingWordEstimate: Number(incoming),
      sheets,
    };
    if (configureVocabulary(data, book.id, config) === data) {
      setError(
        "대상 자료와 실제 마지막 Day, 시트별 범위를 확인해 주세요. 기존 기록보다 작은 Day 또는 겹치는 시트 구간은 저장할 수 없습니다.",
      );
      return;
    }
    update((d) => configureVocabulary(d, book.id, config));
    onClose();
  }
  return (
    <Dialog title="기존 단어장 구조 확인" onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <label>
          Day를 이어 붙일 기존 자료
          <select
            aria-label="편입 대상 자료"
            required
            disabled={imported}
            value={materialId}
            onChange={(e) => setMaterial(e.target.value)}
          >
            <option value="">직접 선택</option>
            {choices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · 등록 Day {m.total ?? "미확인"}
              </option>
            ))}
          </select>
        </label>
        {!choices.length && (
          <p className="form-help">
            기존 자료의 관리 단위를 Day로 설정하고 실제 마지막 Day를 확인한 뒤
            연결하세요. 기존 자료는 새로 복제하지 않습니다.
          </p>
        )}
        <label>
          기존 실제 마지막 Day
          <input
            aria-label="기존 실제 마지막 Day"
            type="number"
            min="1"
            max="10000"
            step="1"
            disabled={imported}
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="불명확하면 비워두기"
          />
        </label>
        <p className="form-help">
          현재 연결 자료·기록에서 확인되는 Day 하한:{" "}
          {vocabularyEvidence(data, {
            ...book,
            materialId,
            materialIds: [materialId, ...sheets.map((s) => s.materialId)],
          }) || "미확인"}
          . 단어 수 ÷ 10으로 마지막 Day를 추정하지 않습니다.
          {imported
            ? " 편입 이후에는 기존 경계와 대상 자료를 바꾸지 않습니다."
            : ""}
        </p>
        {book.area !== "chinese" && (
          <div className="form-grid">
            <label>
              기존 단어 수 (대략)
              <input
                type="number"
                min="0"
                step="1"
                required
                value={existing}
                onChange={(e) => setExisting(e.target.value)}
              />
            </label>
            <label>
              추가 정리 대상 수 (대략)
              <input
                type="number"
                min="0"
                step="1"
                required
                value={incoming}
                onChange={(e) => setIncoming(e.target.value)}
              />
            </label>
          </div>
        )}
        {book.area !== "chinese" && (
          <>
            <h3>기존 시트와 전체 연속 Day 범위</h3>
            <p className="form-help">
              실제 확인한 범위만 입력하세요. 급수마다 Day 1로 초기화하지
              않습니다. 미확인 범위는 비워둘 수 있습니다.
            </p>
            <div className="vocabulary-sheet-setup">
              {sheets.map((s) => (
                <fieldset key={s.id}>
                  <legend>{s.title}</legend>
                  <label>
                    연결 자료
                    <select
                      aria-label={`${s.title} 연결 자료`}
                      value={s.materialId}
                      onChange={(e) =>
                        patchSheet(s.id, { materialId: e.target.value })
                      }
                    >
                      <option value="">미확인 / 같은 원본 내부 시트</option>
                      {data.materials
                        .filter((m) => m.area === book.area)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      시작 Day
                      <input
                        aria-label={`${s.title} 시작 Day`}
                        type="number"
                        min="1"
                        step="1"
                        value={s.startDay ?? ""}
                        onChange={(e) =>
                          patchSheet(s.id, {
                            startDay:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      종료 Day
                      <input
                        aria-label={`${s.title} 종료 Day`}
                        type="number"
                        min="1"
                        step="1"
                        value={s.endDay ?? ""}
                        onChange={(e) =>
                          patchSheet(s.id, {
                            endDay:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button">구조 저장</button>
      </form>
    </Dialog>
  );
}
function VocabularyPaste({
  book,
  onClose,
}: {
  book: VocabularyBook;
  onClose: () => void;
}) {
  const { data, update } = useData();
  const [batchId] = useState(newId),
    [text, setText] = useState(""),
    [reference, setReference] = useState(false),
    [sheetId, setSheet] = useState(
      book.area === "chinese"
        ? (book.sheets.find((s) => s.id === "chinese") ?? book.sheets[0]).id
        : book.sheets[0].id,
    ),
    [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const rows = parseVocabularyText(text);
    if (!rows.length) {
      setError("실제 단어 목록을 입력해 주세요.");
      return;
    }
    const ids = rows.map((_, i) => `${batchId}-${i}`);
    if (
      addVocabularyEntries(data, book.id, rows, sheetId, reference, ids) ===
      data
    ) {
      setError("시트와 입력 내용을 확인해 주세요.");
      return;
    }
    update((d) =>
      addVocabularyEntries(d, book.id, rows, sheetId, reference, ids),
    );
    onClose();
  }
  return (
    <Dialog title="원본 단어 입력" onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <label>
          입력 목적
          <select
            aria-label="단어 입력 목적"
            value={reference ? "reference" : "incoming"}
            onChange={(e) => setReference(e.target.value === "reference")}
          >
            <option value="incoming">추가 정리 대상 원본</option>
            <option value="reference">기존 단어 색인 (중복 비교용)</option>
          </select>
        </label>
        {book.area !== "chinese" && (
          <label>
            원본 시트
            <select
              aria-label="원본 시트"
              value={sheetId}
              onChange={(e) => setSheet(e.target.value)}
            >
              {book.sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          단어 · 뜻 · 메모 (탭으로 구분)
          <textarea
            aria-label="원본 단어 목록"
            rows={10}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Excel에서 단어·뜻·메모 열만 복사해 붙여넣으세요. 한 줄에 한 단어이며 뜻·메모는 선택입니다."
          />
        </label>
        <label>
          TSV / 텍스트 파일 불러오기 (선택)
          <input
            type="file"
            accept=".tsv,.txt"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setText(await file.text());
            }}
          />
        </label>
        <p className="form-help">
          입력만으로 Day나 학습 기록을 만들지 않습니다. 기존 색인은 중복
          비교에만 사용하며 기존 Day·회독을 변경하지 않습니다. XLSX 파일 자체는
          수정하지 않습니다.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button">원본 목록 저장</button>
      </form>
    </Dialog>
  );
}
function VocabularyEntryForm({
  book,
  value,
  onClose,
}: {
  book: VocabularyBook;
  value: VocabularyEntry;
  onClose: () => void;
}) {
  const { update } = useData();
  const [entry, setEntry] = useState(value);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!entry.term.trim()) return;
    update((d) => editVocabularyEntry(d, book.id, entry));
    onClose();
  }
  return (
    <Dialog title="단어 내용 수정" onClose={onClose}>
      <form className="v1-form" onSubmit={submit}>
        <label>
          단어
          <input
            required
            value={entry.term}
            onChange={(e) => setEntry({ ...entry, term: e.target.value })}
          />
        </label>
        <label>
          뜻
          <textarea
            value={entry.meaning}
            onChange={(e) => setEntry({ ...entry, meaning: e.target.value })}
          />
        </label>
        <label>
          메모
          <textarea
            value={entry.note}
            onChange={(e) => setEntry({ ...entry, note: e.target.value })}
          />
        </label>
        {book.area !== "chinese" && (
          <label>
            시트
            <select
              aria-label="단어 시트"
              disabled={entry.status === "imported"}
              value={entry.sheetId}
              onChange={(e) => setEntry({ ...entry, sheetId: e.target.value })}
            >
              {book.sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="form-help">
          {entry.status === "imported"
            ? `Day ${entry.day} · ${entry.position}번은 그대로 유지됩니다.`
            : "내용을 바꾸면 편입 여부를 다시 검토하도록 대기 상태로 돌아갑니다."}
        </p>
        <button className="primary-button">단어 수정 저장</button>
        {entry.status !== "imported" && (
          <button
            type="button"
            className="task-delete-button"
            onClick={() => {
              update((d) => deleteVocabularyEntry(d, book.id, entry.id));
              onClose();
            }}
          >
            이 입력 항목 삭제
          </button>
        )}
      </form>
    </Dialog>
  );
}
export function VocabularyPage() {
  const { id } = useParams(),
    { data, update } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const book = data.vocabularies?.find((b) => b.id === id);
  const [setup, setSetup] = useState(
      () => searchParams.get("setup") === "learning",
    ),
    [paste, setPaste] = useState(false),
    [editing, setEditing] = useState<VocabularyEntry | null>(null),
    [status, setStatus] = useState("pending"),
    [sheet, setSheet] = useState("all"),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(30),
    [selectedTask, setTask] = useState(""),
    [notice, setNotice] = useState("");
  const duplicateIndex = useMemo(
    () =>
      book
        ? vocabularyDuplicateIndex(book)
        : new Map<string, VocabularyEntry[]>(),
    [book?.entries],
  );
  const hasDuplicate = (entry: VocabularyEntry) =>
    (duplicateIndex.get(normalizeTerm(entry.term))?.length ?? 0) >
    (entry.status === "excluded" ? 0 : 1);
  if (!book)
    return (
      <Empty>
        단어장을 찾을 수 없습니다. <Link to="/languages">외국어로</Link>
      </Empty>
    );
  const plan = vocabularyPlan(data, book),
    references = book.entries.filter((e) => e.status === "reference"),
    task = data.tasks.find((t) => t.id === book.taskId),
    candidates = prepTaskCandidates(data, book);
  const rows = book.entries.filter(
    (e) =>
      (status === "all" || status === "duplicates"
        ? status === "all" || hasDuplicate(e)
        : e.status === status) &&
      (sheet === "all" || e.sheetId === sheet) &&
      `${e.term} ${e.meaning} ${e.note}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const clean = rows.filter((e) => e.status === "pending" && !hasDuplicate(e));
  function connect() {
    const next = connectVocabularyTask(
      data,
      book!.id,
      selectedTask || undefined,
    );
    if (next === data) {
      setNotice(
        "연결할 기존 과업을 선택해 주세요. 중복 과업은 자동 생성하지 않습니다.",
      );
      return;
    }
    update((d) =>
      connectVocabularyTask(d, book!.id, selectedTask || undefined),
    );
    setNotice(
      "같은 정리 과업에 연결했습니다. 정리한 범위와 실제 작업 날짜는 과업에서 기록하세요.",
    );
  }
  return (
    <>
      <Link className="back-link" to={`/fields/${book.area}`}>
        <ArrowLeft size={16} />
        {fieldName(book.area)}로
      </Link>
      <PageHeading
        eyebrow="VOCABULARY · SOURCE & REVIEW"
        title={`${fieldName(book.area)} 단어 입력·편입`}
        description="기존 Day와 학습 이력을 유지하며 실제 입력한 단어만 뒤에 편입합니다."
        action={
          <button className="secondary-button" onClick={() => setSetup(true)}>
            <Pencil size={15} />
            기존 구조 확인
          </button>
        }
      />
      <VocabularySummary area={book.area} management />
      <section
        className="vocabulary-workflow"
        aria-label="원본 검토와 Day 편입"
      >
        <div className="vocabulary-metadata">
          <span>
            기존 단어 색인 {references.length.toLocaleString()}개
            {book.area !== "chinese" &&
              ` / 약 ${book.existingWordEstimate.toLocaleString()}개`}
          </span>
          <span>다음 Day {plan.next ?? "미확인"}</span>
          {book.materialId && (
            <Link className="text-link" to={`/materials/${book.materialId}`}>
              학습 기록 보기 →
            </Link>
          )}
        </div>
        <p className="micro-note">
          기존 색인에 입력하지 않은 원본 단어는 중복 여부를 확인할 수 없습니다.
          대소문자·공백·유니코드 표기만 정규화하며 스페인어 악센트와 중국어
          글자를 임의 변환하지 않습니다.
        </p>
        {plan.last === null && (
          <p className="vocabulary-inline-notice">
            편입 전 기존 구조 확인에서 Day를 이어 붙일 대상 자료와 실제 마지막
            Day를 연결해 주세요.
          </p>
        )}
        <div className="vocabulary-actions">
          <button className="primary-button" onClick={() => setPaste(true)}>
            <Plus size={15} />
            원본 단어 입력
          </button>
          <button
            className="secondary-button"
            disabled={!clean.length}
            onClick={() => {
              update((d) =>
                setVocabularyReview(
                  d,
                  book.id,
                  clean.map((e) => e.id),
                  "ready",
                ),
              );
              setNotice(
                `입력된 목록에서 중복 후보 없는 ${clean.length}개를 편입 대상으로 확정했습니다.`,
              );
            }}
          >
            중복 후보 없는 입력 항목 확정 ({clean.length})
          </button>
        </div>
        <div className="vocabulary-import-plan">
          <strong>
            편입 가능 {plan.words}개 · {plan.days} Days
          </strong>
          <span>
            {plan.next !== null && plan.days
              ? `Day ${plan.next}~${plan.last! + plan.days}`
              : book.area === "chinese"
                ? "확정 단어가 10개 모이면 편입 가능"
                : "확정 단어가 같은 시트에 10개 모이면 편입 가능"}
          </span>
          <button
            className="primary-button"
            disabled={
              plan.last === null || !plan.days || plan.last + plan.days > 10000
            }
            onClick={() => {
              update((d) => appendVocabularyDays(d, book.id));
              setNotice(
                `${plan.words}개를 새 Day로 편입했습니다. 학습 완료나 과업 처리 수량은 자동 기록하지 않았습니다.`,
              );
            }}
          >
            확정 단어로 새 Day 편입
          </button>
        </div>
        <p className="micro-note">
          {book.area === "chinese"
            ? "급수별 시트 구분 없이 10개씩 새 Day로 편입하며 남은 단어는 대기합니다. "
            : "시트별 10개 단위로 편입하고 남은 단어는 대기합니다. "}
          Day는 전체 마지막 번호 뒤에 연속으로 추가하며, 기존 Day를 다시
          채우거나 번호를 바꾸지 않습니다.
        </p>
      </section>
      <section
        className="vocabulary-task-link"
        aria-label="단어 정리 과업 연결"
      >
        <div>
          <h2>추가 단어 정리 과업</h2>
          {task ? (
            <Link className="text-link" to={`/tasks/${task.id}`}>
              {task.title} · 실제 작업 기록 열기 →
            </Link>
          ) : (
            <p className="micro-note">
              기존 과업이 있으면 재사용합니다. 단어 원본의 검토 상태는 실제 처리
              수량과 별도로 표시됩니다.
            </p>
          )}
        </div>
        <div>
          <label>
            <span className="sr-only">연결할 정리 과업</span>
            <select
              aria-label="연결할 정리 과업"
              value={selectedTask}
              onChange={(e) => setTask(e.target.value)}
            >
              <option value="">
                {task
                  ? "현재 연결 유지"
                  : candidates.length === 1
                    ? `기존 과업 사용: ${candidates[0].title}`
                    : candidates.length > 1
                      ? "기존 과업 직접 선택"
                      : "정리 과업 등록"}
              </option>
              {data.tasks
                .filter((t) => t.area === book.area)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
          <button className="secondary-button" onClick={connect}>
            정리 과업 연결·등록
          </button>
        </div>
      </section>
      <p className="vocabulary-notice" role="status" aria-live="polite">
        {notice}
      </p>
      <section className="vocabulary-entries" aria-label="입력한 단어 목록">
        <div className="vocabulary-filters">
          <label>
            상태
            <select
              aria-label="단어 검토 상태"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setLimit(30);
              }}
            >
              <option value="all">전체</option>
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l} ({book.entries.filter((e) => e.status === v).length})
                </option>
              ))}
              <option value="duplicates">중복 후보</option>
            </select>
          </label>
          {book.area !== "chinese" && (
            <label>
              시트
              <select
                aria-label="단어 목록 시트"
                value={sheet}
                onChange={(e) => {
                  setSheet(e.target.value);
                  setLimit(30);
                }}
              >
                <option value="all">모든 시트</option>
                {book.sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            단어 검색
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(30);
              }}
            />
          </label>
        </div>
        {rows.length ? (
          <ul className="vocabulary-word-list">
            {rows.slice(0, limit).map((entry) => {
              const dup = duplicateCandidates(book, entry, duplicateIndex);
              return (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.term}</strong>
                    <span>
                      {book.area !== "chinese" &&
                        `${book.sheets.find((s) => s.id === entry.sheetId)?.title} · `}
                      {statusLabels[entry.status]}
                      {entry.day !== null
                        ? ` · Day ${entry.day} / ${entry.position}번`
                        : ""}
                    </span>
                    {entry.meaning && <p>{entry.meaning}</p>}
                    {entry.note && <p>{entry.note}</p>}
                    {dup.length > 0 && (
                      <p className="vocabulary-duplicate">
                        중복 후보 {dup.length}개:{" "}
                        {dup
                          .slice(0, 3)
                          .map((e) => `${e.term} (${statusLabels[e.status]})`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="vocabulary-word-actions">
                    <button
                      className="icon-button"
                      aria-label={`${entry.id} 단어 수정`}
                      onClick={() => setEditing(entry)}
                    >
                      <Pencil size={15} />
                    </button>
                    {!["reference", "imported"].includes(entry.status) && (
                      <>
                        {entry.status !== "ready" && (
                          <button
                            className="text-link"
                            onClick={() =>
                              update((d) =>
                                setVocabularyReview(
                                  d,
                                  book.id,
                                  [entry.id],
                                  "ready",
                                ),
                              )
                            }
                          >
                            {dup.length ? "별도 단어로 유지" : "편입 대상"}
                          </button>
                        )}
                        {entry.status !== "excluded" && (
                          <button
                            className="text-link"
                            onClick={() =>
                              update((d) =>
                                setVocabularyReview(
                                  d,
                                  book.id,
                                  [entry.id],
                                  "excluded",
                                ),
                              )
                            }
                          >
                            중복·제외
                          </button>
                        )}
                        {entry.status !== "pending" && (
                          <button
                            className="text-link"
                            onClick={() =>
                              update((d) =>
                                setVocabularyReview(
                                  d,
                                  book.id,
                                  [entry.id],
                                  "pending",
                                ),
                              )
                            }
                          >
                            검토로 되돌리기
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="task-empty-inline">
            입력한 실제 단어가 없습니다. 예상 단어 수만큼 임의의 항목을 생성하지
            않습니다.
          </p>
        )}
        {rows.length > limit && (
          <button className="text-link" onClick={() => setLimit((n) => n + 30)}>
            단어 더 보기 ({rows.length - limit}개)
          </button>
        )}
      </section>
      <details className="vocabulary-sources">
        <summary>
          {book.area === "chinese"
            ? "기존 자료와 Day 범위 확인"
            : "기존 자료와 시트 범위 확인"}
        </summary>
        {book.materialIds.map((mid) => {
          const m = data.materials.find((m) => m.id === mid);
          return m ? (
            <p key={mid}>
              <Link className="text-link" to={`/materials/${m.id}`}>
                {m.title}
              </Link>{" "}
              · 등록 전체량 {m.total ?? "미확인"} (
              {m.kind === "days" ? "Day" : "기존 관리 단위"})
            </p>
          ) : null;
        })}
        {book.area !== "chinese" &&
          book.sheets.map((s) => (
            <p key={s.id}>
              {s.title}: 기존 Day{" "}
              {s.startDay === null
                ? "범위 미확인"
                : `${s.startDay}~${s.endDay}`}{" "}
              · 신규 편입{" "}
              {
                book.entries.filter(
                  (e) => e.status === "imported" && e.sheetId === s.id,
                ).length
              }
              개
            </p>
          ))}
      </details>
      {setup && (
        <VocabularySetup
          book={book}
          onClose={() => {
            setSetup(false);
            if (searchParams.has("setup")) {
              const next = new URLSearchParams(searchParams);
              next.delete("setup");
              setSearchParams(next, { replace: true });
            }
          }}
        />
      )}
      {paste && <VocabularyPaste book={book} onClose={() => setPaste(false)} />}
      {editing && (
        <VocabularyEntryForm
          key={editing.id}
          book={book}
          value={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
