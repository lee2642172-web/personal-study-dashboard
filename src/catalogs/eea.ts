import type { DashboardData, Material } from "../model.ts";

export const EEA_READING_ID = "eea-reading";
const volumes = [
  [EEA_READING_ID, "낭독편"],
  ["eea-survival", "서바이벌편"],
  ["eea-idioms", "이디엄편"],
] as const;

export const isEeaMaterial = (material: Material) =>
  material.area === "english" && volumes.some(([id]) => id === material.id);

export function createEeaMaterials(): Material[] {
  return volumes.map(([id, volume]) => ({
    id,
    title: `EEA: English for Everyday Activities · ${volume}`,
    area: "english",
    groupId: "eea",
    kind: "days",
    status: id === EEA_READING_ID ? "학습 중" : "보관 중",
    total: id === EEA_READING_ID ? 50 : null,
    targetPasses: null,
    routine:
      id === EEA_READING_ID
        ? "Day별 낭독 · 회독 학습"
        : "낭독편부터 시작 · 이후 학습 예정",
    note:
      id === EEA_READING_ID
        ? "낭독편 Day 1~50. 실제 학습 날짜·시간·완료 여부는 기록한 내용만 반영합니다. 회독 횟수 제한 없음."
        : `${volume}은 시작 전입니다. 전체 Day 수와 학습 진도는 아직 입력되지 않았습니다.`,
    schedule: [],
    startDate: "",
    duration: null,
  }));
}

/** Add once; preserve all user changes and previously recorded learning. */
export function includeEea(data: DashboardData): DashboardData {
  const missing = createEeaMaterials().filter(
    (m) => !data.materials.some((existing) => existing.id === m.id),
  );
  return missing.length
    ? { ...data, materials: [...data.materials, ...missing] }
    : data;
}
