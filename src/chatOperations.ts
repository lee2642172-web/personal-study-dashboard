import type { DashboardData, StudyLog } from "./model.ts";
import { validData, restoreData } from "./storage.ts";
import { stableStringify } from "./syncMerge.ts";
import { deleteTodo } from "./todos.ts";
import {
  ebsCourses,
  courseEntries,
  courseDay,
  recordEbsLearning,
  scheduled,
  EBS_DEFAULT_MINUTES,
} from "./ebs.ts";
import { isDateString } from "./dates.ts";

export const chatCollections = [
  "materials",
  "logs",
  "goals",
  "tasks",
  "todos",
  "events",
  "dayBooks",
  "vocabularies",
] as const;
type Collection = (typeof chatCollections)[number];
type Selector = {
  key: "id" | "materialId" | "round" | "number";
  value: string | number;
};
type Segment = string | Selector;
export type ChatOperation =
  | {
      op: "set" | "append" | "delete";
      collection: Collection;
      entityId?: string;
      path?: Segment[];
      value?: unknown;
    }
  | {
      op: "ebs_listen";
      id: string;
      sessions: {
        contentDate: string;
        learnedDate: string;
        courseIds?: string[];
        minutes?: number;
      }[];
    };
export class OperationError extends Error {}
function fail(code: string): never {
  throw new OperationError(code);
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown) =>
  stableStringify(a) === stableStringify(b);
const forbidden = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "syncState",
  "password",
  "access_token",
  "refresh_token",
  "sealed_session",
  "token_hash",
  "user_id",
  "owner_id",
]);
function safe(value: unknown, depth = 0): void {
  if (depth > 30) fail("VALUE_TOO_DEEP");
  if (Array.isArray(value)) {
    for (const v of value) safe(v, depth + 1);
    return;
  }
  if (object(value)) {
    for (const [key, v] of Object.entries(value)) {
      if (forbidden.has(key)) fail("UNSAFE_FIELD");
      safe(v, depth + 1);
    }
    return;
  }
  if (
    (value !== null &&
      !["string", "number", "boolean", "undefined"].includes(typeof value)) ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    fail("INVALID_VALUE");
}
const identity = (name: string) =>
  name === "dayBooks"
    ? "materialId"
    : name === "rounds"
      ? "round"
      : name === "lectures"
        ? "number"
        : "id";
function arrayRecord(array: unknown[], key: string, value: unknown) {
  return array.find((x) => object(x) && x[key] === value);
}
function walk(root: unknown, path: Segment[]): unknown {
  let node = root;
  for (const part of path) {
    if (typeof part === "string") {
      if (
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(part) ||
        forbidden.has(part) ||
        !object(node)
      )
        fail("INVALID_PATH");
      node = node[part];
    } else {
      if (
        !object(part) ||
        !["id", "materialId", "round", "number"].includes(part.key) ||
        !["string", "number"].includes(typeof part.value) ||
        !Array.isArray(node)
      )
        fail("INVALID_SELECTOR");
      node = arrayRecord(node, part.key, part.value);
    }
    if (node === undefined) fail("PATH_NOT_FOUND");
  }
  return node;
}
function applyEbs(
  data: DashboardData,
  op: Extract<ChatOperation, { op: "ebs_listen" }>,
  asOf: string,
): DashboardData {
  if (
    typeof op.id !== "string" ||
    !op.id ||
    op.id.length > 100 ||
    !Array.isArray(op.sessions) ||
    !op.sessions.length ||
    op.sessions.length > 31
  )
    fail("INVALID_EBS_BATCH");
  let next = data;
  const available = ebsCourses(data.materials),
    standard = ["ebs-0", "ebs-1", "ebs-2"];
  for (const row of op.sessions) {
    const minutes = row.minutes ?? EBS_DEFAULT_MINUTES;
    if (
      !isDateString(row.contentDate) ||
      !isDateString(row.learnedDate) ||
      row.contentDate > row.learnedDate ||
      row.learnedDate > asOf ||
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      minutes > 1440
    )
      fail("INVALID_EBS_DATE_OR_TIME");
    const ids = row.courseIds ?? standard;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => !standard.includes(id))
    )
      fail("INVALID_EBS_COURSES");
    let eligible = 0;
    for (const id of new Set(ids)) {
      const course = available.find((m) => m.id === id);
      if (!course) fail("EBS_COURSE_NOT_FOUND");
      if (!scheduled(course, row.contentDate)) continue;
      eligible++;
      const entries = courseEntries(course, next.logs, row.contentDate).filter(
        (l) => l.completed && !l.voided && !l.reviewOf,
      );
      if (entries.some((l) => l.date === row.learnedDate)) continue;
      const unknown = entries.find((l) => l.date === null);
      if (unknown) {
        next = {
          ...next,
          logs: next.logs.map((l) =>
            l.id === unknown.id
              ? {
                  ...l,
                  date: row.learnedDate,
                  contentDate: row.contentDate,
                  minutes: l.minutes ?? minutes,
                }
              : l,
          ),
        };
        continue;
      }
      const logId = `chat:${op.id}:${id}:${row.contentDate}:${row.learnedDate}`;
      if (next.logs.some((l) => l.id === logId))
        fail("EBS_RECORD_WAS_CANCELLED_USE_NEW_ID");
      next = recordEbsLearning(
        next,
        id,
        row.contentDate,
        row.learnedDate,
        logId,
        courseDay(course, next.logs, row.contentDate, row.learnedDate)
          .completed,
      );
      next = {
        ...next,
        logs: next.logs.map((l) => (l.id === logId ? { ...l, minutes } : l)),
      };
    }
    if (!eligible) fail("NO_EBS_EPISODES_ON_DATE");
  }
  return next;
}
function summarize(value: unknown): unknown {
  if (value === undefined) return null;
  const text = stableStringify(value);
  return text.length <= 4000
    ? value
    : {
        summary: "large value",
        bytes: text.length,
        keys: object(value) ? Object.keys(value) : undefined,
      };
}
export function prepareChatOperations(
  data: DashboardData,
  input: unknown,
  asOf: string,
) {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > 200 ||
    !isDateString(asOf)
  )
    fail("INVALID_OPERATIONS");
  safe(input);
  let next = structuredClone(data);
  for (const raw of input) {
    if (!object(raw)) fail("INVALID_OPERATION");
    const op = raw as unknown as ChatOperation;
    if (op.op === "ebs_listen") {
      next = applyEbs(next, op, asOf);
      continue;
    }
    if (
      !["set", "append", "delete"].includes(op.op) ||
      !chatCollections.includes(op.collection)
    )
      fail("INVALID_OPERATION");
    const key = op.collection,
      root = next as unknown as Record<string, unknown>;
    if (root[key] === undefined) root[key] = [];
    const array = root[key];
    if (!Array.isArray(array)) fail("INVALID_COLLECTION");
    const idKey = identity(key),
      entity =
        op.entityId === undefined
          ? undefined
          : arrayRecord(array, idKey, op.entityId);
    if (
      op.entityId !== undefined &&
      (typeof op.entityId !== "string" ||
        !op.entityId ||
        op.entityId.length > 500)
    )
      fail("INVALID_ENTITY_ID");
    const path = op.path ?? [];
    if (!Array.isArray(path) || path.length > 20) fail("INVALID_PATH");
    if (op.op === "delete" && op.entityId && !path.length) {
      if (key === "todos") {
        next = deleteTodo(next, op.entityId);
        continue;
      }
      root[key] = array.filter((x) => !object(x) || x[idKey] !== op.entityId);
      continue;
    }
    if (op.entityId !== undefined && !entity) fail("ENTITY_NOT_FOUND");
    const target = op.entityId === undefined ? array : entity;
    if (op.op === "append") {
      if (path.length && typeof path.at(-1) === "string") {
        const field = path.at(-1) as string;
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field) || forbidden.has(field))
          fail("INVALID_PATH");
        const parent = walk(target, path.slice(0, -1));
        if (object(parent) && parent[field] === undefined) parent[field] = [];
      }
      const destination = walk(target, path);
      if (!Array.isArray(destination) || !object(op.value))
        fail("APPEND_REQUIRES_RECORD_ARRAY");
      const field = identity(path.length ? String(path.at(-1)) : key),
        id = op.value[field];
      if (!["string", "number"].includes(typeof id) || id === "")
        fail("RECORD_ID_REQUIRED");
      const existing = arrayRecord(destination, field, id);
      if (existing) {
        if (!same(existing, op.value)) fail("RECORD_ALREADY_EXISTS");
        continue;
      }
      destination.push(structuredClone(op.value));
      continue;
    }
    if (!op.entityId || !path.length)
      fail("WHOLE_COLLECTION_REPLACEMENT_NOT_ALLOWED");
    const parent = walk(target, path.slice(0, -1)),
      leaf = path.at(-1)!;
    if (typeof leaf !== "string") {
      if (op.op !== "delete" || !Array.isArray(parent) || !object(leaf))
        fail("INVALID_PATH");
      const index = parent.findIndex(
        (v) => object(v) && v[leaf.key] === leaf.value,
      );
      if (index >= 0) parent.splice(index, 1);
      continue;
    }
    if (
      !object(parent) ||
      forbidden.has(leaf) ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(leaf)
    )
      fail("INVALID_PATH");
    const parentSelector = path.at(-2);
    if (
      (path.length === 1 && leaf === idKey) ||
      (object(parentSelector) && parentSelector.key === leaf)
    )
      fail("IDENTITY_CHANGE_NOT_ALLOWED");
    if (op.op === "delete") {
      delete parent[leaf];
      continue;
    }
    const old = parent[leaf],
      value = op.value;
    if (value === undefined) fail("SET_VALUE_REQUIRED");
    if (
      (object(old) && object(value) && !same(old, value)) ||
      (Array.isArray(old) && old.some(object) && !same(old, value))
    )
      fail("USE_FIELD_UPDATES_TO_PRESERVE_HISTORY");
    parent[leaf] = structuredClone(value);
  }
  if (!validData(next)) fail("INVALID_DASHBOARD_DATA");
  const changedLogs = next.logs.filter(
    (l) =>
      !same(
        l,
        data.logs.find((old) => old.id === l.id),
      ),
  );
  for (const log of changedLogs) {
    if (log.date !== null && log.date > asOf) fail("FUTURE_STUDY_DATE");
    const m = next.materials.find((m) => m.id === log.materialId);
    if ((log.materialId && !m) || (m && m.area !== log.area))
      fail("LOG_MATERIAL_MISMATCH");
    if (
      m &&
      ["units", "days", "lectures", "book"].includes(m.kind) &&
      (!/^\d+$/.test(log.item) ||
        Number(log.item) < 1 ||
        (m.total !== null && Number(log.item) > m.total))
    )
      fail("ITEM_OUT_OF_RANGE");
  }
  for (const todo of next.todos ?? [])
    if (
      todo.completion &&
      todo.completion.date > asOf &&
      !same(
        todo,
        data.todos?.find((t) => t.id === todo.id),
      )
    )
      fail("FUTURE_COMPLETION_DATE");
  for (const task of next.tasks)
    for (const record of task.records ?? [])
      if (
        record.date > asOf &&
        !same(
          record,
          data.tasks
            .find((t) => t.id === task.id)
            ?.records?.find((r) => r.id === record.id),
        )
      )
        fail("FUTURE_WORK_DATE");
  next = restoreData(next);
  for (const op of input)
    if (
      op.op === "delete" &&
      op.collection === "materials" &&
      !op.path?.length &&
      next.materials.some((m) => m.id === op.entityId)
    )
      fail("DEFAULT_MATERIAL_USE_ARCHIVE_STATUS");
  const changes: {
    collection: string;
    id: unknown;
    action: string;
    before: unknown;
    after: unknown;
  }[] = [];
  for (const key of chatCollections) {
    const field = identity(key),
      before = (data[key] ?? []) as unknown as Record<string, unknown>[],
      after = (next[key] ?? []) as unknown as Record<string, unknown>[];
    const ids = new Set([...before, ...after].map((x) => x[field]));
    for (const id of ids) {
      const a = before.find((x) => x[field] === id),
        b = after.find((x) => x[field] === id);
      if (same(a, b)) continue;
      changes.push({
        collection: key,
        id,
        action: !a ? "added" : !b ? "deleted" : "updated",
        before: summarize(a),
        after: summarize(b),
      });
    }
  }
  return {
    next,
    changes,
    summary: {
      added: changes.filter((c) => c.action === "added").length,
      updated: changes.filter((c) => c.action === "updated").length,
      deleted: changes.filter((c) => c.action === "deleted").length,
    },
  };
}
