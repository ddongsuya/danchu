---
name: web-design-guidelines
description: "단추 저장소용. 화면 코드를 Vercel Web Interface Guidelines 규칙으로 줄 단위 점검한다. 요청서·회신·가입 같은 입력 화면, 출고 전 점검, 'UI 점검해줘', '접근성 확인' 요청에 쓴다. Review UI code for Web Interface Guidelines compliance."
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines (단추 사본)

> 원본: vercel-labs/agent-skills@6ec2693 `skills/web-design-guidelines` + 규칙 vercel-labs/web-interface-guidelines@434b7f9 `command.md` (MIT, SOURCE.md). 원본은 점검할 때마다 규칙을 인터넷에서 받아 오지만, 이 사본은 고정한 규칙 `rules.md`를 읽는다. 최신 규칙과 비교하고 싶을 때만 원본 주소에서 받아 차이를 본다.

## 하는 일

1. 점검할 파일을 정한다. 인자가 없으면 이번 브랜치에서 바뀐 `app/**`, `components/**`, `*.css` 파일을 대상으로 한다(`git diff --name-only origin/main...HEAD`).
2. `.claude/skills/web-design-guidelines/rules.md`를 읽는다.
3. 파일을 읽고 규칙마다 확인한다. 화면에 보이는 CSS는 `app/globals.css`, `app/home.css`, `app/site.css`, `components/shell/portal.css`와 각 페이지의 `page.css`까지 함께 본다.
4. 결과는 `rules.md` 맨 아래 형식(파일별, `file:line - 문제`)으로 낸다. 고칠 줄을 사용자에게 보고할 때는 CLAUDE.md 0절대로 `| Before | After | Why |` 표로 바꿔 낸다.

## 단추에서 다르게 읽는 규칙

| 규칙 | 단추에서 |
|---|---|
| Tailwind 표기(`focus-visible:ring-*`, `min-w-0`, `truncate` 등) | 같은 뜻의 일반 CSS로 읽는다. Tailwind를 설치하지 않는다. |
| Title Case, `&` over "and", Numerals for counts, Second person | 영어 문구 규칙이라 한국어 화면에는 적용하지 않는다. |
| Curly quotes, `…` | 한국어 문구는 danchu-copy-check 기준을 따른다. 로딩 문구 끝의 `…`만 적용한다. |
| Placeholders end with `…` | 단추 입력칸의 "예: 50 g" 같은 예시 형식은 그대로 둔다. |
| URL reflects state | 요청서 단계·비교표 필터에 적용을 검토하되, 동작을 바꾸는 수정은 사용자 확인 후. |
| Destructive actions need confirmation | 적용한다. 브라우저 `confirm()` 대신 화면 안 확인 단계로. |
| Animation 항목 | CLAUDE.md 4절(emil-design-eng 기준)과 다르면 CLAUDE.md를 따른다. |

## 우선순위

CLAUDE.md 맨 위 규칙(Tailwind 미사용, 중립, 리디자인 범위) > DESIGN.md 토큰 > CLAUDE.md 디자인 규칙 > 이 스킬.
