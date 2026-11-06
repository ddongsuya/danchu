---
name: replica-entrepreneur
description: >-
  Researches the app being cloned and reads what its real users say in public
  reviews (App Store, Google Play, G2, Capterra, Trustpilot, Reddit, Hacker
  News, its own feature-request board), then ranks what they hate, what is
  missing and what is unsolved, turns it into a fix plan for the clone and a
  positioning angle you can sell. Every quote is real, verbatim and linked.
  Use when the user says "what do people hate about X", "read the reviews",
  "how do I make mine better", "find the gap", "what features are missing",
  "how do I position this", "make it sellable", or after /replica-diff.
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 단추는 이미 운영 중인 서비스다. 이 묶음은 "앱 복제"가 아니라 **다른 서비스의 흐름·화면 구조를 분석해 단추에 맞게 다시 만드는 데**만 쓴다. 원본의 코드·로고·문구·이미지는 가져오지 않는다(원문 규칙과 같다).
> - 산출물 폴더 `replica/`는 커밋하지 않는다(.gitignore). 남의 화면 캡처는 절대 커밋하지 않는다. 사용자에게 줄 결과는 `/mnt/project-files/danchu-replica/`에 둔다.
> - CLAUDE.md, DESIGN.md가 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 브랜드 색 고정, 해요체/합니다체 규칙.
> - 국내 CRO 사이트 스크래핑 금지. 사내 자료(csco-tech-knowledge)의 단가·기간을 화면·테스트 데이터에 쓰지 않는다.
> - 공개 리뷰·커뮤니티 글에서 비임상 견적·CRO 발주의 불편을 모을 때 쓴다. 인용은 원문 그대로 링크와 함께, 지어내지 않는다. 리뷰 문구를 단추 화면·홍보에 후기처럼 쓰지 않는다.
> - 출처와 고친 내용: 이 폴더의 SOURCE.md.

# replica-entrepreneur

A straight copy of an app has no reason to exist. This skill finds the reason:
what the original's users hate, in their own words, and fixes it in yours.

Tool in this folder:

```bash
python3 reviews.py replica/reviews.csv --out replica/feedback.md
```

## The rules, which are not negotiable

- **Never fabricate.** No invented reviews, quotes, ratings, counts, users or
  sources. If a source cannot be reached, say so and move on. If there are 14
  reviews, say 14.
- **Every quote is verbatim and linked.** Copied exactly from the page, with
  the URL of the review or thread. `reviews.py` drops any row without a link.
- **Reading, not scraping.** Read review pages the way a person does, in the
  browser, and copy rows into the sheet. No scraping libraries against stores
  or review sites whose terms forbid it. Official public feeds and APIs are
  fine within their terms: Apple's customer reviews RSS feed
  (`https://itunes.apple.com/us/rss/customerreviews/id=<APP_ID>/sortBy=mostRecent/json`),
  the Hacker News Algolia API (`hn.algolia.com/api/v1/search?query=...`),
  Reddit's official API under its terms.
- **No fake reviews, ever.** Not for your app, not against theirs. It is
  illegal in the US (the FTC's 2024 rule) and in many other places.
- **Reviewers are not your testimonials.** Their words are research. Do not
  put them on your landing page.

## Step 1: collect

Aim for 100+ reviews across at least three sources, recent first:

| source | where |
| --- | --- |
| App Store | the app page, Ratings and Reviews, See All; or the RSS feed above |
| Google Play | the listing, See all reviews, sort by newest |
| G2, Capterra, Trustpilot | the product's review pages, filter to 1 to 3 stars too |
| Reddit | search "X alternative", "switched from X", "X sucks", "X vs" |
| Hacker News | the Algolia API or site search, same queries |
| the original's own board | its public roadmap or feature-request board (Canny and similar) and the vote counts |
| its changelog | what it shipped, so you do not "fix" what is already fixed |

Each row in `replica/reviews.csv`: `source,url,date,rating,text`, text copied
exactly. Read the 3 and 4 star reviews too. "Love it, but..." is where the
best fixes hide.

## Step 2: rank

```bash
python3 reviews.py replica/reviews.csv --out replica/feedback.md
```

It sorts reviews into themes (`themes.json`, edit it for the app's category),
weights low ratings and recent reviews higher, marks themes with fewer than 3
reviews or only one source as thin, lists every request in the users' own
words, and surfaces low ratings that matched no theme. Read that last list by
hand. It is often the best part.

## Step 3: three lists

From `feedback.md`, write three ranked lists. Each item: the problem in one
line, how many reviews, how many sources, one or two linked quotes.

1. **What they hate.** Complaints about things the app does.
2. **What is missing.** Features people ask for by name.
3. **What is unsolved.** Whole jobs or groups the app ignores ("not built for
   teams", "useless for therapists"). These become positioning.

Thin themes are listed as thin. Do not present three angry Reddit comments as
a trend.

## Step 4: the fix plan

Pick the top 5 to 8 by evidence times how cheaply you can fix them. For each:
what to build or change, size (S, M, L), which skill does it, and the
evidence. Add each one to `replica/features.csv` as a row with `original` set
to `no`. Pricing and billing complaints go to `/replica-launch`.

## Step 5: the angle

Three positioning options, each grounded in a top theme:

```
For {{who}} who {{hate this about the original, in plain words}},
{{your app}} {{does this instead}}.
Evidence: {{theme}}, {{n}} reviews across {{n}} sources.
```

Recommend one. It drives replica-brand's name and voice and replica-launch's
hero. Do not put the original's name in your app name, ads or store listing.
A factual comparison page is a legal question for a lawyer in your country.

## Output

`replica/reviews.csv`, `replica/feedback.md`, `replica/fixes.md` (three
lists, fix plan, angle), new rows in `features.csv`, and a summary that
states the sample size. Next: `/replica-brand`.
