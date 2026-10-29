import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stuckReasons } from "@/lib/stuck";

/* 운영자 홈 "멈춘 요청" (2026-10-29 과업 점검). 운영 데이터 모양 그대로: 오늘 2026-10-29 */
const today = "2026-10-29";
const now = new Date("2026-10-29T10:00:00Z").getTime();
const base = { compared_at: null, cro_count: "5곳", distributed_at: "2026-09-28T06:19:00Z" };

describe("멈춘 요청 이유", () => {
  const old = "2026-09-29T00:07:00Z";
  it("0007: 9월 초대는 mailed_at 이 비어도 미발송으로 보지 않는다 (Resend 기록상 배달). 기한 지남·참여 0만", () => {
    const r = stuckReasons({ ...base, rfq_no: "DC-2026-0007", status: "distributed", reply_by: "2026-10-10" }, [{ status: "sent", mailed_at: null, sent_at: old }, { status: "sent", mailed_at: null, sent_at: old }], null, today, now);
    expect(r.map((x) => x.kind)).toEqual(["no_join"]);
  });
  it("0008: 기한 전, 9월 초대라 멈춤 없음", () => {
    const r = stuckReasons({ ...base, rfq_no: "DC-2026-0008", status: "quoted", reply_by: "2026-10-31", cro_count: "전체" }, [{ status: "submitted", joined_at: "x", mailed_at: null, sent_at: old }, { status: "sent", joined_at: "y", mailed_at: null, sent_at: old }], null, today, now);
    expect(r).toEqual([]);
  });
  it("기록을 믿을 수 있는 날 뒤의 초대가 mailed_at 없으면 미발송", () => {
    const r = stuckReasons({ ...base, rfq_no: "X", status: "distributed", reply_by: "2026-11-20" }, [{ status: "sent", mailed_at: null, sent_at: "2026-11-02T00:00:00Z" }], null, "2026-11-03", new Date("2026-11-03T01:00:00Z").getTime());
    expect(r.map((x) => x.label)).toEqual(["참여 안내 메일 미발송 1곳"]);
  });
  it("0006: 선택 후 30일 계약 보고 없음", () => {
    const r = stuckReasons({ ...base, rfq_no: "DC-2026-0006", status: "selected", reply_by: "2026-09-30", compared_at: "2026-09-29T00:14:00Z" }, [], { awarded_at: "2026-09-29T00:15:00Z", contract_reported_at: null, cro_name: "테스트기관1" }, today, now);
    expect(r).toEqual([{ kind: "contract", label: "테스트기관1 선택 후 30일 · 계약 보고 없음", action: "기관에 확인", days: 30 }]);
  });
  it("선택 후 14일 전에는 멈춘 것으로 보지 않는다", () => {
    expect(stuckReasons({ ...base, rfq_no: "X", status: "selected", reply_by: null }, [], { awarded_at: "2026-10-20T00:00:00Z", contract_reported_at: null, cro_name: "A" }, today, now)).toEqual([]);
  });
  it("메일이 갔고 기한 전이면 멈춤 없음", () => {
    expect(stuckReasons({ ...base, rfq_no: "X", status: "distributed", reply_by: "2026-11-05" }, [{ status: "sent", mailed_at: "2026-10-28T00:00:00Z", sent_at: "2026-10-28T00:00:00Z" }], null, today, now)).toEqual([]);
  });
  it("안내 전 접수가 기한 2영업일 안이면 자동 안내 보류로", () => {
    expect(stuckReasons({ ...base, rfq_no: "X", status: "received", reply_by: "2026-10-30", distributed_at: null }, [], null, today, now).map((x) => x.kind)).toEqual(["too_soon"]);
  });
});

describe("메일 재시도와 자동 안내 보류", () => {
  const src = readFileSync(join(process.cwd(), "lib/distribute.ts"), "utf8");
  it("재시도는 최근 3일 초대만 (예전 초대는 이미 배달됐을 수 있어 다시 보내지 않는다)", () => {
    const fn = src.slice(src.indexOf("export async function resendUnmailedInvites"));
    expect(fn.slice(0, fn.indexOf("for (const inv"))).toContain('.gte("sent_at", since)');
  });
  it("자동 안내는 기한이 2영업일 안이면 보내지 않는다", () => {
    expect(src).toContain('blocked: "reply_too_soon"');
  });
});
