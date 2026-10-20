import { type DashboardData, type Material } from "../model.ts";

export const COST_MANAGEMENT_ACCOUNTING_ID =
  "customs-cost-management-accounting";
/** User-provided titles and parenthesized lengths, in the original lecture order. */
const rows: [string, number][] = [
  ["OT", 31],
  ["원가회계의 기초개념 (p820~824)", 43],
  ["제조원가 흐름 (p825~829)", 41],
  ["제조간접원가 (p829~838)", 31],
  ["개별원가계산 (p842~847)", 47],
  ["보조부문 (p847~853)", 42],
  ["개별원가계산 객관식 문제(p855~858)", 18],
  ["활동기준원가계산 (p862~868)", 42],
  ["활동기준원가계산 객관식 문제 (p869~878)", 37],
  ["완성품환산량 (p879~889)", 46],
  ["공손품 (p889~893)", 31],
  ["감손 (p893~902)", 45],
  ["결합원가계산 (p908~915)", 42],
  ["결합원가배분 (p915~926)", 37],
  ["결합원가계산 객관식 문제 (p927~928)", 16],
  ["정상원가계산 (p933~942)", 36],
  ["표준원가계산 (p942~950)", 25],
  ["원가차이분석 (p950~959)", 43],
  ["변동원가계산1 (p964~967)", 24],
  ["변동원가계산2 (p966~973)", 31],
  ["전부/변동/초변동원가계산 (p973~980)", 27],
  ["전부/변동/초변동원가계산 객관식 문제 (p981~998)", 59],
  ["원가함수추청 객관식 문제 (p999~1014)", 45],
  ["확장모형 (p1014~1023)", 41],
  ["안전한계 (p1024~1036)", 45],
  ["관련원가분석 (p1040~1045)", 28],
  ["특별주문수락 (p1045~1055)", 38],
  ["의사결정방법 (p1056~1064)", 31],
  ["대체가격결정 (p1071~1085)", 42],
  ["자본예산 (p1088~1111)", 51],
  ["종합예산 객관식 문제 (p1118~1134)", 49],
  ["책임회계제도 (p1134~1167)", 42],
  ["전략적 원가관리 (p1173~1191) *완강입니다.", 29],
];
export function createCostManagementAccounting(): Material {
  return {
    id: COST_MANAGEMENT_ACCOUNTING_ID,
    title: "원가관리회계",
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
    routine: "관세사 · 원가관리회계 강의",
    note: "사용자 제공 33강을 모두 미수강으로 등록했습니다. 괄호 안 강의 길이를 사용하며, 수강 완료 시 기본 학습시간으로 기록됩니다. 시간은 수정할 수 있습니다.",
  };
}
export function includeCostManagementAccounting(
  data: DashboardData,
): DashboardData {
  if (data.materials.some((m) => m.id === COST_MANAGEMENT_ACCOUNTING_ID))
    return data;
  return {
    ...data,
    materials: [...data.materials, createCostManagementAccounting()],
  };
}
