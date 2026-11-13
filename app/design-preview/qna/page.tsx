import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { PREREG_NAV_CRO, PREREG_NAV_REQ } from "@/components/app/prereg-nav";
import { QnaBoard } from "@/components/qna/QnaBoard";
import type { Session } from "@/lib/auth";
import { croItems, partyLabels, sponsorItems, type QnaRow } from "@/lib/qna";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "질의응답 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 화면 확인용 예시. 기관과 글은 실제 값이 아니다 */
const TESTS = [
  { seq: 1, name: "반복투여 4주" },
  { seq: 2, name: "용량결정(DRF) 2주" },
  { seq: 3, name: "복귀돌연변이(Ames)" },
  { seq: 4, name: "소핵 in vivo" },
];
const INV = [
  { id: "inv-a", cro_name: "기관 가", joined_at: "2026-11-10T01:00:00Z", sent_at: "2026-11-09T01:00:00Z" },
  { id: "inv-b", cro_name: "기관 나", joined_at: "2026-11-10T03:00:00Z", sent_at: "2026-11-09T01:00:00Z" },
  { id: "inv-c", cro_name: "기관 다", joined_at: "2026-11-11T02:00:00Z", sent_at: "2026-11-09T01:00:00Z" },
];
const row = (o: Partial<QnaRow> & Pick<QnaRow, "id" | "invite_id" | "direction" | "topic" | "body" | "created_at">): QnaRow => ({
  rfq_id: "rfq", cro_org_id: null, test_seq: null, body_has_contact: false, asked_by: null, answer: null, answer_has_contact: false, answered_by: null, answered_at: null, scope: null, ...o,
});
const ROWS: QnaRow[] = [
  row({ id: "00000000-0000-4000-8000-000000000004", invite_id: "inv-c", direction: "cro", topic: "substance", test_seq: 1, body: "시험물질 용해도 자료가 있으면 부형제 선정에 참고하겠습니다. 물에 녹는지 여부만이라도 알려 주세요. 자료가 길면 qa-test@example.com 으로 보내 주셔도 됩니다.", body_has_contact: true, created_at: "2026-11-14T01:12:00Z" }),
  row({ id: "00000000-0000-4000-8000-000000000003", invite_id: "inv-a", direction: "cro", topic: "terms", test_seq: 1, body: "반복투여 4주 시험에 회복군 2주를 포함할까요? 요청서에 회복군 표시가 없습니다.", created_at: "2026-11-13T07:40:00Z", answer: "회복군 포함해 주세요. 대조군과 고용량군에 암수 각 5마리, 회복 기간 2주입니다.", answered_at: "2026-11-13T09:02:00Z", scope: "all" }),
  row({ id: "00000000-0000-4000-8000-000000000002", invite_id: "inv-b", direction: "cro", topic: "schedule", body: "동물 입고 일정상 12월 14일 착수가 가능합니다. 이 착수일로 견적해도 될까요?", created_at: "2026-11-13T02:05:00Z", answer: "가능합니다. 12월 14일 착수로 견적해 주세요.", answered_at: "2026-11-13T02:40:00Z", scope: "private" }),
  row({ id: "00000000-0000-4000-8000-000000000001", invite_id: "inv-a", direction: "cro", topic: "substance", body: "시험물질 제공량이 반복투여와 유전독성 합산으로 충분한지 확인 부탁드립니다.", created_at: "2026-11-12T06:22:00Z", answer: "50 g 제공 예정입니다.", answered_at: "2026-11-12T08:10:00Z", scope: "private" }),
];
const SENT: QnaRow[] = [
  row({ id: "00000000-0000-4000-8000-000000000005", invite_id: "inv-b", direction: "sponsor", topic: "quote", body: "조제물분석이 미포함으로 되어 있습니다. 포함하면 견적 총액이 얼마나 달라지나요?", created_at: "2026-11-22T01:00:00Z" }),
];

/**
 * 질의응답 화면 검토용 (로그인 없이). Vercel 미리보기 배포에서만 열린다. 보내기는 막혀 있다.
 * ?role=req 의뢰자(회신 중) · ?role=req&stage=compared 의뢰자(비교표 뒤, 기관에 질의) · ?role=cro 기관
 */
export default async function QnaPreview({ searchParams }: { searchParams: Promise<{ role?: string; stage?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const { role, stage } = await searchParams;
  const tests = new Map(TESTS.map((t) => [t.seq, t.name]));
  const cro = role === "cro";
  const session: Session = {
    userId: "qna-preview", email: "preview@example.invalid", org: cro ? { id: "org", name: "기관 나", status: "approved" } as Session["org"] : null, pendingOrg: null,
    profile: { id: "qna-preview", email: "preview@example.invalid", role: cro ? "cro" : "requester", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };

  let board;
  if (cro) {
    const { mine, shared } = croItems([...SENT, ...ROWS], { inviteId: "inv-b", selectedInviteId: null, tests });
    board = <QnaBoard side="cro" endpoint="" no="DC-2026-0000" substance="DC-101" backHref="/design-preview/qna?role=cro" mine={mine} shared={shared} canAsk canAnswer askBy="2026-11-20" tests={TESTS} />;
  } else {
    const compared = stage === "compared";
    const labels = partyLabels(INV, compared);
    const rows = compared ? [...SENT, ...ROWS] : ROWS;
    const items = sponsorItems(rows, { labels, selectedInviteId: null, tests });
    board = (
      <QnaBoard
        side="sponsor" endpoint="" no="DC-2026-0000" substance="DC-101" backHref="/design-preview/qna?role=req"
        items={items} targets={compared ? INV.map((i) => ({ inviteId: i.id, label: labels.get(i.id)! })) : []}
        canAsk={compared} canAnswer askBy={null} tests={TESTS}
      />
    );
  }
  return (
    <AppState>
      <Shell session={session} nav={cro ? PREREG_NAV_CRO : PREREG_NAV_REQ}>
        {board}
      </Shell>
    </AppState>
  );
}
