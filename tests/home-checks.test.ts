import { describe, expect, it } from "vitest";
import { homeChecks, type CheckAward, type CheckReq } from "@/lib/home-checks";

const md = (d: string) => d.slice(5, 10);
const req = (no: string, o: Partial<CheckReq> = {}): CheckReq => ({ rfq_no: no, substance: "EB", status: "distributed", reply_by: "2027-07-20", compared_at: null, joined: 1, sent: 3, submitted: 0, ...o });
const award = (no: string, o: Partial<CheckAward> = {}): CheckAward => ({ rfq_no: no, cro_name: "기관 B", contract_status: "signed", contract_reported_at: "2027-07-09T00:00:00Z", contract_confirm_due_at: "2027-07-16T00:00:00Z", confirmed: false, disputed: false, ...o });

describe("홈 확인 필요", () => {
  it("계약 보고 확인 대기와 기한 지남(참여 0곳)만 고르고, 기한 순", () => {
    const list = [req("A", { status: "contracting" }), req("B", { reply_by: "2027-06-25", joined: 0 }), req("C")];
    const out = homeChecks(list, [award("A")], "2027-07-14", md);
    expect(out.map((c) => c.no)).toEqual(["B", "A"]);
    expect(out[1]).toMatchObject({ pill: "확인 대기", action: "계약 내용 확인", line: "기관 B 계약 보고 · 07-16 자동 확정" });
    expect(out[0]).toMatchObject({ pill: "기한 지남", action: "기한 연장 요청", href: "/app/support?rfq=B&type=%EC%9D%BC%EC%A0%95" });
  });
  it("확정했거나 이의 중인 계약, 참여가 있는 요청은 빠진다", () => {
    const list = [req("A", { status: "contracting" }), req("B", { reply_by: "2027-06-25", joined: 1 })];
    expect(homeChecks(list, [award("A", { confirmed: true })], "2027-07-14", md)).toEqual([]);
    expect(homeChecks(list, [award("A", { disputed: true })], "2027-07-14", md)).toEqual([]);
  });
});
