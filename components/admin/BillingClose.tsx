"use client";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { comma } from "@/lib/format";
import { adminPost } from "./act";

/**
 * 청구 월 마감 (시안 검토판 a-close). 마감하면 그 달 명세를 저장본으로 고정하고 청구 제외 토글을 막는다.
 * 마감한 달은 다시 열 수 없다 (2026-10-20 결정, 0024). 그래서 해제 버튼이 없고, 끝나지 않은 달(이번 달·다음 달 이후)은 마감하지 않는다.
 * 마감한 달이면 아무것도 그리지 않는다 (화면 위 안내가 대신한다). 확인창이 마감을 실행하고 실패하면 창 안에 이유를 보여 준다.
 */
export function BillingClose({ month, label, closed, ended, orgs = 0, zero = 0, total = 0 }: { month: string; label: string; closed: boolean; ended: boolean; orgs?: number; zero?: number; total?: number }) {
  const router = useRouter();
  const confirm = useConfirm();
  if (closed) return null;
  if (!ended) return <span className="billclose__hint">이 달이 끝난 뒤 마감할 수 있어요</span>;

  const go = async () => {
    const ok = await confirm({
      title: `${label} 청구를 마감할까요?`,
      body: (
        <>
          <p>마감하면 이 달 명세를 고칠 수 없고, 청구서를 만들 수 있습니다.</p>
          <dl className="adm-dl" style={{ marginTop: 12 }}>
            <div><dt>청구 달</dt><dd>{label}</dd></div>
            <div><dt>청구할 기관</dt><dd className="tnum">{orgs}곳{zero ? ` (0원 ${zero}곳 제외)` : ""}</dd></div>
            <div><dt>합계 (VAT 별도)</dt><dd className="tnum">{comma(total)}</dd></div>
          </dl>
        </>
      ),
      confirmLabel: "청구 마감",
      pendingLabel: "마감하는 중",
      danger: true,
      action: async () => { await adminPost("/api/admin/billing/close", { month, closed: true }, "청구를 마감하지 못했어요. 명세는 바뀌지 않았어요."); },
    });
    if (ok) router.push(`/admin/invoices?month=${month}`);
  };

  return <Button className="b1 b1--danger" onClick={go}>청구 마감</Button>;
}
