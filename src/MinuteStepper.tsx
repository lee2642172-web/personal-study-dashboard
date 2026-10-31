import { ChevronUp, ChevronDown } from "lucide-react";
import { shiftTodoMinutes } from "./timeUnits";

export function MinuteStepper({
  value,
  onChange,
  label,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
}) {
  return (
    <div className="minute-stepper">
      <label className="minute-stepper-input">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          aria-label={label}
          min="0"
          step="1"
          inputMode="numeric"
          value={value}
          placeholder="0"
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(shiftTodoMinutes(value, e.key === "ArrowUp" ? 1 : -1));
            }
          }}
        />
        <span aria-hidden="true">분</span>
      </label>
      <div className="minute-stepper-arrows">
        <button
          type="button"
          aria-label={`${label} 5분 늘리기`}
          title="5분 늘리기"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(shiftTodoMinutes(value, 1))}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          aria-label={`${label} 5분 줄이기`}
          title="5분 줄이기"
          disabled={Number(value) === 0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(shiftTodoMinutes(value, -1))}
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
