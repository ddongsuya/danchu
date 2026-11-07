import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogView } from "@/components/cro/crm/LogView";
import { rowsOf } from "@/components/cro/crm/ctx";
import { STAGE_LABEL, type Stage } from "@/lib/crm-deals";
import { personLabel } from "@/lib/crm-shape";
import { Frame } from "../frame";
import { CPATHS, ME, previewCtx, previewEnabled } from "../fixtures";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "기록 남기기 검토 · 단추", robots: { index: false, follow: false } };

export default function CrmLogPreview() {
  if (!previewEnabled()) notFound();
  const c = previewCtx();
  const deals = rowsOf(c).filter((r) => r.deal.status === "open").map((r) => ({
    id: r.deal.id, title: r.deal.title, stage: STAGE_LABEL[r.deal.stage as Stage], who: [r.company ?? (r.danchuNo ? `단추 ${r.danchuNo}` : ""), r.contact ?? ""].filter(Boolean).join(" · "),
    companyId: r.deal.company_id, contacts: c.data.contacts.filter((x) => x.company_id === r.deal.company_id).map((x) => ({ id: x.id, name: personLabel(x.name, x.title) })),
  }));
  const start = deals.find((d) => d.title.startsWith("단회·반복"))?.id ?? null;
  return <Frame><LogView deals={deals} start={start} members={c.data.members} me={ME} back={CPATHS.today} base={CPATHS.deals} /></Frame>;
}
