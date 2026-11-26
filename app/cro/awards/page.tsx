import { redirect } from "next/navigation";

/** 수주(계약 결과 보고·시험물질 필요량)는 받은 요청의 "선정" 탭으로 옮겼다 (2026-11-26 시안 v7 c-req-won). 알림·메일의 예전 링크를 살린다 */
export default function CroAwards() {
  redirect("/cro/requests?tab=won");
}
