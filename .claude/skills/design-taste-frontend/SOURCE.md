# 출처 (design-taste-frontend)

- 원본: https://github.com/Leonxlnx/taste-skill (MIT, LICENSE 참고)
- 2026-09-28 `npx skills add` 로 설치 (skills/taste-skill, 내용은 upstream 3c7017d 와 같음)
- 2026-10-22 본문 갱신: https://github.com/Leonxlnx/taste-skill-classics/blob/5e08c9383dc4ad7fc0df70e1ac8cfa09ec356305/skills/taste-skill-v2-experimental/SKILL.md 의 본문(6행부터)으로 바꿨다. upstream PR #124(StickyStack·HorizontalPan 수정)와 #126(`transition: all` 제거) 두 건만 다르다. 이름·설명(1~4행)은 그대로 둔다.
- taste-skill v2.1 로 올리지 않았다: Node·헤드리스 Chrome 스크립트를 실행하고, CDN 스크립트·Google Fonts 를 쓰고, 무작위 아트 디렉션을 고르는 다른 스킬이 되었다 (2026-10-22 검토).
- 그래서 skills-lock.json 에서 이 항목을 뺐다. `npx skills update` 가 같은 이름의 v2.1 로 조용히 바꾸지 않게 하려는 것이다. 바꿀 때는 이 파일을 갱신하고 검토 뒤 손으로 바꾼다.
