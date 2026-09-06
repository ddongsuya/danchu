"use client";

import Link from "next/link";
import { useApp } from "@/components/app/AppState";
import { Caret, TabBar } from "@/components/app/ui";
import { ME } from "@/lib/app-data";

function Toggle({ on, onFlip, label }: { on: boolean; onFlip: () => void; label: string }) {
  return (
    <button type="button" className="tgl" aria-pressed={on} aria-label={label} onClick={onFlip}>
      <span />
    </button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="kv">{children}</div>;
}

function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="kv" style={{ alignItems: "center", color: "var(--ink)" }}>
      <span>{children}</span>
      <Caret dir="right" color="var(--dash)" />
    </Link>
  );
}

export default function Profile() {
  const { dark, theme, toggleDark, push, mail, setFlag } = useApp();

  return (
    <div className="scr scr--sf">
      <div style={{ padding: "calc(var(--top) + 10px) 20px 0" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>프로필</h1>
      </div>

      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="card" style={{ padding: 18, display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ flex: "none", width: 52, height: 52, borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>
            {ME.initial}
          </span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{ME.name}</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{ME.company} · {ME.dept}</span>
            <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{ME.email}</span>
          </div>
          <span className="pill pill--tint" style={{ fontSize: 11, padding: "4px 8px" }}>의뢰자</span>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="grouplab">회사</div>
        <div className="card card--rows">
          <Row>
            <span className="kv__k">기관 유형</span>
            <span className="kv__v">{ME.orgType}</span>
          </Row>
          <Row>
            <span className="kv__k">표준 CDA</span>
            <span className="kv__v" style={{ color: "var(--ok)" }}>{ME.cda}</span>
          </Row>
          <Row>
            <span className="kv__k">휴대전화</span>
            <span className="kv__v tnum">{ME.phone}</span>
          </Row>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="grouplab">설정</div>
        <div className="card card--rows">
          <div className="kv" style={{ alignItems: "center", padding: "12px 0" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span>다크 모드</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {theme === "system" ? `기기 설정을 따름 · 지금 ${dark ? "어두움" : "밝음"}` : dark ? "항상 어둡게" : "항상 밝게"}
              </span>
            </div>
            <Toggle on={dark} onFlip={toggleDark} label="다크 모드" />
          </div>
          <div className="kv" style={{ alignItems: "center", padding: "12px 0" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span>푸시 알림</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>견적 도착 · 비교표 · 계약 진행</span>
            </div>
            <Toggle on={push} onFlip={() => setFlag("push", !push)} label="푸시 알림" />
          </div>
          <div className="kv" style={{ alignItems: "center", padding: "12px 0" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span>이메일 알림</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>앱 알림과 동일 내용</span>
            </div>
            <Toggle on={mail} onFlip={() => setFlag("mail", !mail)} label="이메일 알림" />
          </div>
          <LinkRow href="/app/support">문의하기</LinkRow>
          <LinkRow href="/terms">이용약관 · 개인정보처리방침</LinkRow>
        </div>
      </div>

      <div className="pad" style={{ padding: "16px 20px 28px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <Link href="/app/login" className="b2" style={{ color: "var(--body)" }}>로그아웃</Link>
        <span style={{ fontSize: 12, color: "var(--ph)" }}>단추 v1.0 · hello@danchu.kr</span>
      </div>

      <TabBar active="profile" unread />
    </div>
  );
}
