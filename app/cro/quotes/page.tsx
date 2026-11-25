import { redirect } from "next/navigation";

/** 제출한 견적은 받은 요청의 "제출" 탭으로 옮겼다 (2026-11-26 시안 v7 c-req-submitted). 알림·메일의 예전 링크를 살린다 */
export default function CroQuotes() {
  redirect("/cro/requests?tab=sent");
}
