"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, useConfirm } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { md } from "@/lib/format";
import { adminPost, josa, type AdminReply } from "./act";

/**
 * 마감한 달 청구서 만들고 보내기 (시안 검토판 a-inv~make). 확인창이 만들고 보낸다. 이미 있는 청구서는 다시 만들지 않는다.
 * 일부만 만들어졌으면 서버 문장을 그대로 띠로 보여 준다 (나머지 청구서는 발행됨).
 */
export function InvoiceIssue({ month, label, orgs, due }: { month: string; label: string; orgs: number; due: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [partial, setPartial] = useState("");
  const go = async () => {
    setPartial("");
    let reply: AdminReply = {};
    const ok = await confirm({
      title: `${label} 청구서를 만들고 보낼까요?`,
      body: `보내면 기관 ${orgs}곳의 청구서 이메일로 청구서가 가고, 납부 기한은 발행일 + 14일인 ${md(due)}입니다.`,
      confirmLabel: "만들고 보내기",
      pendingLabel: "보내는 중",
      action: async () => { reply = await adminPost("/api/admin/billing/invoices", { month, send: true }, "청구서를 만들지 못했어요. 명세는 그대로예요."); },
    });
    if (!ok) return;
    const failed = typeof reply.failed === "number" ? reply.failed : 0;
    const sentN = typeof reply.sent === "number" ? reply.sent : 0;
    if (failed) setPartial(`${sentN + failed}곳 중 ${failed}곳에 청구서를 보내지 못했어요.`);
    router.refresh();
  };
  return (
    <>
      <Button className="b1" onClick={go}>청구서 만들고 보내기</Button>
      {partial && <p className="note note--err" role="alert" style={{ flexBasis: "100%" }}>{partial}</p>}
    </>
  );
}

/** 청구서 1장: 보내기 · 입금 확인 · 청구서 취소. 입금 확인과 취소는 확인창 안에서 날짜·사유를 받는다 (시안 a-paid) */
export function InvoiceActions({ id, sent, org, no }: { id: string; sent: boolean; org: string; no: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [mode, setMode] = useState<"" | "paid" | "void">("");
  const [paidOn, setPaidOn] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const url = `/api/admin/billing/invoices/${id}`;

  const send = async () => {
    if (await confirm({
      title: `${no} 청구서를 ${sent ? "다시 " : ""}보낼까요?`,
      body: `보내면 ${org} 청구서 이메일로 청구서가 갑니다.`,
      confirmLabel: sent ? "다시 보내기" : "보내기",
      pendingLabel: "보내는 중",
      action: async () => { await adminPost(url, { action: "send" }, "청구서를 보내지 못했어요. 청구서 상태는 바뀌지 않았어요."); },
    })) router.refresh();
  };
  const paid = async () => {
    if (!paidOn) throw new Error("입금일을 골라 주세요.");
    await adminPost(url, { action: "paid", paidOn, note }, "입금을 확인하지 못했어요. 청구서 상태는 바뀌지 않았어요.");
    router.refresh();
  };
  const cancel = async () => {
    if (!reason.trim()) throw new Error("취소 사유를 입력해 주세요.");
    await adminPost(url, { action: "void", reason }, "청구서를 취소하지 못했어요. 청구서 상태는 바뀌지 않았어요.");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button type="button" className="b1 bsm" onClick={() => setMode("paid")}>입금 확인</button>
      <button type="button" className="b2 bsm" onClick={send}>{sent ? "다시 보내기" : "보내기"}</button>
      <button type="button" className="b2 bsm" onClick={() => setMode("void")}>청구서 취소</button>
      <ConfirmDialog
        open={mode === "paid"}
        title={`${org} 입금을 확인할까요?`}
        body={
          <div className="stack" style={{ gap: 12 }}>
            <p>확인하면 청구서 {josa(no, "이", "가")} 입금 확인 상태로 바뀝니다.</p>
            <div className="fld">
              <label className="fld__lab" htmlFor={`paid-${id}`}>입금일</label>
              <input id={`paid-${id}`} className="inp tnum" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div className="fld">
              <label className="fld__lab" htmlFor={`note-${id}`}>메모 (선택)</label>
              <input id={`note-${id}`} className="inp" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="입금자명, 은행" />
            </div>
          </div>
        }
        confirmLabel="입금 확인"
        cancelLabel="닫기"
        pendingLabel="확인하는 중"
        action={paid}
        onResult={() => setMode("")}
      />
      <ConfirmDialog
        open={mode === "void"}
        title={`청구서 ${josa(no, "을", "를")} 취소할까요?`}
        body={
          <div className="stack" style={{ gap: 12 }}>
            <p>취소해도 기록은 남고, 같은 달 청구서를 다시 만들 수 있습니다.</p>
            <div className="fld">
              <label className="fld__lab" htmlFor={`void-${id}`}>취소 사유</label>
              <input id={`void-${id}`} className="inp" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        }
        confirmLabel="청구서 취소"
        cancelLabel="닫기"
        pendingLabel="취소하는 중"
        danger
        action={cancel}
        onResult={() => setMode("")}
      />
    </div>
  );
}
