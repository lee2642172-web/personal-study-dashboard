import type { DashboardData } from "./model.ts";
import { progress } from "./model.ts";
import { getDayBook, dayRoundTotal, isDayBook } from "./dayLearning.ts";
import { isEbsCourse } from "./ebs.ts";

/** Read-only view: each material retains its own unit, round and saved learning position. */
export function englishMaterialProgress(data: DashboardData) {
  return data.materials
    .filter((m) => m.area === "english" && !isEbsCourse(m))
    .map((material) => {
      const tracked = ["units", "days", "book", "lectures"].includes(
        material.kind,
      );
      const book = isDayBook(material) ? getDayBook(data, material) : null;
      const valid = data.logs.filter(
        (log) =>
          log.materialId === material.id &&
          !log.voided &&
          log.activity !== "system" &&
          !log.initialLearning &&
          /^\d+$/.test(log.item) &&
          Number.isSafeInteger(Number(log.item)) &&
          Number(log.item) >= 1 &&
          (material.total === null || Number(log.item) <= material.total),
      );
      const round =
        book?.activeRound ?? Math.max(1, ...valid.map((log) => log.round));
      const total = tracked
        ? book
          ? dayRoundTotal(book, round)
          : material.total
        : null;
      const scoped = valid.filter(
        (log) =>
          log.round === round && (total === null || Number(log.item) <= total),
      );
      const counted = scoped.map((log) => ({
        ...log,
        item: String(Number(log.item)),
      }));
      const done = total
        ? progress({ ...material, total }, counted, round).count
        : tracked
          ? new Set(
              counted.filter((log) => log.completed).map((log) => log.item),
            ).size
          : 0;
      const latest = [...scoped]
        .reverse()
        .filter((log) => log.completed)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
      return {
        material,
        round,
        total,
        done,
        percent: total ? (done / total) * 100 : null,
        unit:
          material.kind === "units"
            ? "Units"
            : material.kind === "days"
              ? "Days"
              : material.kind === "lectures"
                ? "강"
                : "페이지",
        position:
          book?.rounds.find((r) => r.round === round)?.lastOpenedDay ?? null,
        hasRecords: scoped.length > 0,
        latest,
        dayBook: !!book,
        initialCount: data.logs.filter(
          (log) =>
            log.materialId === material.id &&
            log.initialLearning &&
            log.completed &&
            !log.voided &&
            log.activity !== "system",
        ).length,
      };
    });
}
