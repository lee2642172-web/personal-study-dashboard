import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { useData } from "./state";
import { useLocalDate } from "./useLocalDate";
import { localDate } from "./dates";
import { newId, type StudyLog } from "./model";
import { ebsCourses } from "./ebs";
import {
  ebsReviews,
  recordEbsReview,
  cancelEbsReview,
  nextEbsReviewDate,
  type EbsReview,
} from "./ebsReview";
import { LogForm } from "./forms";

const dotted = (date: string) => date.replaceAll("-", ".");
function ReviewLabel({ review }: { review: EbsReview }) {
  return (
    <div className="ebs-review-copy">
      <h3>{review.course.title}</h3>
      <p>
        발행일 {dotted(review.contentDate)} · 학습일{" "}
        {dotted(review.learnedDate)}
      </p>
      <small>복습 예정일 {dotted(review.dueDate)}</small>
    </div>
  );
}

export function EbsReviewPanel({ compact = false }: { compact?: boolean }) {
  const { data, update } = useData();
  const today = useLocalDate();
  const [editing, setEditing] = useState<StudyLog | null>(null);
  const [notice, setNotice] = useState("");
  const [limit, setLimit] = useState(8);
  const reviews = ebsReviews(data, today);
  const pending = reviews.filter((r) => r.dueDate <= today && !r.completion);
  const overdue = pending.filter((r) => r.dueDate < today).length;
  const completed = reviews.filter((r) => r.completion?.date === today);
  const upcoming = reviews.filter(
    (r) => r.dueDate === nextEbsReviewDate(today) && !r.completion,
  );
  if (!ebsCourses(data.materials).length) return null;
  if (compact) {
    if (!pending.length && !upcoming.length && !completed.length) return null;
    return (
      <Link to="/english/ebs" className="ebs-review-reminder">
        <RotateCcw size={21} aria-hidden="true" />
        <div>
          <strong>
            EBS 오디오어학당 ·{" "}
            {pending.length
              ? `복습할 회차 ${pending.length}개`
              : "다음 날 복습"}
          </strong>
          <p>
            {overdue ? `놓친 복습 ${overdue}개 포함 · ` : ""}오늘 복습 완료{" "}
            {completed.length}개 · 내일 예정 {upcoming.length}개
          </p>
        </div>
        <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <section className="ebs-review-panel" aria-label="EBS 다음 날 복습">
      <header className="ebs-review-heading">
        <div>
          <p className="eyebrow">NEXT DAY REVIEW · {dotted(today)}</p>
          <h2>오늘 복습할 오디오어학당</h2>
          <p>실제 학습일의 다음 날에 복습해요. 놓친 복습도 함께 표시합니다.</p>
        </div>
        <span className="status-pill">
          미완료 {pending.length}개{overdue ? ` · 지난 복습 ${overdue}개` : ""}
        </span>
      </header>
      {pending.length ? (
        <ul className="ebs-review-list" aria-label="복습할 회차">
          {pending.slice(0, limit).map((review) => (
            <li key={review.sourceIds[0]}>
              <ReviewLabel review={review} />
              <div className="ebs-review-actions">
                <button
                  className="primary-button"
                  onClick={() => {
                    const date = localDate(),
                      id = newId();
                    update((d) =>
                      recordEbsReview(d, review.sourceIds[0], date, id),
                    );
                    setNotice(
                      `${review.course.title} · ${dotted(date)} 복습 완료 · 시간은 필요할 때 입력하세요.`,
                    );
                  }}
                >
                  복습 완료하기
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ebs-review-empty">
          지금 복습할 회차가 없습니다. 학습을 기록하면 다음 날 여기에
          표시됩니다.
        </p>
      )}
      {pending.length > limit && (
        <button className="text-link" onClick={() => setLimit((n) => n + 8)}>
          복습 목록 더 보기 ({pending.length - limit}개)
        </button>
      )}
      {completed.length > 0 && (
        <details className="ebs-review-details" open>
          <summary>오늘 복습 완료 {completed.length}개</summary>
          <ul className="ebs-review-list" aria-label="오늘 복습 완료 회차">
            {completed.map((review) => {
              const log = review.completion!;
              return (
                <li key={review.sourceIds[0]}>
                  <ReviewLabel review={review} />
                  <div className="ebs-review-actions">
                    <span className="ebs-review-done">
                      <Check size={15} aria-hidden="true" />
                      복습 완료 ·{" "}
                      {log.minutes === null
                        ? "시간 미입력"
                        : `${log.minutes}분`}
                    </span>
                    <div className="ebs-review-secondary">
                      <button
                        className="text-link"
                        onClick={() => setEditing(log)}
                      >
                        {log.minutes === null ? "시간 입력" : "기록 수정"}
                      </button>
                      {log.reviewOf && (
                        <button
                          className="text-link"
                          onClick={() => {
                            update((d) => cancelEbsReview(d, log.id));
                            setNotice(
                              `${review.course.title} · 복습 취소 · 해당 복습시간은 집계에서 제외됩니다.`,
                            );
                          }}
                        >
                          복습 취소
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <details className="ebs-review-details">
        <summary>내일 복습 예정 {upcoming.length}개</summary>
        {upcoming.length ? (
          <ul className="ebs-review-list">
            {upcoming.map((review) => (
              <li key={review.sourceIds[0]}>
                <ReviewLabel review={review} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="micro-note">
            오늘 실제로 학습한 회차가 생기면 표시됩니다.
          </p>
        )}
      </details>
      <p className="micro-note">
        복습시간은 선택 입력입니다. 미입력도 복습 완료로 저장되며, 시간 합계에는
        포함되지 않습니다.
      </p>
      <p className="ebs-review-notice" role="status" aria-live="polite">
        {notice}
      </p>
      {editing && (
        <LogForm
          value={editing}
          lockMaterial
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
