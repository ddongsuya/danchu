import type { Metadata } from "next";
import { SignupView } from "@/components/auth/SignupView";
import { redirectIfLoggedIn } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "의뢰자 가입 — 단추" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  await redirectIfLoggedIn(next);
  return <SignupView />;
}
