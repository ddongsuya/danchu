import { requireSession } from "@/lib/auth";
import { dbReady, listOrgMembers } from "@/lib/data";
import { OrgForm } from "@/components/cro/OrgForm";
import { ThemeSettings } from "@/components/ThemeSettings";
import { LogoutButton } from "@/components/shell/LogoutButton";
import { ymd } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  pending: ["승인 대기", "pill--warn"],
  approved: ["참여 중", "pill--ok"],
  rejected: ["반려", "pill--err"],
  suspended: ["중지", "pill--err"],
};

export default async function CroOrgPage() {
  const s = await requireSession("cro");
  const org = s.org;
  const members = org && dbReady() ? await listOrgMembers(org.id) : [];
  const st = STATUS[org?.status ?? "pending"];

  return (
    <>
      <div className="ph">
        <div>
          <h1>{org?.name ?? "기관"}</h1>
          <p>{s.profile.name} · {s.email}</p>
        </div>
        <span className={`pill ${st[1]}`}>{st[0]}</span>
      </div>

      {org?.status === "pending" && <div className="note note--warn" style={{ marginBottom: 16 }}>운영자가 기관 정보를 확인하는 중입니다. 승인되면 메일로 알려 드립니다. 그동안 아래 정보를 보완해 두면 심사가 빨라집니다.</div>}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          {org ? (
            <div className="card card--pad">
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>기관 정보</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>GLP 인증과 수행 분야는 회신에 자동으로 채워지고, 배포 대상 선정과 비교표의 제출처 대응 판정에 쓰입니다.</p>
              <OrgForm org={org} />
            </div>
          ) : (
            <div className="empty">소속 기관이 없습니다. hello@danchu.kr로 알려주세요.</div>
          )}
        </div>
        <div className="stack">
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>담당자 {members.length}</div>
            {members.map((m) => (
              <div key={m.id} className="kv">
                <span>
                  <b style={{ fontWeight: 600 }}>{m.name || "—"}</b>
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.email}{m.phone ? ` · ${m.phone}` : ""}</span>
                </span>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{ymd(m.created_at)}</span>
              </div>
            ))}
            <div style={{ padding: "10px 0 12px", fontSize: 13, color: "var(--muted)" }}>담당자 추가는 같은 기관명으로 <Link href="/signup/cro">CRO 가입 신청</Link>을 하면 운영자가 연결합니다.</div>
          </div>
          <ThemeSettings />
          <div className="card card--rows">
            <Link href="/cro/profile" className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
              <span>내 계정 정보</span>
              <span style={{ color: "var(--dash)" }}>›</span>
            </Link>
            <Link href="/terms" className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
              <span>이용약관 · 개인정보처리방침</span>
              <span style={{ color: "var(--dash)" }}>›</span>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0" }}>
            <LogoutButton className="b2" style={{ alignSelf: "center", padding: "0 24px" }} />
            <span style={{ fontSize: 12, color: "var(--ph)" }}>단추 · hello@danchu.kr</span>
          </div>
        </div>
      </div>
    </>
  );
}
