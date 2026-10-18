# MY DASHBOARD — Personal Study & Career Dashboard

개인 학습과 커리어 목표를 한눈에 보는 한국어 프론트엔드 시제품입니다. iPad 가로 화면을 중심으로 세로 화면과 모바일까지 대응합니다.

## 실행

Node.js 24 및 npm 11 환경에서 검증했습니다.

```sh
npm install
npm run dev
```

클라우드 환경에서 npm 기본 캐시에 쓰기 권한이 없다면 `npm install --cache /workspace/.npm-cache`를 사용합니다. 잠금 파일 기반 재설치는 `npm ci --cache /workspace/.npm-cache`입니다.

```sh
npm run typecheck
npm run build
npm run preview
```

## 화면과 기능

- HOME: 집중 목표, 학습 요약, 외국어·자격증 두 카테고리, 오늘 할 일 및 학습/자료 정리 필터
- 외국어: 영어 MAIN 카드 + 중국어·일본어·스페인어 보조 카드, 공용한자 연결
- 자격증: 관세사 MAIN 카드 + 무역영어 1급·원산지관리사·보세사 보조 항목(관세사 시험 체크포인트로 이동)
- 기존 영어·관세사·언어별 상세 기능 유지. CAREER는 홈과 주요 내비게이션에서 제외하며 기존 데이터 및 상세 URL은 보존
- SYSTEM은 자료 · Task 준비 메뉴와 `/system` 상세 화면에 유지하며 향후 Task 관리용 프로젝트 구조 보존
- 중국어, 일본어, 스페인어, 공용한자별 상세 화면
- ACTIVITY: Today / This Week 전환, 학습·복습·자료 정리 누적 막대, 오늘 완료 활동
- 오늘 체크 상태는 화면 이동 중 유지되며 요약 및 활동 화면과 연결됩니다. 새로고침 시 초기화됩니다.
- 진행률은 완료량 / 전체량으로 계산하고 0~100%로 제한합니다. 진도 미입력 항목에 임의 비율을 부여하지 않습니다.
- 보유 자료 규모, DB 정비, 실제 학습 진도는 구분합니다. 모든 활동 수치 및 예시 진도는 UI 테스트용 가상 데이터입니다.
- 오늘 날짜는 Asia/Seoul 기준입니다. 주간 샘플에서 오늘에 해당하는 값은 HOME의 체크 상태를 반영합니다.

## 주요 파일

```text
src/
  main.tsx        라우팅, 화면 컴포넌트, 체크 상태 및 인터랙션
  data.ts         학습 카테고리 구성, 자격증 체크포인트, 기존 분야/언어/과목/활동 샘플 데이터
  styles.css      Tailwind 및 반응형 스타일, 진행률 애니메이션
  vite-env.d.ts   Vite 클라이언트 타입
vite.config.ts    React + Tailwind Vite 플러그인
```

React, TypeScript, Vite, Tailwind CSS, Lucide React, React Router를 사용합니다. 데이터는 `src/data.ts`에서 관리하며 이후 데이터 소스로 교체할 수 있습니다. 백엔드, 회원가입, 외부 API, Excel 연동, 영구 저장 및 기기 간 동기화는 포함하지 않습니다.

클라이언트 라우팅을 사용합니다. `vercel.json`의 SPA rewrite 설정으로 Vercel에서도 상세 URL 직접 접근·새로고침을 지원합니다. 다른 배포 서버에서도 하위 URL 요청을 `index.html`로 반환해야 합니다.

홈과 내비게이션의 최상위 구조는 `learningCategories`에서 관리하며, 기존 `areas` 상세 데이터와 분리되어 있습니다. 보조 자격증은 기존 시험 계획만 표시하며 별도 진도율을 생성하지 않습니다.
