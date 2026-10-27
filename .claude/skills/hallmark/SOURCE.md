# 출처 (hallmark)

- 원본: https://github.com/Nutlope/hallmark/tree/7ec868225c6caa040558c321ee0fefa0e73f83a8/skills/hallmark (MIT, LICENSE 참고. Together AI)
- 2026-10-27 추가. 사용자 요청으로 계정 스킬 활용 분석 중 "AI가 만든 티" 2차 검사용으로 넣었다.
- 넣은 것: LICENSE, scripts/sloplint.mjs, scripts/sloplint-render.mjs (Node 표준 라이브러리만, 네트워크 없음. 렌더 단계만 puppeteer-core 필요), references/ 중 검사에 쓰는 6개(gates.md, redesign.md, flow.md, review-finish.md, review-hero.md, interaction-and-states.md). 원문 그대로.
- 뺀 것: 원본 SKILL.md(페이지 짓기 흐름), references/themes(48개 테마, 그림 5.4MB), genres, macrostructures, layout·imagery·craft 등 짓기용 문서, scripts/theme.mjs·photos.json·imagegen.mjs(Together API)·capture.mjs·install*.mjs·lint-hook.mjs(편집 시 자동 훅), fixtures, agents/.
- 고친 것: SKILL.md를 단추용 검사 전용 안내로 새로 썼다(무시·예외 항목 표 포함). references 안의 짓기 관련 링크는 이 사본에 없는 파일을 가리킬 수 있다.
- 검사 결과 폴더 `.hallmark/`는 .gitignore에 넣었다.
