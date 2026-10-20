import { type DashboardData, type Lecture, type Material } from "../model.ts";

export const CUSTOMS_TRADE_ENGLISH_ID = "customs-trade-english-theory";
/** User-provided curriculum. Durations are exclusively the parenthesized course lengths. */
const rows: [string, number][] = [
  ["[이론] PART_1 Ch.1 국제무역 (p.8)", 56],
  ["[이론] PART_1 Ch.4 계약의 성립 - 청약과 승낙 (p.14)", 65],
  [
    "[이론] PART_1 Ch.4 계약의 성립 - 청약과 승낙 (p.18) / [협약] CISG (p.14)",
    66,
  ],
  ["[협약] 01. CISG (p.16)", 46],
  ["[이론] PART_1 Ch.5 계약의 증빙 - 계약서 (p.22)", 61],
  ["[이론] PART_2 Ch.1 무역거래의 기본 조건 (p.34)", 55],
  ["[이론] PART_2 Ch.1 무역거래의 기본 조건 (p.39)", 45],
  ["[이론] PART_2 Ch.1 무역거래의 기본 조건 (p.42)", 46],
  ["[이론] PART_2 Ch.2 정형거래 조건 (p.44)", 53],
  ["[이론] PART_2 Ch.3 INCOTERMS (p.47)", 59],
  ["[이론] PART_2 Ch.3 INCOTERMS (p.51) / [협약] INCOTERMS 2020 (p.94)", 67],
  ["[협약] INCOTERMS 2020 (p.97)", 54],
  ["[협약] 02. INCOTERMS 2020 (p.101)", 51],
  ["[협약] 02. INCOTERMS 2020 (p.103)", 48],
  ["[협약] 02. INCOTERMS 2020 (p.114)", 49],
  ["[협약] 02. INCOTERMS 2020 (p.105)", 53],
  ["[이론] PART_3 국제운송 (p.59)", 45],
  ["[이론] PART_3 Ch.1 해상운송 (p.63)", 54],
  ["[이론] PART_3 Ch.1 해상운송 (p.69)", 50],
  ["[이론] PART_3 Ch.3 기타운송 (p.73)", 52],
  ["[이론] PART_3 Ch.4 운송서류 (p.77)", 46],
  ["[이론] PART_3 Ch.5 운송서류 이외의 무역서류 (p.82)", 39],
  ["[협약] 03. Hague Rules (p.117)", 54],
  ["[협약] 03. Hague Rules (p.123)", 53],
  ["[협약] 04. Hamburg Rules (p.143)", 41],
  ["[협약] 05. CMI (p.173)", 53],
  ["[협약] 07. Montreal 협약 (p.213)", 57],
  ["[이론] PART_4 Ch.1 무신용장 결제 방식(p.92)", 49],
  ["[이론] PART_4 Ch.1 무신용장 결제 방식 (p.94)", 49],
  ["[이론] PART_4 Ch.1 무신용장 결제 방식 (p.97)", 58],
  ["[협약] 08. URC 522 제5조 (p.259)", 57],
  ["[협약] 08. URC 522 제11조 (p.264)", 73],
  ["[이론] PART_4 Ch.2 신용장거래 (p.100)", 61],
  ["[이론] PART_4 Ch.2 신용장거래 (p.105)", 57],
  ["[이론] PART_4 Ch.2 신용장거래 (p.108)", 62],
  ["[협약] 09. UCP 600 제3조 (p.278)", 51],
  ["[협약] 09. UCP 600 제7조 (p.281)", 61],
  ["[협약] 09. UCP 600 제10조 (p.286)", 52],
  ["[협약] 09. UCP 600 제14조 (p.291)", 55],
  ["[협약] 09. UCP 600 제17조 (p.295)", 55],
  ["[협약] 09. UCP 600 제21조 (p.302)", 45],
  ["[협약] 09. UCP 600 제28조 (p.312)", 59],
  ["[협약] 09. UCP 600 제31조 (p.316)", 66],
  ["[협약] 09. UCP 600 제38조 (p.323)", 64],
  ["[이론] PART_4 Ch.3 기타 방식의 결제 (p.114)", 50],
  ["[이론] PART_4 Ch.3 기타 방식의 결제 (p.120)", 53],
  ["[협약] 11. MIA (p.341)", 65],
  ["[협약] 11. MIA 33조 (p.357)", 60],
  ["[협약] 11. MIA 61조 (p.370)", 56],
  ["[협약] 12. ICC 2009 (p.397)", 69],
  ["[협약] 02. INCOTERMS 2020 (p.61)", 57],
  ["[협약] 02. INCOTERMS 2020 (p.72)", 61],
  ["[협약] 02. INCOTERMS 2020 (p.81)", 68],
  ["[이론] PART_6 무역계약의 종료와 클레임 (p.131)", 54],
  ["[협약] 01. CISG 7조 (p.11)", 68],
  ["[협약] 01. CISG 33조 (p.22)", 54],
  ["[협약] 01. CISG 41조 (p.26)", 50],
  ["[협약] 01. CISG 49조 (p.31)", 57],
  ["[협약] 01. CISG 66조 (p.40)", 62],
  ["[협약] 01. CISG 81조 (p.47) * 완강입니다.", 82],
];
export function createCustomsTradeEnglish(): Material {
  const lectures: Lecture[] = rows.map(([title, duration], index) => ({
    number: index + 1,
    title,
    duration,
  }));
  return {
    id: CUSTOMS_TRADE_ENGLISH_ID,
    title: "무역영어 이론·협약",
    area: "customs",
    kind: "lectures",
    status: "보관 중",
    total: lectures.length,
    targetPasses: null,
    lectures,
    schedule: [],
    startDate: "",
    duration: null,
    routine: "관세사 · 무역영어 강의",
    note: "사용자 제공 60강 목록을 모두 미수강으로 등록했습니다. 강의 길이는 괄호 안 분량만 반영했으며 실제 학습시간과 별도로 관리합니다.",
  };
}
/** Additive catalog update; never replaces the user's material settings or learning history. */
export function includeCustomsTradeEnglish(data: DashboardData): DashboardData {
  if (data.materials.some((m) => m.id === CUSTOMS_TRADE_ENGLISH_ID))
    return data;
  return {
    ...data,
    materials: [...data.materials, createCustomsTradeEnglish()],
  };
}
