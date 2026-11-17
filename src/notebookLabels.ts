import type { ActivityEntry } from "./activities.ts";
import type { Material } from "./model.ts";
import { isEbsCourse } from "./ebs.ts";
import { isDateString } from "./dates.ts";

/** Compact notebook labels only; the original title and record stay untouched. */
export function notebookLabel(
  entry: ActivityEntry,
  materials: Material[],
): string {
  if (entry.source === "study") {
    const log = entry.log;
    const material = materials.find((m) => m.id === log.materialId);
    if (material && isEbsCourse(material)) {
      const date = log.contentDate || log.item;
      if (isDateString(date))
        return `EBS 어학당 ${Number(date.slice(5, 7))}/${Number(date.slice(-2))}${log.reviewOf || log.activity === "review" ? " 복습" : ""}`;
    }
    if (material?.kind === "lectures") {
      const subject = material.title
        .replace(/\s*이론[·ㆍ]?협약\s*/g, "")
        .trim();
      return `${material.area === "customs" ? "관세사 " : ""}${subject} ${log.item}강`;
    }
    if (material?.id === "basic") return `Basic GIU U${log.item}`;
    if (material?.id === "intermediate") return `Intermediate GIU U${log.item}`;
    if (material?.groupId === "eea") {
      const volume =
        material.id === "eea-reading"
          ? "낭독"
          : material.id === "eea-survival"
            ? "서바이벌"
            : "이디엄";
      return `EEA ${volume} D${log.item}`;
    }
    if (material?.kind === "days")
      return `${material.title.replace("일반 영어 단어장", "영단어").replace("구동사·표현 단어장", "구동사")} D${log.item}`;
  }
  const title = entry.title;
  const vocabulary = title.match(/영단어\s+D(\d+)\s+재정리/);
  if (vocabulary) return `영단어 D${vocabulary[1]} 정리`;
  return title
    .replace("한자 학습 관련 대시보드 작성", "한자 대시보드 작성")
    .replace("영어 회화 학원 탐색", "회화 학원 탐색")
    .replace(/파고다.*비즈니스 기초 영어 회화반/, "파고다 회화 수업");
}
