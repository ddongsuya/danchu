# 출처 (ui-ux-pro-max)

- 원본: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/623a9a9037d006ea727f8213f084d02a6b6f11b5/.claude/skills/ui-ux-pro-max (MIT, LICENSE 참고)
- 2026-10-22 추가. 원본 파일은 고정한 커밋의 jsDelivr sha256 목록과 모두 같음을 확인했다.
- 넣은 것: SKILL.md, references/(pro-rules, quick-reference), scripts/(search.py, core.py, design_system.py, reasoning_contract.py: 표준 라이브러리만, 네트워크·하위 프로세스 없음), data/ 의 CSV 11개, data/stacks/nextjs.csv·react.csv
- 뺀 것: scripts/tests/, scripts/validate_data.py(개발용), data/motion.csv(GSAP, CLAUDE.md 4절과 충돌), data/google-fonts.csv(글꼴은 Pretendard 셀프호스트로 고정), 런타임에 읽지 않는 JSON 4개, nextjs·react 외 스택 20개, 같은 저장소의 다른 스킬(ui-styling: shadcn·Tailwind 설치, design·brand·design-system: 외부 이미지 API·토큰 생성, banner-design, slides)
- 고친 것 (SKILL.md 만): 설명을 근거 조회용으로 좁힘, 단추 규칙 블록 추가, 실행 경로 `${CLAUDE_PLUGIN_ROOT}` → 저장소 루트 기준 `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`, 디자인 시스템 생성(--design-system, --persist, 다이얼) 단계를 "단추에서는 쓰지 않음"으로 표시, 남긴 스택만 안내, gsap·google-fonts 도메인 행 삭제
- `npx skills add` 나 플러그인 설치로 바꾸지 않는다 (고정되지 않고 위 파일을 모두 넣는다).
