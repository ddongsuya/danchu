"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { adminPost, josa } from "./act";

/**
 * 운영자 진행 관리. "회신 마감"은 compared_at 을 채워 비교표를 열고 남은 회신 링크를 닫는다 (lib/reply-window.ts).
 * 회신 기한이 지난 요청에서만 보인다. 다음 날 예약 작업이 같은 일을 하므로 그보다 먼저 열 때만 쓴다.
 * 기한 전 마감(의뢰자 요청 포함)은 없다 (2026-10-21 결정 2). 열린 비교표는 다시 열 수 없다 (결정 3).
 * 확인창이 동작을 실행하고, 실패하면 창 안에 이유와 "다시 …"를 보여 준다 (시안 검토판).
 */
export function AdminActions({ no, status, submitted, pending, early, closed, award }: { no: string; status: string; submitted: number; pending: number; early: boolean; closed: boolean; award: { cro: string; at: string; contract: string } | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState("");

  const run = async (key: string, opts: Parameters<typeof confirm>[0]) => {
    if (busy) return;
    setBusy(key);
    try {
      if (await confirm(opts)) router.refresh();
    } finally {
      setBusy("");
    }
  };
  const post = (body: unknown, fallback: string) => async () => { await adminPost(`/api/admin/rfqs/${no}/status`, body, fallback); };
  const done = status === "closed" || status === "cancelled";
  // 기한이 지난 요청만 마감한다. 기한 전에는 참여가 마감된 뒤 참여한 기관이 모두 제출하면 DB 가 연다 (2026-10-21 결정 2)
  const canClose = !done && !closed && !early && ["distributed", "quoted"].includes(status);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canClose && (
          <Button className="b1" pending={busy === "close-replies"} disabled={submitted === 0 || (!!busy && busy !== "close-replies")} title={submitted === 0 ? "제출된 견적이 있어야 마감할 수 있습니다" : undefined} onClick={() => run("close-replies", {
            title: `견적 ${submitted}건으로 회신을 마감할까요?`,
            body: `마감하면 비교표가 열리고${pending ? ` 제출하지 않은 ${pending}곳의 회신 링크가 닫히며` : ""}, 열린 비교표는 다시 닫거나 회신 기한을 늘릴 수 없습니다.`,
            confirmLabel: "회신 마감",
            pendingLabel: "마감하는 중",
            danger: true,
            action: async () => { await adminPost(`/api/admin/rfqs/${no}/close-replies`, {}, "회신을 마감하지 못했어요. 요청 상태는 바뀌지 않았어요."); },
          })}>
            회신 마감
          </Button>
        )}
        {!done && (
          <Button className="b2" pending={busy === "close"} disabled={!!busy && busy !== "close"} onClick={() => run("close", {
            title: `${josa(no, "을", "를")} 종료할까요?`,
            body: "종료하면 의뢰자에게 종료 알림이 갑니다.",
            confirmLabel: "종료",
            pendingLabel: "종료하는 중",
            action: post({ status: "closed" }, "종료하지 못했어요. 요청 상태는 바뀌지 않았어요."),
          })}>종료</Button>
        )}
        {!done && (
          <Button className="b2 b2--danger" pending={busy === "cancel"} disabled={!!busy && busy !== "cancel"} onClick={() => run("cancel", mopUp(no))}>요청 마무리</Button>
        )}
        {done && (
          <Button className="b2" pending={busy === "reopen"} disabled={!!busy} onClick={() => run("reopen", {
            title: `${josa(no, "을", "를")} 다시 열까요?`,
            body: "다시 열면 마무리 전 단계로 돌아갑니다.",
            confirmLabel: "다시 열기",
            pendingLabel: "여는 중",
            action: post({ status: "reopen" }, "다시 열지 못했어요. 요청 상태는 바뀌지 않았어요."),
          })}>다시 열기</Button>
        )}
      </div>
      {!done && !closed && early && ["distributed", "quoted"].includes(status) && (
        <p className="adm-small adm-muted" style={{ margin: 0 }}>회신 기한 전에는 마감하지 않아요.</p>
      )}
      {award && (
        <div className="note note--ok" style={{ flexDirection: "column", gap: 2 }}>
          <b style={{ fontWeight: 600 }}>{award.cro} 선정 · {award.at}</b>
          <span>{award.contract ? `계약 체결 보고 · ${award.contract}` : "계약 체결 보고 대기"}</span>
        </div>
      )}
    </div>
  );
}

/** 요청 마무리 확인창 (시안 a-intake~close). 취소 처리(cancelled)라 안내를 받은 기관의 링크가 닫히고 의뢰자에게 알림이 간다 */
export function mopUp(no: string) {
  return {
    title: `${josa(no, "을", "를")} 마무리할까요?`,
    body: "마무리하면 의뢰자에게 결과 메일이 가고, 안내를 받은 기관은 더 참여하거나 회신할 수 없습니다.",
    confirmLabel: "요청 마무리",
    pendingLabel: "마무리하는 중",
    danger: true,
    action: async () => { await adminPost(`/api/admin/rfqs/${no}/status`, { status: "cancelled" }, "요청을 마무리하지 못했어요. 요청 상태는 바뀌지 않았어요."); },
  };
}

/** 운영 메모 (내부용). 저장에 실패하면 칸 바로 아래 이유를 쓰고 입력은 그대로 둔다 (시안 a-r~memo) */
export function MemoForm({ no, note: initial }: { no: string; note: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    try {
      await adminPost(`/api/admin/rfqs/${no}/status`, { note }, "메모를 저장하지 못했어요. 연결을 확인해 주세요.");
      setSaved(note);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "메모를 저장하지 못했어요. 연결을 확인해 주세요.");
    }
  };
  return (
    <div className="fld">
      <textarea id="note" className="ta" rows={3} aria-label="운영 메모 (내부용)" aria-invalid={!!err || undefined} aria-describedby={err ? "note-err" : undefined} value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} />
      {err && <p id="note-err" className="fld__err" role="alert">{err}</p>}
      <div>
        <Button className="b2 bsm" disabled={note === saved} onClick={save}>메모 저장</Button>
      </div>
    </div>
  );
}

/** 접수 오른쪽 칸의 "마무리" (서버 화면에서 쓰는 단추) */
export function MopUpButton({ no }: { no: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  return <Button className="b2 bsm" onClick={async () => { if (await confirm(mopUp(no))) router.refresh(); }}>마무리</Button>;
}
