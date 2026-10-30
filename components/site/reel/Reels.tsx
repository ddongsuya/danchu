"use client";

import { Reel } from "./Reel";
import { about, aboutDims } from "./films/about";

// 영상 위아래에 남길 높이 [PC, 휴대폰]. 휴대폰은 제목이 영상 위로 올라오므로 더 남긴다
const SIDE: [number, number] = [60, 190];
const SIDE_CTA: [number, number] = [60, 230];
const SIDE_TABS: [number, number] = [150, 220];

/** 페이지별 영상. 서버 페이지에서 바로 쓰도록 빌더를 여기서 묶는다 */
export function AboutReel() {
  return <Reel build={about} dims={aboutDims} reserve={96} label="기관마다 따로 연락하던 견적 요청이, 단추에서는 요청서 한 장으로 여러 기관에 가고, 회신이 비교표로 모이는 과정" />;
}

import { how, howDims } from "./films/how";
export function HowReel() {
  return <Reel build={how} dims={howDims} reserve={96} label="요청서를 접수하면 분야가 맞는 기관에 전달되고, 참여한 기관이 세부 내용을 확인해 견적서를 회신하며, 모인 견적서가 비교 견적이 되어 의뢰자에게 전달되는 과정" />;
}

import { croHero, croHeroDims, croSteps, croStepsDims, CRO_STEPS, croReply, croReplyDims, croRules, croRulesDims } from "./films/cro";
export function CroHeroReel() {
  return <Reel build={croHero} dims={croHeroDims} loop reserve={160} className="rl-hero" label="제약사, 바이오텍, 화장품, 건강기능식품, 의료기기, 화학물질, 연구소가 보낸 요청이 모두 단추를 거쳐 우리 기관 요청함에 쌓이고, 우리 기관이 참여할 요청을 정해 견적서를 회신하면 그 고객이 비교해 우리 기관을 선정하는 장면" />;
}
export function CroStepsReel() {
  return <Reel build={croSteps} dims={croStepsDims} chapters={CRO_STEPS} hint="보고 싶은 단계를 누르면 그 장면부터 볼 수 있어요" reserve={250} label="기관이 참여를 신청하고, 표준 가격을 등록하고, 참여 안내를 받아 참여를 정하고, 견적서를 회신한 뒤 선정되어 계약하는 과정" />;
}
export function CroReplyReel() {
  return <Reel build={croReply} dims={croReplyDims} reserve={SIDE} label="엑셀, PDF, 메일로 온 회신에서 금액이 표시되고, 각 회신이 기관 열이 되어 같은 항목끼리 한 줄로 정리되는 과정. 기관 B 회신에는 TK 분석이 빠져 있다" />;
}
export function CroRulesReel() {
  return <Reel build={croRules} dims={croRulesDims} reserve={SIDE} label="같은 요청서가 같은 기한으로 모든 기관에 동시에 가고, 회신은 비교표로만 모이며 기관끼리는 서로 볼 수 없는 장면" />;
}

import { guideWeeks, guideWeeksDims, WEEK_TABS, guideInd, guideIndDims, guideTests, guideTestsDims, TEST_TABS } from "./films/guide";
export function GuideWeeksReel() {
  return <Reel build={guideWeeks} dims={guideWeeksDims} chapters={WEEK_TABS} hint="임상 투여기간을 눌러 확인해보세요. 근거 ICH M3" reserve={250} label="임상 투여기간에 따라 반복투여독성 시험 기간이 달라지는 모습. 임상 2주 이내는 설치류·비설치류 2주, 2주 초과 6개월까지는 임상과 같게, 6개월 초과는 설치류 6개월·비설치류 9개월" />;
}
export function GuideIndReel() {
  return <Reel build={guideInd} dims={guideIndDims} reserve={SIDE_CTA} label="임상 1상 전에 필요한 시험을 합성의약품과 바이오의약품으로 나란히 비교한 표. 바이오의약품은 유전독성이 통상 불필요하다" />;
}
export function GuideTestsReel() {
  return <Reel build={guideTests} dims={guideTestsDims} chapters={TEST_TABS} reserve={SIDE_TABS} label="단회투여독성, 반복투여독성, 유전독성, 안전성약리의 동물종, 기간, 동물 수, GLP 정보가 차례로 넘어가는 카드" />;
}
