import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAQ } from "@/lib/faq";
import { CRO_TERMS_VERSION, JOIN_CONSENT } from "@/lib/request-policy";
import { CONSENT_VERSION } from "@/lib/rfq-schema";
import {
  confidentialAccess,
  needsCda,
  remainingInvites,
} from "@/lib/request-policy";
import { quoteSelectable } from "@/lib/quote-policy";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  type Draft,
} from "@/components/app/AppState";
import { filled, validateRequired } from "@/lib/rfq-schema";
afterEach(() => vi.unstubAllGlobals());
describe("기밀과 배포 정책", () => {
  it.each([
    "CDA 필요 (단추 표준 CDA)",
    "자체 CDA 사용",
    "알 수 없는 기밀 등급",
  ])("%s은 체결 확인까지 비공개", (value) => {
    expect(needsCda(value)).toBe(true);
    expect(confidentialAccess(value, null)).toBe(false);
    expect(confidentialAccess(value, "2026-09-30T00:00:00Z")).toBe(true);
  });
  it("일반 요청은 별도 체결 없이 공개", () =>
    expect(confidentialAccess("일반")).toBe(true));
  it("기존 초대와 보충 배포도 총 수에 포함", () => {
    expect(remainingInvites("3곳", 2)).toBe(1);
    expect(remainingInvites("3곳", 4)).toBe(0);
    expect(remainingInvites("5곳", 3)).toBe(2);
    expect(remainingInvites("전체", 20)).toBe(Infinity);
  });
});
describe("기관 선정", () => {
  const confirmed = {
    auto: false,
    pdf_path: "quote.pdf",
    start_date: "2026-10-01",
    valid_until: "2026-10-30",
  };
  it("확인된 정식 견적만 선정", () => {
    expect(quoteSelectable(confirmed, "2026-09-30")).toBe(true);
    for (const patch of [
      { auto: true },
      { pdf_path: null },
      { start_date: null },
      { valid_until: "2026-09-29" },
    ])
      expect(quoteSelectable({ ...confirmed, ...patch }, "2026-09-30")).toBe(
        false,
      );
  });
});
describe("계정별 초안과 복구", () => {
  const draft: Draft = {
    version: 2,
    q: 2,
    phase: "edit",
    updatedAt: "2026-09-30",
    values: { substance: "물질 A" },
    files: [{ name: "자료.pdf", size: 100 }],
  };
  it("다른 계정 초안과 이전 소유자 없는 초안을 읽지 않음", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k),
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
    });
    expect(saveDraft("account-a", draft)).toBe(true);
    map.set("danchu.app.rfqDraft", JSON.stringify(draft));
    expect(loadDraft("account-b")).toBeNull();
    expect(map.has("danchu.app.rfqDraft")).toBe(false);
    expect(loadDraft("account-a")).toEqual(draft);
    clearDraft("account-a");
    expect(loadDraft("account-a")).toBeNull();
  });
  it("브라우저 저장 실패를 성공으로 표시하지 않음", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(saveDraft("a", draft)).toBe(false);
  });
  it("공백 입력과 잘못된 옵션을 거부", () => {
    expect(filled({ substance: "  " }, "substance")).toBe(false);
    expect(
      validateRequired({
        company: "A",
        name: "B",
        email: "a@b.co",
        croCount: "100곳",
        confid: "일반",
      }),
    ).not.toBe("");
  });
});

/* 참여 선택형 공개 문구 (0023, 설계 5절 4단계): 약관 제4조·제5조, 기관 안내, FAQ, 조건 판 */

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** JSX·문자열 리터럴 안의 한글 문장만 대충 뽑는다 (주석 제외) */
const visible = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("참여 선택형 공개 문구", () => {
  it("기관 조건 판은 한 곳에서 정하고 기관 안내 문서가 같은 값을 보여 준다", () => {
    expect(CRO_TERMS_VERSION).toBe("pilot-2026-10-21");
    // 시범 판은 pilot- 으로 시작해야 청구 함수가 무료로 본다 (0023 billing_lines)
    expect(CRO_TERMS_VERSION.startsWith("pilot-")).toBe(true);
    const forCro = src("app/for-cro/page.tsx");
    expect(forCro).toContain('id="cro-terms"');
    expect(forCro).toContain("{CRO_TERMS_VERSION}");
    expect(forCro).not.toMatch(/pilot-20\d\d-/);
    expect(src("components/cro/JoinPanel.tsx")).toContain("/for-cro#cro-terms");
  });
  it("약관을 바꿨으므로 의뢰자 동의 판도 올렸다", () => expect(CONSENT_VERSION).toBe("2026-10-21"));
  it("약관 제4조는 참여 안내와 참여한 요청에 제출한 견적으로 설명한다", () => {
    const terms = visible(src("app/terms/page.tsx"));
    for (const s of ["참여 안내", "참여한 요청에 제출한 견적", "지명 기관에만 안내", "참여 결정 기한", "참여를 철회", "대신하여 참여를"]) expect(terms).toContain(s);
    expect(terms).not.toContain("견적 요청을 배포합니다");
    expect(terms).not.toContain("전달받은 참여 CRO가 모두 회신");
    expect(terms).not.toContain("그 합의 이후에 전달된");
  });
  it("기관 안내에는 참여 결정 단계가 있고 없어진 자동 제출 설명이 없다", () => {
    const forCro = visible(src("app/for-cro/page.tsx"));
    expect(forCro).toContain("참여 결정");
    expect(forCro).toContain("이번 요청 불참");
    expect(forCro).not.toContain("예비 견적 자동 제출");
    expect(forCro).not.toContain("회신하지 않음 포함");
    expect(forCro).not.toContain("합의 이후에 전달된 요청");
  });
  it("FAQ 는 참여 안내와 참여 자리로 설명한다", () => {
    const all = FAQ.flatMap((f) => [f.q, ...f.a]).join("\n");
    expect(all).toContain("참여 안내");
    expect(all).toContain("참여 자리");
    expect(all).not.toContain("선택한 기관 수 범위");
    expect(all).not.toContain("요청서가 배포");
    expect(all).not.toContain("전달받은 기관이 모두 회신");
  });
  it("바뀐 화면 문구에 긴 대시가 없다", () => {
    const texts = [
      FAQ.flatMap((f) => [f.q, ...f.a]).join("\n"),
      JOIN_CONSENT,
      visible(src("app/terms/page.tsx")),
      visible(src("app/for-cro/page.tsx")),
      visible(src("components/admin/OptInTransition.tsx")),
    ];
    for (const t of texts) expect(t).not.toMatch(/[–—]/);
  });
});
