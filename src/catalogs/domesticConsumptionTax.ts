import { type DashboardData, type Material } from "../model.ts";

export const DOMESTIC_CONSUMPTION_TAX_ID = "customs-domestic-consumption-tax";
/** User-provided course lengths from parentheses; all lectures start unstudied. */
const rows: [string, number][] = [
  ["OT + 부가가치세 입문", 38],
  ["부가가치세 과세요건 + [PART1] 부가가치세법 Ch.1 총칙 (p.10)", 61],
  ["Ch.1 납세의무자 (p.14)", 47],
  ["Ch.1 납세의무자 - 수탁자 (p.16)", 40],
  ["Ch.1 개념 완성 기출문제 (p.30)", 48],
  ["Ch.1 사업자등록 (p.20)", 46],
  ["Ch.1 개념 완성 기출문제 (p.36)", 51],
  ["Ch.1 납세지 (p.27)", 48],
  ["Ch.2 과세거래와 거래시기 (p.44)", 35],
  ["Ch.2 재화의 공급 - 법률상 원인 (p.48)", 41],
  ["Ch.2 재화의 공급 - 간주공급 (p.49)", 18],
  ["Ch.2 재화의 공급으로 보지 않는 것 (p.53)", 53],
  ["Ch.2 재화의 수입 (p.59)", 64],
  ["Ch.2 부수재화 또는 용역 (p.60)", 30],
  ["Ch.2 공급시기와 공급장소 (p.63)", 52],
  ["Ch.2 공급시기 특례 (p.67)", 48],
  ["Ch.3 영세율과 면세 (p.88)", 52],
  ["Ch.3 수출재화 임가공용역 (p.94)", 39],
  ["Ch.3 면세 (p.96)", 58],
  ["Ch.3 면세 개념 완성 기출문제 (p.113)", 45],
  ["Ch.5 세금계산서 개념 완성 기출문제 (p.144)", 42],
  ["세금계산서 기출문제 (p.144)", 58],
  ["Ch.6 특수한 경우의 과세표준 (p.154)", 54],
  ["Ch.6 과세표준 계산의 특례 (p.162)", 53],
  ["Ch.6 과세표준 개념 완성 기출문제 30번 (p.182)", 35],
  ["Ch.6 대손세액공제 (p.165)", 52],
  ["Ch.7 개념 완성 기출문제 (p.195)", 39],
  ["Ch.7 재계산 (p.192)", 49],
  ["Ch.8 공급받은 사업자의 가산세 (p.213)", 68],
  ["Ch.9 개념 완성 기출문제 (p.231)", 62],
  ["Ch.10 재고납부세액과 재고매입세액 (p.253)", 44],
  ["Ch.4 거래징수 (p.120)", 59],
  ["[PART2] 개별소비세법 Ch.1 개관 (p.274)", 58],
  ["Ch.3 납세의무자 (p.292)", 49],
  ["Ch.4 미납세 반출 (p.308)", 66],
  ["Ch.5 개념 완성 기출문제 (p.326)", 36],
  ["[PART3] 주세법 Ch.1 총칙 (p.356)", 24],
  ["Ch.2 주세의 부과, 징수 (p.365) * 완강입니다.", 59],
];
export function createDomesticConsumptionTax(): Material {
  return {
    id: DOMESTIC_CONSUMPTION_TAX_ID,
    title: "내국소비세법",
    area: "customs",
    kind: "lectures",
    status: "보관 중",
    total: rows.length,
    targetPasses: null,
    lectures: rows.map(([title, duration], index) => ({
      number: index + 1,
      title,
      duration,
    })),
    schedule: [],
    startDate: "",
    duration: null,
    routine: "관세사 · 내국소비세법 강의",
    note: "사용자 제공 38강을 모두 미수강으로 등록했습니다. 강의 길이는 괄호 안 분량만 반영했습니다. 수강 완료 시 해당 길이를 기본 학습시간으로 기록하며 수정할 수 있습니다.",
  };
}
export function includeDomesticConsumptionTax(
  data: DashboardData,
): DashboardData {
  if (data.materials.some((m) => m.id === DOMESTIC_CONSUMPTION_TAX_ID))
    return data;
  return {
    ...data,
    materials: [...data.materials, createDomesticConsumptionTax()],
  };
}
