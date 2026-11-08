import type { ApiRequest, ApiResponse } from "../server/http.ts";
import {
  authenticate,
  ConnectError,
  digest,
  readConfig,
  seal,
  seconds,
  unseal,
} from "../server/core.ts";
import { bearer, body, json, originAllowed } from "../server/http.ts";
import { cloudRepository } from "../src/cloud.ts";
import {
  OperationError,
  prepareChatOperations,
} from "../src/chatOperations.ts";
import {
  changeDocument,
  plainData,
  stableStringify,
} from "../src/syncMerge.ts";
import { studySummary, dashboardTimeEntries } from "../src/dashboard.ts";
export const koreaToday = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
};
export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const config = readConfig();
    originAllowed(req, config);
    const { api, user, connection } = await authenticate(config, bearer(req));
    const repository = cloudRepository(api),
      snapshot = await repository.read();
    if (!snapshot) throw new ConnectError("ONLINE_DASHBOARD_NOT_FOUND", 409);
    const today = koreaToday();
    if (req.method === "GET")
      return json(res, 200, {
        account: { id: user.id, email: user.email },
        revision: snapshot.revision,
        updated_at: snapshot.updatedAt,
        today,
        summary: studySummary(dashboardTimeEntries(snapshot.data), today),
        data: plainData(snapshot.data),
      });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { error: "method_not_allowed" });
    }
    const input = await body(req);
    if (input.action !== "preview" && input.action !== "apply")
      throw new ConnectError("INVALID_ACTION");
    if (!Array.isArray(input.operations))
      throw new ConnectError("INVALID_OPERATIONS");
    const operationsHash = digest(stableStringify(input.operations));
    if (input.action === "preview") {
      if (
        !Number.isSafeInteger(input.expected_revision) ||
        input.expected_revision !== snapshot.revision
      )
        throw new ConnectError("REVISION_CHANGED_READ_AGAIN", 409);
      const plan = prepareChatOperations(
        snapshot.data,
        input.operations,
        today,
      );
      const token = seal(config, {
        kind: "preview",
        exp: seconds() + 600,
        sub: user.id,
        connection,
        revision: snapshot.revision,
        operations_hash: operationsHash,
      });
      return json(res, 200, {
        saved: false,
        revision: snapshot.revision,
        preview_token: token,
        summary: plan.summary,
        changes: plan.changes,
      });
    }
    let preview;
    try {
      preview = unseal(config, input.preview_token, "preview");
    } catch {
      throw new ConnectError("PREVIEW_EXPIRED_OR_INVALID", 409);
    }
    if (
      preview.sub !== user.id ||
      preview.connection !== connection ||
      preview.operations_hash !== operationsHash
    )
      throw new ConnectError("PREVIEW_DOES_NOT_MATCH", 403);
    const plan = prepareChatOperations(snapshot.data, input.operations, today);
    if (!plan.changes.length)
      return json(res, 200, {
        saved: true,
        wrote: false,
        revision: snapshot.revision,
        summary: plan.summary,
      });
    if (preview.revision !== snapshot.revision)
      throw new ConnectError("REVISION_CHANGED_PREVIEW_AGAIN", 409);
    const document = changeDocument(
      snapshot.data,
      plan.next,
      `codex:${connection}`,
    );
    let saved;
    try {
      saved = await repository.write(document, snapshot.revision);
    } catch (e) {
      if (e instanceof Error && e.message === "DASHBOARD_CONFLICT")
        throw new ConnectError("REVISION_CHANGED_PREVIEW_AGAIN", 409);
      throw e;
    }
    return json(res, 200, {
      saved: true,
      wrote: true,
      revision: saved.revision,
      summary: plan.summary,
      actualTime: studySummary(dashboardTimeEntries(saved.data), today),
    });
  } catch (e) {
    const error =
      e instanceof ConnectError
        ? e
        : e instanceof OperationError
          ? new ConnectError(e.message)
          : new ConnectError("DASHBOARD_REQUEST_FAILED", 503);
    return json(res, error.status, { error: error.code });
  }
}
