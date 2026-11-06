import type { NavItem } from "@/components/shell/Shell";

/** 사전예약 기간 새 계정의 메뉴 (2026-11-06 시안 판 15). soon 은 누를 수 없고 열리는 날을 옆에 적는다 */
export const PREREG_NAV_REQ: NavItem[] = [
  { href: "/app", label: "둘러보기", icon: "explore", exact: true },
  { href: "/app/new", label: "요청", icon: "plus", soon: "6월 1일부터" },
  { href: "/app/report", label: "비교 보고서", icon: "doc", soon: "6월 1일부터" },
  { href: "/app/profile", label: "내 정보", icon: "user" },
];
export const PREREG_NAV_CRO: NavItem[] = [
  { href: "/cro", label: "둘러보기", icon: "explore", exact: true },
  { href: "/cro/r", label: "요청", icon: "inbox", soon: "6월 1일부터" },
  { href: "/cro/profile", label: "내 정보", icon: "user" },
];
