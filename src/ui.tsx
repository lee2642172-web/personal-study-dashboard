import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { fields, type FieldId } from "./model";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="v1-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Section({
  title,
  tag,
  children,
  link,
}: {
  title: string;
  tag?: string;
  children: ReactNode;
  link?: string;
}) {
  return (
    <section className="v1-section">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {tag && <span>{tag}</span>}
        </div>
        {link && (
          <Link className="text-link" to={link}>
            전체 보기 <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="v1-empty">{children}</div>;
}
export function Progress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  return (
    <div className="progress-wrap">
      <div className="progress-caption">
        <span>
          {label} · {done} / {total}
        </span>
        <strong>{Number(percent.toFixed(1))}%</strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Number(percent.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="v1-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="닫기"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function FieldSelect({
  value,
  onChange,
}: {
  value: FieldId;
  onChange: (value: FieldId) => void;
}) {
  return (
    <label>
      분야
      <select
        aria-label="분야"
        value={value}
        onChange={(e) => onChange(e.target.value as FieldId)}
      >
        {fields.map((field) => (
          <option key={field.id} value={field.id}>
            {field.title}
          </option>
        ))}
      </select>
    </label>
  );
}
export const ActivityLabels = {
  study: "학습",
  review: "복습",
  system: "자료 정비",
};
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="stat">
      <div className="stat-label">{label}</div>
      <p>
        <strong>{value}</strong>
      </p>
      <small>{note}</small>
    </article>
  );
}
