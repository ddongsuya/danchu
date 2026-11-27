"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { mmdd } from "@/lib/format";
import { adminPost, josa } from "./act";

type Invite = { id: string; cro_name: string; cda_signed_at: string | null; joined_at: string | null };

/**
 * 기관별 CDA 확인 (시안 검토판 a-r-cda). 운영자가 양측의 CDA 체결을 확인한 뒤 그 기관에 첨부를 연다.
 * 행마다 "체결 확인하고 공개" / "비공개로 전환", 근거 메모는 표 아래 한 칸. 참여한 기관만 공개할 수 있다(참여 전에는 첨부가 보이지 않는다).
 */
export function CdaPanel({ no, files, invites }: { no: string; files: number; invites: Invite[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [reference, setReference] = useState("");
  const [refErr, setRefErr] = useState("");

  const change = async (i: Invite) => {
    if (!reference.trim()) { setRefErr("체결 확인 근거를 입력해 주세요."); return; }
    setRefErr("");
    const open = !i.cda_signed_at;
    const action = async () => {
      await adminPost(`/api/admin/rfqs/${no}/cda`, { inviteId: i.id, reference, signed: open }, "저장하지 못했어요. 공개 상태는 바뀌지 않았어요.");
    };
    const ok = await confirm(open
      ? { title: `${i.cro_name}에 첨부를 공개할까요?`, body: `공개하면 ${josa(i.cro_name, "이", "가")} 첨부 ${files}건을 열람할 수 있고, 회사명과 연락처는 선정 전까지 계속 가려집니다. CDA 문서에 적힌 당사자 정보는 가려지지 않습니다.`, confirmLabel: "공개", pendingLabel: "공개하는 중", action }
      : { title: `${i.cro_name} 첨부를 비공개로 바꿀까요?`, body: "바꾸면 이 기관은 첨부를 더 열 수 없고, 이미 내려받은 파일은 회수되지 않습니다.", confirmLabel: "비공개로 전환", pendingLabel: "바꾸는 중", danger: true, action });
    if (!ok) return;
    setReference("");
    router.refresh();
  };

  if (!invites.some((i) => i.joined_at)) return <EmptyState title="참여한 기관이 없어요" />;
  return (
    <section className="adm-sec" aria-labelledby="cda-h">
      <div className="adm-sec__head"><h2 id="cda-h">기관별 CDA 확인</h2></div>
      <div className="card tbl-wrap">
        <table className="tbl tbl--stack">
          <thead><tr><th>기관</th><th>참여</th><th>CDA</th><th><span className="sr-only">처리</span></th></tr></thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.id}>
                <td className="strong">{i.cro_name}</td>
                <td data-label="참여" className="tnum">{i.joined_at ? `참여 ${mmdd(i.joined_at)}` : "참여 결정 전"}</td>
                <td data-label="CDA">{!i.joined_at ? "-" : i.cda_signed_at ? <span className="pill pill--ok">체결 확인됨</span> : <span className="pill pill--warn">체결 확인 대기</span>}</td>
                <td className="tbl__act">
                  {i.joined_at && <button type="button" className={i.cda_signed_at ? "b2 bsm" : "b1 bsm"} onClick={() => change(i)}>{i.cda_signed_at ? "비공개로 전환" : "체결 확인하고 공개"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fld" style={{ marginTop: 12 }}>
        <label className="fld__lab" htmlFor="cda-ref">체결 확인 근거 / 변경 사유</label>
        <input id="cda-ref" className="inp" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="계약 문서 번호, 체결일, 확인 내용" maxLength={500} aria-invalid={!!refErr || undefined} aria-describedby={refErr ? "cda-ref-err" : undefined} />
        {refErr && <p id="cda-ref-err" className="fld__err" role="alert">{refErr}</p>}
      </div>
      <p className="adm-small adm-muted" style={{ marginTop: 8 }}>공개해도 회사명과 연락처는 선정 전까지 가려져요.</p>
    </section>
  );
}
