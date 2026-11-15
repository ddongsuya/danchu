import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { labEnabled } from "@/lib/agent-lab/domain";
import { hasLabAccess, LAB_ACCESS_COOKIE } from "@/lib/agent-lab/access";
import { AgentLab } from "@/components/agent-lab/AgentLab";
import { AgentLabAccess } from "@/components/agent-lab/AgentLabAccess";
import "./agent-lab.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "단추 에이전트 테스트", robots: { index: false, follow: false } };

export default async function AgentLabPage() {
  if (!labEnabled()) notFound();
  if (!hasLabAccess((await cookies()).get(LAB_ACCESS_COOKIE)?.value)) return <AgentLabAccess />;
  return <AgentLab />;
}
