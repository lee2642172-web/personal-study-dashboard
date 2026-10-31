import type { SupabaseClient } from "@supabase/supabase-js";

export function passwordInputError(password: string, confirmation: string) {
  if (password.length < 8 || !password.trim())
    return "비밀번호는 8자 이상으로 입력해 주세요.";
  if (password !== confirmation)
    return "비밀번호와 확인 입력이 일치하지 않습니다.";
  return "";
}
export function passwordAuthError(error: unknown, changing = false) {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code =
    typeof value.code === "string" && /^[a-z0-9_]{1,64}$/.test(value.code)
      ? value.code
      : "";
  let message: string;
  if (code === "invalid_credentials")
    message =
      "이메일 또는 비밀번호를 확인해 주세요. 이메일 링크로만 로그인했다면 로그인 중인 PC·iPad에서 먼저 비밀번호를 설정하세요.";
  else if (code === "email_not_confirmed")
    message =
      "이메일 확인이 필요합니다. 기존에 확인을 마친 같은 이메일 계정으로 로그인해 주세요.";
  else if (
    [
      "reauthentication_needed",
      "reauthentication_not_valid",
      "session_not_found",
      "session_expired",
    ].includes(code)
  )
    message =
      "비밀번호를 설정하려면 최근 로그인 확인이 필요합니다. 인증 메일 발송 제한이 해제된 후 다시 로그인하고 설정해 주세요.";
  else if (code === "weak_password" || value.name === "AuthWeakPasswordError")
    message =
      "더 강한 비밀번호가 필요합니다. 8자 이상으로 영문·숫자·기호를 조합해 주세요.";
  else if (code === "same_password")
    message =
      "현재 비밀번호와 같습니다. 변경하려면 다른 비밀번호를 입력해 주세요.";
  else if (code === "over_request_rate_limit" || value.status === 429)
    message =
      "로그인 요청이 일시적으로 제한되었습니다. 잠시 기다린 뒤 다시 시도해 주세요.";
  else if (value.status === 401)
    message = "로그인 상태와 저장소 연결 키를 확인해 주세요.";
  else if (
    value.name === "AuthRetryableFetchError" ||
    value.name === "TypeError" ||
    value.status === 0
  )
    message =
      "로그인 서비스에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.";
  else
    message = changing
      ? "비밀번호를 저장하지 못했습니다. 로그인 상태와 Supabase의 비밀번호 설정을 확인해 주세요."
      : "비밀번호로 로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.";
  return new Error(code ? `${message} (오류 코드: ${code})` : message);
}

export async function loginWithPassword(
  client: SupabaseClient,
  email: string,
  password: string,
) {
  const { error } = await client.auth
    .signInWithPassword({ email: email.trim(), password })
    .catch((error: unknown) => {
      throw passwordAuthError(error);
    });
  if (error) throw passwordAuthError(error);
}
export async function setAccountPassword(
  client: SupabaseClient,
  password: string,
  confirmation: string,
) {
  const validation = passwordInputError(password, confirmation);
  if (validation) throw new Error(validation);
  const { error } = await client.auth
    .updateUser({ password })
    .catch((error: unknown) => {
      throw passwordAuthError(error, true);
    });
  if (error) throw passwordAuthError(error, true);
}
