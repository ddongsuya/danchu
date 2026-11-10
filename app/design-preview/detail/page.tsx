import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { PREREG_NAV_REQ } from "@/components/app/prereg-nav";
import { DetailRequest } from "@/components/app/DetailRequest";
import { DetailReply, type DetailReplyView } from "@/components/cro/DetailReply";
import { CompareBoard, type CompareCol } from "@/components/CompareBoard";
import type { Session } from "@/lib/auth";
import type { Values } from "@/lib/rfq-schema";
import { detailLines } from "@/lib/detail-quote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "상세 견적 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 화면 확인용 예시. 기관 이름과 금액은 실제 값이 아니다 */
const PAYLOAD: Values = {
  categories: ["일반독성", "유전독성"],
  "일반독성.items": ["반복투여 4주", "용량결정(DRF) 2주"],
  "일반독성.species": ["랫드"],
  "일반독성.recovery": "2주",
  "일반독성.tk": "포함",
  "유전독성.items": ["복귀돌연변이(Ames, TG 471)", "소핵 in vivo(랫드)"],
};
const ROWS = [
  { seq: 1, name: "반복투여 4주", category: "일반독성", amount: 48_000_000, weeks: 20 },
  { seq: 2, name: "용량결정(DRF) 2주", category: "일반독성", amount: 14_000_000, weeks: 8 },
  { seq: 3, name: "복귀돌연변이(Ames, TG 471)", category: "유전독성", amount: 9_000_000, weeks: 8 },
  { seq: 4, name: "소핵 in vivo(랫드)", category: "유전독성", amount: 16_000_000, weeks: 10 },
];
const DETAIL: Values = { storage: "냉장(2~8℃)", amount: "50 g", "detail.appearance": "백색 분말, 순도 99.2%", reportLang: ["국문"], "일반독성.recovery": "4주" };

/**
 * 2차 상세 견적 화면 검토용 (로그인 없이). Vercel 미리보기 배포에서만 열린다. 실제 계정·데이터는 쓰지 않고 보내기는 막혀 있다.
 * ?role=req 의뢰자 상세 견적 요청 · ?role=cro 기관 2차 회신 · ?role=board 비교표의 1차·2차
 */
export default async function DetailPreview({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const { role } = await searchParams;
  const total = ROWS.reduce((a, r) => a + r.amount, 0);

  if (role === "cro") {
    const { changed, added } = detailLines(DETAIL, PAYLOAD, ["일반독성", "유전독성"], { forCro: true });
    const view: DetailReplyView = {
      no: "DC-2026-0000", substance: "DC-101", status: "sent", replyBy: "2026-11-25", expired: false, closed: false, changed, added,
      files: [{ id: "00000000-0000-4000-8000-000000000001", name: "첨부 1 (PDF, 1.2MB)", size: 1_258_291 }],
      first: { total, weeks: 22, items: ROWS.map((r) => ({ seq: r.seq, name: r.name, amount: r.amount, weeks: r.weeks, avail: "가능" })) },
      reply: null,
    };
    return <DetailReply token="preview" view={view} backHref="/design-preview/detail?role=board" preview />;
  }

  if (role === "board") {
    const session: Session = {
      userId: "detail-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
      profile: { id: "detail-preview", email: "preview@example.invalid", role: "requester", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
    };
    const col = (id: string, name: string, k: number, detail: CompareCol["detail"]): CompareCol => ({
      id, name, total: Math.round(total * k), weeks: 22, final: null, finalReport: null, start: "2026-12-07", valid: "2026-12-31", pay: "30 · 40 · 30",
      includes: [], note: null, glpOk: true, glpMissing: [], glp: ["식약처(KGLP)"], unavailable: [], conditional: 0,
      items: ROWS.map((r) => ({ seq: r.seq, avail: "가능", amount: Math.round(r.amount * k), weeks: r.weeks })),
      hasPdf: false, selected: false, auto: false, detail,
    });
    const cols = [
      col("a", "기관 A", 1, { status: "submitted", total: total + 6_000_000, weeks: 24, note: null, items: [{ seq: 1, amount: 54_000_000, weeks: 22, mode: "as_requested", reason: "" }] }),
      col("b", "기관 B", 1.08, { status: "kept", total: null, weeks: null, note: null, items: [] }),
      col("c", "기관 C", 1.2, null),
    ];
    return (
      <AppState>
        <Shell session={session} nav={PREREG_NAV_REQ}>
          <div className="cmp-detail">
            <b>상세 견적</b>
            <span className="tnum">2차 회신 기한 11.25 · 답한 곳 2/2</span>
          </div>
          <CompareBoard no="DC-2026-0000" cols={cols} rows={ROWS.map(({ seq, name, category }) => ({ seq, name, category }))} canSelect={false} />
        </Shell>
      </AppState>
    );
  }

  return (
    <DetailRequest
      no="DC-2026-0000"
      substance="DC-101"
      quotes={[{ id: "a", name: "기관 A", total }, { id: "b", name: "기관 B", total: Math.round(total * 1.08) }, { id: "c", name: "기관 C", total: Math.round(total * 1.2) }, { id: "d", name: "기관 D", total: Math.round(total * 1.31) }]}
      payload={PAYLOAD}
      cats={["일반독성", "유전독성"]}
      closeHref="/design-preview/detail?role=board"
      preview
    />
  );
}
