import type { DashboardData, VocabularyBook } from "./model.ts";
import { ensureDayBook } from "./dayLearning.ts";
import { dayEvidence, validVocabulary } from "./vocabulary.ts";

export function vocabularyDayMaterial(
  data: DashboardData,
  book: VocabularyBook,
) {
  return data.materials.find(
    (m) =>
      m.id === book.materialId && m.area === book.area && m.kind === "days",
  );
}

/** Only the selected Day book is evidence. Reference word counts and planned work are not Days. */
export function registeredVocabularyLastDay(
  data: DashboardData,
  book: VocabularyBook,
): number | null {
  const material = vocabularyDayMaterial(data, book);
  if (!material) return null;
  return Math.max(
    0,
    book.baselineLastDay ?? 0,
    dayEvidence(data, material.id),
    ...book.entries.filter((e) => e.status === "imported").map((e) => e.day!),
  );
}

function resizeVocabularyDayRange(
  data: DashboardData,
  materialId: string,
  lastDay: number,
) {
  const material = data.materials.find((m) => m.id === materialId)!;
  const previousScope = Math.max(
    material.total ?? 0,
    data.dayBooks?.find((b) => b.materialId === materialId)?.totalDays ?? 0,
  );
  // Establish the old scope before expansion, including completed rounds restored from legacy logs.
  let next: DashboardData = {
    ...data,
    materials: data.materials.map((m) =>
      m.id === materialId ? { ...m, total: previousScope || null } : m,
    ),
  };
  next = ensureDayBook(next, materialId);
  next = {
    ...next,
    materials: next.materials.map((m) =>
      m.id === materialId ? { ...m, total: lastDay || null } : m,
    ),
  };
  return ensureDayBook(next, materialId);
}

/** Reconcile older range metadata without changing actual logs, archives or round positions. */
export function normalizeVocabularyDayRanges(
  data: DashboardData,
): DashboardData {
  let next = data;
  for (const book of data.vocabularies ?? []) {
    const material = vocabularyDayMaterial(next, book),
      last = registeredVocabularyLastDay(next, book);
    if (
      material &&
      last !== null &&
      last > 0 &&
      last <= 10000 &&
      material.total !== last
    )
      next = resizeVocabularyDayRange(next, material.id, last);
  }
  return next;
}

/** Number-only growth: never create words, study logs or preparation records. */
export function extendVocabularyDays(
  data: DashboardData,
  bookId: string,
  lastDay: number,
  expectedLastDay?: number,
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === bookId);
  if (!book) return data;
  const material = vocabularyDayMaterial(data, book),
    current = registeredVocabularyLastDay(data, book);
  if (
    !material ||
    current === null ||
    !Number.isInteger(lastDay) ||
    lastDay <= current ||
    lastDay > 10000 ||
    (expectedLastDay !== undefined && expectedLastDay !== current)
  )
    return data;
  return resizeVocabularyDayRange(data, material.id, lastDay);
}

/** Resolve an unlinked legacy book without changing any source, sheet or learning history. */
export function selectVocabularyDayMaterial(
  data: DashboardData,
  bookId: string,
  materialId: string,
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === bookId);
  const material = data.materials.find(
    (m) => m.id === materialId && m.area === book?.area && m.kind === "days",
  );
  if (!book || !material || vocabularyDayMaterial(data, book)) return data;
  const last = Math.max(
    book.baselineLastDay ?? 0,
    dayEvidence(data, material.id),
    ...book.entries.filter((e) => e.status === "imported").map((e) => e.day!),
  );
  const updated = {
    ...book,
    materialId,
    materialIds: [...new Set([...book.materialIds, materialId])],
  };
  if (!validVocabulary(updated) || last > 10000) return data;
  const next: DashboardData = {
    ...data,
    vocabularies: data.vocabularies!.map((b) =>
      b.id === book.id ? updated : b,
    ),
    materials: data.materials.map((m) =>
      m.id === materialId ? { ...m, vocabularyId: book.id } : m,
    ),
  };
  return resizeVocabularyDayRange(next, materialId, last);
}
