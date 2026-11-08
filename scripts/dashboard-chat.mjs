#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, writeFile, chmod } from "node:fs/promises";

const args = process.argv.slice(2),
  command = args.shift();
function flag(name) {
  const n = args.indexOf(name);
  return n < 0 ? null : args[n + 1];
}
function setting(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경 설정이 필요합니다.`);
  return value;
}
async function call(path, method = "GET", payload) {
  const origin = setting("DASHBOARD_CHAT_URL").replace(/\/$/, "");
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(
      "DASHBOARD_CHAT_URL은 대시보드의 HTTPS 기본 주소여야 합니다.",
    );
  const token =
    path === "/api/dashboard" ? setting("DASHBOARD_CHAT_TOKEN") : null;
  if (token && /[\r\n]/.test(token))
    throw new Error("연결키 환경 설정 형식을 확인해 주세요.");
  const config = [
    `url = ${JSON.stringify(origin + path)}`,
    `request = ${JSON.stringify(method)}`,
    'header = "Content-Type: application/json"',
  ];
  if (token)
    config.push(`header = ${JSON.stringify("Authorization: Bearer " + token)}`);
  if (payload !== undefined)
    config.push(`data = ${JSON.stringify(JSON.stringify(payload))}`);
  // Use stdin, not command-line arguments or a shell, for the credential header.
  const result = spawnSync(
    "curl",
    [
      "--silent",
      "--show-error",
      "--max-time",
      "45",
      "--config",
      "-",
      "--write-out",
      "\n%{http_code}",
    ],
    {
      input: config.join("\n") + "\n",
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      "대시보드에 연결하지 못했습니다. 환경의 네트워크 허용 목록과 연결 설정을 확인해 주세요.",
    );
  const split = result.stdout.lastIndexOf("\n"),
    status = Number(result.stdout.slice(split + 1));
  let data;
  try {
    data = JSON.parse(result.stdout.slice(0, split));
  } catch {
    throw new Error(
      "API가 JSON을 반환하지 않았습니다. 배포 주소와 API 라우팅을 확인해 주세요.",
    );
  }
  if (status < 200 || status >= 300)
    throw new Error(
      typeof data.error === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(data.error)
        ? `HTTP ${status}: ${data.error}`
        : `HTTP ${status}: 요청 실패`,
    );
  return data;
}
try {
  let result;
  if (command === "status") result = await call("/api/chat-access");
  else if (command === "read") result = await call("/api/dashboard");
  else if (command === "preview" || command === "apply") {
    const file = flag("--file");
    if (!file) throw new Error("--file 변경요청.json 이 필요합니다.");
    const proposal = JSON.parse(await readFile(file, "utf8"));
    if (command === "preview")
      result = await call("/api/dashboard", "POST", {
        action: "preview",
        expected_revision: proposal.expected_revision,
        operations: proposal.operations,
      });
    else {
      const previewFile = flag("--preview");
      if (!previewFile)
        throw new Error("--preview 미리보기.json 이 필요합니다.");
      const preview = JSON.parse(await readFile(previewFile, "utf8"));
      result = await call("/api/dashboard", "POST", {
        action: "apply",
        operations: proposal.operations,
        preview_token: preview.preview_token,
      });
    }
  } else
    throw new Error(
      "사용법: node scripts/dashboard-chat.mjs status|read|preview|apply [--file 요청.json] [--preview 미리보기.json] [--out 결과.json]",
    );
  const output = flag("--out");
  if (output) {
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", {
      mode: 0o600,
    });
    await chmod(output, 0o600);
    console.log(
      JSON.stringify({
        file: output,
        revision: result.revision,
        saved: result.saved,
        summary: result.summary,
        serverReady: result.serverReady,
        databaseReady: result.databaseReady,
      }),
    );
  } else console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    error instanceof SyntaxError
      ? "요청/미리보기 JSON 파일 형식을 확인해 주세요."
      : error instanceof Error
        ? error.message
        : "요청을 처리하지 못했습니다.",
  );
  process.exitCode = 1;
}
