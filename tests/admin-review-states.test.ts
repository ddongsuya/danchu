import { describe, expect, it } from "vitest";
import { hasFinal, josa, particle } from "@/components/admin/act";
import { contractErrors } from "@/components/admin/ContractRecord";
import { termsErrors } from "@/components/admin/OrgTerms";
import { managedOrgError } from "@/components/admin/ManagedOrgForm";
import { emailError, errStatus, mmss } from "@/components/AuthBits";
import { signupErrors } from "@/components/auth/SignupView";
import { croSignupErrors } from "@/components/auth/SignupCroView";

/** 시안 검토판(2026-11-27) 운영자·로그인 화면의 칸 검사와 조사 고르기 */
describe("조사", () => {
  it("받침에 따라 을/를 · 과/와 · 이/가를 고른다", () => {
    expect(josa("DC-2027-0007", "을", "를")).toBe("DC-2027-0007을");
    expect(josa("예시 기관 E", "을", "를")).toBe("예시 기관 E를");
    expect(josa("예시바이오", "이", "가")).toBe("예시바이오가");
    expect(josa("반복투여 4주", "을", "를")).toBe("반복투여 4주를");
    expect(particle("kim@", "과", "와")).toBe("과");
    expect(particle("KR-0932", "과", "와")).toBe("와");
    expect(particle("반려", "과", "와")).toBe("와");
    expect(hasFinal("DC-202801-001")).toBe(true);
    expect(hasFinal("DC-202801-002")).toBe(false);
  });
});

describe("운영자 칸 검사", () => {
  it("계약 기록: 체결은 체결일·금액, 미체결은 사유", () => {
    expect(contractErrors("signed", { date: "", amount: "", note: "", gapOk: true })).toEqual({ date: "체결일을 골라 주세요.", amount: "계약금액을 입력해 주세요." });
    expect(contractErrors("signed", { date: "2026-11-20", amount: "230000000", note: "", gapOk: false })).toEqual({ gap: "차이 사유를 골라 주세요." });
    expect(contractErrors("not_signed", { date: "", amount: "", note: " ", gapOk: true })).toEqual({ note: "미체결 사유를 입력해 주세요." });
    expect(contractErrors("negotiating", { date: "", amount: "", note: "", gapOk: true })).toEqual({});
  });
  it("약정: 비우면 통과, 글자가 섞이면 숫자만", () => {
    expect(termsErrors({ monthlyFee: "", perRequestFee: "", feeRate: "" })).toEqual({});
    expect(termsErrors({ monthlyFee: "백만", perRequestFee: "30000", feeRate: "2.5" })).toEqual({ monthlyFee: "숫자만 입력해 주세요." });
    expect(termsErrors({ monthlyFee: "1,000,000", perRequestFee: "", feeRate: "5%" })).toEqual({ monthlyFee: "숫자만 입력해 주세요.", feeRate: "숫자만 입력해 주세요." });
  });
  it("기관 추가: 첫 오류 한 줄", () => {
    expect(managedOrgError({ name: "", contactEmail: "" }, [])).toBe("기관명을 입력해 주세요.");
    expect(managedOrgError({ name: "예시 기관", contactEmail: "owner@" }, [])).toBe("이메일 형식을 확인해 주세요.");
    expect(managedOrgError({ name: "예시 기관", contactEmail: "owner@cro.test" }, [])).toBe("수행 분야를 하나 이상 골라 주세요.");
    expect(managedOrgError({ name: "예시 기관", contactEmail: "owner@cro.test" }, ["일반독성"])).toBe("");
  });
});

describe("로그인·가입 칸 검사", () => {
  it("이메일: 빈칸과 형식", () => {
    expect(emailError("")).toBe("이메일을 입력해 주세요.");
    expect(emailError("review@")).toBe("이메일 형식을 확인해 주세요.");
    expect(emailError("review@example-bio.test")).toBe("");
  });
  it("의뢰자 가입: 비밀번호는 고를 때만", () => {
    const f = { company: "예시바이오", name: "", email: "review@", password: "" };
    expect(signupErrors(f, false, true)).toEqual({ name: "담당자 성명을 입력해 주세요.", email: "이메일 형식을 확인해 주세요." });
    expect(signupErrors({ ...f, name: "검토 담당", email: "a@b.co" }, true, false)).toEqual({ password: "비밀번호는 8자 이상이어야 해요.", consent: "필수 약관에 동의해 주세요." });
  });
  it("기관 참여 신청: 사업자등록번호는 쓰면 10자리", () => {
    const base = { orgName: "예시 기관", businessNo: "123-45", name: "대표", email: "owner@cro.test", password: "12345678" };
    expect(croSignupErrors(base, ["일반독성"], true)).toEqual({ businessNo: "사업자등록번호 10자리를 입력해 주세요." });
    expect(croSignupErrors({ ...base, businessNo: "123-45-67890" }, ["일반독성"], true)).toEqual({});
    expect(croSignupErrors({ ...base, businessNo: "" }, [], true)).toEqual({ cats: "수행 분야를 하나 이상 골라 주세요." });
  });
  it("오류 상태와 다시 받기 시간", () => {
    expect(errStatus(Object.assign(new Error("x"), { status: 409 }))).toBe(409);
    expect(errStatus(new Error("x"))).toBe(0);
    expect(mmss(59)).toBe("00:59");
    expect(mmss(0)).toBe("00:00");
  });
});
