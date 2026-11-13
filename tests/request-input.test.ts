import { describe, expect, it } from "vitest";
import { prepareValues, tooLong } from "@/lib/rfq-create";
import { allowedRfqFile } from "@/lib/upload";
import type { Values } from "@/lib/rfq-schema";

/** 서버가 받는 요청서 한 장. 화면을 거치지 않고 API 로 바로 보낸 경우를 본다 (2026-11-13 전체 검토) */
const base = (): Values => ({
  company: "의뢰사", name: "담당자", email: "a@example.test", orgType: "바이오벤처", purpose: "자체 연구용", intent: "예산 검토",
  substance: "DC-101", croCount: "3곳", confid: "일반", categories: ["유전독성"], agreePrivacy: true, agreeTerms: true, agreeShare: true, replyBy: "2099-01-05",
});

describe("의뢰자 첨부 형식", () => {
  it("화면의 파일 고르기와 같은 형식만 받는다", () => {
    for (const ok of ["a.pdf", "시험계획서.DOCX", "x.y.hwp", "표.xlsx", "사진.JPG"]) expect(allowedRfqFile(ok)).toBe(true);
    for (const bad of ["virus.exe", "a.pdf.exe", "page.html", "script.js", "noext", "a.svg", ".pdf.sh"]) expect(allowedRfqFile(bad)).toBe(false);
  });
  it("받지 않는 형식이 섞이면 요청서를 저장하지 않는다", () => {
    expect(prepareValues(base(), [{ name: "a.pdf", size: 10, type: "application/pdf" }])).toBe("");
    expect(prepareValues(base(), [{ name: "virus.exe", size: 10, type: "application/octet-stream" }])).toContain("형식만");
  });
});

describe("입력 길이 한도", () => {
  it("시험물질 이름은 200자를 넘기지 않는다", () => {
    expect(tooLong({ ...base(), substance: "가".repeat(200) })).toBe("");
    expect(tooLong({ ...base(), substance: "가".repeat(201) })).toContain("200자");
  });
  it("긴 글 칸은 5,000자까지", () => {
    expect(tooLong({ ...base(), notes: "가".repeat(5000) })).toBe("");
    expect(prepareValues({ ...base(), notes: "가".repeat(5001) }, [])).toContain("5,000자");
  });
  it("예산 검토 요청도 그대로 받는다 (요청 성격으로 막지 않는다)", () => {
    for (const intent of ["발주 예정", "비교 견적", "예산 검토"]) expect(prepareValues({ ...base(), intent }, [])).toBe("");
  });
});
