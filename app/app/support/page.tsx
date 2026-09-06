"use client";

import { useState } from "react";
import Link from "next/link";
import { Caret, CheckDisc } from "@/components/app/ui";
import { ME, REQUESTS } from "@/lib/app-data";

const TYPES = ["견적 문의", "일정", "CDA·기밀", "계약", "기타"];

export default function Support() {
  const [rfq, setRfq] = useState("");
  const [type, setType] = useState("견적 문의");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="scr scr--wh">
      <div className="hd">
        <div className="hd__bar">
          <Link href="/app/profile" className="hd__back">
            <Caret />
            프로필
          </Link>
          <span className="hd__ttl">문의</span>
          <span style={{ minWidth: 56 }} />
        </div>
      </div>

      {sent ? (
        <div className="rise-in" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "20px 24px 80px", gap: 12, textAlign: "center" }}>
          <CheckDisc size={56} />
          <h1 style={{ marginTop: 8, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>문의를 보냈습니다</h1>
          <p style={{ fontSize: 15, color: "var(--body)", maxWidth: 300 }}>
            영업일 1일 내 {ME.email}로 답변합니다.
          </p>
          <button
            type="button"
            className="btxt"
            style={{ marginTop: 16 }}
            onClick={() => {
              setSent(false);
              setText("");
            }}
          >
            새 문의 작성
          </button>
        </div>
      ) : (
        <>
          <div className="pad" style={{ flex: 1, padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h1 style={{ fontSize: 26, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.02em" }}>무엇을 도와드릴까요?</h1>
              <p style={{ fontSize: 15, color: "var(--muted)" }}>
                영업일 기준 1일 내 이메일로 답변합니다. 요청 건과 관련되면 번호를 선택해 주세요.
              </p>
            </div>

            <div className="fld">
              <label className="fld__lab" htmlFor="rfq">관련 요청</label>
              <div className="selwrap">
                <select id="rfq" className="sel" value={rfq} onChange={(e) => setRfq(e.target.value)}>
                  <option value="">해당 없음 (일반 문의)</option>
                  {REQUESTS.map((r) => (
                    <option key={r.no} value={r.no}>{r.no} · {r.substance}</option>
                  ))}
                </select>
                <Caret dir="down" color="var(--muted)" />
              </div>
            </div>

            <div className="fld">
              <span className="fld__lab">유형</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TYPES.map((t) => {
                  const on = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setType(t)}
                      style={{
                        border: `1px solid ${on ? "var(--brand)" : "var(--iline)"}`,
                        borderRadius: 999, padding: "0 14px", height: 40, fontSize: 15,
                        background: on ? "var(--brand)" : "var(--wh)",
                        color: on ? "var(--onbrand)" : "var(--ink)",
                        fontWeight: on ? 600 : 400,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fld">
              <label className="fld__lab" htmlFor="text">
                내용<span className="req">*</span>
              </label>
              <textarea
                id="text"
                className="ta"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="예: 견적의 조직병리 포함 범위가 비교표와 PDF에서 다르게 보입니다. 확인 부탁드립니다."
                style={{ fontSize: 16 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 16px", border: "1px dashed var(--dash)", borderRadius: 12, fontSize: 14, color: "var(--muted)" }}>
              <span>답변 받을 이메일</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{ME.email}</span>
            </div>
          </div>

          <div className="cta cta--wh">
            <button type="button" className="b1" disabled={!text.trim()} onClick={() => setSent(true)}>
              보내기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
