---
name: graphify
description: 단추 저장소용. 큰 수정 전에 "이걸 고치면 어디가 같이 바뀌나"를 찾을 때, 함수·파일·DB 테이블이 서로 어디서 이어지는지 물을 때 쓴다. graphify CLI로 코드 그래프(graphify-out/)를 만들고 query·explain·path로 묻는다. grep 대신 연결 관계가 필요할 때 쓴다.
---

# graphify (단추 사본)

코드를 tree-sitter로 읽어 함수·파일·SQL을 점, 호출·import·포함을 선으로 잇는 그래프를 만든다. 코드 그래프는 AI를 부르지 않고 컴퓨터 안에서만 만든다(단추 전체 약 12초).

## 처음 한 번

```bash
uv tool install 'graphifyy[sql]==0.9.107'   # 또는 pipx install 'graphifyy[sql]==0.9.107'. [sql]이 없으면 마이그레이션 66개가 빠진다
```

`graphify install`(전역 스킬 등록)과 `graphify hook install`(git 훅)은 하지 않는다. 이 사본이 그 역할을 한다.

## 그래프 만들기·고치기

```bash
graphify update .        # 저장소 루트에서. 바뀐 파일만 다시 읽는다. 결과는 graphify-out/ (커밋 금지, .gitignore에 있음)
graphify update . --force   # 파일을 많이 지운 뒤 그래프가 줄어드는 걸 허용할 때
```

브랜치를 바꾸거나 큰 병합 뒤에는 다시 `graphify update .` 한다. `/graphify .`(문서·PDF까지 AI로 읽는 전체 실행)는 사용자가 요청할 때만 쓴다. AI 비용이 들고 문서 내용이 모델로 간다.

## 묻기

```bash
graphify explain "getSupabaseAdmin"          # 이 점의 정의 위치와 이웃(기본 20개, --all 전체)
graphify path "NewRequest" "effectiveSuccessFee" --undirected   # 두 점이 어떻게 이어지나
graphify query "effectiveSuccessFee callers"   # 질문에 맞는 부분 그래프. 코드 이름으로 묻는다
```

- `query`는 질문 속 단어를 점 이름에 맞춰 출발점을 고른다. 한국어 문장으로 물으면 tools/mirofish 문서 제목에 걸리기 쉬우니 함수·파일 이름을 넣는다.
- 이름이 여러 개에 걸리면 종료 코드 3과 후보 목록이 나온다. 파일 경로가 들어간 이름으로 다시 묻는다.
- 선마다 `EXTRACTED`(코드에 그대로 있음) / `INFERRED`(graphify가 추론) 표시가 붙는다. 수정 범위를 정할 때는 `INFERRED`만으로 판단하지 않고 해당 파일을 연다.
- 그래프는 출발점을 찾는 도구다. 최종 확인은 늘 코드를 읽고 `npm run typecheck`, 테스트로 한다.

## 단추에서 알아 둘 것

- 허브(연결 많은 순): `getSupabaseAdmin`, `sessionOrNull`, `requireSession`, `dbReady`, `notifyUsers`, `logEvent`, `rateLimited`. 이것들을 바꾸면 거의 모든 화면이 영향받는다.
- `tools/mirofish/` 파이썬 스크립트가 "main" 묶음으로 따로 잡힌다. 앱 코드와 무관하다.
- `graphify-out/graph.html`은 unpkg에서 vis-network를 불러오므로 인터넷 없이 열면 빈 화면이다.
- 사용자에게 그래프를 보여 줄 때는 graph.html을 그대로 보내지 말고 Artifact로 올린다(앱 미리보기에서 4MB html이 안 보였다, 2026-11-12).

출처와 바꾼 내용은 SOURCE.md.
