import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  entrySourceFor,
  findDuplicateOrg,
  loadOptsFor,
  marksOpened,
  needsContractReminder,
  parseContractStatus,
  parseManagedOrg,
  quoteKindLabel,
  replyPath,
} from "@/lib/concierge";
import { normalizeCompanyName } from "@/lib/request-policy";
import { inviteMailHtml, inviteReplyTo } from "@/lib/distribute";
import { contractFollowupMail } from "@/lib/mail";

describe("운영자 관리 기관: 입력 검증", () => {
  const base = { name: "㈜바이오랩", contactEmail: "Lab@Example.com", categories: ["일반독성"] };
  it("기관명·대표 이메일·수행 분야는 필수", () => {
    expect(parseManagedOrg({ ...base, name: " " })).toBe("기관명을 입력해 주세요.");
    expect(parseManagedOrg({ ...base, contactEmail: "" })).toMatch(/대표 이메일을 입력/);
    expect(parseManagedOrg({ ...base, contactEmail: "no-at" })).toMatch(/형식/);
    expect(parseManagedOrg({ ...base, categories: ["없는 분야"] })).toMatch(/수행 분야/);
    expect(parseManagedOrg(null)).toBe("기관명을 입력해 주세요.");
  });
  it("허용된 분야·GLP 값만 남기고 이메일은 소문자로", () => {
    const r = parseManagedOrg({ ...base, categories: ["일반독성", "일반독성", "가짜"], glpCerts: ["OECD GLP", "모름"], businessNo: "123-45-67890", aaalac: true });
    expect(typeof r).toBe("object");
    if (typeof r === "string") return;
    expect(r.contact_email).toBe("lab@example.com");
    expect(r.categories).toEqual(["일반독성"]);
    expect(r.glp_certs).toEqual(["OECD GLP"]);
    expect(r.business_no).toBe("123-45-67890");
    expect(r.aaalac).toBe(true);
    expect(r.contact_name).toBeNull();
  });
  it("숫자가 없는 사업자번호는 거절", () => {
    expect(parseManagedOrg({ ...base, businessNo: "없음" })).toMatch(/사업자등록번호/);
  });
});

describe("운영자 관리 기관: 중복 판정", () => {
  const orgs = [
    { id: "a", name: "㈜바이오랩", business_no: null },
    { id: "b", name: "켐랩", business_no: "123-45-67890" },
  ];
  it("법인 표기·공백·기호를 떼고 같은 회사로 본다", () => {
    expect(normalizeCompanyName("㈜바이오벤처")).toBe("바이오벤처");
    expect(normalizeCompanyName("바이오벤처 주식회사")).toBe("바이오벤처");
    expect(normalizeCompanyName("(주) 바이오-벤처")).toBe("바이오벤처");
    expect(normalizeCompanyName("BioVenture Co., Ltd.")).toBe("bioventure");
    expect(normalizeCompanyName("")).toBe("");
  });
  it("이름이 달라도 사업자번호가 같으면 같은 기관", () => {
    expect(findDuplicateOrg({ name: "Chem Lab", business_no: "1234567890" }, orgs)?.id).toBe("b");
  });
  it("정규화한 이름이 같으면 같은 기관", () => {
    expect(findDuplicateOrg({ name: "바이오랩 주식회사" }, orgs)?.id).toBe("a");
    expect(findDuplicateOrg({ name: "켐 랩", business_no: "999" }, orgs)?.id).toBe("b");
  });
  it("다르면 null", () => {
    expect(findDuplicateOrg({ name: "다른연구소", business_no: "111" }, orgs)).toBeNull();
    expect(findDuplicateOrg({ name: "(주)" }, orgs)).toBeNull();
  });
  it("가입 합류(strictBusinessNo): 양쪽 사업자번호가 다르면 이름이 같아도 다른 회사", () => {
    expect(findDuplicateOrg({ name: "켐 랩", business_no: "999" }, orgs, { strictBusinessNo: true })).toBeNull();
    // 한쪽이라도 번호가 없으면 이름으로 본다
    expect(findDuplicateOrg({ name: "켐 랩" }, orgs, { strictBusinessNo: true })?.id).toBe("b");
    expect(findDuplicateOrg({ name: "바이오랩 주식회사", business_no: "555" }, orgs, { strictBusinessNo: true })?.id).toBe("a");
    expect(findDuplicateOrg({ name: "Chem Lab", business_no: "123-45-67890" }, orgs, { strictBusinessNo: true })?.id).toBe("b");
  });
});

describe("메일 링크: 계정 없는 기관은 /q 토큰", () => {
  const inv = { id: "inv-1", token: "tok_abcdefgh" };
  it("운영자 관리 기관과 담당자 0명 기관은 로그인 없는 회신 링크", () => {
    expect(replyPath(inv, { managed: true, members: 0 })).toBe("/q/tok_abcdefgh");
    expect(replyPath(inv, { managed: true, members: 2 })).toBe("/q/tok_abcdefgh");
    expect(replyPath(inv, { managed: false, members: 0 })).toBe("/q/tok_abcdefgh");
  });
  it("담당자가 있는 기관은 지금처럼 포털 링크", () => {
    expect(replyPath(inv, { managed: false, members: 1 })).toBe("/cro/r/inv-1");
  });
  const rfq = { rfq_no: "DC-2026-0001", substance: "ABC-1", categories: ["일반독성"], purpose: null, intent: "비교 견적", confidentiality: "일반", org_type: "바이오벤처" };
  it("운영자 관리 기관 배포 메일: /q 링크만, 포털·카탈로그 안내 없음, PDF 회신 안내", () => {
    const html = inviteMailHtml(rfq, "2026-10-30", "tok_abcdefgh", "inv-1", { managed: true, members: 0 });
    expect(html).toContain("/q/tok_abcdefgh");
    expect(html).not.toContain("/cro/");
    expect(html).not.toContain("카탈로그");
    expect(html).toContain("PDF를 이 메일에 회신");
    expect(html).toContain("수신 거부");
  });
  it("담당자가 있는 기관 배포 메일은 포털 링크를 유지, 계정이 없으면 뺀다", () => {
    expect(inviteMailHtml(rfq, "2026-10-30", "tok_abcdefgh", "inv-1", { members: 2 })).toContain("/cro/r/inv-1");
    expect(inviteMailHtml(rfq, "2026-10-30", "tok_abcdefgh", "inv-1")).toContain("/cro/r/inv-1");
    expect(inviteMailHtml(rfq, "2026-10-30", "tok_abcdefgh", "inv-1", { members: 0 })).not.toContain("/cro/");
  });
  it("운영자 관리 기관만 회신 주소를 운영자로 둔다", () => {
    expect(inviteReplyTo({ managed: false })).toBeUndefined();
    expect(inviteReplyTo({ managed: true })).toMatch(/@/);
  });
  it("회신 주소는 운영 역할 주소(OPERATOR_REPLY_TO)이고 운영자 알림 목록(ADMIN_EMAIL)이 아니다", () => {
    vi.stubEnv("ADMIN_EMAIL", "person@gmail.com,other@danchu.kr");
    vi.stubEnv("OPERATOR_REPLY_TO", "");
    expect(inviteReplyTo({ managed: true })).toBe("hello@danchu.kr");
    vi.stubEnv("OPERATOR_REPLY_TO", "ops@danchu.kr");
    expect(inviteReplyTo({ managed: true })).toBe("ops@danchu.kr");
  });
  it("운영자 관리 기관 배포 메일은 연락처를 어디서 받았는지와 개인정보처리방침 링크를 알린다", () => {
    const html = inviteMailHtml(rfq, "2026-10-30", "tok_abcdefgh", "inv-1", { managed: true, members: 0 });
    expect(html).toContain("공개한 대표 연락처");
    expect(html).toContain("/privacy");
    expect(html).not.toMatch(/[–—]/);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("대리 입력", () => {
  it("운영자 세션 제출은 operator, 그 밖은 cro", () => {
    expect(entrySourceFor("admin")).toBe("operator");
    expect(entrySourceFor("cro")).toBe("cro");
    expect(entrySourceFor(null)).toBe("cro");
  });
  it("운영자가 연 링크는 기관 열람으로 남기지 않는다", () => {
    expect(marksOpened("admin")).toBe(false);
    expect(marksOpened("cro")).toBe(true);
    expect(marksOpened(undefined)).toBe(true);
  });
  it("운영자만 기한 잠금·링크 만료 없이 연다 (기관·토큰 접근은 그대로)", () => {
    expect(loadOptsFor("admin")).toEqual({ markOpened: false, operator: true });
    expect(loadOptsFor("cro")).toEqual({ markOpened: true, operator: false });
    expect(loadOptsFor(null)).toEqual({ markOpened: true, operator: false });
  });
  it("비교표 견적 구분 표기", () => {
    expect(quoteKindLabel({ auto: false, entry_source: "cro" })).toBe("기관 제출 견적");
    expect(quoteKindLabel({ auto: false, entry_source: "operator" })).toBe("단추 정리 · 기관 PDF 기준");
    expect(quoteKindLabel({ auto: true, entry_source: "cro" })).toBe("기관 확인 전 예비 견적");
  });
});

describe("계약 진행 상태", () => {
  it("체결은 이 경로로 기록하지 않는다 (체결 보고로만)", () => {
    expect(parseContractStatus({ status: "signed" }, false)).toMatch(/체결일과 금액/);
    expect(parseContractStatus({ status: "unknown" }, false)).toMatch(/올바르지/);
  });
  it("미체결은 사유가 필요하다", () => {
    expect(parseContractStatus({ status: "not_signed" }, false)).toMatch(/사유/);
    expect(parseContractStatus({ status: "not_signed", note: " 일정 보류 " }, false)).toEqual({ status: "not_signed", note: "일정 보류" });
  });
  it("협의 중·확인 전은 메모 없이 기록", () => {
    expect(parseContractStatus({ status: "negotiating" }, false)).toEqual({ status: "negotiating", note: "" });
    expect(parseContractStatus({ status: "pending" }, false)).toEqual({ status: "pending", note: "" });
  });
  it("체결 보고된 수주는 되돌리지 않는다", () => {
    expect(typeof parseContractStatus({ status: "negotiating" }, true)).toBe("string");
  });
  it("미체결로 기록한 수주에는 리마인더를 보내지 않는다", () => {
    expect(needsContractReminder({ contract_reported_at: null, contract_status: "pending" })).toBe(true);
    expect(needsContractReminder({ contract_reported_at: null, contract_status: "negotiating" })).toBe(true);
    expect(needsContractReminder({ contract_reported_at: null, contract_status: "not_signed" })).toBe(false);
    expect(needsContractReminder({ contract_reported_at: "2026-10-01T00:00:00Z", contract_status: "signed" })).toBe(false);
  });
});

describe("운영자 관리 기관 계약 확인 메일", () => {
  const m = contractFollowupMail({ rfqNo: "DC-2026-0007", substance: "<X>", croName: "바이오랩", days: 14, awardedOn: "2026-10-01" });
  it("로그인 링크 없이 메일 회신으로 받는다", () => {
    expect(m.subject).toContain("DC-2026-0007");
    expect(m.html).toContain("14일");
    expect(m.html).toContain("회신");
    expect(m.html).not.toContain("/cro");
    expect(m.html).not.toContain("<a ");
  });
  it("입력값은 이스케이프한다", () => {
    expect(m.html).toContain("&lt;X&gt;");
  });
  it("화면 문자열에 긴 대시를 쓰지 않는다", () => {
    expect(m.html).not.toMatch(/[–—]/);
  });
});

describe("0019 마이그레이션: 기존 고객 면제 제거", () => {
  const sql = readFileSync("supabase/migrations/0019_concierge_mode.sql", "utf8");
  const summary = sql.slice(sql.indexOf("create or replace function public.billing_summary"), sql.indexOf("revoke execute on function public.billing_summary"));
  it("billing_summary 는 면제 없이 다시 만든다", () => {
    expect(summary).not.toBe("");
    expect(summary).not.toMatch(/exempt/);
    expect(sql.indexOf("create or replace function public.billing_summary")).toBeLessThan(sql.indexOf("drop column if exists fee_exempt"));
  });
  it("면제 열과 기존 고객 표를 지운다", () => {
    for (const col of ["existing_client_claim", "existing_client_claimed_at", "fee_exempt", "fee_exempt_reason", "fee_exempt_at", "fee_exempt_by"]) expect(sql).toContain(`drop column if exists ${col}`);
    expect(sql).toContain("drop table if exists public.cro_org_clients");
  });
  it("체결 보고가 contract_status 를 signed 로 맞춘다", () => {
    expect(sql).toMatch(/contract_reported_at = now\(\),\s*contract_status = 'signed'/);
  });
  it("입력 주체는 save_quote 제출과 같은 트랜잭션에서 남기고, 초안 저장은 바꾸지 않는다", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.save_quote"), sql.indexOf("revoke execute on function public.save_quote"));
    expect(fn).toContain("p_header->>'entry_source'");
    expect(fn).toMatch(/entry_source = case when p_submit then v_source else entry_source end/);
  });
  it("0019 전에 운영자 계정으로 제출한 견적은 대리 입력으로 되돌려 적는다", () => {
    expect(sql).toMatch(/set entry_source = 'operator'\s+where entry_source = 'cro' and submitted_by in \(select id from public.profiles where role = 'admin'\)/);
  });
});
