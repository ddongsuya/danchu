import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 흐름 재설계 병합 리뷰 반영 (2026-10-20). 동작은 tests/db/flow_redesign.sql 과 각 라우트 테스트가 보고,
 * 여기서는 되돌아가기 쉬운 지점만 소스로 확인한다.
 */
const src = (p: string) => readFileSync(p, "utf8");

describe("메일 버튼 접수", () => {
  it("화면을 여는 것만으로는 접수하지 않는다 (요약 + 보내기 버튼, POST 라우트)", () => {
    const page = src("app/app/claim/[token]/page.tsx");
    expect(page).not.toMatch(/claimPending\(/);
    expect(page).toMatch(/pendingPreview\(/);
    expect(page).toMatch(/ClaimPendingButton/);
    expect(src("app/api/rfq/pending/claim/route.ts")).toMatch(/export async function POST/);
  });
});

describe("인증번호 확인", () => {
  const verify = src("app/api/rfq/pending/verify/route.ts");
  it("만료 문구로 응답을 나누지 않는다 (기관·운영자 이메일과 응답이 같다)", () => {
    expect(verify).not.toMatch(/\/expired\/i/);
  });
  it("이메일별 제한과 확인 전 시도 잡기", () => {
    expect(verify).toMatch(/pending-verify:email"/);
    expect(verify).toMatch(/\.eq\("verify_attempts", row\.verify_attempts\)/);
    expect(src("app/api/rfq/pending/resend/route.ts")).toMatch(/pending-resend:email"/);
  });
});

describe("계약 확인", () => {
  it("운영자는 의뢰자 대신 확인하지 않는다 (라우트 403, 화면 버튼 없음, DB forbidden)", () => {
    expect(src("app/api/rfq/[no]/contract/route.ts")).toMatch(/byOperator && action === "confirm"/);
    expect(src("app/app/r/[no]/page.tsx")).toMatch(/needsConfirm = [^\n]*ownsRfq\(rfq, s\.userId\)/);
    const sql = src("supabase/migrations/0025_flow_redesign.sql");
    const fn = sql.slice(sql.indexOf("create or replace function public.confirm_contract"), sql.indexOf("create or replace function public.dispute_contract"));
    expect(fn).toMatch(/if not v_owner then return jsonb_build_object\('ok', false, 'code', 'forbidden'\)/);
  });
  it("기관 수주 화면에는 이의 사유를 보이지 않는다", () => {
    expect(src("app/cro/awards/page.tsx")).toMatch(/includeNote: false/);
  });
});

describe("의뢰자 목록", () => {
  it("비교표가 열린 요청만 강조하고, 마무리 상태를 위해 outcome 을 넘긴다", () => {
    const ov = src("components/app/RequestOverview.tsx");
    expect(ov).toMatch(/r\.status === "compared" && r\.submitted > 0/);
    expect(ov).not.toMatch(/회신 기한까지는 수정될 수 있습니다/);
    expect(src("app/app/page.tsx")).toMatch(/outcome, substance/);
  });
});
