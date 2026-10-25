export const fields = [
  { id: "english", title: "영어", category: "languages", main: true },
  { id: "chinese", title: "중국어", category: "languages", main: false },
  { id: "japanese", title: "일본어", category: "languages", main: false },
  { id: "spanish", title: "스페인어", category: "languages", main: false },
  { id: "customs", title: "관세사", category: "certifications", main: true },
  {
    id: "trade-english",
    title: "무역영어 1급",
    category: "certifications",
    main: false,
  },
  {
    id: "origin-manager",
    title: "원산지관리사",
    category: "certifications",
    main: false,
  },
  {
    id: "bonded-specialist",
    title: "보세사",
    category: "certifications",
    main: false,
  },
  { id: "computer", title: "컴활", category: "certifications", main: false },
] as const;
export type FieldId = (typeof fields)[number]["id"];
export type MaterialStatus = "보관 중" | "학습 중" | "보류" | "완료";
export const materialStatuses: MaterialStatus[] = [
  "보관 중",
  "학습 중",
  "보류",
  "완료",
];
export type Lecture = {
  number: number;
  title: string;
  duration: number;
};
export type Material = {
  id: string;
  title: string;
  area: FieldId;
  groupId?: string;
  kind: "audio" | "units" | "days" | "reference" | "book" | "lectures";
  lectures?: Lecture[];
  /** Ongoing catalogs show the registered count rather than a final course total. */
  lectureCatalogStatus?: "ongoing" | "complete";
  status: MaterialStatus;
  total: number | null;
  targetPasses: number | null;
  note: string;
  routine: string;
  schedule: number[];
  startDate: string;
  duration: number | null;
};
export type StudyLog = {
  id: string;
  area: FieldId;
  materialId: string;
  /** EBS publication date; legacy records retain the same value in item. */
  contentDate?: string;
  /** EBS next-day review: ID of the actual listening record being reviewed. */
  reviewOf?: string;
  item: string;
  round: number;
  date: string | null;
  minutes: number | null;
  activity: "study" | "review" | "system";
  /** Explicit first learning of a Day; time counts, review-round progress does not. */
  initialLearning?: boolean;
  note: string;
  topic: string;
  writing: string;
  speaking: string;
  origin: "reported" | "entered";
  completed: boolean;
  /** Cancelled completion retained for undo; excluded from active time totals. */
  voided?: boolean;
};
export type Goal = {
  id: string;
  area: FieldId;
  title: string;
  target: string;
  current: string;
  status: "계획" | "진행 중" | "장기 목표" | "취득";
  targetDate: string;
  acquiredDate: string;
  expiresOn: string;
  recognized: "인정" | "미인정" | "확인 필요";
  prerequisiteId: string;
  prerequisiteGrade: string;
};
export type Task = {
  id: string;
  title: string;
  area: FieldId;
  kind: "자유 과업" | "프로젝트";
  status: "예정" | "진행 중" | "보류" | "완료";
  items: TaskStep[];
  note: string;
  targetDate?: string;
  tracking?: TaskTracking;
  records?: TaskWorkRecord[];
};
export type TaskStep = {
  id: string;
  title: string;
  done: boolean;
  note?: string;
  completedDate?: string;
};
export type TaskTracking = {
  mode: "day-range" | "quantity" | "rounds" | "steps";
  dayStart?: number;
  dayEnd?: number | null;
  total?: number | null;
  unit?: string;
  subject?: string;
  roundTarget?: number | null;
  materialId?: string;
};
export type TaskWorkRecord = { id: string; date: string; note: string } & (
  | { mode: "day-range"; startDay: number; endDay: number }
  | { mode: "quantity"; quantity: number }
  | { mode: "rounds" }
);
export type DayRoundState = {
  round: number;
  /** Frozen scope of a completed round when more Days are appended. */
  totalDays?: number;
  nextDay: number | null;
  lastOpenedDay: number;
  lastReviewId?: string;
};
export type DayBookState = {
  materialId: string;
  totalDays: number;
  activeRound: number;
  rounds: DayRoundState[];
};
export type DashboardData = {
  version: 1;
  events?: CalendarEvent[];
  dayBooks?: DayBookState[];
  materials: Material[];
  logs: StudyLog[];
  goals: Goal[];
  tasks: Task[];
};
export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  category: "시험" | "시험 접수" | "성적 발표" | "학습" | "기타";
  registrationPhase: "" | "start" | "deadline";
  note: string;
  area: FieldId | "";
  goalId: string;
};
export const newId = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
export const fieldName = (id: string) =>
  fields.find((f) => f.id === id)?.title ?? id;
export function episodes(material: Material, month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  if (!year || mon < 1 || mon > 12) return [];
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  ).filter(
    (date) =>
      date >= material.startDate &&
      material.schedule.includes(new Date(`${date}T12:00:00Z`).getUTCDay()),
  );
}
export function unitItems(material: Material): string[] {
  return Array.from({ length: material.total ?? 0 }, (_, i) => String(i + 1));
}
export function progress(material: Material, logs: StudyLog[], round = 1) {
  const entries = logs.filter(
    (l) =>
      l.materialId === material.id &&
      l.activity !== "system" &&
      !l.initialLearning,
  );
  const count = new Set(
    entries
      .filter(
        (l) =>
          l.completed &&
          !l.voided &&
          l.round === round &&
          (!["days", "lectures"].includes(material.kind) ||
            Number.isInteger(Number(l.item))) &&
          Number(l.item) >= 1 &&
          Number(l.item) <= (material.total ?? 0),
      )
      .map((l) =>
        ["days", "lectures"].includes(material.kind)
          ? String(Number(l.item))
          : l.item,
      ),
  ).size;
  return {
    count,
    entries,
    total: material.total,
    percent:
      material.total && entries.some((l) => l.round === round)
        ? Math.min(100, (count / material.total) * 100)
        : null,
  };
}
export function completedRounds(
  material: Material,
  logs: StudyLog[],
  rounds?: DayRoundState[],
) {
  if (!material.total || material.kind === "audio") return 0;
  return [
    ...new Set(
      logs.filter((l) => l.materialId === material.id).map((l) => l.round),
    ),
  ].filter((round) => {
    const total = Math.min(
      material.total!,
      rounds?.find((r) => r.round === round)?.totalDays ?? material.total!,
    );
    return progress({ ...material, total }, logs, round).count >= total;
  }).length;
}
export const companyExams: Record<string, string[]> = {
  english: ["OPIc", "OPI"],
  chinese: ["新BCT", "OPI"],
  japanese: ["SJPT", "OPI"],
  spanish: ["OPI"],
};
