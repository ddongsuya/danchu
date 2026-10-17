# MiroFish로 단추 시나리오 보고서 만들기

MiroFish(github.com/666ghj/MiroFish, AGPL-3.0)는 자료를 읽고 가상 인물 수십 명을 만들어 모의 SNS에서 반응을 주고받게 한 뒤 보고서를 쓰는 다중 에이전트 시뮬레이션 도구입니다. 이 폴더는 MiroFish를 **수정하지 않은 별도 도구**로 설치해, 화면 없이 API로 돌리고 단추에 관한 보고서를 받는 데 필요한 것을 모아 둔 곳입니다. 단추 서비스 코드와는 연결되지 않습니다.

## 먼저 알아 둘 것

- **예측이 아니라 시나리오 탐색입니다.** 결과는 LLM이 만든 가상 인물의 반응이며 검증된 예측이 아닙니다. 같은 입력으로도 실행마다 결과가 달라지고, 에이전트가 한쪽 의견으로 쏠리는 경향이 보고되어 있습니다. 보고서는 실제 의뢰자·기관 인터뷰로 확인할 가설 목록으로 씁니다. 가능하면 2~3회 돌려 반복해서 나오는 주제만 남깁니다.
- **자료가 외부로 나갑니다.** `seed/upload/`의 문서와 시뮬레이션 내용은 LLM 제공자(OpenAI)와 Zep Cloud로 전송됩니다. 그래서 업로드 문서에는 공개 문구와 공개해도 되는 설명만 넣었습니다. `seed/optional/`(내부 과금 구조 초안)은 단추 팀이 동의한 경우에만 `--include-internal`로 올립니다.
- **비용**: `gpt-4o-mini` 기준 1회 약 0.4~2.2달러(추정, 2026-10-14 가격). Zep은 1회 약 1~3천 크레딧(추정). OpenAI는 선불 크레딧과 사용 한도를 걸어 두고 씁니다.
- **모델**: 기본값 `gpt-4o-mini`를 씁니다. OpenAI 공지상 2027-01-14에 종료되므로 그 뒤에는 다른 모델을 따로 시험해야 합니다. Claude 키는 쓸 수 없습니다(MiroFish가 보내는 temperature 값을 최신 Claude 모델이 거부합니다).

## 준비물

| 이름 | 필수 | 설명 |
|---|---|---|
| `LLM_API_KEY` | 예 | OpenAI API 키 |
| `ZEP_API_KEY` | 예 | Zep Cloud 키 (app.getzep.com) |
| `LLM_BASE_URL` | 아니요 | 기본값 `https://api.openai.com/v1` |
| `LLM_MODEL_NAME` | 아니요 | 기본값 `gpt-4o-mini` |

클라우드 세션에서는 환경 설정(세션 제목줄의 환경 메뉴 → Edit)의 **환경 변수**에 넣고, 저장한 뒤 **새 세션**을 엽니다. 키 값은 채팅이나 파일에 적지 않습니다. 이 폴더의 스크립트는 변수 이름만 출력합니다.

그 밖에 git, uv, Python 3.11 또는 3.12, 디스크 약 8GB, 실행 시간 1~1.5시간이 필요합니다.

## 실행 순서

저장소 루트에서 실행합니다.

```bash
# 1. 설치: 고정 커밋으로 받아 가상환경을 만듭니다 (약 5분, 약 7GB, 다시 실행해도 안전)
tools/mirofish/setup.sh

# 2. 키 확인: LLM 1회 호출 + Zep 임시 그래프에 항목 10종 설정 후 삭제 (크레딧 거의 없음)
~/.cache/danchu-mirofish/venv/bin/python tools/mirofish/preflight.py

# 3. 백엔드 시작: 127.0.0.1:5001, 상태 확인까지 기다립니다
tools/mirofish/start-backend.sh

# 4. 계획만 확인 (네트워크 호출 없음)
~/.cache/danchu-mirofish/venv/bin/python tools/mirofish/run.py --requirement R1-launch-reaction --dry-run

# 5. 실행: 1~1.5시간. 끝나면 runs/<시각>-<시나리오>/full_report.md 가 생깁니다
~/.cache/danchu-mirofish/venv/bin/python tools/mirofish/run.py --requirement R1-launch-reaction --cleanup

# 6. 백엔드 종료 (진행 중인 기록 정리에 최대 수 분 걸릴 수 있습니다)
tools/mirofish/start-backend.sh --stop
```

- 2단계에서 Zep이 실패하면 요금제가 MiroFish가 쓰는 항목 수(10종)를 허용하지 않는 것입니다. 무료 플랜은 5종으로 안내되어 있습니다. 비용을 쓰기 전에 여기서 멈추고 요금제를 확인합니다.
- `--cleanup`은 보고서를 저장한 뒤 Zep에 올린 그래프와 프로젝트를 지웁니다. 단추 자료를 Zep에 남기지 않으려면 붙입니다.
- Claude Code 세션에서 돌릴 때 5단계는 백그라운드 실행 제한 시간을 최대(2시간)로 두고 실행합니다. 백엔드가 꺼지면 시뮬레이션도 함께 끝나고, 시뮬레이션은 이어서 재개할 수 없습니다.

## 시나리오 (`seed/requirements/`)

MiroFish에는 영어본(`.en.txt`)을 보내고 보고서도 영어로 받습니다. 한국어 출력은 MiroFish를 고쳐야 해서 쓰지 않습니다. 한국어본(`.ko.txt`)은 사람이 읽는 용도입니다.

| ID | 내용 | 내부 자료 |
|---|---|---|
| `R1-launch-reaction` | 출시 발표 직후(모의 시간 약 하루) 의뢰자와 기관의 첫 반응 | 필요 없음 (첫 실행 추천) |
| `R2-fee-acceptance` | 기관의 수수료 구조 수용성 | `--include-internal` 필수, 단추 팀 동의 후 |
| `R3-neutrality-trust` | 단추의 중립성 주장에 대한 신뢰 | 필요 없음 |

## 시드 자료 (`seed/`)

| 경로 | 내용 |
|---|---|
| `upload/01-danchu-overview.md` | 단추가 무엇이고 의뢰자·기관·운영자가 어떻게 쓰는지 |
| `upload/02-business-public.md` | 공개된 약관·안내 문구만 |
| `upload/03-market-context.md` | 단추 문구에 적힌 견적 현장의 어려움. 수치 없음 |
| `upload/04-stakeholder-personas.md` | 가상 이해관계자 11명. 실존 인물·기관이 아님 |
| `optional/02-business-internal.md` | 내부 과금 구조 초안. 동의 후에만 업로드 |
| `evidence/SOURCES.md` | 각 문장의 저장소 근거(파일:줄). 업로드하지 않음 |

시드에는 실제 기관명, 금액, 요율, 시장 수치를 넣지 않았습니다. 규제기관 이름도 넣지 않았는데, 넣으면 MiroFish가 규제기관을 가상 인물로 만들기 때문입니다. `run.py`는 준비 단계 전에 규제기관처럼 보이는 항목이 추출되면 멈춥니다.

## run.py 안전장치

- **비용 상한**: 가상 인물이 `--max-agents`(기본 40)를 넘으면 시작하기 전에 멈춥니다(종료 코드 3). 확인한 뒤 `--yes`로 계속합니다.
- **라운드 확인**: 모의 시간이 하루보다 짧거나 낮 시간 라운드가 15개보다 적으면 멈춥니다. 초반 밤 시간대는 활동이 거의 없기 때문입니다.
- **R2 차단**: `--include-internal` 없이 R2를 실행하면 거부합니다.
- **재실행 보호**: 다른 시뮬레이션이 이미 쓴 그래프를 다시 쓰지 않습니다. 쓰면 앞선 결과가 섞이기 때문입니다.
- **재개**: 중간에 끊기면 출력에 나온 `--project-id` / `--simulation-id` / `--report-only`로 이어 갑니다.
- **기록**: 모든 단계의 ID와 상태를 `runs/.../run.json`에 남깁니다. 키 값은 가려서 기록합니다.

## 결과물

`runs/<UTC 시각>-<시나리오>/` 아래에 `full_report.md`(영어 보고서), 가상 인물 목록, 시뮬레이션 설정, `run.json`이 생깁니다. `runs/`는 커밋하지 않습니다. 보고서는 검토한 뒤 한국어로 정리해 필요한 곳에 옮깁니다. 정리할 때 "모의 시뮬레이션 결과이며 예측이 아님"을 함께 적습니다.

## 라이선스

MiroFish는 AGPL-3.0입니다. 수정하지 않고 내부 도구로만 실행하므로 소스 공개 의무는 생기지 않는 것으로 봅니다(법률 자문 아님). MiroFish 코드를 단추 서비스에 넣거나, 고쳐서 외부에 제공하려면 먼저 법률 검토를 받습니다. 이 폴더의 스크립트는 MiroFish의 HTTP API만 호출하며 MiroFish 코드를 포함하지 않습니다.
