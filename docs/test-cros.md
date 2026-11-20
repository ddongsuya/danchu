# 시험용 가짜 기관 20곳

로컬 시험 서버에서 비교 견적·기관 화면을 실제처럼 시험하려고 넣는 가짜 CRO 기관이에요. **운영 DB(danchu.kr)에는 넣지 않아요.** 스크립트가 `SUPABASE_URL`이 localhost/127.0.0.1이 아니면 바로 멈춰요.

- 수준: 시험용. 실서비스 데이터가 아니에요.
- 단가·기간·설계 값은 모두 지어낸 가상 값이에요. 실제 기관 단가, 사내 자료, 스크래핑 자료는 쓰지 않았어요. 기관마다 배율(0.78~1.32)과 기간 차이(-2~+3주)를 둬서 비교표에서 서로 다르게 보여요.
- 시험 목록 각 줄의 메모는 "테스트용 가상 값", 기관 소개는 "테스트용 가상 기관이에요"로 들어가요.

## 넣기 · 지우기

```bash
# 1) 로컬 Supabase (처음 한 번 init, config.toml 은 커밋하지 않음)
npx supabase init
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta

# 2) .env.local 에 로컬 URL·anon·service 키 (supabase start 출력값)

# 3) 넣기. 이미 있으면 지우고 같은 값으로 다시 넣어요 (값은 매번 같아요)
npx tsx scripts/seed-test-cros.ts

# 지우기만
npx tsx scripts/seed-test-cros.ts --remove

# 계정 목록만
npx tsx scripts/seed-test-cros.ts --list
```

지우기는 `test-cro01@test.local` ~ `test-cro20@test.local` 계정과, 대표 이메일이 그 주소이고 이름이 "테스트 "로 시작하는 기관만 지워요. 기관을 지우면 시험 목록·단가표·설정이 함께 지워져요(on delete cascade).

## 로그인

- 주소: 시험 서버 `/login` (예: http://localhost:3100/login)
- 비밀번호: 모두 `Test1234!x`
- 기관은 모두 승인 상태, 계정은 그 기관의 대표(owner)예요.

| 계정 | 기관 | 분야 | 요금제 |
|---|---|---|---|
| test-cro01@test.local | 테스트 은행나무 랩 | 종합 독성 | free |
| test-cro02@test.local | 테스트 느티나무 랩 | 종합 독성 | plus |
| test-cro03@test.local | 테스트 소나무 랩 | 종합 독성 | pro |
| test-cro04@test.local | 테스트 자작나무 랩 | 종합 독성 | free |
| test-cro05@test.local | 테스트 단풍나무 랩 | 효력 전문 | plus |
| test-cro06@test.local | 테스트 버드나무 랩 | 효력 전문 | pro |
| test-cro07@test.local | 테스트 동백 랩 | 효력 전문 | free |
| test-cro08@test.local | 테스트 목련 랩 | 효력 전문 | plus |
| test-cro09@test.local | 테스트 해바라기 랩 | 효력 전문 | pro |
| test-cro10@test.local | 테스트 민들레 랩 | 약동학·생체시료분석 | free |
| test-cro11@test.local | 테스트 라일락 랩 | 약동학·생체시료분석 | plus |
| test-cro12@test.local | 테스트 수국 랩 | 약동학·생체시료분석 | pro |
| test-cro13@test.local | 테스트 진달래 랩 | 약동학·생체시료분석 | free |
| test-cro14@test.local | 테스트 개나리 랩 | 체외·대체시험 | plus |
| test-cro15@test.local | 테스트 코스모스 랩 | 체외·대체시험 | pro |
| test-cro16@test.local | 테스트 백합 랩 | 체외·대체시험 | free |
| test-cro17@test.local | 테스트 튤립 랩 | 의료기기·환경 | plus |
| test-cro18@test.local | 테스트 국화 랩 | 의료기기·환경 | pro |
| test-cro19@test.local | 테스트 매화 랩 | 소규모 종합 | free |
| test-cro20@test.local | 테스트 도라지 랩 | 소규모 종합 | plus |

## 들어가는 것

- `cro_orgs`: 승인됨, 수행 분야(categories), GLP 인증, 요금제. 전화번호는 비워서 문자가 나가지 않아요. 메일 주소는 `.local`이라 어디에도 배달되지 않아요.
- `cro_catalog`(시험 목록): 기관 분야 안의 항목. 흔한 항목(단회·DRF 2주·반복 4주·13주, Ames·473·소핵, hERG, TK·PK, 조제물 3종, 효력 항암·대사 등)은 그 분야를 하는 기관이면 늘 넣어요. 표준가, 소요 기간, 군 구성, 동물종·경로 여러 개와 다른 조건일 때 표준가(cond_prices), 기본 포함·별도 옵션. 효력 줄은 모델과 비용 다섯 칸 설계(extra.kd.pd)까지.
- `cro_price_items`·`cro_price_settings`(효력 단가표): 효력을 하는 기관 7곳(05~09, 19, 20)에 동물·사육·유발·투여·관찰·분석·병리·영상·보고서 단가와 관리비·이익 %.
