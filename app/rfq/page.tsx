import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { RfqForm } from "@/components/RfqForm";

export const metadata: Metadata = { title: "견적 요청 — 단추" };

export default function RfqPage() {
  return (
    <div className="page form-page">
      <header className="header">
        <div className="container header__inner">
          <Logo sub="견적 요청" />
          <LangToggle />
        </div>
      </header>
      <main className="form-main">
        <RfqForm />
      </main>
    </div>
  );
}
