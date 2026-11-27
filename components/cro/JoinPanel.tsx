"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRO_TERMS_VERSION, JOIN_CONSENT } from "@/lib/request-policy";
import { useParticipation } from "./Participation";

/**
 * 참여 결정 (0023, 시안 검토판 c-r · q-view). 요약을 본 기관이 참여하기 또는 이번 요청 불참을 고른다.
 * 동의 문장을 보여 주고 "참여하기"를 누른다 (체크박스 없음). 참여하면 동의 문장과 이용 조건 판, IP·브라우저가 참여 기록으로 남는다(join_offer).
 * 불참은 확인 창에서 처리하고, 참여 결정 기한까지는 같은 패널의 "다시 참여하기"로 되돌릴 수 있다 (rejoinBy).
 * 운영자는 기관 대신 참여할 수 없다. 운영자 화면에서는 참여 버튼 대신 안내만 보이고, 기관이 알린 불참만 기록할 수 있다.
 * prefill: 포털은 시험 목록으로 회신 초안을 채우므로 그 문장을 붙인다. 회신 링크(/q)에는 시험 목록이 없다
 */
export function JoinPanel({ token, seats, afterDeclineHref, operator = false, declineEndpoint, rejoinBy, joinBy = "", prefill = true }: { token: string; seats: string; afterDeclineHref: string; operator?: boolean; declineEndpoint?: string; rejoinBy?: string; joinBy?: string; prefill?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const askDecline = useParticipation(token, declineEndpoint);

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/quote/${token}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree: true, terms: CRO_TERMS_VERSION }) });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("참여를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };
  const decline = async () => {
    if (!(await askDecline("decline", joinBy, operator))) return;
    if (declineEndpoint) router.push(afterDeclineHref);
    router.refresh();
  };

  const lead = rejoinBy
    ? `이 요청에는 불참으로 처리했어요. 참여 결정 기한(${rejoinBy})까지는 남은 자리가 있으면 다시 참여할 수 있어요.`
    : `지금은 요약만 보여요. 참여하면 시험물질명, 의뢰자 설명, 첨부가 열${prefill ? "리고, 시험 목록을 채워 두셨다면 회신 초안이 채워져요." : "려요."}`;

  return (
    <section className="card join" aria-labelledby="join-title">
      <div className="join__head">
        <h2 id="join-title">{rejoinBy ? "불참을 취소하고 다시 참여할까요?" : "이 요청에 참여할까요?"}</h2>
        <p className="join__lead">{lead}</p>
      </div>
      {error && (
        <div className="note note--err join__err" role="alert">
          <span>{error}</span>
          <button type="button" className="b2 bsm" onClick={join} disabled={busy}>다시 참여하기</button>
        </div>
      )}
      {operator ? (
        <p className="note note--tint">운영자는 기관 대신 참여할 수 없어요. 기관이 회신 링크나 포털에서 직접 참여하기를 눌러야 하고, 그 뒤에 PDF 견적을 옮겨 적을 수 있어요. 참여를 권하려면 기관에 전화나 메일로 안내해 주세요.</p>
      ) : (
        <p className="join__consent">{JOIN_CONSENT}</p>
      )}
      <p className="join__meta tnum">
        {seats} · <a href="/terms/cro" target="_blank" rel="noopener noreferrer" title={`조건 판 ${CRO_TERMS_VERSION}`}>기관 이용약관</a>
      </p>
      <div className="join__actions">
        {!rejoinBy && (
          <button type="button" className="b2" onClick={decline} disabled={busy}>
            {operator ? "기관이 알린 불참 기록" : "이번 요청 불참"}
          </button>
        )}
        {!operator && (
          <button type="button" className="b1" onClick={join} disabled={busy} aria-busy={busy || undefined}>
            {busy ? "참여 처리 중" : rejoinBy ? "다시 참여하기" : "참여하기"}
          </button>
        )}
      </div>
    </section>
  );
}
