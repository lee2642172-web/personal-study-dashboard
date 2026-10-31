export class EmailLoginError extends Error {
  retryAfterSeconds: number | null;
  constructor(message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "EmailLoginError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Classify provider failures without echoing email addresses, keys or auth links. */
export function emailLoginError(error: unknown): EmailLoginError {
  if (error instanceof EmailLoginError) return error;
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code =
    typeof value.code === "string" && /^[a-z0-9_]{1,64}$/.test(value.code)
      ? value.code
      : "";
  const status = typeof value.status === "number" ? value.status : null;
  const detail = typeof value.message === "string" ? value.message : "";
  const delayMatch = detail.match(/(?:after|in)\s+(\d+)\s+seconds?/i);
  const delay =
    delayMatch && Number(delayMatch[1]) > 0 && Number(delayMatch[1]) <= 3600
      ? Number(delayMatch[1])
      : null;
  let message: string;
  let retry: number | null = null;
  if (
    code === "over_email_send_rate_limit" ||
    (!code &&
      status === 429 &&
      (delay !== null || /email.*rate limit/i.test(detail)))
  ) {
    retry = delay ?? 60;
    message = delay
      ? `인증 메일 재요청 간격 제한입니다. ${delay}초 후 다시 시도해 주세요.`
      : "Supabase의 인증 메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. 계속되면 Supabase의 Authentication에서 Rate Limits와 이메일(SMTP) 설정을 확인해 주세요.";
  } else if (code === "over_request_rate_limit" || status === 429) {
    retry = delay ?? 60;
    message =
      "로그인 요청이 일시적으로 제한되었습니다. 잠시 기다린 뒤 한 번만 다시 요청해 주세요.";
  } else if (code === "email_address_not_authorized") {
    message =
      "Supabase 기본 메일 서비스의 발송 대상 제한입니다. 허용된 이메일인지 확인하거나 Supabase의 이메일(SMTP) 설정을 연결해야 합니다.";
  } else if (code === "email_provider_disabled" || code === "otp_disabled") {
    message =
      "Supabase의 이메일 로그인이 꺼져 있습니다. Authentication의 Email 제공자 설정을 확인해 주세요.";
  } else if (code === "email_address_invalid" || code === "validation_failed") {
    message =
      "이메일 주소를 확인해 주세요. 다른 기기에서 사용한 것과 같은 주소를 입력하세요.";
  } else if (
    status === 401 ||
    /invalid api ?key|invalid apikey/i.test(detail)
  ) {
    message =
      "저장소 연결 키를 확인해 주세요. PC와 같은 프로젝트의 Publishable key를 입력해야 합니다.";
  } else if (
    code === "unexpected_failure" ||
    /error sending.*(?:email|otp)/i.test(detail)
  ) {
    message =
      "Supabase에서 인증 메일을 보내지 못했습니다. Authentication의 Logs에서 메일 발송 오류와 SMTP 설정을 확인해 주세요.";
  } else if (
    value.name === "AuthRetryableFetchError" ||
    value.name === "TypeError" ||
    status === 0
  ) {
    message =
      "온라인 저장소에 연결하지 못했습니다. 휴대폰의 인터넷 연결과 Project URL을 확인해 주세요.";
  } else {
    message =
      "로그인 메일을 보내지 못했습니다. 연결 설정을 확인해 주세요. 아래 오류 식별 정보로 원인을 확인할 수 있습니다.";
  }
  const reference = code
    ? `오류 코드: ${code}`
    : status && Number.isInteger(status)
      ? `HTTP ${status}`
      : "네트워크 또는 로그인 서비스 오류";
  return new EmailLoginError(`${message} (${reference})`, retry);
}
