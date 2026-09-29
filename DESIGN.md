---
name: Danchu Research Workspace
description: 비임상 시험의 요청과 견적 비교를 위한 차분한 연구 워크스페이스
colors:
  primary: "#246457"
  primary-deep: "#194e43"
  primary-tint: "#edf4f0"
  background: "#fcfdfb"
  surface: "#f3f5f2"
  text: "#202b28"
  secondary: "#66716c"
  border: "#dfe5e0"
  dark-primary: "#92cfb7"
  dark-background: "#1c2520"
  dark-surface: "#131b17"
typography:
  display:
    fontFamily: "Pretendard Variable"
    fontSize: "clamp(36px, 4.05vw, 56px)"
    fontWeight: 600
    lineHeight: 1.27
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Pretendard Variable"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
---

## Overview

랜딩은 Persuade, 안내는 Read, 포털은 Operate. 연구를 시작하는 사람에게는 간결한 출발점을, 업무 중인 사람에게는 명확한 상태와 다음 행동을 제공한다. 제품 사실과 중립 원칙은 PRODUCT.md를 따른다. 스타일은 일반 CSS이며 Tailwind를 추가하지 않는다.

## Colors

모든 색의 실제 정의는 `app/globals.css`. 밝은 연구 환경을 위한 그린 그레이 바탕과 짙은 녹색 강조를 사용한다. 공개·인증·포털·토큰 회신은 같은 토큰을 공유한다. 다크 모드는 `data-theme`의 CSS 변수로만 바꾼다. 성공·경고·오류 색은 의미가 있는 상태에 한해 사용한다. 꼬리말도 같은 테마를 유지한다.

## Typography

기존 셀프호스트 Pretendard Variable을 유지한다. 한글은 keep-all, 긴 사용자 입력은 overflow-wrap으로 보호한다. 큰 제목은 56px 이내, -0.04em보다 좁게 하지 않는다. 포털 제목은 29px, 행 제목은 16px, 보조 정보는 12~14px. 요청 번호·금액·기간은 tabular-nums를 사용한다.

## Layout

공개 사이트는 최대 78rem, 기본 좌우 24px, 휴대전화 22px. 첫 화면은 설명과 사진의 두 열이며 899px 이하에서 한 열이 된다. 시험 분야는 필터와 펼침 목록, 안내는 선으로 구분한 순서, 비교 설명은 항목표로 구성한다. 기존 상세 설명은 `/how-it-works`로 보존한다.

포털은 960px 이상에서 244px 사이드바와 72px 상단 바. 그 아래에서는 상단 바와 하단 탭을 쓴다. 요청 목록은 넓은 화면에서 정렬된 열, 좁은 화면에서는 두 열로 정보를 재배치한다. 가로로 긴 업무 표는 표 컨테이너 안에서만 스크롤한다.

## Elevation & Depth

테두리 또는 표면색으로 그룹을 구분한다. 광고성 부유 카드나 그림자 중첩을 쓰지 않는다. 실험실 이미지는 생성한 브랜드 분위기 자료이며 특정 기관의 사진이나 시험 수행 증거가 아니다. `public/images/lab-glassware.prompt.txt`에 출처를 기록한다.

## Shapes

8px는 작은 입력·상태, 12px는 버튼·알림, 16px는 큰 표면과 이미지에 사용한다. pill은 필터와 짧은 태그에 한한다. 네 구멍의 단추 마크를 공개와 포털에서 공통으로 사용한다. 아이콘은 Phosphor regular; 기존 양식의 SVG 아이콘은 기능을 보존한다.

## Components

- 기본 행동은 채운 버튼, 보조 행동은 테두리 버튼, 문서 이동은 텍스트 링크.
- 시험 분야 필터는 aria-pressed, 상세 항목은 aria-expanded. 검색 결과 개수는 status로 안내.
- 모바일 메뉴는 native dialog로 포커스를 가두고 Escape와 닫기 버튼을 제공한다.
- 시험 제안은 기존 규칙을 그대로 사용한다. 네이티브 select가 상태 변경 때 재마운트되지 않도록 컴포넌트를 바깥에 정의한다.
- 포털 목록은 검색·상태 필터·비어 있음·일치 결과 없음 상태를 제공한다.
- 키보드 focus-visible을 유지하고 축소 모션 설정을 존중한다. 반복 업무는 불필요한 진입 애니메이션을 쓰지 않는다.
- `/design-preview`는 `DANCHU_DESIGN_PREVIEW=1`에서만 보이는 합성 데이터 검토 화면. 기존 인증이나 데이터 접근 규칙을 바꾸지 않는다.

## Do's and Don'ts

제품에 있는 기능만 약속한다. 의뢰자·기관을 함께 고려한다. 기관의 순위나 기준을 임의로 정하지 않는다. 상세 견적 정보는 필요할 때 찾게 하고, 첫 화면에는 핵심 행동을 둔다. 가짜 기관·실적·인증·가격을 만들지 않는다. 카드 3개를 반복하는 장식적 구조, 그라데이션 글자, 자동 스크롤 효과, 명암 반전 섹션을 피한다. `main`은 운영 브랜치이며 이 디자인은 별도 브랜치에서 검토한다.
