import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, BookOpen, ListPlus, ArrowRight } from "lucide-react";
import { useData } from "./state";
import { PageHeading, Empty } from "./ui";
import { fieldName } from "./model";
import { getDayBook } from "./dayLearning";
import {
  vocabularyDayMaterial,
  registeredVocabularyLastDay,
  extendVocabularyDays,
  selectVocabularyDayMaterial,
} from "./vocabularyDays";

export function VocabularySummary({ area }: { area: "chinese" | "spanish" }) {
  const { data } = useData();
  const book = data.vocabularies?.find((b) => b.area === area);
  if (!book) return null;
  const material = vocabularyDayMaterial(data, book),
    last = registeredVocabularyLastDay(data, book);
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
        <p>Day를 선택해 학습 날짜·시간과 회독·복습을 기록하세요.</p>
        <strong className="vocabulary-card-value">
          {last ? `Day 1~${last}` : "학습할 기존 단어장 연결"}
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
              : `/vocabulary/${book.id}`
          }
        >
          {material?.total ? "Day 학습하기" : "Day 학습 연결"}
          <ArrowRight size={15} />
        </Link>
      </article>
      <article className="vocabulary-action-card" aria-label="Day 추가">
        <div className="vocabulary-card-heading">
          <ListPlus size={18} />
          <h2>Day 추가</h2>
        </div>
        <p>마지막 번호를 늘리거나 다음 Day를 하나 추가하세요.</p>
        <strong className="vocabulary-card-value">
          {last === null ? "기존 마지막 Day 확인 필요" : `다음 Day ${last + 1}`}
        </strong>
        <small>Day를 추가해도 학습 완료나 학습시간은 기록되지 않습니다.</small>
        <Link className="secondary-button" to={`/vocabulary/${book.id}`}>
          Day 추가·관리
          <ArrowRight size={15} />
        </Link>
      </article>
    </section>
  );
}

export function VocabularyPage() {
  const { id } = useParams(),
    { data, update } = useData();
  const book = data.vocabularies?.find((b) => b.id === id);
  const [lastInput, setLastInput] = useState(""),
    [selectedMaterial, setMaterial] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  if (!book)
    return (
      <Empty>
        단어장을 찾을 수 없습니다. <Link to="/languages">외국어로</Link>
      </Empty>
    );
  const material = vocabularyDayMaterial(data, book),
    last = registeredVocabularyLastDay(data, book);
  const choices = data.materials.filter(
    (m) => m.area === book.area && m.kind === "days",
  );
  const task = data.tasks.find((t) => t.id === book.taskId);
  function grow(target: number) {
    if (
      last === null ||
      extendVocabularyDays(data, book!.id, target, last) === data
    ) {
      setError(
        `현재 마지막 Day ${last ?? "미확인"}보다 큰 정수로 입력해 주세요. 최대 10,000 Day까지 등록할 수 있습니다.`,
      );
      return;
    }
    update((d) => extendVocabularyDays(d, book!.id, target, last));
    setLastInput("");
    setError("");
    setNotice(
      `Day ${last + 1}${target > last + 1 ? `~${target}` : ""}를 추가했습니다. 기존 학습·회독 기록은 유지됩니다.`,
    );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    grow(Number(lastInput));
  }
  function connect(e: FormEvent) {
    e.preventDefault();
    if (
      selectVocabularyDayMaterial(data, book!.id, selectedMaterial) === data
    ) {
      setError("연결할 기존 Day 자료를 선택해 주세요.");
      return;
    }
    update((d) => selectVocabularyDayMaterial(d, book!.id, selectedMaterial));
    setError("");
    setNotice(
      "기존 Day 자료를 연결했습니다. 학습 기록과 회독 이력은 유지됩니다.",
    );
  }
  return (
    <>
      <Link className="back-link" to={`/fields/${book.area}`}>
        <ArrowLeft size={16} />
        {fieldName(book.area)}로
      </Link>
      <PageHeading
        eyebrow="VOCABULARY · DAYS"
        title={`${fieldName(book.area)} Day 관리`}
        description="Day 1부터 마지막 Day까지 연속된 번호만 관리합니다. 단어 내용은 Excel에서 관리하세요."
      />
      {last === null ? (
        <section
          className="vocabulary-day-manager"
          aria-label="기존 Day 자료 연결"
        >
          <h2>기존 학습 자료 연결</h2>
          <p className="micro-note">
            학습 기록이 있는 기존 자료를 선택하세요. 여러 자료의 기록을 임의로
            합치지 않습니다.
          </p>
          {choices.length ? (
            <form className="v1-form" onSubmit={connect}>
              <label>
                기존 Day 자료
                <select
                  aria-label="기존 Day 자료"
                  required
                  value={selectedMaterial}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  <option value="">자료 선택</option>
                  {choices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} · 마지막 Day {m.total ?? "미입력"}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button">학습 자료 연결</button>
            </form>
          ) : (
            <p className="micro-note">
              보관함에서 Day 단위 자료를 등록한 뒤 연결할 수 있습니다.{" "}
              <Link className="text-link" to="/library">
                보관함으로 →
              </Link>
            </p>
          )}
        </section>
      ) : (
        <section className="vocabulary-day-manager" aria-label="Day 번호 관리">
          <div className="vocabulary-day-stats">
            <div>
              <span>현재 등록 범위</span>
              <strong>{last ? `Day 1~${last}` : "등록된 Day 없음"}</strong>
            </div>
            <div>
              <span>다음 신규 Day</span>
              <strong>Day {last + 1}</strong>
            </div>
          </div>
          <form className="vocabulary-grow-form v1-form" onSubmit={submit}>
            <label>
              마지막 Day 번호
              <input
                aria-label="마지막 Day 번호"
                type="number"
                min={last + 1}
                max="10000"
                step="1"
                required
                value={lastInput}
                onChange={(e) => {
                  setLastInput(e.target.value);
                  setError("");
                }}
                placeholder={`예: ${last + 10}`}
              />
            </label>
            <button className="primary-button" disabled={last >= 10000}>
              마지막 Day 늘리기
            </button>
          </form>
          <div className="vocabulary-day-actions">
            <button
              className="secondary-button"
              disabled={last >= 10000}
              onClick={() => grow(last + 1)}
            >
              <Plus size={16} />
              Day {last + 1} 하나 추가
            </button>
            {material && (
              <Link className="text-link" to={`/materials/${material.id}`}>
                Day 학습하기
                <ArrowRight size={15} />
              </Link>
            )}
          </div>
          <p className="micro-note">
            번호를 늘리면 사이의 Day도 연속으로 등록됩니다. 학습
            날짜·시간·회독·복습은 Day 학습 화면에서 별도로 기록하세요.
          </p>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="vocabulary-notice" role="status" aria-live="polite">
        {notice}
      </p>
      <section
        className="vocabulary-preparation-link"
        aria-label="Excel 정리 장기 과업"
      >
        <h2>Excel 정리 작업</h2>
        <p>단어장 정리와 자료 구축은 별도의 장기 과업으로 관리합니다.</p>
        <Link
          className="text-link"
          to={task ? `/tasks/${task.id}` : `/tasks?area=${book.area}`}
        >
          {task ? `${task.title} →` : "장기 과업 관리 →"}
        </Link>
      </section>
    </>
  );
}
