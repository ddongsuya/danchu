import Link from "next/link";
import { CheckDisc } from "@/components/app/ui";
import { addBusinessDays, formatKo, nowSeoul } from "@/lib/dates";

/** 웹 접수 완료·확인 메일과 같은 일정 기준: 배포 +1 · 회신 +5 · 비교표 +7 영업일 */
const STEPS = [
  { t: "CRO 배포", d: 1, note: "CDA 필요 시 체결 후 전달" },
  { t: "견적 회신", d: 5, note: "도착할 때마다 알림" },
  { t: "비교표 수령", d: 7, note: "앱과 이메일로" },
];

export const dynamic = "force-dynamic";

export default async function Done({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const { no } = await searchParams;
  const rfqNo = no && /^DC-\d{4}-\d{4,}$/.test(no) ? no : "DC-----";
  const today = nowSeoul();

  return (
    <div className="scr scr--sf">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "calc(var(--top) + 40px) 20px 40px", gap: 16 }}>
        <div className="card" style={{ padding: "36px 24px 28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
          <CheckDisc size={56} />
          <h1 style={{ marginTop: 6, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>접수되었습니다</h1>
          <p style={{ fontSize: 15, color: "var(--body)" }}>요청서를 정리해 영업일 1일 내 CRO에 배포합니다.</p>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "var(--tint)", border: "1px solid var(--bline)", borderRadius: 12, padding: "14px 28px", minWidth: 220 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>RFQ 번호</span>
            <span className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: ".02em" }}>{rfqNo}</span>
          </div>
        </div>

        <div className="card" style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>다음 단계</h2>
          {STEPS.map((s, i) => (
            <div key={s.t} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span
                style={{
                  flex: "none", width: 26, height: 26, borderRadius: "50%",
                  background: i === 0 ? "var(--brand)" : "transparent",
                  border: i === 0 ? "0" : "1.5px solid var(--iline)",
                  color: i === 0 ? "var(--onbrand)" : "var(--muted)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <div style={{ fontSize: 15 }}>
                <b style={{ fontWeight: 600 }}>{s.t}</b>
                <small style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>
                  {formatKo(addBusinessDays(today, s.d))} · {s.note}
                </small>
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 4, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>문의 hello@danchu.kr</p>
      </div>

      <div style={{ padding: "0 20px calc(34px + var(--bot))", display: "flex", flexDirection: "column", gap: 10 }}>
        <Link href={`/app/r/${rfqNo}`} className="b1">진행 상태 보기</Link>
        <Link href="/app" className="b2">홈으로</Link>
      </div>
    </div>
  );
}
