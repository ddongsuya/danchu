---
name: replica-brand
description: >-
  Names and rebrands an app clone so it is the user's own: name candidates
  with the trademark, domain, store and handle checks to run, a new palette
  checked for contrast, a logo brief, a voice guide, and a sweep tool that
  finds anything of the original left in the codebase. Use when the user says
  "name my app", "rebrand the clone", "make it mine", "pick a name and
  colours", "logo brief", "brand voice", "check for leftovers", or after
  /replica-entrepreneur. Always runs before /replica-launch.
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 단추는 이미 운영 중인 서비스다. 이 묶음은 "앱 복제"가 아니라 **다른 서비스의 흐름·화면 구조를 분석해 단추에 맞게 다시 만드는 데**만 쓴다. 원본의 코드·로고·문구·이미지는 가져오지 않는다(원문 규칙과 같다).
> - 산출물 폴더 `replica/`는 커밋하지 않는다(.gitignore). 남의 화면 캡처는 절대 커밋하지 않는다. 사용자에게 줄 결과는 `/mnt/project-files/danchu-replica/`에 둔다.
> - CLAUDE.md, DESIGN.md가 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 브랜드 색 고정, 해요체/합니다체 규칙.
> - 국내 CRO 사이트 스크래핑 금지. 사내 자료(csco-tech-knowledge)의 단가·기간을 화면·테스트 데이터에 쓰지 않는다.
> - 단추 브랜드는 이미 정해져 있다(danchu-brand-color, 로고). 이름·색을 새로 정하지 않는다. `sweep.py`만 레퍼런스 서비스 이름·색이 코드에 남았는지 검사하는 데 쓴다.
> - 출처와 고친 내용: 이 폴더의 SOURCE.md.

# replica-brand

Nothing launches under the original's identity. This skill is the line
between "a clone" and "your app".

Tool in this folder:

```bash
python3 sweep.py . --avoid "Original Name,Its Company" --domains original.com --colors "#006bff"
python3 sweep.py . --config replica/brand.json        # same, from the brand file
```

Writes `replica/brand.md` and `replica/brand.json` (`avoid`, `domains`,
`colors`, used by `sweep.py`, `listing.py` and replica-deploy).

## Step 1: the name

Read the angle from `replica/fixes.md`. Generate 20 candidates across styles:
descriptive (Booklink), compound (Slotwise), invented (Calvo), metaphor
(Harbor), verb (Book). Then cut to 5 with these filters:

- **Not confusingly similar to the original** in sound, look or meaning, and
  not to any other app in the same category. That is the test trademark
  offices use, so it is the test here. No puns on their name, no "-ly" twin.
- Short, spellable after hearing it once, no awkward meaning in big languages.
- Says something about the angle, or at least does not fight it.

## Step 2: the checks, run, not assumed

For each of the 5, a row per check. Mark each **to run**, or the result with
the date it was run. Never write "available" for a check nobody ran.

| check | where |
| --- | --- |
| US trademark | tmsearch.uspto.gov, the app's class (usually 9 and 42) |
| EU trademark | euipo.europa.eu eSearch, or TMview for many offices |
| Canada | ised-isde.canada.ca trademarks database |
| global | WIPO Global Brand Database |
| domain | `whois name.com`, or the registrar's search |
| App Store and Play | search the exact name |
| handles | X, Instagram, TikTok, GitHub |
| the web | search "name + category" |

These are screening checks, not legal clearance. Before spending money on
the name, a trademark lawyer should do a proper search.

## Step 3: palette

A new palette, written into the same token roles replica-design set up.
Pick a primary brand hue from a different family than the original's (if
theirs is blue, yours is not a nearby blue). Then:

```bash
python3 ../replica-design/contrast.py replica/design/tokens.json
```

Zero AA failures. Add the original's brand colours to `brand.json` so the
sweep catches any that survive.

## Step 4: logo brief

Not a logo, a brief for whoever makes it (the user, a designer, an image
model):

- the idea in one line, tied to the name and angle
- mark type: wordmark, symbol plus wordmark, or monogram
- must work at 16px (favicon) and as a 1024px app icon
- deliverables: SVG, app icon 1024x1024 with no transparency for iOS,
  favicon set, social image 1200x630
- **must not resemble the original's mark**: no shared shape, colour pair or
  letterform trick. Put the original's logo next to the drafts and check.

## Step 5: voice

Three words for how it sounds, with what each does not mean ("direct, not
blunt"). Five do and don't pairs. Then rewrite the 10 most-seen strings in
the clone (sign up, empty states, the main button, the confirmation, the
error) in that voice. All fresh, none echoing the original's phrasing.

## Step 6: the sweep

Replace every placeholder name, colour and string. Then:

```bash
python3 sweep.py . --config replica/brand.json
```

It searches file contents and file names for the original's name (also inside
identifiers like `CalendlyEmbed`), domains and colours, skipping
`node_modules`, build output and the `replica/` planning folder. Exit 1 means
something is left. Fix until it says clean. Also check by eye: the favicon,
the page titles, the email templates, the OG image, the app icon.

## Output

`replica/brand.md` (name with checks, palette, logo brief, voice),
`replica/brand.json`, updated tokens, rewritten strings, and a clean sweep.
Next: `/replica-launch`.
