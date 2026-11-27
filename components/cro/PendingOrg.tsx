import Link from "next/link";
import type { CroOrg } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * 기관이 승인되기 전, 또는 기존 기관 합류 승인 전에 보이는 안내 (시안 검토판 c-pending · c-pending~wait).
 * 시스템이 끝낸 단계까지만 말한다. 처리 기간은 약속하지 않는다
 */
export function PendingOrg({ org, pendingOrg }: { org: CroOrg | null; pendingOrg?: CroOrg | null }) {
  const check = <Link href="/cro/org" className="b1 bsm">기관 정보 확인</Link>;
  if (!org) {
    if (pendingOrg) return <EmptyState title={`${pendingOrg.name} 담당자 합류를 기다리고 있어요`}>연결되면 메일로 알려요.</EmptyState>;
    return <EmptyState title="소속 기관이 없어요" action={check} />;
  }
  const msg = {
    pending: ["기관 참여 신청을 보냈어요", "운영자가 승인하면 메일로 알려요."],
    rejected: ["가입 신청이 반려됐어요", "사유는 메일로 안내했어요."],
    suspended: ["참여가 일시 중지됐어요", "문의는 support@danchu.kr로 보내 주세요."],
    approved: ["", ""],
  }[org.status];
  return <EmptyState title={msg[0]} action={check}>{msg[1]}</EmptyState>;
}
