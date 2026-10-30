import { CATS, type Cat } from "@/lib/rfq-schema";
import { AREA_NAMES } from "@/lib/efficacy";
import { OTHER_AREAS } from "@/lib/other-areas";
export { OTHER_AREAS };

/**
 * 견적 요청 네 갈래(Tox·PD·PK·Other)와 그 경계.
 * 갈래는 "무엇을 확인하려는가"로 나눈다: 독성(Tox), 효과(PD), 체내 농도(PK), 이미 가진 시료·물질의 분석만(Other).
 * 시험물질 투여부터 맡기면 Tox·PD·PK 중 하나, 분석만 맡기면 Other다.
 * 갈래마다 요청서에서 고를 수 있는 시험 항목(cats)이 정해지고, 첫 항목(cats[0])은 PD·PK·Other에서 미리 골라 둔다.
 */
export type Kind = "tox" | "pd" | "pk" | "other";

export const OTHER_CATS: Cat[] = ["기타(임상병리·조직병리 등)", "조제물분석"];
const NOT_TOX: Cat[] = ["PK/TK/ADME·생체시료분석", "효력시험(약효)", ...OTHER_CATS];
export const TOX_CATS: Cat[] = CATS.filter((c) => !NOT_TOX.includes(c));


export type KindInfo = {
  k: Kind;
  tag: string;
  name: string;
  lead: string;
  cats: Cat[];
  /** 요청서로 들어가는 길. Tox만 둘(가이드라인에서 찾기 / 직접 고르기) */
  paths: { title: string; desc: string; ex: string; href: string }[];
  /** 이 갈래가 아닌 경우 → 맞는 갈래 */
  elsewhere: [string, Kind][];
};

export const KINDS: Record<Kind, KindInfo> = {
  tox: {
    k: "tox",
    tag: "Tox",
    name: "독성시험",
    lead: "시험물질을 투여했을 때 나타나는 독성을 확인해요. 알고 있는 조건만 입력하세요.",
    cats: TOX_CATS,
    paths: [
      { title: "필요한 시험 찾아보기", desc: "개발 상황을 고르면 해당하는 가이드라인 기준을 보여드려요.", ex: "개발 단계, 자료 제출처, 임상 투여경로와 기간", href: "/request/new?start=advisor" },
      { title: "시험 직접 고르기", desc: "필요한 시험을 알고 계시면 바로 요청서를 쓰세요.", ex: TOX_CATS.join(" · "), href: "/request/new?start=manual&kind=tox" },
    ],
    elsewhere: [
      ["질환 모델에서 효과를 보는 시험", "pd"],
      ["체내 농도 변화를 보는 시험", "pk"],
      ["가진 시료나 물질의 분석만 맡기는 경우", "other"],
    ],
  },
  pd: {
    k: "pd",
    tag: "PD",
    name: "효력시험",
    lead: "질환 모델에서 시험물질이 효과를 내는지 확인해요. 모델을 모르면 영역만 고르세요.",
    cats: ["효력시험(약효)"],
    paths: [
      { title: "질환 영역 고르기", desc: "영역과 아는 조건만 적으면 기관이 시험 설계와 견적을 함께 회신해요.", ex: AREA_NAMES.join(" · "), href: "/request/new?start=manual&kind=pd" },
    ],
    elsewhere: [
      ["독성 확인이 목적인 시험", "tox"],
      ["체내 농도 변화를 보는 시험", "pk"],
      ["가진 시료의 분석만 맡기는 경우", "other"],
    ],
  },
  pk: {
    k: "pk",
    tag: "PK",
    name: "약동학시험",
    lead: "투여한 시험물질이 몸 안에서 얼마나, 얼마 동안 머무는지 확인해요.",
    cats: ["PK/TK/ADME·생체시료분석"],
    paths: [
      { title: "시험 종류 고르기", desc: "동물종, 채혈 시점, 검체, 분석법 중 아는 것만 적으세요.", ex: "PK · TK · ADME · 체외 대사 안정성 · CYP · 혈장단백결합 · 수송체 · 조직분포 · 생체시료 분석법 개발과 검증", href: "/request/new?start=manual&kind=pk" },
    ],
    elsewhere: [
      ["독성 확인이 목적인 시험", "tox"],
      ["질환 모델에서 효과를 보는 시험", "pd"],
      ["이미 채취한 시료의 농도 측정만", "other"],
    ],
  },
  other: {
    k: "other",
    tag: "Other",
    name: "개별 분석",
    lead: "가진 시료나 물질을 맡기고 필요한 분석만 받아요. 투여는 포함하지 않아요.",
    cats: OTHER_CATS,
    paths: [
      { title: "분석 항목 고르기", desc: "시료 종류와 수, 받고 싶은 분석을 적으세요.", ex: OTHER_AREAS.join(" · "), href: "/request/new?start=manual&kind=other" },
    ],
    elsewhere: [
      ["독성 확인을 위해 투여부터 맡기는 경우", "tox"],
      ["효과 확인을 위해 투여부터 맡기는 경우", "pd"],
      ["농도 변화를 보려고 투여부터 맡기는 경우", "pk"],
    ],
  },
};

export const isKind = (v: unknown): v is Kind => typeof v === "string" && v in KINDS;
