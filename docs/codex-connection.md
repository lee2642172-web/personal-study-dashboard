# Codex 채팅에서 실제 대시보드 데이터 관리

이 연결은 EBS 전용이 아닙니다. 학습 자료·모든 학습 기록·진도와 회독 위치·일반 할 일·장기 과업과 작업 기록·캘린더 일정·목표를 읽고 추가·수정·삭제합니다. 기존 브라우저와 같은 Supabase 계정 문서를 쓰므로 저장 후 PC·iPad·휴대폰에도 기존 자동 동기화로 반영됩니다.

코드 배포는 이 연결을 처음 만들 때만 필요합니다. 연결 후의 기록 변경은 코드를 수정하거나 GitHub에 커밋하지 않고 실제 데이터 API로 처리합니다. 기존 초기 데이터에 사용자의 새 이력을 넣지 않습니다.

## 처음 한 번 설정

1. Vercel에 배포된 대시보드의 **온라인 저장 설정 → Codex 채팅으로 대시보드 관리** 또는 `/connect/codex`를 엽니다.
2. 서버 준비 안내에 따라 Vercel 환경변수를 설정합니다. 기존 `VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`도 서버가 재사용하므로 이미 설정했다면 별도로 복제할 필요는 없습니다. 서버 전용 별칭 `SUPABASE_URL`·`SUPABASE_PUBLISHABLE_KEY`도 지원합니다.
   - `DASHBOARD_CHAT_ORIGIN`: 실제 대시보드 기본 주소. 예: `https://personal-study-dashboard-tau.vercel.app`. 생략하면 Vercel의 `VERCEL_PROJECT_PRODUCTION_URL`을 사용합니다.
   - `DASHBOARD_CHAT_SECRET`: 연결 화면에서 생성한 32바이트 서버 설정키. Vercel의 비밀 환경변수에만 넣고 `VITE_`로 시작하게 만들지 않습니다. 이 키를 바꾸면 기존 연결키를 다시 발급해야 합니다.
3. Supabase SQL Editor에서 [codex.sql](../supabase/codex.sql)을 실행합니다. 기존 [setup.sql](../supabase/setup.sql) 이후 추가하는 연결 저장소이며 기존 학습 데이터·테이블·저장 함수는 변경하지 않습니다.
4. 다시 배포한 뒤 연결 화면에서 **설정 다시 확인**을 누릅니다. 같은 대시보드 계정으로 로그인하고 현재 비밀번호로 **Codex 연결키 발급**을 누릅니다. 이 과정은 별도 세션을 사용하며 PC·iPad의 기존 로그인과 기록을 바꾸지 않습니다.
5. 발급한 연결키를 **Codex 실행 환경의 비밀 설정**에 `DASHBOARD_CHAT_TOKEN`으로 등록합니다. `DASHBOARD_CHAT_URL`에는 대시보드 기본 주소를 등록하고 인터넷 허용 목록에도 해당 호스트를 추가합니다. 연결키를 채팅·명령줄 인수·GitHub 파일에 붙여넣지 않습니다. 환경 설정 적용 후 해당 환경으로 이 대화를 계속합니다. 이 환경의 설정 변경 도구가 없으면 사용자가 환경 설정 화면에서 한 번 저장해야 합니다.

현재 작업 환경의 비밀 설정과 네트워크 권한이 준비되기 전에는 이 채팅에서 실제 저장이 완료됐다고 말하지 않습니다. 키 발급만으로 Codex 실행 환경 설정까지 완료되지는 않습니다. 연결은 계정 소유자가 `/connect/codex`에서 해제할 수 있으며, 키가 만료되거나 로그인 세션이 해제되면 새 연결키를 발급합니다.

## Codex 실행 방법

연결키는 상속된 환경변수로만 읽습니다. HTTP 요청은 상속된 프록시·CA 설정을 사용하는 curl로 보내며, 인증 헤더는 셸이나 프로세스 명령줄 인수가 아니라 표준입력으로 전달합니다.

```sh
node scripts/dashboard-chat.mjs status
node scripts/dashboard-chat.mjs read --out /tmp/dashboard-current.json
node scripts/dashboard-chat.mjs preview --file /tmp/dashboard-request.json --out /tmp/dashboard-preview.json
node scripts/dashboard-chat.mjs apply --file /tmp/dashboard-request.json --preview /tmp/dashboard-preview.json
node scripts/dashboard-chat.mjs read --out /tmp/dashboard-verified.json
```

읽은 데이터와 미리보기 파일은 권한 0600으로 저장합니다. 사용자 요청에 이미 권한이 있으면 변경 미리보기를 검토한 뒤 바로 저장하며 불필요한 재승인을 요구하지 않습니다. 삭제는 명시적으로 요청한 경우에만 합니다. 수정 중 다른 기기의 버전이 바뀌면 최신 데이터를 다시 읽고 미리보기를 다시 만듭니다. 전체 대시보드를 교체하지 않습니다.

`status`는 서버 설정 확인용입니다. 실제 접근 가능 여부는 인증된 `read` 성공으로 확인합니다. 서버 준비가 안 됐거나 환경의 네트워크가 호스트를 허용하지 않으면 정확한 설정 오류를 보고하고 저장했다고 주장하지 않습니다.

## 변경 요청 형식

파일은 다음 형태입니다. `expected_revision`에는 직전에 읽은 실제 버전을 사용합니다.

```json
{
  "expected_revision": 7,
  "operations": [
    {"op":"set","collection":"goals","entityId":"opic","path":["current"],"value":"IH"},
    {"op":"append","collection":"todos","value":{"id":"unique-request-id","title":"교재 구매","dueDate":"","note":"","completion":null}}
  ]
}
```

예제는 형식 설명이며 기본 데이터나 자동 반영 이력이 아닙니다.

지원 컬렉션은 `materials`, `logs`, `goals`, `tasks`, `todos`, `events`, `dayBooks`, `vocabularies`입니다. 일반 레코드는 `id`, 회독 상태 `dayBooks`는 `materialId`로 찾습니다. 데이터의 실제 필드와 타입은 [model.ts](../src/model.ts)를 따릅니다.

- `set`: `collection`, `entityId`, `path`, `value`. 지정한 필드만 바꿉니다. 기존 객체 전체나 이력 배열의 교체를 막아 나머지 정보를 보존합니다. 새 객체·완료 정보·수량 등은 형식 검증을 거칩니다.
- `append`: 최상위 컬렉션 또는 `entityId`·`path`로 지정한 이력 배열에 완전한 레코드를 추가합니다. 누락된 이력 배열은 만들며, 같은 ID·같은 내용은 중복 추가하지 않습니다. 같은 ID인데 내용이 다르면 기존 정보를 덮어쓰지 않고 오류를 반환합니다.
- `delete`: `entityId` 레코드 또는 `path`로 지정한 세부 이력만 제거합니다. 이미 없으면 중복 삭제하지 않습니다. 할 일 묶음 삭제는 기존 할 일 해제 동작을 재사용합니다.
- 세부 배열은 위치 번호가 아닌 ID로 찾습니다. 예: 과업 체크 항목 수정은 `path:["items",{"key":"id","value":"format"},"done"]`. 회독 번호는 `{"key":"round","value":2}`, 강의 번호는 `{"key":"number","value":1}`을 사용합니다.

진도는 실제 완료 기록을 기반으로 합니다. 단순히 높은 Unit·Day를 열거나 등록 자료 수를 바꿨다는 이유로 완료 이력·학습시간을 만들지 않습니다. 알려지지 않은 실제 날짜·시간은 추정하지 않습니다. 미래 목표·일정은 등록할 수 있지만 미래의 실제 학습·작업 완료 기록은 거부합니다.

### EBS 일괄 청취 편의 명령

일반 명령 외에 `ebs_listen`도 지원합니다. `id`는 요청별 고유 ID이고, 각 `sessions` 항목은 `contentDate`(발행일), `learnedDate`(실제 청취일), 선택적 `courseIds`, 선택적 `minutes`를 가집니다. 강좌를 생략하면 Start·Easy·Power 중 그날 발행되는 강좌를 대상으로 합니다. 기본 시간은 18분입니다.

동일 발행일·실제 청취일에 이미 완료한 청취는 건너뜁니다. 실제 날짜만 비어 있던 완료 이력은 날짜를 보완하고 이미 측정한 시간은 유지합니다. 다른 날짜의 기존 청취는 덮어쓰지 않고 별도의 재청취로 기록합니다. 미리보기에서 변경할 개수와 내용을 확인합니다. 원래 기록 날짜를 고치라는 요청이면 일반 `set`으로 기존 기록을 수정합니다.

## 저장·권한·검증

연결키는 무작위 256비트 값으로 발급하며 DB에는 해시만 보관합니다. Supabase 세션은 서버 전용 키로 AES-256-GCM 암호화합니다. 연결키로 읽을 수 있는 암호문에도 실제 접근·갱신 토큰은 노출되지 않습니다. 세션 갱신은 연결 버전 비교로 처리하고, 해제·만료된 연결키는 거부합니다. 서버 비밀 키나 Supabase service role 키를 사용자에게 요구하지 않습니다.

API는 연결된 실제 사용자를 Supabase Auth로 확인하고, 그 사용자의 기존 RLS와 `save_dashboard`를 사용합니다. 다른 계정 ID를 요청 인수로 선택할 수 없으며, 아직 온라인 문서가 없으면 새 빈 문서를 임의로 만들어 덮어쓰지 않습니다. 저장은 기존 `syncState` 변경 메타데이터를 함께 갱신하므로 오래된 기기가 새 기록을 되돌리거나 삭제한 기록을 되살리지 않습니다.

미리보기는 계정·연결·버전·요청 내용에 묶인 10분 유효 토큰으로 발급합니다. 저장 시 이를 검증하고 서버의 현재 버전과 다시 비교합니다. 같은 요청 재전송은 중복 합산하지 않습니다. 단, 서로 다른 실제 반복 학습은 별개 ID·이력으로 보존합니다.

`tests/chatOperations.test.mjs`와 `tests/chatBridge.test.mjs`는 전체 컬렉션 조작, 실제 날짜 합계, 중복 방지, 동시 수정, 계정 분리, SQL RLS/함수 권한, 암호문·미리보기 검증, CLI와 연결 해제·세션 갱신을 실제 격리 Postgres 엔진으로 검증합니다. 실제 사용자의 온라인 계정 데이터는 테스트하지 않습니다.

## 로컬 개발

`npm run dev:full`은 Vite와 같은 서버에서 두 API를 실행합니다. 로컬 환경은 `DASHBOARD_CHAT_ORIGIN=http://127.0.0.1:5173`을 사용할 수 있습니다. 운영 환경에서는 HTTPS 기본 주소만 허용합니다. 테스트 외의 실제 계정 정보는 저장소에 커밋하지 않습니다.

한 요청은 최대 200개 명령, 본문 256 KiB입니다. 더 큰 요청은 현재 버전을 다시 확인하며 나누어 처리합니다. 앱이 기본 자료로 유지하는 카탈로그는 삭제 시 자동 재등록될 수 있으므로 API는 이 경우 `DEFAULT_MATERIAL_USE_ARCHIVE_STATUS` 오류를 반환합니다. 기본 자료의 보관/보류 상태 변경이나 HOME 표시 변경은 기존 앱의 관리 방식에 맞게 처리합니다.
