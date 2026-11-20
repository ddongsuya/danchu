import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { Crumb } from "@/components/app/ui";
import { ContractPages } from "@/components/contract/ContractPages";
import { SendDraftButton } from "@/components/contract/SendDraftButton";
import { PrintButton } from "@/components/cro/PrintButton";
import { buildContractDraft } from "@/lib/contract-draft";
import type { Session } from "@/lib/auth";
import "@/components/contract/contract.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "계약서(안) 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/cro/requests", label: "받은 요청", icon: "inbox" },
  { href: "/design-preview/contract", label: "수주·계약", icon: "award" },
];

/** 계약서(안) 화면 검토용 (로그인 없이, 저장·전송 안 됨). 미리보기 배포에서만. 값은 계산 확인용 가상의 값 */
export default async function ContractPreview() {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const draft = buildContractDraft({
    rfqNo: "DC-2026-0142",
    substance: "시험물질 A",
    awardedAt: "2026-11-20T03:00:00Z",
    sponsor: { name: "예시 의뢰사", contact: "검토 담당자", bizNo: null, address: null },
    cro: { name: "예시 비임상연구센터", contact: "사업개발팀", bizNo: "000-00-00000", address: "예시 주소" },
    items: [
      { seq: 1, name: "랫드 4주 반복투여독성", avail: "가능", amount: 48_500_000, weeks: 14 },
      { seq: 2, name: "TK 분석", avail: "가능", amount: 6_200_000, weeks: 6 },
      { seq: 3, name: "회복군 추가(4주)", avail: "조건부 가능", amount: 31_500_000, weeks: 4 },
    ],
    quote: { pay_terms: "50/50", start_date: "2026-12-07", report_lang: "국문", includes: ["조직병리(검경 포함)", "QA 점검"], final_weeks: 18, revision: 1 },
    terms: { extra: "시험물질은 착수 2주 전까지 보낸다.", note: "" },
  });
  const session: Session = {
    userId: "contract-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "contract-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <div className="noprint">
          <Crumb href="/design-preview/contract" label="수주·계약" />
        </div>
        <div className="ph noprint">
          <div>
            <h1>계약서(안)</h1>
            <p>
              {draft.rfqNo}, {draft.sponsor.name}
            </p>
          </div>
          <div className="ph__actions">
            <PrintButton />
            <SendDraftButton awardId="00000000-0000-4000-8000-000000000000" sentAt={null} />
          </div>
        </div>
        <ContractPages draft={draft} />
      </Shell>
    </AppState>
  );
}
