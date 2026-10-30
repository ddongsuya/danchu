import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { participation, participationLabel } from "@/lib/request-policy";

/* 같은 요청은 의뢰자 목록·의뢰자 상세·운영자 목록·운영자 상세에서 같은 참여·제출 숫자를 보여야 한다 (2026-10-29 과업 점검 3).
   고치기 전: 의뢰자 목록은 0007을 "0/0곳", 상세는 "0/5곳", 운영자 목록은 초대 전부를 분모로 셌다. 운영 데이터 0007·0008 모양 그대로 */
const r0007 = { cro_count: "5곳", invites: [{ status: "sent" }, { status: "sent" }] };
const r0008 = { cro_count: "전체", invites: [{ status: "submitted", joined_at: "2026-09-29T23:37:00Z" }, { status: "sent", joined_at: "2026-10-26T01:28:00Z" }] };
const withdrawn = {
  cro_count: "3곳",
  invites: [
    { status: "submitted", joined_at: "2026-09-29T00:00:00Z", withdrawn_at: "2026-09-30T00:00:00Z" },
    { status: "submitted", joined_at: "2026-09-29T00:00:00Z" },
    { status: "sent" },
  ],
};

describe("참여 수 계산", () => {
  it("0007: 참여 0/5곳, 제출 0", () => {
    const p = participation(r0007.cro_count, r0007.invites);
    expect(p).toEqual({ joined: 0, cap: 5, submitted: 0 });
    expect(participationLabel(p)).toBe("참여 0/5곳");
  });
  it("0008: 자리 제한 없음, 참여 2곳, 제출 1", () => {
    const p = participation(r0008.cro_count, r0008.invites);
    expect(p).toEqual({ joined: 2, cap: null, submitted: 1 });
    expect(participationLabel(p)).toBe("참여 2곳");
  });
  it("철회한 제출은 세지 않는다", () => {
    expect(participation(withdrawn.cro_count, withdrawn.invites)).toEqual({ joined: 1, cap: 3, submitted: 1 });
  });
});

describe("네 화면이 같은 계산만 쓴다", () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("목록 두 곳은 participation 으로 센다", () => {
    const data = src("lib/data.ts");
    expect(data.match(/participation\(r\.cro_count/g)?.length).toBe(2);
  });
  // 의뢰자 목록 줄은 2026-10-30부터 lib/request-story.ts 의 rowLine 이 만든다
  for (const f of ["lib/request-story.ts", "app/admin/page.tsx", "app/app/r/[no]/page.tsx", "app/admin/r/[no]/page.tsx"]) {
    it(`${f} 는 participationLabel 로 표시한다`, () => {
      expect(src(f)).toContain("participationLabel(");
    });
  }
});
