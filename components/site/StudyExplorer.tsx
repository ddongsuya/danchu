"use client";

import { useState } from "react";
import { ArrowUpRight, CaretDown, Flask } from "@phosphor-icons/react";
import { CATS, DETAILS, type Cat } from "@/lib/rfq-schema";
import { RfqLink } from "@/components/RfqLink";

const GROUPS = [
  { label: "독성·안전성", categories: CATS.slice(0, 8) },
  { label: "효력·분석", categories: [CATS[9], CATS[10], CATS[11]] },
  { label: "대체·특수시험", categories: [CATS[8], CATS[12], CATS[13]] },
  { label: "기타 시험", categories: [CATS[14]] },
];

export function StudyExplorer() {
  const [group, setGroup] = useState(0);
  const [expanded, setExpanded] = useState<Cat | null>(null);
  return (
    <div className="study-explorer">
      <div className="study-filters" role="group" aria-label="시험 분야 필터">
        {GROUPS.map((g, i) => (
          <button key={g.label} type="button" aria-pressed={i === group} aria-controls="study-results" onClick={() => { setGroup(i); setExpanded(null); }}>
            {g.label}<span>{g.categories.length}</span>
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">{GROUPS[group].label} {GROUPS[group].categories.length}개 분야</p>
      <div id="study-results" className="study-results">
        {GROUPS[group].categories.map((cat) => {
          const id = `study-${CATS.indexOf(cat)}`;
          const fields = DETAILS[cat].filter((field) => field.label).slice(0, 4);
          return (
            <div className="study-item" key={cat}>
              <button className="study-trigger" type="button" aria-expanded={expanded === cat} aria-controls={id} onClick={() => setExpanded(expanded === cat ? null : cat)}>
                <Flask size={22} weight="regular" aria-hidden="true" /><span>{cat}</span><CaretDown size={16} aria-hidden="true" />
              </button>
              <div id={id} hidden={expanded !== cat} className="study-detail">
                <p>요청서에서 {fields.map((field) => field.label).join(", ")} 등의 조건을 입력할 수 있습니다.</p>
                <RfqLink className="text-link">요청서에서 항목 선택 <ArrowUpRight size={16} aria-hidden="true" /></RfqLink>
              </div>
            </div>
          );
        })}
      </div>
      <div className="study-foot"><span>세부 조건을 아직 몰라도 괜찮습니다.</span><a href="#advisor" className="text-link">시험 제안 살펴보기 <ArrowUpRight size={16} aria-hidden="true" /></a></div>
    </div>
  );
}
