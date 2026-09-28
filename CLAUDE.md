# 단추 (Danchu)

비임상 시험의 견적과 계약을 한곳에서 처리하는 B2B 발주 플랫폼. Next.js(App Router) + React + TypeScript.

## 이 프로젝트에서 먼저 알아야 할 것

- **Tailwind를 쓰지 않는다.** 스타일은 일반 CSS 파일이다: `app/globals.css`, `app/home.css`(랜딩), `components/shell/portal.css`(로그인 후 화면). 색과 간격은 이 파일들의 CSS 변수(`--brand`, `--ink`, `--muted` 등)를 쓴다.
- 아래 디자인 규칙에 나오는 Tailwind 표기(`leading-relaxed`, `max-w-7xl`, `dark:` 등)는 **기준값으로 읽고 CSS로 옮겨 적용한다.** 예: `max-w-7xl` → `max-width: 80rem`, `text-balance` → `text-wrap: balance`, `min-h-[100dvh]` → `min-height: 100dvh`. Tailwind를 새로 설치하지 않는다.
- 단추는 중립이다. 화면 문구에서 단추가 기준을 정하는 것처럼 쓰지 않는다. 기관마다 다른 부분은 기관의 설명을 나란히 보여 준다.
- 운영 배포는 `main` 브랜치다. 커밋 전에 현재 브랜치를 확인한다.
- 검사: `npm run typecheck`, `npx next build`.

## 디자인 규칙


> 스택: Next.js(App Router) + React + Tailwind. 아래 규칙은 emil-design-eng, impeccable, design-taste-frontend 3개 스킬의 핵심을 단추 프로젝트에 맞게 압축한 것이다. UI 파일(`app/**`, `components/**`, `*.css`)을 만들거나 고칠 때 항상 적용한다.
> 스킬 자체가 설치되어 있으면 원문이 우선한다. 이 문서는 스킬이 로드되지 않은 세션에서도 같은 기준을 유지하기 위한 요약본이다.

## 0. UI 작업 순서 (매번)

1. **Design Read 한 줄 선언**: "이 화면은 `<종류>`, 사용자는 `<누구>`, 톤은 `<분위기>`, 모드는 `Persuade|Operate|Read|Experience`." 모드는 제품이 아니라 *해당 화면*으로 정한다 (랜딩=Persuade, 앱 내부 화면=Operate, 도움말=Read).
2. **기존 시각 언어 확인**: `DESIGN.md`, `PRODUCT.md`, `tailwind.config.*`, `globals.css`의 토큰을 먼저 읽는다. 리파인은 기존 정체성을 보존하고, 리디자인만 교체한다. 절반만 바꾸는 "폴리시 위에 새 룩" 금지.
3. **빌드**: 아래 1~6절 규칙으로 완성본을 만든다. 절반짜리 데모 금지.
4. **검증 1회 배치**: Playwright MCP로 **1440px + 390px** 스크린샷을 한 번에 찍고, 7절 체크리스트를 한 번에 돌린다. 발견된 문제를 한 번에 고치고, 확인 스크린샷 최대 1회 더. 그 이상 무한 폴리시 루프 금지.
5. **리뷰 보고 형식**: 문제는 반드시 `| Before | After | Why |` 마크다운 표로 보고한다 (줄 나열 금지).

## 1. 타이포그래피

- 본문 measure 65~75ch, `leading-relaxed`. 디스플레이 최대 6rem, `tracking` 하한 -0.04em, 제목은 `text-balance`.
- 크기·굵기 단계가 눈에 띄게 구분되어야 한다 (h1/h2/본문/캡션이 비슷하면 실패).
- 폰트는 `next/font`로 셀프호스트. 프로덕션에서 Google Fonts `<link>` 금지. 기본값 Inter 남발 금지. 세리프는 브랜드가 명시할 때만.
- 헤드라인 강조는 **같은 서체의 italic/bold**로. 세리프 단어 끼워넣기 금지. italic에 y g j p q 가 있으면 `leading-[1.1]` 이상 + `pb-1`.
- 히어로: 헤드라인 2줄 이내, 서브텍스트 20단어(한국어 기준 2문장) 이내, 상단 패딩 `pt-24` 이하, 텍스트 요소 최대 4개(아이브로우 또는 브랜드띠 중 0~1, 헤드라인, 서브, CTA 1+1).
- **눈썹 라벨(eyebrow, 소문자 대문자 트래킹 라벨) 금지가 기본.** 섹션 3개당 최대 1개. 섹션 번호(01/02/03) 금지.
- 대시: 화면에 보이는 문자열에 `—` `–` 사용 금지. 하이픈 `-` 또는 마침표/쉼표.

## 2. 색

- 중립 베이스(zinc/slate/stone 중 하나로 고정) + **강조색 1개**, 채도 80% 미만. 페이지 전체에서 같은 강조색만 사용(7번째 섹션에서 갑자기 파란 CTA 금지).
- 순수 `#000`/`#fff` 금지. 오프블랙/오프화이트.
- AI 보라 그라데이션, 네온 글로우, 그라데이션 텍스트 금지. 강조는 굵기·크기로.
- 대비: 본문·플레이스홀더 4.5:1 이상, 큰 글자 3:1 이상. 색 있는 배경 위 보조 텍스트는 회색이 아니라 그 배경 색조에서 파생.
- **버튼 대비 체크 필수**: 흰 버튼+흰 글자, 배경과 같은 색의 고스트 버튼 금지. 사진 위 버튼은 스크림/테두리.
- 다크모드: 소비자 대상 화면은 양쪽 모드 모두 설계. 전략은 `dark:` 변형 **또는** CSS 변수 중 하나만. 페이지 테마는 하나로 잠근다(중간 섹션만 반전 금지).

## 3. 레이아웃·간격

- 그룹 내부는 촘촘하게, 그룹 사이는 넉넉하게. 제목 위 여백 > 제목 아래 여백.
- `h-screen` 금지 → `min-h-[100dvh]`. flex 퍼센트 계산 금지 → CSS Grid. 컨테이너 `max-w-7xl mx-auto px-4`.
- 카드는 실제 위계가 있을 때만. **같은 크기 아이콘+제목+텍스트 카드 3개 나열 금지.** 중첩 카드 금지. 대신 `divide-y`, `border-t`, 여백.
- 그림자는 오프셋 + 부드러운 블러, 배경 색조로 틴트. 0-오프셋 컬러 헤일로, `4px 4px 0` 하드 섀도우(네오브루탈 아닌 이상) 금지. 카드 좌/우 컬러 보더 1px 초과 금지.
- 모서리 반경 체계 하나로 고정(전부 sharp / 전부 12~16px / 인터랙티브만 pill). 혼용 시 규칙을 문서화.
- 같은 레이아웃 패밀리는 페이지당 1회. 이미지+텍스트 지그재그는 연속 2회까지. 벤토 그리드는 콘텐츠 수 = 셀 수, 빈 셀 금지, 셀 2~3개는 이미지/틴트로 시각 변화.
- 네비게이션은 데스크톱 한 줄, 높이 64~72px(최대 80px).
- 모든 다열 레이아웃은 같은 컴포넌트 안에 `< md` 붕괴 규칙을 명시.

## 4. 모션 (emil 기준)

- **애니메이션 할지 먼저 판단**: 하루 100회+ 반복 동작(키보드 단축키, 커맨드 팔레트)은 애니메이션 없음. 수십 회(호버, 리스트 이동)는 최소화. 가끔(모달, 드로어, 토스트)은 표준. 첫 경험(온보딩, 축하)만 딜라이트.
- 키보드로 시작된 동작은 절대 애니메이션하지 않는다.
- 이징: 등장/퇴장 = ease-out, 화면 내 이동 = ease-in-out, 호버/색 = ease, 등속(마키·프로그레스) = linear. **UI에 ease-in 금지.** 커스텀 커브 사용:
  ```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  ```
- 길이: 버튼 피드백 100~160ms, 툴팁 125~200ms, 드롭다운 150~250ms, 모달/드로어 200~500ms. **UI 애니메이션은 300ms 이하.**
- `transition: all` 금지 → 속성 명시. `transform`과 `opacity`만 애니메이션(필요 시 blur/clip-path/backdrop-filter까지). width/height/top/left 금지.
- 누를 수 있는 요소는 `:active { transform: scale(0.97) }` (0.95~0.98). `transition: transform 160ms var(--ease-out)`.
- `scale(0)`에서 등장 금지 → `scale(0.95) + opacity 0`. 팝오버는 트리거 기준 `transform-origin`(모달만 center 유지).
- 빠르게 반복되는 UI(토스트, 토글)는 keyframes 대신 transition(중단 가능). 등장은 `@starting-style` 우선.
- 툴팁: 첫 번째는 지연, 인접 툴팁은 즉시(지연·애니메이션 생략).
- 여러 요소 동시 등장 시 30~80ms 스태거. 스태거 중 인터랙션 차단 금지.
- 입력은 느리게(홀드 삭제 2s linear), 시스템 응답은 빠르게(해제 200ms ease-out).
- 호버 애니메이션은 `@media (hover: hover) and (pointer: fine)` 안에서만.
- `prefers-reduced-motion: reduce`에서 이동 애니메이션 제거, opacity/색 전환은 유지. Motion 사용 시 `useReducedMotion()`.
- Motion(framer) `x/y/scale` 단축 prop은 메인스레드. 부하 시 `transform: "translateX()"` 문자열 또는 CSS 애니메이션.
- 스크롤: `window.addEventListener('scroll')` 금지 → `useScroll`/IntersectionObserver/CSS scroll-driven. 마우스·스크롤 연속값을 `useState`에 넣지 않는다(`useMotionValue`/`useTransform`).
- 페이지당 "작가가 의도한 모션 순간" 하나. 모든 섹션에 같은 페이드인 반복 금지. 마키는 페이지당 1개.
- Motion/스크롤 리스너 컴포넌트는 `'use client'` 리프로 격리. `useEffect` 애니메이션은 cleanup 필수.

## 5. 상태·컴포넌트·카피

- 모든 인터랙티브 컴포넌트는 hover / focus-visible / active / disabled / loading / error / empty 상태를 갖는다. 로딩은 최종 레이아웃 모양의 스켈레톤(원형 스피너 지양).
- 폼: 라벨은 입력 위, 에러는 아래, `gap-2`. 플레이스홀더를 라벨로 쓰지 않는다. 입력/플레이스홀더/포커스링/헬퍼 모두 AA 대비.
- CTA: 데스크톱에서 한 줄(최대 3단어). 같은 의도의 CTA 라벨은 페이지에서 하나로 통일("문의하기"와 "연락하기" 공존 금지).
- **브라우저 기본 표면도 디자인한다**: `::selection`, caret-color, 스크롤바, focus ring, `text-underline-offset`, 표 숫자는 `tabular-nums`. 이것이 "조립"이 아니라 "제작"된 페이지의 가장 싼 신호.
- 아이콘: 라이브러리 하나로 고정(`@phosphor-icons/react` 우선, 프로젝트가 이미 lucide면 lucide 유지), `strokeWidth` 전역 통일. 손으로 SVG 패스 그리기 금지. 이모지를 아이콘 대용으로 쓰지 않는다.
- 이미지: 실제 이미지 우선(이미지 생성 도구 → `https://picsum.photos/seed/<설명>/w/h` → 명시적 TODO 슬롯). `<div>`로 만든 가짜 스크린샷/가짜 대시보드 금지. 히어로는 텍스트+그라데이션 블롭만으로 끝내지 않는다.
- 카피: 컨트롤은 동작을 이름으로(저장, 보내기). 에러는 문제+복구 방법. 필러 동사(혁신적인, 완벽한, 차세대) 금지. "John Doe", "Acme", `99.99%` 같은 가짜 데이터 금지. 출고 전 모든 문자열 재독.
- 의존성: import 전에 `package.json` 확인, 없으면 설치 명령 먼저 출력.

## 6. 성능·접근성

- LCP < 2.5s(히어로 이미지 `next/image priority`), INP < 200ms, CLS < 0.1(이미지·폰트 공간 예약).
- 그레인/노이즈는 `fixed inset-0 pointer-events-none` 의사요소에만. `will-change`는 실제 움직이는 요소에만.
- z-index는 상수 파일에 스케일 정의(nav/overlay/modal/toast). 임의 `z-50` 남발 금지.
- 키보드만으로 전 흐름 완주 가능해야 한다.

## 7. 출고 전 체크 (Playwright 스크린샷과 함께 한 번에)

- [ ] Design Read 선언했는가, 기존 DESIGN.md 토큰과 충돌 없는가
- [ ] 1440 / 390 스크린샷에서 오버플로·줄바꿈 깨짐·겹침 없음
- [ ] 강조색 1개·중립 1계열·반경 체계 1개·테마 1개로 잠금
- [ ] 눈썹 라벨 ≤ 섹션/3, 섹션 번호 0, 화면 문자열에 `—` 0개
- [ ] 히어로: 헤드라인 ≤2줄, 서브 ≤2문장, CTA 스크롤 없이 보임, `pt-24` 이하
- [ ] 동일 크기 카드 3개 나열 없음, 지그재그 ≤2연속, 벤토 빈 셀 0
- [ ] 모든 버튼·폼 AA 대비, CTA 한 줄, 같은 의도 CTA 라벨 1개
- [ ] `transition: all` 0, `ease-in` 0, UI 애니메이션 ≤300ms, `scale(0)` 등장 0, 키보드 동작 애니메이션 0
- [ ] `:active` scale 피드백, hover는 `(hover:hover)` 게이트, reduced-motion 대응
- [ ] loading/empty/error 상태 존재, focus-visible 보임
- [ ] `::selection`·스크롤바·focus ring·`tabular-nums` 테마 적용
- [ ] `h-screen` 0, `window.addEventListener('scroll')` 0, Motion은 `'use client'` 리프
- [ ] 가짜 스크린샷 div 0, 손그림 SVG 아이콘 0, 이모지 아이콘 0
- [ ] 카피 재독 완료, 가짜 이름/숫자 0

## 8. 스킬·도구 호출 가이드

| 상황 | 호출 |
|---|---|
| 새 화면/섹션 만들기 | `design-taste-frontend` 규칙으로 Design Read → 빌드, 이후 `/impeccable polish` |
| 기존 화면 점검 | `/impeccable critique <경로>` (UX) / `/impeccable audit <경로>` (a11y·perf·반응형) |
| 밋밋함 / 과함 | `/impeccable bolder` / `/impeccable quieter` |
| 모션 추가·리뷰 | `emil-design-eng` 기준으로 `/impeccable animate`, 리뷰는 Before/After 표 |
| 타이포·간격만 | `/impeccable typeset`, `/impeccable layout` |
| 출고 직전 | `/impeccable harden` → Playwright 1440/390 스크린샷 → 7절 체크 |
| 피그마 시안 반영 | Figma MCP로 파일의 색·간격·타이포 토큰을 읽어 `tailwind.config`/`globals.css` 변수에 매핑 후 구현 |
| 브라우저에서 변형 고르기 | `/impeccable live`, `/impeccable generate 3 variants <요소>` |
