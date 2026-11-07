import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { type CroPaths } from "@/components/cro/Pipeline";
import { ClientsView, type ClientTab } from "@/components/cro/ClientsView";
import { buildFeed, groupClients, type ClientNote } from "@/lib/clients";
import type { Session } from "@/lib/auth";

export const PATHS: CroPaths = { pipe: "/design-preview/cro-crm", clients: "/design-preview/cro-crm/clients" };
export const NAV: NavItem[] = [
  { href: PATHS.pipe, label: "견적 진행", icon: "inbox", exact: true },
  { href: PATHS.clients, label: "고객", icon: "clients" },
  { href: "/cro/docs", label: "견적서", icon: "quote" },
  { href: "/design-preview/catalog", label: "시험 목록", icon: "list" },
  { href: "/cro/notifications", label: "알림", icon: "bell" },
  { href: "/cro/org", label: "기관", icon: "org" },
  { href: "/cro/billing", label: "청구", icon: "receipt" },
];

const DAY = 864e5;
const at = (now: number, d: number) => new Date(now + d * DAY).toISOString();
const ymd = (now: number, d: number) => new Date(now + d * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/**
 * 화면 설명용 예시. 회사·금액은 실제 값이 아니다.
 * 한 기관이 받은 요청 6건: 참여 결정 전 2, 작성 중 1, 제출 1, 선정 2(하나는 계약 보고 남음), 미선정 1
 */
export function sample(now = Date.now()) {
  const rfq = (n: number, o: Record<string, unknown> = {}) => ({
    rfq_no: `DC-2026-01${n}`, substance: `예시 물질 ${n}`, categories: ["일반독성"], org_type: "제약사", company: `예시 의뢰사 ${String.fromCharCode(64 + n)}`,
    status: "distributed", selected_quote_id: null, compared_at: null, join_by: ymd(now, 3), user_id: `u${n}`, contact_name: "담당자", email: `contact${n}@example.invalid`, phone: "", ...o,
  });
  const inv = (n: number, o: Record<string, unknown>) => ({
    id: `00000000-0000-4000-8000-00000000010${n}`, rfq_id: `r${n}`, rfq_no: `DC-2026-01${n}`, status: "sent", sent_at: at(now, -4), reply_by: ymd(now, 12), expires_at: at(now, 30),
    joined_at: null, withdrawn_at: null, revoked_at: null, quote: null, rfq: rfq(n), ...o,
  });
  const q = (id: string, amount: number, o: Record<string, unknown> = {}) => ({ id, status: "submitted", total_amount: amount, submitted_at: at(now, -6), first_submitted_at: at(now, -6), valid_until: ymd(now, 40), ...o });
  const invites = [
    inv(1, { rfq: rfq(1, { categories: ["일반독성", "유전독성"] }) }),
    inv(2, { rfq: rfq(2, { categories: ["안전성약리"], join_by: ymd(now, 11) }), reply_by: ymd(now, 20) }),
    inv(3, { joined_at: at(now, -2), status: "draft", quote: q("q3", 42_000_000, { status: "draft", submitted_at: null, first_submitted_at: null }) }),
    inv(4, { joined_at: at(now, -9), status: "submitted", quote: q("q4", 86_000_000), rfq: rfq(4, { compared_at: at(now, -1) }) }),
    inv(5, { joined_at: at(now, -30), status: "submitted", quote: q("q5", 120_000_000), rfq: rfq(5, { status: "selected", selected_quote_id: "q5" }) }),
    inv(6, { joined_at: at(now, -60), status: "submitted", quote: q("q6", 64_000_000), rfq: rfq(6, { status: "contracting", selected_quote_id: "q6", company: "예시 의뢰사 E", user_id: "u5" }) }),
    inv(7, { joined_at: at(now, -20), status: "submitted", quote: q("q7", 55_000_000), rfq: rfq(7, { status: "selected", selected_quote_id: "other" }) }),
  ];
  const award = (n: number, i: (typeof invites)[number], amount: number, o: Record<string, unknown>) => ({
    id: `a${n}`, invite_id: i.id, rfq_id: i.rfq_id, awarded_at: at(now, -5), contract_reported_at: null, contract_amount: null, substance_updated_at: null, quoteAmount: amount,
    rfq: i.rfq, ...o,
  });
  const awards = [
    award(5, invites[4], 120_000_000, {}),
    award(6, invites[5], 64_000_000, { awarded_at: at(now, -40), contract_reported_at: at(now, -30), contract_amount: 61_500_000 }),
  ];
  const notes: ClientNote[] = [
    { id: "n1", body: "다음 달 13주 반복투여 문의 예정이라고 함. 그때 회복군 포함 여부 다시 확인", remind_on: ymd(now, 14), reminded_at: null, created_at: at(now, -3), author: "검토 계정" },
  ];
  return { invites, awards, notes };
}

export const SESSION: Session = {
  userId: "crm-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
  profile: { id: "crm-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
};

export function previewEnabled() {
  return process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
}

export function ClientsPreview({ c, tab }: { c?: string; tab?: string }) {
  const { awards, notes } = sample();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aw = awards as any;
  const clients = groupClients(aw);
  const cur = clients.find((x) => x.key === c) ?? null;
  const active = cur ?? clients[0] ?? null;
  const t: ClientTab = tab === "won" || tab === "info" ? tab : "log";
  const feed = active ? buildFeed(active, aw, active.key === "u5" ? notes : [], []) : [];
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV}>
        <ClientsView clients={clients} cur={cur} active={active} tab={t} feed={feed} docs={[]} notesReady paths={PATHS} />
      </Shell>
    </AppState>
  );
}
