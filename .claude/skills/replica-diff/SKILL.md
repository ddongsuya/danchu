---
name: replica-diff
description: >-
  Compares an app clone against the original: a feature parity score from the
  feature matrix (weighted by must, should, could) with the missing list in
  build order, plus a screenshot layout diff that ignores colour so a rebrand
  does not count against you. Two standard-library Python tools. Use when the
  user says "how close is my clone", "compare it to the original", "what's
  missing", "parity check", "diff the screens", "is it ready", or after
  /replica-test.
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 단추는 이미 운영 중인 서비스다. 이 묶음은 "앱 복제"가 아니라 **다른 서비스의 흐름·화면 구조를 분석해 단추에 맞게 다시 만드는 데**만 쓴다. 원본의 코드·로고·문구·이미지는 가져오지 않는다(원문 규칙과 같다).
> - 산출물 폴더 `replica/`는 커밋하지 않는다(.gitignore). 남의 화면 캡처는 절대 커밋하지 않는다. 사용자에게 줄 결과는 `/mnt/project-files/danchu-replica/`에 둔다.
> - CLAUDE.md, DESIGN.md가 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 브랜드 색 고정, 해요체/합니다체 규칙.
> - 국내 CRO 사이트 스크래핑 금지. 사내 자료(csco-tech-knowledge)의 단가·기간을 화면·테스트 데이터에 쓰지 않는다.
> - 단추에서 가장 쓸모 있는 부분: `imgdiff.py`로 **승인된 시안 캡처 vs 실제 구현 캡처**의 배치를 비교하고, `--mode pixel`로 같은 화면의 이전·이후 회귀를 본다. 남의 화면과 픽셀을 맞추는 데는 쓰지 않는다.
> - 출처와 고친 내용: 이 폴더의 SOURCE.md.

# replica-diff

Two tools in this folder, both standard-library Python, no installs:

```bash
python3 parity.py replica/features.csv                         # feature parity + missing list
python3 imgdiff.py replica/screens/S07.png replica/clone-screens/S07.png --out diff-S07.png
python3 imgdiff.py a.png b.png --json > replica/diffs/S07.json # for parity.py --visual
python3 parity.py replica/features.csv --visual replica/diffs/*.json --markdown > replica/parity.md
```

## What parity means here

**Parity means it does the same job, not that it looks the same.** The
feature score is the number that matters: can a user do everything they could
do in the original. The layout score checks structure (is the information in
the same places, in the same hierarchy), because that is what makes a switcher
feel at home. It deliberately ignores colour, because replica-brand changes
every colour on purpose. Do not chase pixel parity with the original. Its
exact look is its trade dress, and it changes before launch.

## Step 1: feature parity

Make sure `replica/features.csv` is current: every row's `clone` column is
`yes`, `partial` (with a note), `no`, or `skip` (with a reason). Then:

```bash
python3 parity.py replica/features.csv
```

It weights must 3, should 2, could 1, counts partial as half, leaves out
`skip` rows and rows you added that the original does not have, and prints:
the score, must-haves done of total, each area weakest first, and the missing
list in build order. Must-haves not done means not shippable, and it says so.

## Step 2: layout diff

For each key screen, take two screenshots at the **same viewport** (1440x900
desktop, 390x844 mobile) in the **same state** (same data shape, same tab
open, logged in the same way). The original's come from public pages or the
user's own account, saved in `replica/screens/`. The clone's go in
`replica/clone-screens/`.

```bash
python3 imgdiff.py replica/screens/S07.png replica/clone-screens/S07.png --out replica/diffs/S07.png
```

Layout mode (default) turns both into edge maps, cuts them into a grid, and
compares where things are, scoring only cells with something in them. It
reports the score (matches 90+, close 75+, partly 50+, different), the
regions that differ (in the original's pixel coordinates, biggest first), and
a height difference if the clone's page is much longer or shorter. Retina and
non-retina screenshots compare fine: both are scaled to the same width.

`--mode pixel` is exact comparison. Use it for your own regressions (clone
today against clone last week), not against the original.

## Step 3: behaviour diff

Walk each flow in both apps and compare what the scores cannot see: clicks to
finish the core flow, what happens on errors, what is remembered between
visits, what emails arrive. Fewer clicks than the original is a win. Write
each difference as: flow, original does, clone does, fix or keep.

## Step 4: the report

`replica/parity.md`: overall score, feature score, layout score per screen,
missing features in build order, behaviour differences, and a verdict:

- **not shippable**: any must-have missing, or any open S1 bug
- **shippable**: all must-haves done, feature score 80+, no open S1 or S2
- **better than the original**: shippable, plus fixes from
  replica-entrepreneur. This is the goal. A straight copy has no reason to exist.

Give honest numbers. A clone at 62% is at 62%.

## Output

`replica/parity.md`, the diff images, and the top five things to build next.
Then `/replica-build` for the gaps, or `/replica-entrepreneur` if parity is
there.
