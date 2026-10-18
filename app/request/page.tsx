import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, homeOf } from "@/lib/auth";
import { GuestShell } from "@/components/shell/GuestShell";
import { NewRequest } from "@/components/NewRequest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "단추 · 견적 요청서",
  description: "로그인 없이 요청서를 쓰고, 보내기 직전에 이메일만 확인하면 기관에 전달됩니다.",
  robots: { index: false, follow: true },
};

/**
 * 로그인 전 방문자의 요청서. 로그인한 의뢰자는 앱 위자드로 보낸다 (?preset 은 그대로).
 * 보내기를 누르면 같은 화면에서 이메일 인증 → 쓴 요청서가 그대로 접수된다.
 */
export default async function GuestRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await getSession();
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const search = q.toString() ? `?${q}` : "";
  if (s) redirect(s.profile.role === "requester" || s.profile.role === "admin" ? `/app/new${search}` : homeOf(s.profile.role));
  return (
    <GuestShell loginNext={`/app/new${search}`}>
      <NewRequest guest userId="guest" contact={{ company: "", name: "", dept: "", email: "", phone: "", orgType: "" }} />
    </GuestShell>
  );
}
