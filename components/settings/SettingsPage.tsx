import Link from "next/link";
import { requireSession, type Session } from "@/lib/auth";
import { CONTACT } from "@/lib/rfq-schema";
import { ProfileForm } from "@/components/ProfileForm";
import { EmailChangeForm } from "@/components/EmailChangeForm";
import { LogoutButton } from "@/components/shell/LogoutButton";
import { NotiSettings, ThemeRow } from "./SettingsBits";
import "./settings.css";

/**
 * 설정 (시안 검토판 r-set-general · r-set-noti · r-set-company · r-set-account · c-set-profile · c-set-noti · c-set-security · a-profile).
 * 의뢰자: ChatGPT 설정 창처럼 왼쪽 탭(일반 · 알림 · 담당자 정보 · 계정). 시안은 창이지만 주소가 있는 화면으로 둔다.
 * 기관·운영자: 셸 사이드바가 설정 메뉴로 바뀌고(components/shell/Shell settingsNav) 본문은 고른 항목 하나.
 * 주소: /app|cro|admin/profile (일반 · 프로필), …/profile/notifications, /app/profile/company, /app/profile/account, /cro/profile/security
 */
export type Section = "general" | "noti" | "company" | "account" | "security";

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  email_changed: { ok: true, text: "로그인 이메일을 바꿨어요. 다음부터 새 주소로 로그인해요." },
  email_expired: { ok: false, text: "이메일 변경 링크가 만료되었거나 올바르지 않아요. 아래에서 다시 요청해 주세요." },
  email_taken: { ok: false, text: "그 주소는 이미 다른 계정에서 쓰고 있어 바꾸지 못했어요." },
  email_failed: { ok: false, text: "이메일을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요." },
};

const REQ_TABS: [Section, string, string][] = [
  ["general", "일반", "/app/profile"],
  ["noti", "알림", "/app/profile/notifications"],
  ["company", "담당자 정보", "/app/profile/company"],
  ["account", "계정", "/app/profile/account"],
];

/** 아직 기한이 남은 이메일 변경 요청 */
function pendingOf(p: Session["profile"]): string | null {
  return p.pending_email && p.pending_email_expires_at && new Date(p.pending_email_expires_at).getTime() > Date.now() ? p.pending_email : null;
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

export async function SettingsPage({ section, searchParams }: { section: Section; searchParams?: Promise<{ notice?: string }> }) {
  const s = await requireSession();
  return <SettingsView s={s} section={section} notice={(await searchParams)?.notice} />;
}

/** 화면만 (검토 화면이 예시 계정으로 부른다). noti: 알림 스위치 초기값(검토용, 없으면 불러온다) */
export function SettingsView({ s, section, notice: noticeKey, noti }: { s: Session; section: Section; notice?: string; noti?: { email: boolean; sms: boolean | null; hasPhone: boolean } }) {
  const p = s.profile;
  const notice = NOTICES[noticeKey ?? ""];
  const pendingEmail = pendingOf(p);
  const email = <EmailChangeForm current={s.email} pending={pendingEmail} />;
  const form = (company: boolean) => (
    <ProfileForm
      initial={{ name: p.name ?? "", company: p.company ?? "", dept: p.dept ?? "", phone: p.phone ?? "", orgType: p.org_type ?? "" }}
      orgTypes={CONTACT.find((f) => f.id === "orgType")?.options ?? []}
      showCompany={company}
    />
  );
  const note = notice && <p className={`note ${notice.ok ? "note--tint" : "note--err"}`} role="status">{notice.text}</p>;

  if (p.role === "requester") {
    const [, title] = REQ_TABS.find(([k]) => k === section) ?? REQ_TABS[0];
    let body: React.ReactNode;
    if (section === "noti") body = <NotiSettings emailLabel="진행 상황 이메일" initial={noti} />;
    else if (section === "company") body = form(true);
    else if (section === "account")
      body = (
        <div className="set-rows">
          <div className="set-blk">
            <span className="set-blk__l">로그인 이메일</span>
            {email}
          </div>
          <Row label="비밀번호 설정·변경"><Link href="/reset-password" className="b2 bsm">바꾸기</Link></Row>
          <Row label="로그아웃"><LogoutButton className="b2 bsm" style={{ alignSelf: "center", padding: "0 12px" }} /></Row>
          <Row label="회원 탈퇴"><Link href="/app/profile/delete" className="b2 bsm">탈퇴</Link></Row>
        </div>
      );
    else body = <div className="set-rows"><ThemeRow /></div>;
    return (
      <div className="set set--tabs">
        <nav className="set-tabs" aria-label="설정">
          {REQ_TABS.map(([k, label, href]) => (
            <Link key={k} href={href} aria-current={k === section ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <section className="set-body" aria-labelledby="set-h">
          <h1 id="set-h">{title}</h1>
          {note}
          {body}
        </section>
      </div>
    );
  }

  // 기관 · 운영자: 사이드바가 설정 메뉴
  if (section === "noti")
    return (
      <div className="set">
        <h1>알림</h1>
        <NotiSettings emailLabel="이메일 알림" initial={noti} />
      </div>
    );
  if (section === "security")
    return (
      <div className="set">
        <h1>보안</h1>
        <div className="set-rows">
          <Row label="비밀번호 설정·변경"><Link href="/reset-password" className="b2 bsm">바꾸기</Link></Row>
          <Row label="로그인 이메일"><Link href="/cro/profile" className="b2 bsm">바꾸기</Link></Row>
          <Row label="회원 탈퇴"><Link href="/cro/profile/delete" className="b2 bsm">탈퇴</Link></Row>
        </div>
      </div>
    );
  return (
    <div className="set">
      <h1>프로필</h1>
      {note}
      <section className="set-sec">
        <h2>로그인 이메일</h2>
        {email}
      </section>
      {p.role === "cro" && (
        <section className="set-sec">
          <h2>담당자 정보</h2>
          {form(false)}
        </section>
      )}
      <section className="set-sec">
        <h2>화면</h2>
        <div className="set-rows"><ThemeRow /></div>
      </section>
    </div>
  );
}
