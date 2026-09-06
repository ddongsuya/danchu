"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CheckDisc, CheckMark, Caret } from "@/components/app/ui";
import { CROS, MIN_TOTAL, croBySlug, md, won } from "@/lib/app-data";

export default function SelectCro({ params }: { params: Promise<{ no: string; cro: string }> }) {
  const { no, cro } = use(params);
  const c = croBySlug(cro);
  const others = CROS.filter((x) => x.slug !== c.slug);
  const diff = c.total - MIN_TOTAL;
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="scr scr--wh">
        <div className="hd">
          <div className="hd__bar">
            <span style={{ minWidth: 56 }} />
            <span className="hd__ttl">CRO 선택</span>
            <span style={{ minWidth: 56 }} />
          </div>
        </div>
        <div className="rise-in" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "20px 24px 80px", gap: 14, textAlign: "center" }}>
          <CheckDisc size={64} />
          <h1 style={{ marginTop: 8, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.name}을 선택했습니다</h1>
          <p style={{ fontSize: 15, color: "var(--body)", maxWidth: 300 }}>
            CRO 담당자가 영업일 1일 내 연락합니다. 계약 진행 상태는 요청 상세에서 확인할 수 있어요.
          </p>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2, background: "var(--tint)", border: "1px solid var(--bline)", borderRadius: 12, padding: "12px 24px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>상태</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>계약 진행</span>
          </div>
        </div>
        <div className="cta cta--wh">
          <Link href={`/app/r/${no}`} className="b1">진행 상태 보기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="scr scr--wh">
      <div className="hd">
        <div className="hd__bar">
          <Link href={`/app/r/${no}/q/${cro}`} className="hd__back">
            <Caret />
            견적서
          </Link>
          <span className="hd__ttl">CRO 선택</span>
          <span style={{ minWidth: 56 }} />
        </div>
      </div>

      <div className="pad" style={{ flex: 1, padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>{no}</p>
          <h1 style={{ fontSize: 26, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.name}과 진행할까요?</h1>
          <p style={{ fontSize: 15, color: "var(--muted)" }}>
            선택하면 CRO에 연락처가 공개되고 계약은 직접 진행합니다. 단추는 조건에 관여하지 않습니다.
          </p>
        </div>

        <div style={{ border: "1px solid var(--brand)", background: "var(--tint)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{c.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: diff === 0 ? "var(--ok)" : "var(--brand)", whiteSpace: "nowrap" }}>
              {diff === 0 ? "최저가" : `최저가 대비 +${won(diff)}`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 14 }}>
            {[
              ["총 견적액", won(c.total)],
              ["착수 · 기간", `${md(c.start)} · ${c.weeks}주`],
              ["GLP", c.glpOk ? "US FDA 대응 ✓" : "US FDA 대응 불가"],
              ["유효기간", md(c.valid)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
                <span className="tnum" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>선택하지 않은 CRO</div>
          {others.map((o) => (
            <div key={o.slug} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 16px", border: "1px solid var(--cline)", borderRadius: 12, fontSize: 14 }}>
              <span>{o.name}</span>
              <span style={{ color: "var(--muted)", textAlign: "right" }}>{won(o.total)} · 안내 메일 발송</span>
            </div>
          ))}
        </div>

        <button type="button" className="chkcard" aria-pressed={agree} onClick={() => setAgree(!agree)}>
          <span className="chkcard__box">
            <CheckMark />
          </span>
          <span>정본 PDF 견적서를 확인했고, 선택한 CRO에 회사명과 담당자 연락처가 공개되는 것에 동의합니다.</span>
        </button>
      </div>

      <div className="cta cta--wh">
        <button type="button" className="b1" disabled={!agree} onClick={() => setDone(true)}>
          {c.name}으로 진행
        </button>
        <Link href={`/app/r/${no}/compare`} className="b2">비교표로 돌아가기</Link>
      </div>
    </div>
  );
}
