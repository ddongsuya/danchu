import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestsBoard, awardLiteOf, type BoardQuery, type Tab } from "@/components/cro/RequestsBoard";
import { RequestView } from "@/components/cro/RequestView";
import { ReplyForm, type ReplyLoaded } from "@/components/cro/ReplyForm";
import { ReplyDone } from "@/components/cro/ReplyDone";
import { CroSkeleton } from "@/components/cro/CroSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { buildPipeline } from "@/lib/pipeline";
import { todaySeoul } from "@/lib/format";
import type { Loaded } from "@/lib/quote-load";
import { Frame } from "../cro-crm/frame";
import { PATHS, previewEnabled, sample } from "../cro-crm/fixtures";
import { croStoryFixture, replyFixture } from "../report-fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "기관 받은 요청 검토 · 단추", robots: { index: false, follow: false } };

const B = "/design-preview/cro-req";
const VIEWS: [string, string][] = [
  ["board", "받은 요청"], ["first", "첫 사용"], ["err", "불러오기 실패"], ["load", "불러오는 중"],
  ["r", "참여 전"], ["r-declined", "불참 뒤"], ["r-ro", "참여 기한 지남"], ["join", "참여 뒤"], ["q", "회신 링크"], ["q-expired", "링크 만료"],
  ["reply", "회신 쓰기"], ["reply-ro", "회신 읽기 전용"], ["done", "제출 완료"],
];

type Sp = { view?: string; tab?: string; q?: string; cat?: string; due?: string; sp?: string; sel?: string; sort?: string };

/** 기관 받은 요청 · 요청 상세 · 회신 화면 검토 (시안 검토판 c-req · c-r · c-join · c-reply · q-*). 예시 데이터, 저장 안 됨 */
export default async function CroReqPreview({ searchParams }: { searchParams: Promise<Sp> }) {
  if (!previewEnabled()) notFound();
  const sp = await searchParams;
  const view = sp.view ?? "board";
  const now = Date.now();
  const story = (before: boolean, patch: Record<string, unknown> = {}) => ({ ...croStoryFixture(now, before), ...patch }) as unknown as Loaded;
  let body: React.ReactNode;
  if (view === "board") {
    const { invites, awards } = sample(now);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = buildPipeline(invites as any, awards as any, now);
    const tab = (["new", "draft", "sent", "won"] as const).find((t) => t === sp.tab) ?? "all";
    const query: BoardQuery = { tab: tab as Tab, q: sp.q ?? "", cat: sp.cat ?? "", due: sp.due ?? "", glp: "", sp: sp.sp ?? "", sel: sp.sel ?? null, sort: sp.sort === "due" ? "due" : "" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body = <RequestsBoard items={items} awards={awards.map((a) => awardLiteOf(a as any))} query={query} paths={PATHS} companyOf={{}} today={todaySeoul()} base={B} />;
  } else if (view === "first") {
    body = <><div className="ph"><div><h1>받은 요청</h1></div></div><EmptyState kind="first" title="아직 받은 요청이 없어요" action={<Link href="/cro/org" className="b1 bsm">기관 정보 채우기</Link>}>수행 분야를 채우면 분야가 맞는 요청의 참여 안내를 받아요.</EmptyState></>;
  } else if (view === "err") {
    body = <><div className="ph"><div><h1>받은 요청</h1></div></div><ErrorState title="받은 요청을 불러오지 못했어요" /></>;
  } else if (view === "load") {
    body = <CroSkeleton kind="board" label="받은 요청을 불러오는 중" />;
  } else if (view === "r") {
    body = <RequestView got={story(true)} replyHref={`${B}?view=reply`} afterDeclineHref={`${B}?view=r-declined`} portal />;
  } else if (view === "r-declined") {
    body = <RequestView got={story(true, { declined: true, canRejoin: true })} replyHref={`${B}?view=reply`} afterDeclineHref={B} portal />;
  } else if (view === "r-ro") {
    body = <RequestView got={story(true, { declined: true, canRejoin: false })} replyHref={`${B}?view=reply`} afterDeclineHref={B} portal />;
  } else if (view === "join") {
    body = <RequestView got={story(false)} replyHref={`${B}?view=reply`} afterDeclineHref={B} afterWithdrawHref={B} qna={{ href: "/design-preview/qna", total: 1, pending: 1 }} portal />;
  } else if (view === "q") {
    body = <RequestView got={story(true)} replyHref={`${B}?view=reply`} afterDeclineHref={`${B}?view=q`} fileToken="preview" />;
  } else if (view === "q-expired") {
    body = <RequestView got={story(true, { expired: true })} replyHref={`${B}?view=reply`} afterDeclineHref={B} fileToken="preview" />;
  } else if (view === "reply" || view === "reply-ro") {
    const fx = replyFixture(now) as unknown as ReplyLoaded;
    const preview = view === "reply-ro" ? { ...fx, closed: true, closedMessage: "", draft: fx.draft && { ...fx.draft, status: "submitted" } } : fx;
    body = <ReplyForm token="design-preview-no-live-token" backHref={`${B}?view=join`} doneHref={`${B}?view=done`} orgCerts={["MFDS GLP"]} preview={preview} />;
  } else {
    body = <ReplyDone no="DEMO-008" title="반복투여 13주 · 설치류 외 5" replyBy={new Date(now + 2 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })} total={140_000_000} weeks="13" files={0} submittedAt={new Date(now).toISOString()} editHref={`${B}?view=reply`} backHref={B} backLabel="받은 요청 보기" closed={false} />;
  }
  return (
    <Frame>
      <nav className="cx-preview" aria-label="검토 화면" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {VIEWS.map(([v, l]) => <Link key={v} href={`${B}?view=${v}`} aria-current={v === view ? "page" : undefined}>{l}</Link>)}
      </nav>
      {body}
    </Frame>
  );
}
