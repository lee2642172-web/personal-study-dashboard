import { Link, useNavigate, useParams } from "react-router-dom";
import { isDateString, shiftDate, calendarWeekdays } from "./dates";
import { personalPeriod } from "./personalPeriods";
import { useLocalDate } from "./useLocalDate";
import { PageHeading } from "./ui";
import { QuickActivity } from "./QuickActivity";
import { Records } from "./pages";
import "./dayPage.css";

export function DayPage() {
  const { date = "" } = useParams();
  const today = useLocalDate();
  const navigate = useNavigate();
  if (!isDateString(date))
    return (
      <div className="dashboard-empty">
        올바른 날짜가 아닙니다. <Link to="/">HOME으로</Link>
      </div>
    );
  const period = personalPeriod(date);
  const weekday =
    calendarWeekdays[(new Date(date + "T12:00Z").getUTCDay() + 6) % 7];
  return (
    <div className="daily-page">
      <PageHeading
        eyebrow="DAILY RECORD"
        title={`${date.replaceAll("-", ".")} (${weekday})`}
        description={`${period.label} · ${period.week}주째 · ${period.day}일째`}
        action={
          <Link className="text-link" to="/">
            학습 상황판 →
          </Link>
        }
      />
      <nav className="daily-date-nav" aria-label="하루 기록 날짜 이동">
        <Link className="secondary-button" to={`/days/${shiftDate(date, -1)}`}>
          이전 날
        </Link>
        <label>
          <span className="sr-only">하루 기록 날짜</span>
          <input
            type="date"
            aria-label="하루 기록 날짜"
            value={date}
            max={today}
            onChange={(e) => {
              if (isDateString(e.target.value) && e.target.value <= today)
                navigate(`/days/${e.target.value}`);
            }}
          />
        </label>
        <Link className="text-link" to={`/days/${today}`}>
          오늘
        </Link>
        {date < today && (
          <Link className="secondary-button" to={`/days/${shiftDate(date, 1)}`}>
            다음 날
          </Link>
        )}
      </nav>
      {date <= today ? (
        <section className="dashboard-panel daily-quick-record">
          <h2>이 날짜에 기록 추가</h2>
          <QuickActivity key={date} recordDate={date} />
        </section>
      ) : (
        <p className="dashboard-empty">아직 기록할 수 없는 미래 날짜입니다.</p>
      )}
      <Records key={date} day={date} />
    </div>
  );
}
