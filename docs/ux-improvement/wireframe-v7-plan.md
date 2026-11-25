# 와이어프레임 v7 반영 계획 (2026-11-26)

시안: claude.ai 아티팩트 "단추 웹앱 와이어프레임" 버전 7. 결정: 새 기능까지 먼저 반영하고 세부 디자인(상세 표시)은 나중에 다시 한다.
원칙: 색·글꼴·모서리는 DESIGN.md 토큰을 그대로 쓴다(세부 디자인 단계에서 바꾼다). PR마다 `npm run typecheck`, `npm run lint`, `npm test`, `npx next build` 통과. 마이그레이션은 `NNNN_snake.sql` 차례대로, `REQUIRED_SCHEMA_VERSION`(lib/schema-version.ts)과 `lib/db-types.ts`를 같이 올린다. 운영 DB 적용은 사용자 확인 후.

순서는 직렬이다(마이그레이션 번호가 이어지고, 뒤 단계가 앞 단계 부품을 쓴다).

| 단계 | 브랜치 | 마이그레이션 | 내용 |
|---|---|---|---|
| 1 | claude/wireframe-v7-shell | 없음 | 공통 껍데기·부품 |
| 2 | claude/wireframe-v7-pay | 0051 | 지급 조건 줄 → 계약서 제4조 |
| 3 | claude/wireframe-v7-round2 | 0052 | 2차 견적 = 견적서 툴, 계약서가 2차 금액 사용 |
| 4 | claude/wireframe-v7-catalog | 0053(필요 시) | 시험 목록 표준 설계·추가/차감 규칙·단가표 범위 |
| 5 | claude/wireframe-v7-crm | 0054 | 선정 이유, 보낸 견적→선정→계약 집계, 담당자별 연결, 활동 첨부·회의록 |
| 6 | claude/wireframe-v7-screens-* | 없음 | 화면 배치: /app, /q, /cro, /admin |

## 1. 공통 껍데기·부품
- `components/shell/Shell.tsx`: 넓은 화면은 위 바(브랜드 / 조직 / 요금제·사용량 / 알림 / 프로필)를 전체 폭으로, 그 아래 사이드바(묶음 메뉴, 맨 아래 설정)와 본문 패널. 좁은 화면 하단 탭은 유지.
- `lib/cro-nav.ts`: Pro 메뉴 묶음을 시안대로 업무(오늘·받은 요청) / CRM(안건·고객사·활동·캘린더·분석) / 견적(견적서·단가표·시험 목록). 요금제별 감춤 규칙은 그대로.
- 공통 부품(`Toast` 실행 취소, `ConfirmDialog`, 대기 중 버튼, 원인별 빈·오류 화면)은 쓰는 곳이 생기는 2~5단계에서 처음 쓰는 PR에 넣는다(쓰는 곳 없는 부품을 미리 만들지 않는다).
- 검증: `tests/cro-nav.test.ts`(묶음·요금제별 메뉴), design-preview 화면 1440·390 캡처.

## 2. 지급 조건 (F1)
- 지금: `cro_quotes.pay_terms text`("30 · 40 · 30"), 견적서 `DocTerms.pay` 자유 글, 계약서 제4조는 `payTerms()` 문자열.
- 바꿈: `PaySchedule = {label, pct, when}[]`(합계 100). `lib/pay-schedule.ts`(검사·기존 글 변환·금액 환산). 0051: `cro_quotes.pay_schedule jsonb`, `save_quote`가 받도록. 회신 폼·견적서 편집·양식 기본값에 줄 추가·삭제 편집기. 계약서 제4조는 줄마다 금액.
- 기존 `pay_terms`는 읽기만 남겨 옛 견적을 보여 준다.

## 3. 2차 견적 (F2)
- 지금: `DetailReply`가 줄마다 금액을 직접 입력, `rfq_detail_targets`에 저장. 견적서 툴과 연결 없음. 계약서는 1차 금액 사용(버그).
- 바꿈: "고쳐서 회신"을 고르면 1차 견적서를 복사한 2차 초안을 견적서 툴로 연다(`copyDoc`이 invite·deal 연결을 잃는 문제부터 고침). 바뀐 줄 차이를 오른쪽에 보여 주고 단가 규칙으로 계산. 보내면 지금의 `save_detail_reply`로 합계·줄을 저장. 계약서는 2차 회신이 있으면 2차 합계·줄을 쓴다.

## 4. 시험 목록 (F3)
- 지금 있는 것: `cro_catalog` 표준 설계 칸, `cro_quote_rates` 추가/차감, 효력 단가표(0047).
- 바꿈: 독성 시험도 효력처럼 "표준 설계" 편집 화면, 추가/차감 규칙 편집에 "규칙 추가"(flat 조정 포함), 기관이 단가표를 효력에만 쓸지 독성 조정에도 쓸지 고르는 설정.

## 5. CRM (F4)
- 0054: `cro_crm_deals.won_reason`, `won_note`. 활동 첨부(스토리지 버킷)와 회의록 칸. 음성 전사는 나중(외부 API).
- 분석: 보낸 견적(`cro_quote_docs.sent_at`) → 선정(won) → 계약(`rfq_awards` 계약 확인) 집계, 선정·실패 사유 분포, 고객사·담당자별.
- 고객사·담당자 상세에 보낸 견적·계약·활동 타임라인.

## 6. 화면 배치
- 시안의 각 화면을 같은 경로에 옮긴다. 의뢰자 /app은 ChatGPT 짜임(왼쪽에 진행 중·끝난 요청). 데이터와 계산은 그대로.
