import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser, type RfqSummary } from "@/lib/data";
import { stageOf, statusLabel, statusTone } from "@/lib/status";
import { Bar, StatusPill } from "@/components/app/ui";
import { ago, md } from "@/lib/format";

export const dynamic = "force-dynamic";

function metaOf(r: RfqSummary): string {
  switch (r.status) {
    case "received":
      return "배포 준비 중";
    case "distributed":
      return r.invites ? `CRO ${r.invites}곳 배포 · 회신 ${r.submitted}곳` : "배포됨";
    case "quoted":
      return `견적 ${r.submitted}/${r.invites}곳 도착${r.reply_by ? ` · 회신 기한 ${md(r.reply_by)}` : ""}`;
    case "compared":
      return `비교표 도착 · ${r.submitted}곳 회신`;
    case "selected":
      return "CRO 연락 대기";
    case "contracting":
      return "계약 진행 중";
    case "closed":
      return "종료";
    default:
      return "";
  }
}

export default async function Home() {
  const s = await requireSession("requester", "/app");
  const list = dbReady() ? await listRequestsForUser(s.userId, s.email) : [];
  const ongoing = list.filter((r) => !["closed", "cancelled"].includes(r.status)).length;
  const arrived = list.filter((r) => ["quoted", "compared"].includes(r.status)).length;
  const closed = list.filter((r) => r.status === "closed").length;
  const hot = list.find((r) => r.status === "compared") ?? list.find((r) => r.status === "quoted");

  return (
    <>
      <div className="ph">
        <div>
          <h1>
            {s.profile.name || "의뢰자"} 님,
            {hot ? (hot.status === "compared" ? " 비교표가 도착했어요" : ` 견적 ${hot.submitted}건이 도착했어요`) : list.length ? " 진행 상황을 확인하세요" : " 첫 견적을 요청해 보세요"}
          </h1>
          {hot && (
            <p className="tnum">
              {hot.rfq_no} · {hot.substance} · {hot.invites}곳 중 {hot.submitted}곳 회신
            </p>
          )}
        </div>
        <div className="ph__actions">
          <Link href="/app/new" className="b1">새 견적 요청</Link>
        </div>
      </div>

      <div className="tiles3">
        {[
          ["진행 중", ongoing, false],
          ["견적 도착", arrived, true],
          ["종료", closed, false],
        ].map(([label, n, brand]) => (
          <div key={String(label)} className="card tile">
            <span>{label}</span>
            <span className="tnum" style={{ color: brand ? "var(--brand)" : undefined }}>{n}</span>
          </div>
        ))}
      </div>

      <div className="sec-title">
        <h2>내 요청</h2>
        <span>최근순</span>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <b>아직 요청이 없습니다</b>
          한번 입력하면 참여 CRO에 배포되고, 같은 양식의 견적을 비교표로 받습니다.
          <div style={{ marginTop: 14 }}>
            <Link href="/app/new" className="b1">견적 요청 시작</Link>
          </div>
        </div>
      ) : (
        <div className="stack">
          {list.map((r) => (
            <Link key={r.id} href={`/app/r/${r.rfq_no}`} className="card card--link" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{r.rfq_no}</span>
                <StatusPill tone={statusTone(r.status)}>{statusLabel(r.status)}</StatusPill>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.substance}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.categories.join(" · ")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bar pct={stageOf(r.status).pct} />
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{metaOf(r) || ago(r.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
