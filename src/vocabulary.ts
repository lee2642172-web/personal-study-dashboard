import {
  type DashboardData,
  type Material,
  type VocabularyBook,
  type VocabularyEntry,
  type VocabularySheet,
  type Task,
} from "./model.ts";
import { ensureDayBook } from "./dayLearning.ts";
export const vocabularyPolicy = {
  chinese: {
    title: "중국어 HSK 단어장",
    existing: 2500,
    incoming: 2500,
    lastDay: null,
    task: "HSK 6급 단어 정리",
  },
  spanish: {
    title: "스페인어 단어장",
    existing: 4500,
    incoming: 5113,
    lastDay: 450,
    task: "미정리 단어 DB 구축",
  },
} as const;
export const vocabularyId = (area: "chinese" | "spanish") =>
  `vocabulary-${area}`;
const positive = (n: unknown): n is number =>
  Number.isInteger(n) && Number(n) > 0 && Number(n) <= 10000;
const nonnegative = (n: unknown): n is number =>
  Number.isSafeInteger(n) && Number(n) >= 0;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function dayEvidence(data: DashboardData, materialId: string) {
  const material = data.materials.find((m) => m.id === materialId);
  const numbered = data.logs
    .filter((l) => l.materialId === materialId && /^\d+$/.test(l.item))
    .map((l) => Number(l.item))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  return Math.max(
    material?.total ?? 0,
    data.dayBooks?.find((b) => b.materialId === materialId)?.totalDays ?? 0,
    0,
    ...numbered,
  );
}
export function vocabularyEvidence(data: DashboardData, book: VocabularyBook) {
  return Math.max(
    0,
    ...data.materials
      .filter(
        (m) =>
          m.kind === "days" &&
          (m.id === book.materialId || book.materialIds.includes(m.id)),
      )
      .map((m) => dayEvidence(data, m.id)),
  );
}
/** Metadata only: never invent words, completed Days, grade boundaries or learning records. */
export function includeVocabularies(data: DashboardData): DashboardData {
  let result = data;
  for (const area of ["chinese", "spanish"] as const) {
    const id = vocabularyId(area);
    if (result.vocabularies?.some((b) => b.id === id || b.area === area))
      continue;
    const policy = vocabularyPolicy[area];
    let candidates = result.materials.filter(
      (m) =>
        m.area === area &&
        (m.kind === "days" || /단어|어휘|HSK|vocab|词|palabra/i.test(m.title)),
    );
    if (!candidates.length) {
      let materialId = `${area}-vocabulary`;
      while (result.materials.some((m) => m.id === materialId))
        materialId += "-book";
      const m: Material = {
        id: materialId,
        title: policy.title,
        area,
        kind: "days",
        status: "보관 중",
        total: policy.lastDay,
        targetPasses: null,
        note:
          area === "spanish"
            ? "사용자 제공 기존 범위 Day 1~450 · 약 4,500개. 실제 단어 원본·학습 진도는 미입력. 신규 단어는 기존 마지막 Day 뒤에 편입합니다."
            : "사용자 제공 HSK 1~5급 약 2,500개. 실제 마지막 Day·급수별 시트 범위·원본은 미확인. 단어 수로 Day를 추정하지 않습니다.",
        routine: "기존 단어장 · 정리와 학습 별도",
        schedule: [],
        startDate: "",
        duration: null,
      };
      result = { ...result, materials: [...result.materials, m] };
      candidates = [m];
    }
    const days = candidates.filter((m) => m.kind === "days");
    const material = days.length === 1 ? days[0] : undefined;
    const baseline =
      material?.total && dayEvidence(result, material.id) === material.total
        ? material.total
        : null;
    const sheets: VocabularySheet[] =
      area === "chinese"
        ? Array.from({ length: 6 }, (_, i) => ({
            id: `hsk-${i + 1}`,
            title: `HSK ${i + 1}급`,
            materialId: "",
            startDay: null,
            endDay: null,
          }))
        : [
            {
              id: "spanish",
              title: "스페인어 단어장",
              materialId: material?.id ?? "",
              startDay: baseline ? 1 : null,
              endDay: baseline,
            },
          ];
    const book: VocabularyBook = {
      id,
      area,
      materialId: material?.id ?? "",
      materialIds: candidates.map((m) => m.id),
      baselineLastDay: baseline,
      existingWordEstimate: policy.existing,
      incomingWordEstimate: policy.incoming,
      wordsPerDay: 10,
      sheets,
      taskId: "",
      entries: [],
    };
    const related = prepTaskCandidates(result, book);
    if (related.length === 1) book.taskId = related[0].id;
    result = {
      ...result,
      materials: result.materials.map((m) =>
        m.id === material?.id ? { ...m, vocabularyId: id } : m,
      ),
      vocabularies: [...(result.vocabularies ?? []), book],
    };
  }
  return result;
}
export function validVocabulary(v: unknown): v is VocabularyBook {
  if (
    !object(v) ||
    !["id", "area", "materialId", "taskId"].every(
      (k) => typeof v[k] === "string",
    ) ||
    !["chinese", "spanish"].includes(String(v.area)) ||
    v.wordsPerDay !== 10 ||
    !(v.baselineLastDay === null || positive(v.baselineLastDay)) ||
    !nonnegative(v.existingWordEstimate) ||
    !nonnegative(v.incomingWordEstimate) ||
    !Array.isArray(v.materialIds) ||
    !v.materialIds.every((s) => typeof s === "string") ||
    !Array.isArray(v.sheets) ||
    !Array.isArray(v.entries)
  )
    return false;
  const b = v as VocabularyBook;
  if (
    !b.sheets.length ||
    !b.sheets.every(
      (s) =>
        object(s) &&
        typeof s.id === "string" &&
        !!s.id &&
        typeof s.title === "string" &&
        !!s.title.trim() &&
        typeof s.materialId === "string" &&
        (s.startDay === null || positive(s.startDay)) &&
        (s.endDay === null || positive(s.endDay)) &&
        ((s.startDay === null && s.endDay === null) ||
          (s.startDay !== null &&
            s.endDay !== null &&
            s.startDay <= s.endDay &&
            b.baselineLastDay !== null &&
            s.endDay <= b.baselineLastDay)),
    ) ||
    new Set(b.sheets.map((s) => s.id)).size !== b.sheets.length
  )
    return false;
  const ranges = b.sheets
    .filter((s) => s.startDay !== null)
    .sort((a, b) => a.startDay! - b.startDay!);
  if (ranges.some((s, i) => i > 0 && s.startDay! <= ranges[i - 1].endDay!))
    return false;
  if (
    !b.entries.every(
      (e) =>
        object(e) &&
        (["id", "sheetId", "term", "meaning", "note", "status"] as const).every(
          (k) => typeof e[k] === "string",
        ) &&
        !!e.id &&
        !!e.term.trim() &&
        b.sheets.some((s) => s.id === e.sheetId) &&
        ["pending", "ready", "excluded", "imported", "reference"].includes(
          e.status,
        ) &&
        (e.status === "imported"
          ? positive(e.day) &&
            positive(e.position) &&
            e.position <= 10 &&
            b.baselineLastDay !== null &&
            e.day > b.baselineLastDay
          : e.day === null && e.position === null),
    ) ||
    new Set(b.entries.map((e) => e.id)).size !== b.entries.length
  )
    return false;
  const imported = b.entries.filter((e) => e.status === "imported");
  if (
    new Set(imported.map((e) => `${e.day}:${e.position}`)).size !==
    imported.length
  )
    return false;
  const days = new Map<number, { count: number; sheet: string }>();
  for (const word of imported) {
    const day = days.get(word.day!);
    if (day) {
      if (day.sheet !== word.sheetId) return false;
      day.count++;
    } else days.set(word.day!, { count: 1, sheet: word.sheetId });
  }
  if ([...days.values()].some((d) => d.count !== 10)) return false;
  return true;
}
const replaceBook = (
  data: DashboardData,
  book: VocabularyBook,
): DashboardData => ({
  ...data,
  vocabularies: data.vocabularies!.map((b) => (b.id === book.id ? book : b)),
});
export function configureVocabulary(
  data: DashboardData,
  id: string,
  config: Pick<
    VocabularyBook,
    | "materialId"
    | "baselineLastDay"
    | "existingWordEstimate"
    | "incomingWordEstimate"
    | "sheets"
  >,
): DashboardData {
  const old = data.vocabularies?.find((b) => b.id === id);
  if (!old) return data;
  const material = data.materials.find(
    (m) =>
      m.id === config.materialId && m.area === old.area && m.kind === "days",
  );
  if (!material) return data;
  const imported = old.entries.some((e) => e.status === "imported");
  if (
    imported &&
    (old.materialId !== config.materialId ||
      old.baselineLastDay !== config.baselineLastDay)
  )
    return data;
  const book = {
    ...old,
    ...config,
    materialIds: [
      ...new Set([
        material.id,
        ...config.sheets.map((s) => s.materialId).filter(Boolean),
      ]),
    ],
  };
  if (
    !imported &&
    config.baselineLastDay !== null &&
    config.baselineLastDay < vocabularyEvidence(data, book)
  )
    return data;
  if (!validVocabulary(book)) return data;
  let next = replaceBook(data, book);
  next = {
    ...next,
    materials: next.materials.map((m) => {
      if (m.id === material.id)
        return {
          ...m,
          vocabularyId: id,
          total: Math.max(m.total ?? 0, config.baselineLastDay ?? 0) || null,
        };
      if (m.vocabularyId === id) {
        const { vocabularyId: _, ...rest } = m;
        return rest;
      }
      return m;
    }),
  };
  return next;
}
export const normalizeTerm = (term: string) =>
  term.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
export function vocabularyDuplicateIndex(book: VocabularyBook) {
  const index = new Map<string, VocabularyEntry[]>();
  for (const e of book.entries) {
    if (e.status === "excluded") continue;
    const key = normalizeTerm(e.term);
    const group = index.get(key);
    if (group) group.push(e);
    else index.set(key, [e]);
  }
  return index;
}
export function duplicateCandidates(
  book: VocabularyBook,
  entry: VocabularyEntry,
  index = vocabularyDuplicateIndex(book),
) {
  return (index.get(normalizeTerm(entry.term)) ?? []).filter(
    (e) => e.id !== entry.id,
  );
}
export function parseVocabularyText(
  text: string,
): { term: string; meaning: string; note: string }[] {
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split("\t");
      return {
        term: parts[0].trim(),
        meaning: (parts[1] ?? "").trim(),
        note: parts.slice(2).join("\t").trim(),
      };
    });
  if (
    rows[0] &&
    /^(단어|word|term|palabra|词语|單詞|单词)$/i.test(rows[0].term) &&
    /^(뜻|meaning|definition|significado|释义|解釋)$/i.test(rows[0].meaning)
  )
    rows.shift();
  return rows.filter((r) => r.term);
}
export function addVocabularyEntries(
  data: DashboardData,
  id: string,
  rows: ReturnType<typeof parseVocabularyText>,
  sheetId: string,
  reference: boolean,
  ids: string[],
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === id);
  if (
    !book ||
    !book.sheets.some((s) => s.id === sheetId) ||
    !rows.length ||
    rows.length !== ids.length ||
    rows.some((r) => !r.term.trim()) ||
    ids.some((i) => !i || book.entries.some((e) => e.id === i)) ||
    new Set(ids).size !== ids.length
  )
    return data;
  const entries: VocabularyEntry[] = rows.map((row, i) => ({
    ...row,
    id: ids[i],
    sheetId,
    status: reference ? "reference" : "pending",
    day: null,
    position: null,
  }));
  const keys = new Set(entries.map((e) => normalizeTerm(e.term)));
  return replaceBook(data, {
    ...book,
    entries: [
      ...book.entries.map((e) =>
        e.status === "ready" && keys.has(normalizeTerm(e.term))
          ? { ...e, status: "pending" as const }
          : e,
      ),
      ...entries,
    ],
  });
}
export function editVocabularyEntry(
  data: DashboardData,
  id: string,
  entry: VocabularyEntry,
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === id),
    old = book?.entries.find((e) => e.id === entry.id);
  if (!book || !old) return data;
  const updated = {
    ...old,
    term: entry.term.trim(),
    meaning: entry.meaning,
    note: entry.note,
    ...(old.status === "imported"
      ? {}
      : {
          sheetId: entry.sheetId,
          status:
            old.status === "reference"
              ? ("reference" as const)
              : ("pending" as const),
        }),
  };
  const next = {
    ...book,
    entries: book.entries.map((e) =>
      e.id === old.id
        ? updated
        : e.status === "ready" &&
            normalizeTerm(e.term) === normalizeTerm(updated.term)
          ? { ...e, status: "pending" as const }
          : e,
    ),
  };
  return validVocabulary(next) ? replaceBook(data, next) : data;
}
export function setVocabularyReview(
  data: DashboardData,
  id: string,
  entryIds: string[],
  status: "pending" | "ready" | "excluded",
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === id);
  if (!book) return data;
  const ids = new Set(entryIds);
  return replaceBook(data, {
    ...book,
    entries: book.entries.map((e) =>
      ids.has(e.id) && !["reference", "imported"].includes(e.status)
        ? { ...e, status }
        : e,
    ),
  });
}
export function deleteVocabularyEntry(
  data: DashboardData,
  id: string,
  entryId: string,
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === id);
  if (
    !book ||
    !book.entries.some((e) => e.id === entryId && e.status !== "imported")
  )
    return data;
  return replaceBook(data, {
    ...book,
    entries: book.entries.filter((e) => e.id !== entryId),
  });
}
export function vocabularyPlan(data: DashboardData, book: VocabularyBook) {
  const batches = book.sheets.map((sheet) => ({
    sheet,
    entries: book.entries.filter(
      (e) => e.sheetId === sheet.id && e.status === "ready",
    ),
  }));
  const days = batches.reduce(
    (n, b) => n + Math.floor(b.entries.length / 10),
    0,
  );
  const last =
    book.baselineLastDay === null || !book.materialId
      ? null
      : Math.max(
          book.baselineLastDay,
          vocabularyEvidence(data, book),
          0,
          ...book.entries
            .filter((e) => e.status === "imported")
            .map((e) => e.day!),
        );
  return {
    batches,
    days,
    last,
    next: last === null ? null : last + 1,
    words: days * 10,
  };
}
/** Append only complete ten-word Days. Never create study logs or task work counts. */
export function appendVocabularyDays(
  data: DashboardData,
  id: string,
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === id);
  if (!book) return data;
  const plan = vocabularyPlan(data, book),
    material = data.materials.find(
      (m) =>
        m.id === book.materialId && m.kind === "days" && m.area === book.area,
    );
  if (
    !material ||
    plan.last === null ||
    !plan.days ||
    plan.last + plan.days > 10000
  )
    return data;
  const initialized = material.total ? ensureDayBook(data, material.id) : data;
  const positions = new Map<string, { day: number; position: number }>();
  let next = plan.last;
  for (const batch of plan.batches)
    for (let i = 0; i < Math.floor(batch.entries.length / 10) * 10; i++) {
      if (i % 10 === 0) next++;
      positions.set(batch.entries[i].id, { day: next, position: (i % 10) + 1 });
    }
  const updated = replaceBook(initialized, {
    ...book,
    entries: book.entries.map((e) =>
      positions.has(e.id)
        ? { ...e, ...positions.get(e.id)!, status: "imported" }
        : e,
    ),
  });
  const expanded = {
    ...updated,
    materials: updated.materials.map((m) =>
      m.id === material.id ? { ...m, total: next } : m,
    ),
  };
  return ensureDayBook(expanded, material.id);
}
export function prepTaskCandidates(data: DashboardData, book: VocabularyBook) {
  return data.tasks.filter(
    (t) =>
      t.area === book.area &&
      (t.id === book.taskId ||
        (book.materialId &&
          t.tracking?.materialId === book.materialId &&
          /정리|DB|구축|편입|검토|인덱스/i.test(t.title)) ||
        (book.area === "chinese"
          ? /HSK\s*6.*(정리|구축)/i.test(t.title)
          : /(미정리|단어).*(DB|정리|구축)/i.test(t.title))),
  );
}
export function connectVocabularyTask(
  data: DashboardData,
  id: string,
  selectedId?: string,
): DashboardData {
  const book = data.vocabularies?.find((b) => b.id === id);
  if (!book) return data;
  const candidates = prepTaskCandidates(data, book);
  let task = selectedId
    ? data.tasks.find((t) => t.id === selectedId && t.area === book.area)
    : (data.tasks.find((t) => t.id === book.taskId) ??
      (candidates.length === 1 ? candidates[0] : undefined));
  if (!task && candidates.length) return data;
  if (selectedId && !task) return data;
  let next = data;
  if (!task) {
    let taskId = `${book.area}-vocabulary-preparation`;
    while (next.tasks.some((t) => t.id === taskId)) taskId += "-task";
    task = {
      id: taskId,
      title: vocabularyPolicy[book.area].task,
      area: book.area,
      kind: "프로젝트",
      status: "예정",
      items: [],
      note: "사용자 제공 추가 정리 대상의 예상 수량입니다. 실제 작업 이력으로 진행률을 기록하며 단어 학습 진도와 분리합니다.",
      tracking: {
        mode: "quantity",
        total: book.incomingWordEstimate || null,
        unit: "단어",
        materialId: book.materialId,
      },
    };
    next = { ...next, tasks: [...next.tasks, task] };
  } else if (task.tracking) {
    const tracking = {
      ...task.tracking,
      ...(!task.tracking.materialId && book.materialId
        ? { materialId: book.materialId }
        : {}),
      ...(task.tracking.mode === "quantity" &&
      task.tracking.total == null &&
      book.incomingWordEstimate
        ? { total: book.incomingWordEstimate }
        : {}),
    };
    next = {
      ...next,
      tasks: next.tasks.map((t) =>
        t.id === task!.id ? { ...t, tracking } : t,
      ),
    };
  }
  return replaceBook(next, { ...book, taskId: task.id });
}
