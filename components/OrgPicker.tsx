"use client";
import { useEffect, useState } from "react";
import type { Values } from "@/lib/rfq-schema";
import { invitationLimit } from "@/lib/request-policy";

type Org = { id: string; name: string; categories: string[]; glp: string[] };

/**
 * 요청서의 지명 기관 선택. 승인된 기관 이름을 칩으로 보여 주고, 고른 이름을 값(string[])으로 둔다.
 * 요청할 기관 수 안에서만 고를 수 있다. 분야가 맞는 기관을 앞에 둔다
 */
export function OrgPicker({ id, values, onChange }: { id: string; values: Values; onChange: (id: string, v: string[]) => void }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [failed, setFailed] = useState(false);
  const picked = Array.isArray(values[id]) ? (values[id] as string[]) : [];
  const cats = Array.isArray(values.categories) ? (values.categories as string[]) : [];
  const max = Math.min(5, invitationLimit(typeof values.croCount === "string" ? values.croCount : undefined));

  useEffect(() => {
    let on = true;
    fetch("/api/orgs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { orgs?: Org[] }) => { if (on) setOrgs(d.orgs ?? []); })
      .catch(() => { if (on) setFailed(true); });
    return () => { on = false; };
  }, []);

  if (failed) return <p className="field__help">기관 목록을 불러오지 못했습니다. 지명 없이 진행해도 분야가 맞는 기관에 전달됩니다.</p>;
  if (!orgs) return <div className="chipset" aria-busy="true"><span className="chip" style={{ opacity: 0.5 }}>기관 목록 불러오는 중</span></div>;
  if (!orgs.length) return <p className="field__help">아직 참여 기관이 없습니다. 지명 없이 진행하면 승인되는 기관에 순서대로 전달됩니다.</p>;

  const sorted = [...orgs].sort((a, b) => Number(b.categories.some((c) => cats.includes(c))) - Number(a.categories.some((c) => cats.includes(c))) || a.name.localeCompare(b.name, "ko"));
  const full = picked.length >= max;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chipset" role="group" aria-label="지명 기관">
        {sorted.map((o) => {
          const on = picked.includes(o.name);
          const fits = cats.length === 0 || o.categories.some((c) => cats.includes(c));
          return (
            <button key={o.id} type="button" className="chip" aria-pressed={on} disabled={!on && full} title={fits ? o.categories.join(" · ") : "선택한 시험 분야와 다른 기관"} onClick={() => onChange(id, on ? picked.filter((x) => x !== o.name) : [...picked, o.name])} style={fits ? undefined : { opacity: 0.6 }}>
              {o.name}
            </button>
          );
        })}
      </div>
      <p className="field__help">{picked.length ? `${picked.length}곳 지명 (최대 ${max}곳)` : `최대 ${max}곳까지 지명할 수 있습니다. 흐린 기관은 선택한 시험 분야와 다릅니다.`}</p>
    </div>
  );
}
