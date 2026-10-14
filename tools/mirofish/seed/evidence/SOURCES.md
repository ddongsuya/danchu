# 시드 근거 표 (업로드하지 않는 로컬 파일)

이 파일은 MiroFish에 올리지 않습니다. upload/와 optional/ 파일의 각 절이 단추 저장소의 어느 줄에서 나왔는지 적어 둔 사이드카입니다. 초안의 "근거:" 줄을 여기로 옮겼고, 2026-10-14에 저장소(/home/user/danchu, 브랜치 claude/elegant-mendel-q5a9f1, HEAD 4a5b3e4)와 다시 대조했습니다. 경로는 저장소 루트 기준입니다.

표기: "공개"는 로그인 없이 보이는 화면 문구, "제품 문서"는 PRODUCT.md·README.md·docs/, "구현"은 실제로 실행되는 코드와 DB 함수, "주석"은 코드 주석입니다. 주석은 구현으로 세지 않습니다.

## upload/01-danchu-overview.md

### 1. 단추는 무엇인가
- B2B 발주 플랫폼, 한 번 요청하고 같은 양식 회신, 항목별 비교: PRODUCT.md:19 · app/about/page.tsx:45-46 (공개)
- 상황 답변과 가이드라인 근거 제안, 규칙은 초안: PRODUCT.md:21, 41 · lib/faq.ts:11 (공개) · app/how-it-works/page.tsx:237 (공개). 원문은 가이드라인 이름을 적지만 시드에서는 "국제·국내 가이드라인"으로 바꿨습니다.
- 이름과 도메인: PRODUCT.md:50
- 중개자, 계약 당사자 아님: app/terms/page.tsx:105-108 (제8조 1항)
- 시범운영 단계, 사업자 정보 추후 반영: app/terms/page.tsx:164-165
- 랜딩 첫 화면 문구: app/page.tsx:29-30

### 2. 이해관계자
- 의뢰자, 기관, 운영자 정의: PRODUCT.md:11-15
- 기관 화면 회신과 로그인 없는 링크 회신: README.md:21-22 · app/for-cro/page.tsx:16
- 기관 내 대표·구성원 역할: README.md:81
- 운영자 업무(승인, 배포, 비교표 공개, 종료·취소, 역할 관리): README.md:23 · PRODUCT.md:15
- 동등하게 본다: PRODUCT.md:11
- 협력기관 준비 중, 확정된 곳 없음: app/partners/page.tsx:8, 19-20

### 3. 의뢰자 흐름
- 상태 순서와 취소: lib/status.ts:5-13 · README.md:12
- 업무용 이메일 가입, 의뢰자 이용료 없음: components/auth/SignupView.tsx:69 · app/how-it-works/page.tsx:281
- 요청서 4단계: PRODUCT.md:75 · app/how-it-works/page.tsx:117
- 입력 항목: lib/rfq-schema.ts:149 (의뢰 목적), 154-155 (요청 성격), 159 (개발 분야), 187-205 (제출처), 211-212 (물질명, 코드명), 217 (착수 시기), 222-223 (회신 희망일), 228-229 (예산 구간), 241 (기관 수), 245-247 (지명 기관), 251-254 (기밀 등급) · app/how-it-works/page.tsx:13-23 (첨부 파일당 20MB는 22행). 제출처 목록의 기관 이름은 시드에서 빼고 "제출처(국내외 복수 선택)"로만 적었습니다. "규제기관" 같은 일반 명사도 MiroFish 온톨로지 프롬프트(backend/app/services/ontology_generator.py, 정부·규제기관을 행위자로 뽑으라고 요구)가 에이전트로 만들 수 있어 뺐습니다.
- 요청 성격은 전달 여부와 무관: lib/rfq-schema.ts:154 · lib/request-policy.ts:79-80
- 자동 배포 대상(분야 겹침, 전부 꺼 둔 기관 제외): lib/distribute.ts:28-58 (matchOrgs)
- 지명 기관 먼저, 나머지는 분야 매칭: lib/rfq-schema.ts:246 · lib/distribute.ts:209-224
- 지명 기관은 분야 대조와 꺼 둔 항목 확인 없이 전달: lib/distribute.ts:212 (주석 "분야가 안 맞아도 의뢰자의 선택을 존중한다"), 216-220 (matchOrgs를 거치지 않고 cro_orgs에서 바로 조회)
- 운영자 수동 배포는 승인된 기관 어디에나: app/api/admin/rfqs/[no]/distribute/route.ts:10-13, 27, 37-38 · supabase/migrations/0009_anonymous_billing.sql:23 (분야 불일치 전달을 청구 제외 사유로 둠)
- 회신 기한 기본값 평일 7일: lib/faq.ts:15 · lib/rfq-schema.ts:223 · lib/distribute.ts:62-67
- 기한 전 회신 수만 보이고 기관명 가림: app/how-it-works/page.tsx:69, 205 · lib/faq.ts:27
- 비교표 자동 공개는 기한 다음 날, 제출 회신 1건 이상일 때: app/api/cron/daily/route.ts:143-147 (reply_by < 오늘) · lib/compare.ts:6-14 · app/how-it-works/page.tsx:70
- 운영자는 회신 1건 이상이면 언제든 공개(기한 확인 없음): app/api/admin/rfqs/[no]/compare/route.ts:8-17 · components/admin/AdminActions.tsx:35 (회신 0건일 때만 버튼 비활성) · lib/compare.ts:13-14
- 공개되면 아직 제출하지 않은 기관의 회신도 닫힘: lib/quote-load.ts:185-193
- 순위 없음, 표시 순서는 의뢰자가 선택(기본은 정렬 없음, 총액·기간·착수일): components/CompareBoard.tsx:58-73, 209-219 · app/how-it-works/page.tsx:145
- 선택한 기관에 회사명·연락처 공개: app/how-it-works/page.tsx:71 · lib/faq.ts:31 · app/api/rfq/[no]/select/route.ts:55-59 (선정 알림에 연락처) (회사명 예외는 5절)
- 선택할 수 없는 견적(예비 견적, PDF·착수일 없음, 유효기간 지남): lib/quote-policy.ts:1-16 · PRODUCT.md:75
- 직접 계약, 조건 불관여: lib/faq.ts:31 · app/how-it-works/page.tsx:72
- 계약 보고 뒤 상태는 "계약 진행", 운영자가 종료: app/api/awards/[id]/contract/route.ts:11, 31-32 · supabase/migrations/0016_contract_report_guard.sql:29 · README.md:8-9. 공개 문구 "보고하면 요청이 종료": app/for-cro/page.tsx:19 · app/how-it-works/page.tsx:73, 96. 초안은 공개 문구만 따랐기 때문에 고쳤습니다.
- 계약금액 VAT 별도: app/for-cro/page.tsx:19
- 비교표 공개 14일 뒤 진행 여부 질문: app/api/cron/daily/route.ts:164-176
- 선택 없이 마무리한 결과(외부 진행, 보류, 취소): app/api/rfq/[no]/outcome/route.ts:9, 13 · supabase/migrations/0009_anonymous_billing.sql:16

### 4. 기관 흐름
- 참여 절차 6단계: app/for-cro/page.tsx:13-20
- 꺼 둔 항목만 있는 요청 제외와 분야 맞는 요청서 수신은 자동 배포 기준: lib/distribute.ts:28-58. 지명·수동 배포 예외는 3절 근거와 같음. 공개 문구(app/for-cro/page.tsx:15-16)는 예외 없이 적습니다.
- 승인 보통 영업일 1~2일: app/for-cro/page.tsx:14 · app/how-it-works/page.tsx:287
- 담당자 추가(합류) 신청: app/for-cro/page.tsx:95 · README.md:60-62
- 링크 유효기간 기한 후 7일: app/for-cro/page.tsx:16 · lib/request-policy.ts:64-69
- 승인이 늦어도 같은 기한: app/for-cro/page.tsx:33 · app/how-it-works/page.tsx:92
- 선정되지 않은 기관에는 결과만: app/for-cro/page.tsx:32
- 회신 양식 칸: app/for-cro/page.tsx:22-29 · app/how-it-works/page.tsx:24-33
- 기본 포함 항목 8개: lib/catalog.ts:66
- 검체 단가 분야: lib/catalog.ts:75 · app/for-cro/page.tsx:24

### 5. 정보 공개와 기밀 등급
- 구현: 회사명 공개 조건은 "선정됨 또는 그 기관의 CDA 체결 확인": lib/request-policy.ts:19-22 (identityVisible) · tests/billing-policy.test.ts:12-13
- 구현 사용처(회사명과 첨부 파일명에만 쓰임): app/cro/page.tsx:39 (기관 받은 요청 목록) · lib/quote-load.ts:34-36 (회신 화면, 토큰 링크 포함) · lib/quote-load.ts:109 (첨부 파일명) · components/cro/RequestView.tsx:31 · app/api/files/[id]/route.ts:50-57 (내려받기 파일명)
- 담당자 연락처는 선정된 기관에만: lib/data.ts:136-141 (연락처를 읽는 곳은 수주 목록뿐) · app/cro/awards/page.tsx:52-57 (수주 화면) · app/api/rfq/[no]/select/route.ts:55-59 (선정 알림)
- CDA 체결 확인은 CDA 필요·자체 CDA 요청에만: app/api/admin/rfqs/[no]/cda/route.ts:19-23 (아니면 거부), 37-46, 55 (기록 문구 "체결 확인 후 회사명·첨부 공개")
- 같은 규칙을 적은 기록: PRODUCT.md:75 ("기관별로 확인한 뒤 회사명과 첨부를 공개")
- 연락처까지 공개한다고 적은 주석(구현과 다름): lib/request-policy.ts:4, 19 · supabase/migrations/0009_anonymous_billing.sql:6 · tests/billing-policy.test.ts:5 (테스트 제목)
- 다르게 적은 공개 문구(선정한 기관에만): app/terms/page.tsx:57 (제4조 2항), 135 (제9조 2항) · lib/faq.ts:19, 31 · app/for-cro/page.tsx:35 · app/how-it-works/page.tsx:71, 87 · lib/rfq-schema.ts:252 (요청서 기밀 등급 설명)
- 다르게 적은 공개 문구(CDA 등급에 따라 가림): app/about/page.tsx:87 · 같은 취지의 제품 문서: PRODUCT.md:35 ("기밀 등급이 CDA 필요이면 체결 전까지 의뢰자 회사명과 첨부를 가린다")
- 선정 전 기관에 보이는 것(기관 유형, 개발 단계, 제출처, 시험 조건): lib/faq.ts:19 · app/for-cro/page.tsx:35 · lib/request-policy.ts:42-45
- 첨부 파일명 익명 표시(회사명이 가려진 기관에만): lib/request-policy.ts:24-34 · lib/quote-load.ts:109 · app/api/files/[id]/route.ts:52-57 · README.md:82. 초안의 예시 크기 값은 뺐습니다.
- 기밀 등급 세 가지: lib/request-policy.ts:49 · app/how-it-works/page.tsx:85-89
- 시험 개요는 체결 전 전달, 비공개 정보는 물질명·설명에 적지 말 것: app/terms/page.tsx:135
- CDA 전자서명 없음, 운영자가 근거 기록 후 공개 범위 변경: app/api/admin/rfqs/[no]/cda/route.ts:24-46 · docs/ux-improvement/README.md:47. README.md:115("마스킹 해제는 운영자가 기밀 등급을 바꾸는 방식")는 지금 코드와 맞지 않는 오래된 문장이라 근거에서 뺐습니다.
- 코드명, 예산 구간만 전달, 비교표는 의뢰자에게만: app/how-it-works/page.tsx:221 · app/terms/page.tsx:137 · lib/rfq-schema.ts:229
- 기관은 언제나 다른 기관 회신을 볼 수 없음: app/how-it-works/page.tsx:205

### 6. 원칙과 중립성
- 원칙 다섯 가지: app/about/page.tsx:29-35 · PRODUCT.md:62-66. 원문 1번의 가이드라인 이름은 시드에서 "국제·국내 가이드라인과 시험법"으로 바꿨습니다.
- 하는 일, 하지 않는 일: app/about/page.tsx:84-98
- 약관 제4조 4항(추천·우선 노출 없음): app/terms/page.tsx:60-62
- 정본 PDF: app/about/page.tsx:71 · app/for-cro/page.tsx:34
- "설계 예", "기관의 방식", 과장 표현 금지: PRODUCT.md:51-52
- 최저가·순위 강조 대신 수행 범위·제외 비용 우선: docs/ux-improvement/README.md:15 · components/CompareBoard.tsx:58-73

### 7. 시험 분야와 제안 범위
- 대분류 15개: lib/rfq-schema.ts:106-122 · app/page.tsx:46. 106행 바로 위 주석은 실제 기관 이름을 담고 있어 시드와 이 파일에 옮기지 않았습니다.
- 제안 지원 유형: lib/faq.ts:11 · app/how-it-works/page.tsx:237 · PRODUCT.md:41
- 랜딩 안내(참고 자료, 규칙은 초안, 기관과 확인): app/page.tsx:73 (공개)
- 약관 제8조 4항(참고용, 자문 아님): app/terms/page.tsx:118-121
- 시험 가이드 페이지는 초안(검토 전): lib/design-guide.ts:10 (검토 여부 false), 12 (안내 문구) · app/guide/page.tsx:13 (검색 노출 차단), 27 ("검토 중인 초안" 표시). 12행 안내 문구는 상담 상대를 적지만, 시드에서는 일반 규제기관 명사가 에이전트로 뽑히지 않도록 "상담을 거쳐 확정하라는 문구"로 풀어 적었습니다.

### 8. 아직 없는 기능과 문서 간 차이
- 아직 없는 기능: PRODUCT.md:42 · README.md:113-116 · app/about/page.tsx:121
- 없는 자료: PRODUCT.md:57
- 차이 1 (회신 일정): app/terms/page.tsx:63-66 · lib/faq.ts:15 · lib/distribute.ts:62-67
- 차이 2 (효력시험): PRODUCT.md:42 · app/about/page.tsx:121
- 차이 3 (예비 견적 자동 제출): app/for-cro/page.tsx:36 · README.md:84 · lib/auth.ts:44-45
- 차이 4 (회사명 공개 시점): 5절 근거와 같음
- 차이 5 (요청 종료 시점): 3절 계약 보고 근거와 같음
- 차이 6 (비교표 공개 시점): 공개 문구 app/about/page.tsx:86 ("기한이 지난 뒤") · app/for-cro/page.tsx:33 ("같은 요청서, 같은 기한") · app/how-it-works/page.tsx:70 · PRODUCT.md:29. 구현은 3절 비교표 근거와 같음

## upload/02-business-public.md

- 의뢰자 무료(FAQ): lib/faq.ts:6-8
- 랜딩 "의뢰자 이용 무료": app/page.tsx:41
- 가입 화면 "의뢰자 이용료는 없습니다": components/auth/SignupView.tsx:69
- 이용 안내 "비용은 없습니다": app/how-it-works/page.tsx:281
- 하지 않는 일 "의뢰자 비용 청구": app/about/page.tsx:98
- 약관 제5조 1항, 2항: app/terms/page.tsx:69-76
- 약관 제2조 참여 CRO 정의: app/terms/page.tsx:27-30
- 기관 참여 조건은 제5조, 별도 계약: lib/faq.ts:7 · app/for-cro/page.tsx:37
- 수수료 금액·방식·시점이 공개 화면에 없음: 공개 페이지(app/page.tsx, app/about, app/faq, app/for-cro, app/how-it-works, app/partners, app/privacy, app/terms, app/guide, components/site, lib/faq.ts)와 가입 화면에서 "수수료", "이용료", "요율"을 검색한 결과, app/terms/page.tsx:73과 components/auth/SignupView.tsx:69("의뢰자 이용료는 없습니다") 외에는 없음
- 절 제목 "중립성과 중개자 지위에 관한 공개 문구": 아래 세 문구(제4조 4항, 제8조, 서비스 소개)는 수수료를 언급하지 않습니다. 수수료는 제5조 2항(app/terms/page.tsx:72-74)에만 나오므로, 두 주제를 한 제목에 묶지 않았습니다.
- 약관 제4조 4항: app/terms/page.tsx:60-62
- 약관 제8조: app/terms/page.tsx:103-113
- 계약 조건 불관여: app/about/page.tsx:97
- 약관 제7조 2항: app/terms/page.tsx:96-99
- 약관 제10조 3항: app/terms/page.tsx:144-146
- 시범운영: app/terms/page.tsx:164-165

## optional/02-business-internal.md

업로드 조건(파일 안에서 옮겨 옴): 이 파일은 기본 업로드 대상이 아닙니다. 단추 팀이 명시적으로 동의한 경우에만 R2(기관 수수료 수용성)에 한해 `--include-internal`로 함께 올립니다. run.py는 R2를 `--include-internal` 없이 실행하지 않습니다(run.py의 NEEDS_INTERNAL). "단추가 참여 기관에 설명하려고 검토 중"이라는 전제는 저장소 근거가 없는 시뮬레이션 가정이라 파일에서 빼고 R2 요구문에 가정으로 표시했습니다. 파일 안에는 "운영 화면에 구현된 초안 구조, 금액·요율·한도 미정"이라는 한 줄만 남겼습니다.

동의 전에 알릴 점: 4절의 기존 고객 면제와 10영업일 신고 기한은 공개되지 않은 참여 약정서 초안 제5조 6항의 조건을 옮긴 것입니다(supabase/migrations/0018_existing_clients.sql:4 · lib/request-policy.ts:116, 둘 다 주석). R2 한국어본의 동의 안내에도 적었습니다.

### 1. 과금 대상과 두 축
- 두 축(전달 1건당 이용료, 선정 견적 금액 기준 성사수수료): supabase/migrations/0009_anonymous_billing.sql:5 · README.md:80
- 값은 자리만 있고 비어 있으면 미정: supabase/migrations/0009_anonymous_billing.sql:10, 35-39 · lib/auth.ts:46-50 · supabase/migrations/0014_billing_close.sql:17-18. 0014의 17행 주석과 lib/auth.ts:49 주석에 있는 요율 예시값, components/admin/OrgTerms.tsx의 입력칸 예시값은 시드에 옮기지 않았습니다.

### 2. 전달 이용료
- 전달 1건 = 청구 1건, 월 한도: lib/distribute.ts:79-87, 99 · lib/request-policy.ts:74-77
- 출처 기록(분야 매칭, 의뢰자 지명, 운영자 수동): lib/request-policy.ts:71-72 · supabase/migrations/0009_anonymous_billing.sql:20-32
- 청구 제외와 사유, 제외분은 한도에서도 뺌: supabase/migrations/0009_anonymous_billing.sql:23, 26-27 · lib/distribute.ts:84-85

### 3. 성사수수료
- 선정 시 선정 견적 총액 고정: supabase/migrations/0009_anonymous_billing.sql:41-45, 68-69
- 기준 금액 × 기관별 요율, 요율 없으면 미정: supabase/migrations/0014_billing_close.sql:7 · lib/billing.ts:16-20 · app/admin/billing/page.tsx:35-41
- 기관 수주 화면 "수수료 정산 기준": app/cro/awards/page.tsx:14
- 운영자 월 명세의 성사수수료(구현): supabase/migrations/0018_existing_clients.sql:43-71 (전달 월로 묶은 초대에 수주를 left join, 계약 보고 조건 없이 면제 제외 선정 견적 합계) · app/admin/billing/page.tsx:41, 89 (그 합계 × 요율) · lib/billing.ts:16-20
- 보고된 계약에만, 계약 보고 달에 청구(주석, 구현과 다름): app/api/cron/daily/route.ts:178-179 · app/api/admin/awards/[id]/exempt/route.ts:10-11. 시드에서는 "코드 주석에만 있는 방침, 확인 필요"로 적었습니다.
- 리마인더 14일, 30일, 45일: lib/contract-reminder.ts:1-3, 11-17 · app/api/cron/daily/route.ts:178-200
- 계약 보고 검증(금액 0, 선정일 이전, 미래 날짜, 중복), 정정은 운영자만: supabase/migrations/0016_contract_report_guard.sql:4-6, 21-24 · app/api/awards/[id]/contract/route.ts:29-32

### 4. 기존 고객 면제
- 면제 취지(기존 고객이면 성사수수료 면제, 신규 의뢰자 한정): supabase/migrations/0018_existing_clients.sql:1, 5-6 · components/cro/OrgClients.tsx:38. 0018의 4행은 미공개 내부 문서를 가리키므로 옮기지 않았습니다.
- 24개월 조건: components/cro/ExemptClaim.tsx:46 · components/cro/OrgClients.tsx:60. 둘 다 화면 안내 문구이며, 기간을 자동으로 검사하는 코드는 없습니다(app/api/rfq/[no]/select/route.ts:78-87은 회사명만 대조). 초안은 이 규칙을 0018:1-6에 연결했는데 그 줄에는 24개월이 없어 고쳤습니다.
- 기존 고객 목록 항목과 대표 담당자만 수정: supabase/migrations/0018_existing_clients.sql:8-22 · components/cro/OrgClients.tsx:54-68
- 선정 때 자동 대조와 운영자 알림: app/api/rfq/[no]/select/route.ts:78-89 · lib/request-policy.ts:109-114
- 회사명 정규화: lib/request-policy.ts:96-105
- 10영업일 신고와 근거 입력, 증빙 별도 제출: app/api/awards/[id]/exempt/route.ts:11-13, 26-30, 37 · components/cro/ExemptClaim.tsx:39 · lib/request-policy.ts:117 (116행 주석은 미공개 내부 문서를 가리키므로 옮기지 않았습니다)
- 운영자 승인·반려·취소, 사유 필수, 기관 알림: app/api/admin/awards/[id]/exempt/route.ts:9-10, 19-21, 31-34
- 목록 비공개: components/cro/OrgClients.tsx:38
- 면제분은 선정 견적 합계에서 빼고 건수만: supabase/migrations/0018_existing_clients.sql:32-38

### 5. 월 명세와 마감
- 화면의 기관별 월 집계 열: app/admin/billing/page.tsx:73-90 (회신하지 않음 열은 집계 함수에만 있고 화면에는 없음, supabase/migrations/0018_existing_clients.sql:34-39)
- CSV는 건별 전달 기록: app/api/admin/billing/export/route.ts:13, 34 (기관, 전달일, 요청 번호, 출처, 회신, 청구 대상, 제외 사유, 약정 단가, 청구액) · app/admin/billing/page.tsx:58 · README.md:80
- 서울 시간 기준 월, 전달 월로 묶음(성사수수료 포함): lib/billing.ts:3-14 · supabase/migrations/0018_existing_clients.sql:43-48
- 월 마감과 해제(기록 남음): supabase/migrations/0014_billing_close.sql:4-6, 9-14 · app/admin/billing/page.tsx:59
- 면제 판단은 마감된 달에도 변경 가능: app/api/admin/awards/[id]/exempt/route.ts:13-26 (마감 확인 없음). 10-11행 주석의 이유("계약 보고가 있는 달에 청구")는 구현과 달라 시드에서 뺐습니다.

### 6. 미정과 확인 필요
- 단가·요율·한도 미정: lib/auth.ts:46-50 · supabase/migrations/0009_anonymous_billing.sql:36 · supabase/migrations/0014_billing_close.sql:17
- 정산 기준 금액 불일치: app/admin/billing/page.tsx:35-41 (선정 견적 금액 × 요율) 대 app/cro/awards/page.tsx:14 (계약 보고 = 정산 기준)
- 성사수수료 대상과 청구 시점 불일치: supabase/migrations/0018_existing_clients.sql:43-71 (구현, 계약 보고와 무관하게 전달 월) 대 app/api/cron/daily/route.ts:178-179 · app/api/admin/awards/[id]/exempt/route.ts:11 (주석, 보고된 계약에만 보고 월)
- 결제 방법, 세금계산서, 도입 혜택: 저장소에 없음

## upload/03-market-context.md

- A. 네 가지 어려움: app/about/page.tsx:13-18, 52
- A. "같은 금액도, 같은 견적은 아니니까": app/page.tsx:64
- A. 총액만 보면 같은 값이 다른 구성: app/how-it-works/page.tsx:148
- A. "흩어져 있던 견적을, 하나의 흐름으로": app/page.tsx:53
- A. 막막하면 상황을 답하고 제안: app/about/page.tsx:46
- A. "견적보다 먼저 막히는 곳이 시험 구성": app/guide/page.tsx:25. 초안(검토 전) 페이지입니다: lib/design-guide.ts:10 · app/guide/page.tsx:13, 27. 초안은 이 문장을 공개 문구처럼 인용해서 표시를 붙였습니다.
- A. 의뢰자 두 유형: PRODUCT.md:13 (제품 문서)
- B. 분야 맞는 요청서만, 꺼 둔 항목: app/for-cro/page.tsx:15, 49 (공개 문구 그대로. 자동 배포 기준이며 지명·수동 배포 예외는 01의 3절과 4절에 적었습니다)
- B. "요청서는 단추가 모으고": app/for-cro/page.tsx:48-49 · app/how-it-works/page.tsx:247
- B. 같은 요청서, 같은 기한: app/for-cro/page.tsx:33
- B. 다른 기관 회신 비공개, 결과만 안내: app/for-cro/page.tsx:32
- B. 선정 전 의뢰자 비공개(공개 문구): app/for-cro/page.tsx:35. CDA 체결 확인 시 회사명 예외는 01의 5절 근거와 같음
- B. 로그인 없는 링크: app/for-cro/page.tsx:16
- C. 의뢰 목적과 GLP: app/how-it-works/page.tsx:14
- C. 제출처 복수 선택, 인증과 짝지어 표시: lib/rfq-schema.ts:187-205 · app/about/page.tsx:26. 기관 이름과 "규제기관"이라는 일반 명사는 빼고 "국내외 제출처"로 적었습니다(01의 3절 입력 항목 근거 참고).
- C. 기간 정의, 검체 단가: app/about/page.tsx:22 · app/for-cro/page.tsx:24 · lib/catalog.ts:75
- C. 기본 포함 8개, 취소선: lib/catalog.ts:66 · app/for-cro/page.tsx:27
- C. 별도 옵션 후보 목록: lib/catalog.ts:69 · components/cro/CatalogEditor.tsx:419 (역량 카탈로그 화면, app/cro/catalog/page.tsx:27). 회신 화면에서는 쓰지 않습니다.
- C. 설계 방식은 기관마다 다름: app/for-cro/page.tsx:26 · app/about/page.tsx:25
- C. 상세 조건 비우면 기관 설계: app/how-it-works/page.tsx:21 · app/for-cro/page.tsx:75
- C. 공통 조건: app/for-cro/page.tsx:28
- C. 정본 PDF: app/page.tsx:65 · app/about/page.tsx:71
- D. 일반 지식 3개: 출처 없음(저장소 밖). D2는 "규제기관" 대신 "허가 신청에 쓰는 자료"로 적었습니다. 초안의 D3(의뢰자의 기관 선택 기준)과 D4(중개 서비스의 공급자 수수료, 기존 고객, 직접 거래 쟁점)는 결론을 미리 심을 수 있어 뺐습니다.
- E. 자료 없음과 시범운영, 협력기관 없음: PRODUCT.md:57 · app/terms/page.tsx:164-165 · app/partners/page.tsx:20

## upload/04-stakeholder-personas.md

- 모든 인물은 가상입니다. 저장소에 근거가 있는 것은 원형의 틀뿐입니다.
- 의뢰자 유형(바이오벤처, 제약사, 화장품·의료기기·건강기능식품)과 두 성향: PRODUCT.md:13
- 기관 담당자 역할: PRODUCT.md:14
- 운영자 업무: PRODUCT.md:15 · README.md:23
- 관찰자(클러스터, 협회, 창업 지원기관): app/partners/page.tsx:8, 19-20
- 규제·인허가 컨설턴트: 초안 시뮬레이션 요구의 관찰자 목록에서 가져온 가정 원형이며 저장소 근거는 없습니다.
- 각 인물의 "단추에 대해 아는 것"은 위 01의 공개 문구 부분과 02-business-public, 03의 B절에서만 가져왔습니다. 단추 운영자만 01 전체(구현 동작 포함)를 압니다. 운영자의 참여 조건 문장은 선택 자료의 미정 상태 대신 공개 사실(약관 제5조 별도 계약, 수수료 금액·방식 비공개, 02-business-public 근거)만 씁니다.
- 대형 GLP 기관, 분야 전문 기관, 신생 기관 구분과 각 인물의 상황·관심사는 시나리오 설계를 위한 가정입니다. 단추 문서에는 없습니다. 파일 머리말과 각 문장에 "가정합니다"로 표시했고, "자주" 같은 빈도 표현은 뺐습니다. 참여 기관과 의뢰자는 현재 테스트 계정뿐입니다(PRODUCT.md:58).
- R2·R3가 찾으려는 결론을 미리 말하지 않도록 "확인하고 싶은 점"과 "관심사"를 중립 문장으로 바꿨습니다(관찰자 A의 운영 주체·수익 구조와 중립성, 관찰자 B의 규제 판단 오해 위험, 기관 A의 예산 검토 요청 회신 가치). 요청 성격(예산 검토)은 공개 화면에 없고 로그인 뒤 요청서 화면(lib/rfq-schema.ts:154)과 기관 회신 화면(lib/quote-load.ts:60)에만 있습니다.
- 기존 거래 관계는 의뢰자 B 한 곳에만, 수수료와 무관하게 남겼습니다. 초안 D4(공급자 수수료, 기존 고객, 직접 거래)가 인물 설정으로 다시 들어오지 않게 하기 위해서입니다.

## requirements/

- 요구 문장은 저장소 사실이 아니라 시뮬레이션 지시입니다. 사실 부분은 위 표의 근거를 따릅니다.
- 출시 후 3개월 대신 출시 발표 뒤 하루 정도로 바꾼 이유: 시뮬레이션 시간이 소셜 글 하루 분량 수준이기 때문입니다(critic 9번).
- "예측"을 "시나리오 탐색, 가설과 열린 질문"으로 바꾼 이유: critic 11번.
- R2: 요구문이 과금 구조를 직접 설명하므로, 선택 자료 없이 보내지 않도록 run.py가 `--include-internal` 없는 R2 실행을 거부합니다. 그래서 "자료가 없으면 no data로 적으라"는 대체 문장은 뺐습니다. 성사수수료 기준 금액은 확인 전이라 "견적 또는 계약 금액(기준 확인 전)"으로 적었습니다. 선정 전 익명 처리 항목은 우회 방지 취지(lib/request-policy.ts:5 주석)를 끌어오지 않도록 중립 문장으로 바꿨습니다.
- R3: 약관 제5조 2항(app/terms/page.tsx:73)은 수수료를 "받을 수 있습니다"라고만 적으므로 "기관이 내고 의뢰자는 무료"를 확정 사실처럼 쓰지 않았습니다. "확인 필요" 지점 일부(회사명 공개 시점, 비교표 공개 시점)는 공개 화면이 아니라 구현에서 나온 것이므로, 주의 깊은 독자나 초기 사용자가 알아챌 수 있는 점으로 다루라고 적었습니다.

## 저장소 쪽 확인 사항 (시드 밖, 단추 팀 참고)

시드를 대조하다 찾은 저장소 안의 어긋남입니다. 시드는 구현된 동작을 기준으로 적고 "확인 필요"로 표시했습니다.

- 회사명·연락처 공개: lib/request-policy.ts:4, 19 주석과 supabase/migrations/0009_anonymous_billing.sql:6 주석은 CDA 체결 확인 시 "회사명·연락처"를 공개한다고 적지만, 화면은 회사명과 원래 첨부 파일명만 보여 주고 연락처는 선정된 기관에만 줍니다.
- 비교표 공개 시점: 운영자 공개 버튼과 API에 기한 확인이 없어, 기한 전에 공개하면 아직 제출하지 않은 기관의 회신이 닫힙니다. 공개 문구는 "기한이 지난 뒤", "같은 기한"이라고 적습니다.
- 성사수수료 청구: 주석은 "보고된 계약에만, 보고가 있는 달에 청구"라고 적지만, 운영자 월 명세는 계약 보고와 관계없이 선정된 수주를 요청이 전달된 달에 셉니다.
- README.md:115의 "마스킹 해제는 운영자가 기밀 등급을 바꾸는 방식"은 지금의 기관별 CDA 확인(app/api/admin/rfqs/[no]/cda/route.ts)과 맞지 않습니다.
