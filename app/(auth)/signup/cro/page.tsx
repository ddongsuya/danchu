import type { Metadata } from "next";
import { SignupCroView } from "@/components/auth/SignupCroView";
import { redirectIfLoggedIn } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "CRO 가입 신청 — 단추" };
export const dynamic = "force-dynamic";

export default async function SignupCroPage() {
  await redirectIfLoggedIn();
  return <SignupCroView />;
}
