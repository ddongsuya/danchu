import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/agent-lab/domain";
import { AgentLab } from "@/components/agent-lab/AgentLab";
import "./agent-lab.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "단추 에이전트 테스트", robots: { index: false, follow: false } };

export default function AgentLabPage() {
  if (!labEnabled()) notFound();
  return <AgentLab />;
}
