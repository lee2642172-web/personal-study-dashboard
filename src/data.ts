export type Metric = {
  label: string;
  done?: number;
  total?: number;
  unit?: string;
  note?: string;
  status?: string;
};
export type Area = {
  id: string;
  name: string;
  title: string;
  goal: string;
  color: string;
  status: string;
  metrics: Metric[];
};
export const subjects: Metric[] = [
  { label: "무역영어", done: 12, total: 60, unit: "강", status: "FOCUS" },
  {
    label: "회계",
    done: 8,
    total: 125,
    unit: "강",
    status: "MAINTAIN",
    note: "전체 125강은 임시 예상값 · 현재 114강 공개",
  },
  { label: "내국소비세법", done: 0, total: 38, unit: "강", status: "NEXT" },
  { label: "관세법", done: 0, total: 98, unit: "강", status: "NEXT" },
  { label: "원가관리회계", done: 0, total: 33, unit: "강", status: "NEXT" },
  { label: "FTA특례법", done: 0, total: 6, unit: "강", status: "NEXT" },
];
export const languages: Area[] = [
  {
    id: "chinese",
    name: "CHINESE",
    title: "중국어",
    goal: "HSK 6급을 향한 다음 단계",
    color: "coral",
    status: "LIGHT / NEXT",
    metrics: [
      {
        label: "HSK 1~5급 DB",
        done: 2500,
        total: 2500,
        unit: "단어",
        note: "자료 정리 완료 · 학습 완료와 별개",
      },
      {
        label: "HSK 6급 DB",
        note: "추가 2,500단어 보유 · 예문 및 형식 정비 필요",
      },
      { label: "HSK 6급 학습", note: "기록 전 · 목표 HSK 6급" },
    ],
  },
  {
    id: "japanese",
    name: "JAPANESE",
    title: "일본어",
    goal: "가나부터, 차근차근",
    color: "purple",
    status: "LIGHT",
    metrics: [
      { label: "히라가나 / 가타카나", note: "기록 전" },
      { label: "기초 어휘와 문법", note: "기존 학습 DB 없음" },
      { label: "JLPT 단계", note: "N5 → N4 → N3 → N2 → N1" },
      { label: "공용한자 연결", note: "한중일 공용한자 808과 함께 학습" },
    ],
  },
  {
    id: "spanish",
    name: "SPANISH",
    title: "스페인어",
    goal: "쌓아온 기반을 오래 유지하기",
    color: "amber",
    status: "PARKED",
    metrics: [
      {
        label: "Vocabulary",
        note: "Day 450 · 약 4,500단어 자료 보유 · 학습 진도 미입력",
      },
      { label: "Expressions", note: "표현·구문 시트 보유" },
      { label: "추가 어휘 자료", note: "약 5,113개 · 중복 포함 가능" },
      {
        label: "DELE 목표",
        note: "A2 취득 → B1 → B2 · 현재 학습 보류 / 초저강도 유지",
      },
    ],
  },
  {
    id: "hanzi",
    name: "SHARED HANZI",
    title: "공용한자",
    goal: "세 언어를 이어주는 808개의 연결",
    color: "teal",
    status: "LIGHT",
    metrics: [
      {
        label: "한중일 공용한자 808",
        done: 100,
        total: 808,
        unit: "자",
        note: "UI 테스트용 가상 학습량",
      },
      { label: "한자 DB", note: "구상 단계 · 중국어·일본어 연계" },
    ],
  },
];
export const areas: Area[] = [
  {
    id: "career",
    name: "CAREER",
    title: "커리어",
    goal: "글로벌 물류 · 해상수출 포워딩 전문성",
    color: "teal",
    status: "ACTIVE",
    metrics: [
      "해상수출2파트 업무 적응",
      "포워딩 실무 지식",
      "Shipping Process · 해상수출 업무 프로세스",
      "Incoterms",
      "B/L · 선적서류 / Documentation",
      "Customs & Filing · AMS, AFR, ENS",
      "Business Communication · 업무 영문 소통",
    ].map((label) => ({ label, note: "진행량 미입력 · 실무와 연결해 학습" })),
  },
  {
    id: "english",
    name: "ENGLISH",
    title: "영어",
    goal: "문장으로 연결되는 실전 영어",
    color: "blue",
    status: "PRIORITY",
    metrics: [
      {
        label: "Vocabulary · DB 정비",
        done: 1820,
        total: 3030,
        unit: "개",
        note: "Day 303 · 총 3,030개 표제어 자료 규모",
      },
      {
        label: "Vocabulary · 실제 예문 학습",
        done: 360,
        total: 3030,
        unit: "개",
        note: "가상 학습량 · DB 정비와 별도로 집계",
      },
      { label: "Phrasal Verbs", note: "Day 35 자료 보유 · 학습 진도 미입력" },
      ...[
        "Patterns",
        "Chunks / Expressions",
        "Listening",
        "Speaking",
        "English Diary",
        "Business English",
        "Grammar in Use 예문 학습",
      ].map((label) => ({ label, note: "기록 전" })),
    ],
  },
  {
    id: "customs",
    name: "CUSTOMS",
    title: "관세사",
    goal: "관세사 자격 취득 · 무역 전문성 확보",
    color: "purple",
    status: "FOCUS",
    metrics: subjects,
  },
  {
    id: "languages",
    name: "LANGUAGES",
    title: "외국어",
    goal: "언어가 넓히는 나의 가능성",
    color: "coral",
    status: "AT MY PACE",
    metrics: [],
  },
  {
    id: "system",
    name: "SYSTEM",
    title: "학습 시스템",
    goal: "배움에 집중할 수 있는 나만의 기반",
    color: "amber",
    status: "IN PROGRESS",
    metrics: [
      {
        label: "영어 단어장 Excel 정비",
        done: 1820,
        total: 3030,
        unit: "개",
        note: "진행 중 · 의미 구분 및 예문 구조 정리",
      },
      { label: "영어 Day별 학습량 재배치", note: "설계 중" },
      { label: "iPad 친화형 Excel 자동 변환", note: "검토 중" },
      { label: "HSK6 어휘 DB 정비", note: "대기 · 예문 및 형식 정비" },
      { label: "스페인어 DB 유지 및 정비", note: "유지 중" },
      { label: "공용한자 DB 구상", note: "구상 중" },
      {
        label: "개인 학습 대시보드 개발",
        note: "시제품 v1 · 디자인 및 화면 이동 검증",
      },
    ],
  },
];
export const initialTasks = [
  {
    id: "trade",
    label: "무역영어 강의 1강",
    detail: "관세사 · 오늘의 우선순위",
    minutes: 40,
    type: "study",
    done: true,
  },
  {
    id: "sentence",
    label: "영어 문장 학습",
    detail: "영어 · 단어를 문장으로 연결하기",
    minutes: 20,
    type: "study",
    done: false,
  },
  {
    id: "accounting",
    label: "회계 강의",
    detail: "관세사 · 꾸준히 감각 유지하기",
    minutes: 35,
    type: "study",
    done: false,
  },
  {
    id: "listening",
    label: "영어 Listening",
    detail: "영어 · 짧게 듣고 따라 말하기",
    minutes: 15,
    type: "study",
    done: false,
  },
  {
    id: "database",
    label: "영어 예문 DB 정리",
    detail: "시스템 · 의미 구분 및 예문 구조 정비",
    minutes: 20,
    type: "system",
    done: false,
  },
];
export const week = [
  { day: "월", study: 45, review: 15, system: 20 },
  { day: "화", study: 65, review: 10, system: 0 },
  { day: "수", study: 30, review: 20, system: 25 },
  { day: "목", study: 80, review: 15, system: 15 },
  { day: "금", study: 50, review: 10, system: 30 },
  { day: "토", study: 40, review: 0, system: 0 },
  { day: "일", study: 0, review: 0, system: 0 },
];
