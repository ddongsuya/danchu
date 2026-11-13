import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/auth";
import { dbReady, unreadCount } from "@/lib/data";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";

const GROUPS: { title: string; items: { href: string; label: string; sub: string }[] }[] = [
  { title: "영업", items: [
    { href: "/cro/clients", label: "고객사", sub: "회사·담당자·회사 전체 기록" },
    { href: "/cro/reports", label: "보고서", sub: "단계별 전환 · 수주율 · 실패 사유" },
    { href: "/cro/calendar", label: "캘린더", sub: "이번 주 일정과 할 일" },
    { href: "/cro/import", label: "엑셀 가져오기", sub: "지금 쓰는 고객 엑셀 옮기기" },
  ] },
  { title: "견적", items: [
    { href: "/cro/requests", label: "받은 요청", sub: "단추 요청 참여·회신" },
    { href: "/cro/docs", label: "견적서", sub: "견적서 만들기·보내기" },
    { href: "/cro/catalog", label: "시험 목록", sub: "기관이 받는 시험과 단가" },
    { href: "/cro/notifications", label: "알림", sub: "" },
  ] },
  { title: "설정", items: [
    { href: "/cro/org", label: "기관", sub: "기관 정보·담당자" },
    { href: "/cro/billing", label: "요금제·결제", sub: "요금제·청구서" },
    { href: "/cro/profile", label: "프로필", sub: "내 이름·연락처" },
  ] },
];

/** 휴대폰 더보기 (아래 탭 네 번째). 넓은 화면에서는 사이드바에 같은 메뉴가 있다 */
export default async function CroMore() {
  const s = await requireSession("cro");
  const unread = dbReady() ? await unreadCount(s.userId) : 0;
  return (
    <div className="cx cx-more">
      <header className="cx-ph"><div><h1>더보기</h1></div></header>
      {GROUPS.map((g) => (
        <section key={g.title} className="cx-more__g" aria-labelledby={`more-${g.title}`}>
          <h2 id={`more-${g.title}`}>{g.title}</h2>
          <ul>
            {g.items.map((x) => (
              <li key={x.href}>
                <Link href={x.href}>
                  <span><b>{x.label}</b>{x.href === "/cro/notifications" ? (unread ? <small>읽지 않은 알림 {unread}개</small> : <small>새 알림 없음</small>) : x.sub && <small>{x.sub}</small>}</span>
                  <CaretRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
