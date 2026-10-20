import { createCostManagementAccounting } from "./catalogs/costManagementAccounting.ts";
import { createCustomsLawIntro } from "./catalogs/customsLawIntro.ts";
import { createDomesticConsumptionTax } from "./catalogs/domesticConsumptionTax.ts";
import { createCustomsTradeEnglish } from "./catalogs/customsTradeEnglish.ts";
import {
  type DashboardData,
  type Material,
  type StudyLog,
  episodes,
} from "./model.ts";
const material = (
  id: string,
  title: string,
  config: Partial<Material>,
): Material => ({
  id,
  title,
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
  ...config,
});
export function createInitialData(): DashboardData {
  const materials: Material[] = [
    ...["Start English", "Easy English", "Power English"].map((title, i) =>
      material(`ebs-${i}`, title, {
        kind: "audio",
        groupId: "ebs-audio",
        status: "학습 중",
        schedule: i === 2 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
        startDate: "2026-04-01",
        duration: 18,
        routine: "출근길 청취",
        note: `EBS 오디오어학당 · ${i === 2 ? "월~토" : "월~금"} 발행 · 약 18분. 2026년 4월호부터 순서대로. 4월 7일 회차까지 청취(실제 청취 날짜·시간 미입력). 발행일은 요일 기준 계획이며 휴방·실제 편성은 미확인.`,
      }),
    ),
    material("basic", "Basic Grammar in Use", {
      kind: "units",
      status: "학습 중",
      total: 113,
      targetPasses: 10,
      routine: "퇴근길 예문 오디오 · 하루 약 4~6 Units",
      note: "미국 영어판 · Unit별 약 15~20개 예문. 현재 1회독 Unit 6까지 청취. 실제 날짜·시간 미입력. 목표 이후에도 회독을 계속 기록할 수 있습니다.",
    }),
    material("intermediate", "Intermediate Grammar in Use", {
      kind: "units",
      total: 142,
      targetPasses: 10,
      note: "Basic 목표 회독 이후 시작 예정 · 목표 이후에도 추가 회독 가능.",
    }),
    material("vocabulary", "일반 영어 단어장", {
      kind: "days",
      status: "보류",
      total: 303,
      targetPasses: 1,
      routine: "예문 중심 복습 · 하루 약 1 Day 계획",
      note: "Excel · Day 1~303 · 약 3,030개 단어 보유(학습 진도 아님). 기존 순서·Day 번호 유지. 다의어를 의미 2~3개 단위(term, term_2, term_3)로 분리하고 Day별 예문량 조정 후 Day 1부터 1회독 예정.",
    }),
    material("phrases", "구동사·표현 단어장", {
      kind: "days",
      total: 35,
      routine: "Day별 예문 복습",
      note: "Excel · 구동사, 숙어, 관용 표현, 회화 구문. 별도 정비 없이 복습 가능. 실제 학습 기록 미입력.",
    }),
    material("patterns", "영어 패턴 자료", {
      total: 200,
      note: "Excel · 약 200개 · 활용 여부 미정.",
    }),
    material("dialogues", "영어 회화문 자료", {
      total: 200,
      note: "Excel · 약 200개 · 핵심 회화 문장 및 관련 대화문.",
    }),
    material("academy", "영어 회화 학원 교재", {
      status: "보류",
      note: "go, get, take 등 기초동사 중심. 과거 약 4개월 수강 및 1회 학습(세부 날짜·시간 미입력). 2026년 11월 토요반 재수강 고려.",
    }),
    createCustomsTradeEnglish(),
    createDomesticConsumptionTax(),
    createCustomsLawIntro(),
    createCostManagementAccounting(),
    material("reverse-grammar", "거꾸로 읽는 영문법", {
      kind: "book",
      note: "일반 도서 · 독서용 자료. 전체 페이지 수 입력 후 페이지별 진도 기록 가능.",
    }),
  ];
  const logs: StudyLog[] = [];
  const reported = (materialId: string, item: string): StudyLog => ({
    id: `reported-${materialId}-${item}`,
    area: "english",
    materialId,
    item,
    round: 1,
    date: null,
    minutes: null,
    activity: "study",
    note: "사용자 제공 완료 이력 · 실제 학습 날짜와 시간은 미입력",
    topic: "",
    writing: "",
    speaking: "",
    origin: "reported",
    completed: true,
  });
  for (const m of materials.filter((m) => m.kind === "audio"))
    for (const date of episodes(m, "2026-04").filter(
      (date) => date <= "2026-04-07",
    ))
      logs.push(reported(m.id, date));
  for (let unit = 1; unit <= 6; unit++)
    logs.push(reported("basic", String(unit)));
  return {
    version: 1,
    materials,
    logs,
    goals: [
      {
        id: "opic",
        area: "english",
        title: "OPIc",
        target: "AL",
        current: "IM2",
        status: "진행 중",
        targetDate: "",
        acquiredDate: "",
        expiresOn: "",
        recognized: "인정",
        prerequisiteId: "",
        prerequisiteGrade: "",
      },
      {
        id: "toefl",
        area: "english",
        title: "TOEFL iBT",
        target: "",
        current: "",
        status: "계획",
        targetDate: "",
        acquiredDate: "",
        expiresOn: "",
        recognized: "미인정",
        prerequisiteId: "",
        prerequisiteGrade: "",
      },
      {
        id: "opi",
        area: "english",
        title: "OPI",
        target: "AM",
        current: "",
        status: "장기 목표",
        targetDate: "",
        acquiredDate: "",
        expiresOn: "",
        recognized: "인정",
        prerequisiteId: "",
        prerequisiteGrade: "",
      },
    ],
    tasks: [
      {
        id: "vocabulary-cleanup",
        title: "영어 단어장 정비",
        area: "english",
        kind: "프로젝트",
        status: "예정",
        note: "실제 단어 복습과 별도로 관리합니다. 기존 단어 순서와 Day 번호를 유지합니다.",
        items: [
          {
            id: "meanings",
            title: "다의어 분리 · term / term_2 / term_3",
            done: false,
          },
          { id: "balance", title: "Day별 예문량 조정", done: false },
          { id: "format", title: "엑셀 양식 정리", done: false },
        ],
      },
    ],
  };
}
