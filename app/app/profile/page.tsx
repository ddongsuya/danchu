import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";
import { ThemeSettings } from "@/components/ThemeSettings";
import { LogoutButton } from "@/components/shell/LogoutButton";
import { CONTACT } from "@/lib/rfq-schema";
import { EmailChangeForm } from "@/components/EmailChangeForm";

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  email_changed: { ok: true, text: "로그인 이메일을 바꿨습니다. 다음부터는 새 주소로 로그인하세요." },
  email_expired: { ok: false, text: "이메일 변경 링크가 만료되었거나 올바르지 않습니다. 아래에서 다시 요청해 주세요." },
  email_taken: { ok: false, text: "그 주소는 이미 다른 계정에서 쓰고 있어 바꾸지 못했습니다." },
  email_failed: { ok: false, text: "이메일을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요." },
};

export const dynamic = "force-dynamic";

export default async function Profile({ searchParams }: { searchParams?: Promise<{ notice?: string }> }) {
  const s = await requireSession();
  const p = s.profile;
  const base = p.role === "cro" ? "/cro" : "/app";
  const notice = NOTICES[(await searchParams)?.notice ?? ""];
  const pendingEmail = p.pending_email && p.pending_email_expires_at && new Date(p.pending_email_expires_at).getTime() > Date.now() ? p.pending_email : null;
  return (
    <>
      <div className="ph">
        <div>
          <h1>프로필</h1>
          <p>{s.email}</p>
        </div>
        <span className="pill pill--tint">{p.role === "admin" ? "운영자" : p.role === "cro" ? "CRO" : "의뢰자"}</span>
      </div>

      {notice && <p className={`note ${notice.ok ? "note--tint" : "note--err"}`} role="status" style={{ marginBottom: 16 }}>{notice.text}</p>}
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>로그인 이메일</h2>
            <EmailChangeForm current={s.email} pending={pendingEmail} />
          </div>
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
            <Link href="/reset-password" className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
              <span>비밀번호 설정·변경</span>
              <span style={{ color: "var(--dash)" }}>›</span>
            </Link>
            <Link href="/terms" className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
              <span>이용약관 · 개인정보처리방침</span>
              <span style={{ color: "var(--dash)" }}>›</span>
            </Link>
            {p.role !== "admin" && (
              <Link href={`${base}/profile/delete`} className="kv" style={{ alignItems: "center", color: "var(--muted)" }}>
                <span>회원 탈퇴</span>
                <span style={{ color: "var(--dash)" }}>›</span>
              </Link>
            )}
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
