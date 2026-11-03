import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import Done from "@/app/app/new/done/page";

let joinBy: string | null;
vi.mock("@/lib/auth", () => ({ requireSession: async () => ({ userId: "requester" }) }));
vi.mock("@/lib/data", () => ({
  getRfqByNo: async () => ({ rfq_no: "DC-2026-0001", join_by: joinBy }),
  ownsRfq: () => true,
  getRfqDetail: async () => ({ files: [], invites: [{}] }),
}));
vi.mock("@/lib/distribute", () => ({ defaultReplyBy: () => "2026-11-11" }));

async function receipt(deadline: string | null) {
  joinBy = deadline;
  const page = await Done({ searchParams: Promise.resolve({ no: "DC-2026-0001" }) });
  return renderToStaticMarkup(page);
}

it.each([
  ["2026-11-04T14:59:59+00:00", "11월 4일 23:59"],
  ["2026-11-04T16:05:00+00:00", "11월 5일 01:05"],
])("접수 화면에 참여 결정 기한 %s을 서울 시각으로 표시한다", async (deadline, label) => {
  const html = await receipt(deadline);
  expect(html).toContain(`>${label} (한국시간)</time> · 참여 결정 기한`);
});

it("참여 결정 기한이 없는 기존 요청은 해당 일정을 생략한다", async () => {
  expect(await receipt(null)).not.toContain("참여 결정 기한");
});
