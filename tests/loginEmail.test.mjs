import test from "node:test";
import assert from "node:assert/strict";
import { emailLoginError, EmailLoginError } from "../src/loginEmail.ts";

test("a provider resend interval is shown accurately with its diagnostic code", () => {
  const error = emailLoginError({
    code: "over_email_send_rate_limit",
    status: 429,
    message:
      "For security purposes, you can only request this after 52 seconds.",
  });
  assert.ok(error instanceof EmailLoginError);
  assert.equal(error.retryAfterSeconds, 52);
  assert.match(error.message, /52초/);
  assert.match(error.message, /over_email_send_rate_limit/);
  const legacy = emailLoginError({
    status: 429,
    message: "For security purposes, request this after 35 seconds.",
  });
  assert.equal(legacy.retryAfterSeconds, 35);
  assert.match(legacy.message, /35초/);
});
test("mail quota and generic request limits remain distinct from invalid address/key errors", () => {
  const quota = emailLoginError({
    code: "over_email_send_rate_limit",
    status: 429,
    message: "Email rate limit exceeded",
  });
  assert.match(quota.message, /발송 한도/);
  assert.equal(quota.retryAfterSeconds, 60);
  const limit = emailLoginError({
    code: "over_request_rate_limit",
    status: 429,
  });
  assert.match(limit.message, /로그인 요청/);
  assert.equal(limit.retryAfterSeconds, 60);
});
test("default SMTP recipient restrictions and email-provider configuration have actionable separate messages", () => {
  const recipient = emailLoginError({
    code: "email_address_not_authorized",
    status: 403,
  });
  assert.match(recipient.message, /발송 대상 제한/);
  assert.match(recipient.message, /SMTP/);
  assert.equal(recipient.retryAfterSeconds, null);
  assert.match(
    emailLoginError({ code: "email_provider_disabled", status: 422 }).message,
    /꺼져/,
  );
  assert.match(
    emailLoginError({
      code: "unexpected_failure",
      status: 500,
      message: "Error sending confirmation email",
    }).message,
    /Logs/,
  );
});
test("invalid keys, invalid emails and network errors give specific guidance without echoing input", () => {
  assert.match(
    emailLoginError({
      status: 401,
      message: "Invalid API key: sb_publishable_secret-input",
    }).message,
    /Publishable key/,
  );
  assert.match(
    emailLoginError({
      code: "email_address_invalid",
      status: 422,
      message: "private@example.com",
    }).message,
    /이메일 주소/,
  );
  assert.match(
    emailLoginError({
      name: "AuthRetryableFetchError",
      status: 0,
      message: "Failed to fetch",
    }).message,
    /인터넷 연결/,
  );
});
test("unknown server responses never echo email addresses, login tokens, HTML or API keys", () => {
  const error = emailLoginError({
    code: "unknown_service_error",
    status: 500,
    message: "private@example.com token=abc sb_secret_123 <script>bad</script>",
  });
  assert.match(error.message, /unknown_service_error/);
  assert.doesNotMatch(error.message, /private@|token=|sb_secret|script/);
  const malformed = emailLoginError({
    code: "https://private.example/?token=abc",
    status: 500,
    message: "secret",
  });
  assert.doesNotMatch(malformed.message, /private|secret|token/);
  assert.match(malformed.message, /HTTP 500/);
});
test("invalid retry durations and non-object failures are safe; classified errors retain their identity", () => {
  assert.equal(
    emailLoginError({
      code: "over_email_send_rate_limit",
      message: "after 9999999 seconds",
    }).retryAfterSeconds,
    60,
  );
  assert.equal(
    emailLoginError({
      code: "over_email_send_rate_limit",
      message: "after 0 seconds",
    }).retryAfterSeconds,
    60,
  );
  assert.ok(emailLoginError(null).message);
  assert.ok(emailLoginError("failed").message);
  const error = new EmailLoginError("분류된 오류", 30);
  assert.equal(emailLoginError(error), error);
});
