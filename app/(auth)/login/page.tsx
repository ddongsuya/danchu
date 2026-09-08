import type { Metadata } from "next";
import { LoginView } from "@/components/auth/LoginView";
import { redirectIfLoggedIn } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "로그인 — 단추" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  await redirectIfLoggedIn(next);
  return <LoginView />;
}
