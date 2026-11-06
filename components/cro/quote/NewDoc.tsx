"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CatalogRow } from "@/lib/catalog";

/** 새 견적서: 의뢰자와 시험을 고른다. 고른 순서대로 견적서에 들어간다 */
export function NewDoc({ catalog }: { catalog: CatalogRow[] }) {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [substance, setSubstance] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const groups = useMemo(() => {
    const m = new Map<string, Map<string, CatalogRow[]>>();
    for (const c of catalog) {
      if (q && !`${c.category} ${c.item} ${c.species.join(" ")} ${(c.routes ?? []).join(" ") || (c.route ?? "")} ${c.dosing ?? ""}`.toLowerCase().includes(q.toLowerCase())) continue;
      const cat = m.get(c.category) ?? new Map<string, CatalogRow[]>();
      cat.set(c.item, [...(cat.get(c.item) ?? []), c]);
      m.set(c.category, cat);
    }
    return m;
  }, [catalog, q]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const create = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/cro/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogIds: picked, client, substance }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    if (!r?.ok || !d?.id) { setBusy(false); setErr(d?.error || "견적서를 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요."); return; }
    router.push(`/cro/docs/${d.id}`);
  };

  return (
    <div className="qnew">
      <section className="qnew__who">
        <div className="fld">
          <label className="fld__lab" htmlFor="qn-client">의뢰자</label>
          <input id="qn-client" className="inp" value={client} maxLength={200} placeholder="회사명" onChange={(e) => setClient(e.target.value)} />
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor="qn-sub">시험물질 <span className="qnew__opt">선택</span></label>
          <input id="qn-sub" className="inp" value={substance} maxLength={200} placeholder="예: 물질 코드" onChange={(e) => setSubstance(e.target.value)} />
        </div>
      </section>

      <section className="qnew__tests">
        <div className="qnew__head">
          <h2>시험 고르기</h2>
          <input className="inp qnew__search" type="search" aria-label="시험 찾기" placeholder="시험 이름, 동물종, 투여경로로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {catalog.length === 0 ? (
          <div className="empty">
            <b>시험 목록에 담은 시험이 없어요</b>
            시험 목록에 조건과 표준가를 적어 두면 견적서가 그 값으로 채워져요. 시험 없이 만들어 직접 적어도 돼요.
            <div style={{ marginTop: 14 }}><Link href="/cro/catalog" className="b2 bsm">시험 목록 열기</Link></div>
          </div>
        ) : (
          [...groups.entries()].map(([cat, items]) => (
            <div key={cat} className="qnew__cat">
              <h3>{cat}</h3>
              {[...items.entries()].map(([item, rows]) => (
                <div key={item} className="qnew__item">
                  <p>{item}</p>
                  {rows.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <label key={c.id} className="qnew__row" data-on={on ? "1" : undefined}>
                        <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                        <span>{[c.species.join("·"), (c.routes?.length ? c.routes.join("·") : c.route), c.dosing, c.method].filter(Boolean).join(" · ") || "조건 미입력"}</span>
                        <b className="tnum">{c.std_price != null ? `${c.std_price.toLocaleString("ko-KR")}원` : <span className="qnew__none">표준가 없음</span>}</b>
                        {on && <em className="tnum">{picked.indexOf(c.id) + 1}</em>}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      <div className="qnew__bar">
        <span>{picked.length ? `시험 ${picked.length}개` : "시험 없이 만들고 편집 화면에서 추가해도 돼요"}</span>
        {err && <span role="alert" className="qnew__err">{err}</span>}
        <button type="button" className="b1" disabled={busy} onClick={create}>{busy ? "만드는 중…" : "견적서 만들기"}</button>
      </div>
    </div>
  );
}
