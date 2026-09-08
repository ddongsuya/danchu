import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";
import { ThemeSettings } from "@/components/ThemeSettings";
import { LogoutButton } from "@/components/shell/LogoutButton";
import { CONTACT } from "@/lib/rfq-schema";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const s = await requireSession();
  const p = s.profile;
  return (
    <>
      <div className="ph">
        <div>
          <h1>프로필</h1>
          <p>{s.email}</p>
        </div>
        <span className="pill pill--tint">{p.role === "admin" ? "운영자" : p.role === "cro" ? "CRO" : "의뢰자"}</span>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>담당자 정보</h2>
            <ProfileForm
              initial={{ name: p.name ?? "", company: p.company ?? "", dept: p.dept ?? "", phone: p.phone ?? "", orgType: p.org_type ?? "" }}
              orgTypes={CONTACT.find((f) => f.id === "orgType")?.options ?? []}
              showCompany={p.role !== "cro"}
            />
          </div>
        </div>
        <div className="stack">
          <ThemeSettings />
          <div className="card card--rows">
            <Link href="/app/support" className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
              <span>문의하기</span>
              <span style={{ color: "var(--dash)" }}>›</span>
            </Link>
            <Link href="/forgot" className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
              <span>비밀번호 재설정</span>
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
