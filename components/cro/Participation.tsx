"use client";

import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * 불참(참여 전)과 참여 철회(참여 뒤, 제출 전) 확인 창 (시안 검토판 c-decline · c-join~wd · c-reply~wd · q-decline).
 * 창 안에서 바로 처리하고, 실패하면 창을 닫지 않고 이유를 보여 준다. 사유는 선택이고 단추 운영자에게만 간다.
 * 화면이 본 상태(mode)를 함께 보낸다. 그 사이 상태가 바뀌었으면 라우트가 409 로 알려 준다.
 */
type Mode = "decline" | "withdraw";

const COPY: Record<Mode, { title: string; body: (joinBy: string) => string; ok: string; pending: string; retry: string; fail: string; help: string }> = {
  decline: {
    title: "이 요청에 불참할까요?",
    body: (joinBy) => `불참으로 처리하면 참여 자리에 세지 않고, ${joinBy ? `참여 결정 기한 ${joinBy}까지는` : "참여 결정 기한까지는"} 자리가 남아 있으면 다시 참여할 수 있습니다.`,
    ok: "불참으로 처리",
    pending: "처리하는 중",
    retry: "다시 처리",
    fail: "불참으로 처리하지 못했어요. 참여 상태는 바뀌지 않았어요.",
    help: "사유는 단추 운영자에게만 전달돼요.",
  },
  withdraw: {
    title: "참여를 철회할까요?",
    body: () => "철회하면 이 요청에 다시 참여할 수 없고, 작성 중이던 내용은 의뢰자에게 보이지 않습니다. 철회한 요청은 청구하지 않습니다.",
    ok: "참여 철회",
    pending: "철회하는 중",
    retry: "다시 철회",
    fail: "처리하지 못했어요. 참여 상태는 바뀌지 않았어요.",
    help: "사유는 단추 운영자에게만 전달돼요.",
  },
};

/** 확인 창을 띄우고, 확인하면 처리한 뒤 true. endpoint 는 운영자 기록용(토큰 없이 초대 id) */
export function useParticipation(token: string, endpoint?: string) {
  const confirm = useConfirm();
  return (mode: Mode, joinBy = "", operator = false): Promise<boolean> => {
    const c = COPY[mode];
    const reason = { current: "" };
    const id = `reason-${mode}`;
    return confirm({
      title: c.title,
      body: (
        <div className="stack" style={{ gap: 12 }}>
          <p>{c.body(joinBy)}</p>
          <div className="fld">
            <label className="fld__lab" htmlFor={id}>사유 (선택)</label>
            <textarea id={id} className="ta" rows={3} maxLength={500} onChange={(e) => { reason.current = e.target.value; }} aria-describedby={`${id}-help`} />
            <span id={`${id}-help`} className="fld__help">{c.help}</span>
          </div>
        </div>
      ),
      confirmLabel: operator ? (mode === "withdraw" ? "기관이 알린 철회 기록" : "기관이 알린 불참 기록") : c.ok,
      pendingLabel: c.pending,
      retryLabel: c.retry,
      danger: true,
      action: async () => {
        const res = await fetch(endpoint ?? `/api/quote/${token}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.current, mode }) }).catch(() => null);
        if (!res?.ok) {
          const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
          throw new Error(res?.status === 409 && d?.error ? d.error : c.fail);
        }
      },
    });
  };
}

/** 참여 철회 글자 버튼. 철회하면 afterHref 로 간다 (받은 요청 또는 회신 링크 첫 화면) */
export function WithdrawButton({ token, afterHref, className = "btxt" }: { token: string; afterHref: string; className?: string }) {
  const router = useRouter();
  const ask = useParticipation(token);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (!(await ask("withdraw"))) return;
        router.push(afterHref);
        router.refresh();
      }}
    >
      참여 철회
    </button>
  );
}
