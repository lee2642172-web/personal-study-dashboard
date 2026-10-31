import type { DashboardData, SyncChange, SyncState } from "./model.ts";
import { createInitialData } from "./initialData.ts";
import {
  isDayBook,
  getDayBook,
  nextUnfinished,
  dayRoundTotal,
} from "./dayLearning.ts";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const has = (v: object, key: string) =>
  Object.prototype.hasOwnProperty.call(v, key);
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    object(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .filter((k) => item[k] !== undefined)
            .map((k) => [k, item[k]]),
        )
      : item,
  );
}
export const equalData = (a: unknown, b: unknown) =>
  stableStringify(a) === stableStringify(b);
export function plainData(
  data: DashboardData,
): Omit<DashboardData, "syncState"> {
  const { syncState: _state, ...rest } = data;
  return rest;
}
const compare = (a: SyncChange, b: SyncChange) =>
  a.n - b.n || (a.actor > b.actor ? 1 : a.actor < b.actor ? -1 : 0);
const emptyMark: SyncChange = { n: -1, actor: "" };
const identity = (path: string[]) =>
  path.at(-1) === "dayBooks"
    ? "materialId"
    : path.at(-1) === "rounds"
      ? "round"
      : path.at(-1) === "lectures"
        ? "number"
        : [
              "materials",
              "logs",
              "goals",
              "tasks",
              "todos",
              "events",
              "vocabularies",
              "items",
              "records",
              "sheets",
              "entries",
            ].includes(path.at(-1) ?? "")
          ? "id"
          : null;
function changeDiff(
  before: unknown,
  after: unknown,
  path: string[],
  stamp: Pick<SyncChange, "n" | "actor">,
  target: Record<string, SyncChange>,
) {
  if (equalData(before, after)) return;
  const key = JSON.stringify(path);
  if (after === undefined) {
    const id = identity(path);
    if (Array.isArray(before) && id) {
      target[key] = { ...stamp, array: true };
      for (const entry of before.filter(object))
        changeDiff(
          entry,
          undefined,
          [...path, "@" + String(entry[id])],
          stamp,
          target,
        );
      return;
    }
    target[key] = { ...stamp, deleted: true };
    return;
  }
  const id = identity(path);
  if (Array.isArray(after) && id) {
    if (!Array.isArray(before)) target[key] = { ...stamp, array: true };
    const old = new Map(
      (Array.isArray(before) ? before : [])
        .filter(object)
        .map((v) => [String(v[id]), v]),
    );
    const next = new Map(after.filter(object).map((v) => [String(v[id]), v]));
    for (const item of new Set([...old.keys(), ...next.keys()]))
      changeDiff(
        old.get(item),
        next.get(item),
        [...path, "@" + item],
        stamp,
        target,
      );
  } else if (
    object(after) &&
    before === undefined &&
    ["materialId", "round"].includes(identity(path.slice(0, -1)) ?? "") &&
    !target[key]?.deleted
  ) {
    target[key] = { ...stamp, object: true };
    for (const field of Object.keys(after))
      changeDiff(undefined, after[field], [...path, field], stamp, target);
  } else if (
    object(before) &&
    object(after) &&
    !["kind", "mode"].some(
      (k) =>
        before[k] !== after[k] &&
        before[k] !== undefined &&
        after[k] !== undefined,
    )
  ) {
    for (const field of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]))
      changeDiff(before[field], after[field], [...path, field], stamp, target);
  } else target[key] = { ...stamp, value: structuredClone(after) };
}
function maxClock(state: SyncState) {
  return Object.values(state.changes).reduce(
    (n, change) => Math.max(n, change.n),
    0,
  );
}
function joinChanges(
  a: Record<string, SyncChange>,
  b: Record<string, SyncChange>,
  dayMaterials: Set<string>,
) {
  const result: Record<string, SyncChange> = Object.fromEntries(
    Object.entries(a),
  );
  for (const [path, change] of Object.entries(b)) {
    const previous = result[path];
    const segments = JSON.parse(path) as string[];
    const monotonic =
      (segments[0] === "dayBooks" && segments.at(-1) === "totalDays") ||
      (segments[0] === "materials" &&
        segments.at(-1) === "total" &&
        dayMaterials.has(segments[1]?.slice(1)));
    if (
      previous &&
      monotonic &&
      typeof previous.value === "number" &&
      typeof change.value === "number"
    ) {
      const newer = compare(change, previous) > 0 ? change : previous;
      result[path] = {
        ...newer,
        value: Math.max(previous.value, change.value),
      };
    } else if (
      !previous ||
      compare(change, previous) > 0 ||
      (compare(change, previous) === 0 &&
        stableStringify(change) > stableStringify(previous))
    )
      result[path] = change;
  }
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0)),
  );
}
type Node = { change?: SyncChange; children: Map<string, Node> };
export function renderDocument(state: SyncState): DashboardData {
  const root: Node = { children: new Map() };
  for (const [encoded, change] of Object.entries(state.changes)) {
    let node = root;
    for (const part of JSON.parse(encoded) as string[]) {
      let next = node.children.get(part);
      if (!next) {
        next = { children: new Map() };
        node.children.set(part, next);
      }
      node = next;
    }
    node.change = change;
  }
  function read(
    original: unknown,
    node: Node | undefined,
    path: string[],
    barrier: SyncChange = emptyMark,
  ): unknown {
    const change =
      node?.change && compare(node.change, barrier) >= 0
        ? node.change
        : undefined;
    if (change?.deleted) return undefined;
    const value = change?.array
      ? []
      : change?.object
        ? {}
        : change && has(change, "value")
          ? change.value
          : original;
    const childBarrier =
      change && has(change, "value") && object(change.value) ? change : barrier;
    const id = identity(path);
    if ((Array.isArray(value) || change?.array) && id) {
      const array = Array.isArray(value) ? value : [];
      const originalById = new Map(
        array.filter(object).map((v) => ["@" + String(v[id]), v]),
      );
      const keys = [
        ...new Set([...originalById.keys(), ...(node?.children.keys() ?? [])]),
      ];
      const index = new Map([...originalById.keys()].map((key, i) => [key, i]));
      keys.sort((a, b) => {
        if (id === "round" || id === "number")
          return Number(a.slice(1)) - Number(b.slice(1));
        if (index.has(a) || index.has(b))
          return (
            (index.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (index.get(b) ?? Number.MAX_SAFE_INTEGER)
          );
        const cmp = compare(
          node?.children.get(a)?.change ?? emptyMark,
          node?.children.get(b)?.change ?? emptyMark,
        );
        return cmp || (a > b ? 1 : a < b ? -1 : 0);
      });
      return keys
        .map((key) =>
          read(
            originalById.get(key),
            node?.children.get(key),
            [...path, key],
            barrier,
          ),
        )
        .filter((v) => v !== undefined);
    }
    if (object(value) || (value === undefined && node?.children.size)) {
      const base = object(value) ? value : {};
      const keys = new Set([
        ...Object.keys(base),
        ...(node?.children.keys() ?? []),
      ]);
      return Object.fromEntries(
        [...keys]
          .map((key) => [
            key,
            read(
              base[key],
              node?.children.get(key),
              [...path, key],
              childBarrier,
            ),
          ])
          .filter(([, v]) => v !== undefined),
      );
    }
    return value;
  }
  const data = read(state.seed, root, []) as DashboardData;
  // Progress pointers are derived from merged records, not independently summed.
  if (data.dayBooks) {
    data.dayBooks = data.dayBooks.map((stored) => {
      const material = data.materials.find((m) => m.id === stored.materialId);
      if (!material || !isDayBook(material)) return stored;
      const highestLog = Math.max(
        0,
        ...data.logs
          .filter(
            (l) =>
              l.materialId === material.id && !l.voided && /^\d+$/.test(l.item),
          )
          .map((l) => Number(l.item)),
      );
      material.total = Math.max(
        material.total ?? 1,
        stored.totalDays,
        highestLog,
      );
      const book = getDayBook(data, material);
      const rounds = book.rounds.map((round) => {
        const next = {
          ...round,
          nextDay: nextUnfinished(
            data.logs,
            material.id,
            round.round,
            dayRoundTotal(book, round.round),
          ),
          lastOpenedDay: Math.min(
            material.total ?? 1,
            Math.max(1, round.lastOpenedDay),
          ),
        };
        if (
          next.lastReviewId &&
          !data.logs.some((l) => l.id === next.lastReviewId && !l.voided)
        )
          delete next.lastReviewId;
        return next;
      });
      return {
        ...book,
        rounds,
        activeRound: rounds.some((r) => r.round === book.activeRound)
          ? book.activeRound
          : (rounds[0]?.round ?? 1),
      };
    });
  }
  return { ...data, syncState: state };
}
export function legacyDocument(
  data: DashboardData,
  actor: string,
  n = 1,
  seed: Omit<DashboardData, "syncState"> = plainData(createInitialData()),
): DashboardData {
  if (data.syncState) return renderDocument(data.syncState);
  const changes: Record<string, SyncChange> = {};
  changeDiff(seed, plainData(data), [], { n, actor }, changes);
  return renderDocument({ protocol: 1, seed, changes });
}
export function changeDocument(
  before: DashboardData,
  after: DashboardData,
  actor: string,
  time = Date.now(),
): DashboardData {
  const tracked = before.syncState
    ? before
    : legacyDocument(before, "legacy:local", 2);
  const state = tracked.syncState!;
  const changes = { ...state.changes };
  const stamp = { n: Math.max(time, maxClock(state) + 1), actor };
  // Additive application migrations must also become tracked before an edit.
  const canonical = renderDocument(state);
  changeDiff(plainData(canonical), plainData(before), [], stamp, changes);
  changeDiff(plainData(before), plainData(after), [], stamp, changes);
  return renderDocument({ ...state, changes });
}
/** Capture edits made by an older tab that retained metadata but did not stamp its changes. */
export function captureUntrackedDocument(
  data: DashboardData,
  actor: string,
  time: number,
): DashboardData {
  if (!data.syncState) return data;
  const expected = renderDocument(data.syncState);
  return equalData(plainData(expected), plainData(data))
    ? data
    : changeDocument(expected, data, actor, time);
}
export function applyDelta(
  document: DashboardData,
  before: DashboardData,
  after: DashboardData,
  actor: string,
  n?: number,
  protectDeleted = false,
): DashboardData {
  const state = document.syncState!;
  const changes = { ...state.changes };
  changeDiff(
    plainData(before),
    plainData(after),
    [],
    { n: n ?? Math.max(Date.now(), maxClock(state) + 1), actor },
    changes,
  );
  if (protectDeleted)
    for (const [path, change] of Object.entries(changes)) {
      if (state.changes[path]?.deleted && !change.deleted)
        changes[path] = state.changes[path];
    }
  return mergeDocuments(document, renderDocument({ ...state, changes }));
}
export function importLegacy(
  document: DashboardData,
  source: DashboardData,
  actor: string,
  n = 2,
): DashboardData {
  if (source.syncState) return mergeDocuments(document, source);
  const state = document.syncState!;
  const changes: Record<string, SyncChange> = {};
  changeDiff(state.seed, plainData(source), [], { n, actor }, changes);
  // An old untracked snapshot cannot recreate an explicitly deleted record.
  for (const [path, change] of Object.entries(changes))
    if (state.changes[path]?.deleted && has(change, "value"))
      delete changes[path];
  return mergeDocuments(document, renderDocument({ ...state, changes }));
}
export function mergeDocuments(
  a: DashboardData,
  b: DashboardData,
): DashboardData {
  let left = a.syncState!,
    right = b.syncState!;
  if (!left || !right) throw new Error("Sync metadata required");
  const seed =
    stableStringify(left.seed) < stableStringify(right.seed)
      ? left.seed
      : right.seed;
  function rebase(state: SyncState): SyncState {
    if (equalData(state.seed, seed)) return state;
    const changes: Record<string, SyncChange> = {};
    changeDiff(seed, state.seed, [], { n: 0, actor: "baseline" }, changes);
    return {
      ...state,
      seed,
      changes: joinChanges(changes, state.changes, new Set()),
    };
  }
  left = rebase(left);
  right = rebase(right);
  const dayMaterials = new Set(
    [...a.materials, ...b.materials]
      .filter((m) => m.kind === "days")
      .map((m) => m.id),
  );
  return renderDocument({
    protocol: 1,
    seed,
    changes: joinChanges(left.changes, right.changes, dayMaterials),
  });
}
export function validSyncState(value: unknown): value is SyncState {
  if (
    !object(value) ||
    value.protocol !== 1 ||
    !object(value.seed) ||
    value.seed.syncState !== undefined ||
    !object(value.changes)
  )
    return false;
  const allowed = new Set([
    "materials",
    "logs",
    "goals",
    "tasks",
    "todos",
    "events",
    "dayBooks",
    "vocabularies",
  ]);
  return Object.entries(value.changes).every(([path, entry]) => {
    if (
      !object(entry) ||
      !Number.isSafeInteger(entry.n) ||
      Number(entry.n) < 0 ||
      typeof entry.actor !== "string" ||
      !entry.actor ||
      entry.actor.length > 200
    )
      return false;
    let parts: unknown;
    try {
      parts = JSON.parse(path);
    } catch {
      return false;
    }
    if (
      !Array.isArray(parts) ||
      !parts.length ||
      parts.length > 20 ||
      !allowed.has(parts[0]) ||
      !parts.every(
        (p) =>
          typeof p === "string" &&
          p.length < 4096 &&
          !["__proto__", "constructor", "prototype"].includes(p),
      )
    )
      return false;
    if (has(entry, "value") && !jsonValue(entry.value)) return false;
    return (
      (entry.deleted === true ? 1 : 0) +
        (entry.array === true ? 1 : 0) +
        (entry.object === true ? 1 : 0) +
        (has(entry, "value") ? 1 : 0) ===
      1
    );
  });
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((item) => jsonValue(item, depth + 1));
  return (
    object(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        !["__proto__", "constructor", "prototype"].includes(key) &&
        jsonValue(item, depth + 1),
    )
  );
}
