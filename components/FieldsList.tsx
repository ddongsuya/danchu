"use client";

import { useState } from "react";

export const FIELDS: [string, string][] = [
  ["일반독성", "단회·용량결정(DRF)·반복투여, 회복군·TK 옵션"],
  ["유전독성", "Ames, 염색체이상, 소핵, MLA, Comet"],
  ["안전성약리", "hERG, 중추신경계, 심혈관계, 호흡기계"],
  ["생식발생독성", "Segment I · II · III, 스크리닝"],
  ["PK/TK/ADME", "약물동태·독성동태, 생체시료 분석법 검증"],
  ["의료기기 생물학적 안전성", "ISO 10993 시리즈"],
  ["발암성·종양원성", "장기 2년, 단기 rasH2 Tg, 종양원성"],
  ["항원성·면역독성", "ASA·PCA, 피부감작, TDAR"],
  ["국소독성", "피부·안점막 자극, 광독성, 광감작"],
  ["국소내성", "투여 부위 내약성 평가"],
  ["동물대체시험", "OECD TG 439 · 431 · 492 · 442 계열"],
  ["조제물분석", "함량·균질성·안정성 (HPLC, LC-MS/MS)"],
  ["효력시험", "질환 모델 유효성 평가"],
  ["환경유해성", "조류·물벼룩·어류, 분배계수, 생분해성"],
  ["기타", "임상병리·조직병리, 다지점시험"],
];

/** 시험 분야 — 대표 6개 + "전체 15개 분야 보기" 토글 */
export function FieldsList() {
  const [more, setMore] = useState(false);
  const shown = more ? FIELDS : FIELDS.slice(0, 6);
  return (
    <>
      <div className="fields__head">
        <h2 className="h2">시험 분야</h2>
        <button type="button" className="fields__more" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? "대표 분야만 보기" : "전체 15개 분야 보기"}
        </button>
      </div>
      <ol className="fields">
        {shown.map(([name, desc], i) => (
          <li key={name}>
            <span className="fields__no">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="fields__name">{name}</div>
              <div className="fields__desc">{desc}</div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
