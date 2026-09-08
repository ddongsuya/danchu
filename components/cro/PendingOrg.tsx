import Link from "next/link";
import type { CroOrg } from "@/lib/auth";

/** 기관이 승인되기 전에 보이는 안내 */
export function PendingOrg({ org }: { org: CroOrg | null }) {
  if (!org) {
    return (
      <div className="empty">
        <b>소속 기관이 없습니다</b>
        계정이 기관에 연결되어 있지 않습니다. hello@danchu.kr로 알려주시면 연결해 드립니다.
      </div>
    );
  }
  const msg = {
    pending: ["승인을 기다리고 있습니다", "운영자가 기관 정보를 확인한 뒤 승인합니다. 보통 영업일 1~2일 안에 결과를 메일로 알려 드립니다."],
    rejected: ["가입 신청이 반려되었습니다", "자세한 사유는 메일로 안내했습니다. 문의는 hello@danchu.kr로 보내주세요."],
    suspended: ["참여가 일시 중지되었습니다", "문의는 hello@danchu.kr로 보내주세요."],
    approved: ["", ""],
  }[org.status];
  return (
    <div className="empty">
      <b>{msg[0]}</b>
      {org.name} · {msg[1]}
      <div style={{ marginTop: 14 }}>
        <Link href="/cro/org" className="b2 bsm">기관 정보 확인</Link>
      </div>
    </div>
  );
}
