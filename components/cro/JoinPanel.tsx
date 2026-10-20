"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRO_TERMS_VERSION, JOIN_CONSENT } from "@/lib/request-policy";
import { DeclineForm } from "./DeclineForm";

/**
 * 참여 결정 (0023). 요약을 본 기관이 참여하기 또는 이번 요청 불참을 고른다.
 * 참여하기를 누르면 아래 동의 문장과 이용 조건 판, IP·브라우저가 참여 기록으로 남고(join_offer), 요청서 전체가 열린다.
 * 운영자는 기관 대신 참여할 수 없다. 운영자 화면에서는 참여 버튼 대신 안내만 보이고, 기관이 메일로 알린 불참만 기록할 수 있다.
 * declineEndpoint: 운영자 전용 요약 화면(/admin/r/[no]/offer/[id])은 토큰 없이 초대 id 로 불참을 기록한다
 * rejoinBy: 참여 전에 불참한 기관이 다시 참여하는 경우 (2026-10-20 결정 3). 참여 결정 기한 전이고 자리가 남았을 때만 보인다.
 *   같은 동의와 같은 길(join_offer)로 처리하고, 불참 버튼은 보이지 않는다. 참여 뒤 철회는 되돌릴 수 없어 이 패널이 나오지 않는다
 */
export function JoinPanel({ token, seats, afterDeclineHref, operator = false, declineEndpoint, rejoinBy }: { token: string; seats: string; afterDeclineHref: string; operator?: boolean; declineEndpoint?: string; rejoinBy?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(false);

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/quote/${token}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree: true, terms: CRO_TERMS_VERSION }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "참여를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "참여를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <section className="card join" aria-labelledby="join-title">
      <div className="join__head">
        <h2 id="join-title">{rejoinBy ? "불참을 취소하고 다시 참여할까요?" : "이 요청에 참여할까요?"}</h2>
        <p className="join__lead">
          {rejoinBy ? `이 요청에는 불참으로 처리했습니다. 참여 결정 기한(${rejoinBy})까지는 남은 자리가 있으면 다시 참여할 수 있습니다. ` : "지금은 요약만 보입니다. "}
          참여하면 시험물질명, 의뢰자 설명, 첨부가 열리고, 카탈로그를 등록해 두셨다면 회신 초안이 채워집니다.
        </p>
      </div>
      {operator ? (
        <p className="note note--tint">운영자는 기관 대신 참여할 수 없습니다. 기관이 회신 링크나 포털에서 직접 참여하기를 눌러야 하고, 그 뒤에 PDF 견적을 옮겨 적을 수 있습니다. 참여를 권하려면 기관에 전화나 메일로 안내해 주세요.</p>
      ) : (
        <p className="join__consent">{JOIN_CONSENT}</p>
      )}
      <p className="join__meta tnum">
        {seats} · <a href="/for-cro#cro-terms" target="_blank" rel="noopener">기관 이용 조건 {CRO_TERMS_VERSION}</a>
      </p>
      {error && <p className="note note--err join__err" role="alert">{error}</p>}
      {!declining && (
        <div className="join__actions">
          {!operator && (
            <button type="button" className="b1" onClick={join} disabled={busy} aria-busy={busy}>
              {busy ? "참여 처리 중…" : rejoinBy ? "다시 참여하기" : "참여하기"}
            </button>
          )}
          {!rejoinBy && (
            <button type="button" className="b2" onClick={() => setDeclining(true)} disabled={busy}>
              {operator ? "기관이 알린 불참 기록" : "이번 요청 불참"}
            </button>
          )}
        </div>
      )}
      {declining && (
        <div id="join-decline">
          <DeclineForm token={token} mode="decline" onCancel={() => setDeclining(false)} afterHref={afterDeclineHref} operator={operator} endpoint={declineEndpoint} />
        </div>
      )}
    </section>
  );
}
