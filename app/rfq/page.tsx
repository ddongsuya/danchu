import type { Metadata } from "next";
import { RfqForm } from "@/components/RfqForm";

export const metadata: Metadata = { title: "견적 요청 — 단추" };

export default function RfqPage() {
  return <RfqForm />;
}
