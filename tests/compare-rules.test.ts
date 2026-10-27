import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CONSENT_VERSION } from "@/lib/rfq-schema";
import { CRO_TERMS_VERSION } from "@/lib/request-policy";
import { COMPARE_LOCKED_DEADLINE } from "@/lib/reply-window";
import { EARLY_CLOSE_REFUSED } from "@/lib/compare";

/* 2026-10-21 대표 결정 "추천대로": 의뢰자 요청 기한 전 마감 삭제(2), 열린 비교표 고정(3), 개인정보처리방침 연락처 제공 두 방향(5) */

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** 주석을 뺀 코드 (화면에 보이는 문자열만 대충 남긴다) */
const visible = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
/** JSX 줄바꿈을 없앤 본문 (문장이 여러 줄에 걸쳐도 찾을 수 있게) */
const flat = (code: string) => visible(code).replace(/\s*\n\s*/g, " ");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

describe("이용약관: 의뢰자 요청 기한 전 마감 삭제 (결정 2)와 열린 비교표 고정 (결정 3)", () => {
  const terms = flat(src("app/terms/page.tsx"));
  it("제4조 제7항에 의뢰자 요청에 따른 기한 전 마감이 없다", () => {
    expect(terms).not.toMatch(/이용자가 요청한 경우에는 회사가 회신 기한 전에/);
    expect(terms).not.toContain("회사가 기한 전에 회신을 마감하는 조건");
    expect(terms).toContain("회사는 이용자의 요청이나 그 밖의 사유로 회신 기한 전에 회신을 마감하지 않으며");
    expect(terms).toContain("요청서에서 회신 기한을 짧게 정할 수 있습니다");
  });
  it("비교표가 열린 뒤에는 다시 열기·기한 연장·견적 수정이 없다", () => {
    expect(terms).toContain("그 뒤에는 회신을 다시 열거나 회신 기한을 연장하지 않고, 기관은 제출한 견적을 수정하거나 다시 제출할 수 없습니다");
    expect(terms).toContain("회사는 비교표가 열리기 전에 한하여 필요한 경우 회신 기한과 참여 결정 기한을 연장할 수 있습니다");
  });
  it("조·항 번호는 그대로다 (제4조는 7개 항, 제7항은 가~사 호, 2026-10-28 제12~14조 신설로 제1조~제15조)", () => {
    const art4 = src("app/terms/page.tsx").split("<h2>제4조")[1].split("<h2>제5조")[0];
    const [head, sub = ""] = art4.split('<ol className="legal__sub">');
    expect((head.match(/<li>/g) ?? []).length).toBe(7);
    expect((sub.match(/<li>/g) ?? []).length).toBe(7);
    for (let n = 1; n <= 15; n++) expect(src("app/terms/page.tsx")).toContain(`<h2>제${n}조 (`);
    expect(src("app/terms/page.tsx")).toContain('version="v1.1"');
  });
  it("약관 밖 화면·메시지에 제4조7항을 마감 근거로 인용하는 문구가 없다 (판 이력 주석은 제외)", () => {
    for (const f of [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => !f.endsWith(join("app", "terms", "page.tsx")))) {
      expect(visible(src(f)), f).not.toMatch(/제4조\s*제?7항|4조\s*7항/);
    }
  });
  it("기관 안내·FAQ 에도 의뢰자 요청 기한 전 마감이 없고, 열린 뒤 수정이 없다고 알린다", () => {
    const forCro = flat(src("app/for-cro/page.tsx"));
    expect(forCro).not.toContain("의뢰자가 요청한 경우에만 기한 전에 회신을 마감");
    // 2026-10-25 사용자 결정: 리디자인한 기관 참여 페이지에는 규칙 안내 문장을 두지 않는다 (규칙은 약관·FAQ). 틀린 말이 없는지만 본다
    const faq = src("lib/faq.ts");
    expect(faq).not.toContain("의뢰자가 요청하면 운영자가 기한 전에 회신을 마감");
    expect(faq).toContain("빨리 받아야 하면 요청서에서 회신 기한을 짧게 정해 주세요");
  });
  it("기관 화면은 회신 기한까지 고칠 수 있다고 약속하지 않는다 (비교표가 열리면 닫힘)", () => {
    for (const f of ["app/cro/quotes/page.tsx", "components/cro/ReplyForm.tsx", "components/cro/ReplyDone.tsx", "app/api/admin/rfqs/[no]/deadline/route.ts", "app/api/cron/daily/route.ts", "app/api/admin/rfqs/[no]/distribute/route.ts"]) {
      const s = visible(src(f));
      expect(s, f).not.toMatch(/회신 기한까지(는)? (수정|고칠)/);
      expect(s, f).not.toMatch(/운영자가 회신을 마감하면|기한을 늘려 다시 연|비교표를 닫고 회신을 다시 받습니다/);
    }
    for (const f of ["app/cro/quotes/page.tsx", "components/cro/ReplyForm.tsx", "components/cro/ReplyDone.tsx"]) expect(src(f), f).toMatch(/열린 뒤에는 (수정하거나|고치거나) 다시 제출할 수 없습니다/);
  });
  it("옮겨 적기 오류는 비교표가 열리기 전에만 바로잡고, 열린 뒤에는 고치지 않고 알린다 (약관 제8조·화면이 같은 말)", () => {
    for (const f of ["app/terms/page.tsx", "app/app/r/[no]/q/[quoteId]/page.tsx", "lib/faq.ts", "components/CompareBoard.tsx"]) {
      const s = flat(src(f));
      expect(s, f).not.toMatch(/오류(가 확인되면|가 있으면) (회사는 지체 없이 |단추가 )?바로잡/);
      expect(s, f).toMatch(/열린 뒤에는 비교표를 고치지 않고/);
    }
    // 기관 참여 페이지는 규칙 문장을 두지 않기로 했으므로(2026-10-25) 틀린 약속만 없으면 된다
    expect(flat(src("app/for-cro/page.tsx"))).not.toMatch(/오류(가 확인되면|가 있으면) (회사는 지체 없이 |단추가 )?바로잡/);
  });
  it("열린 요청의 만료 링크는 연장 안내 대신 닫힌 이유를, 완료 화면은 닫혔으면 수정하기를 숨긴다", () => {
    const form = visible(src("components/cro/ReplyForm.tsx"));
    expect(form.indexOf("data.closed ? data.closedMessage")).toBeGreaterThan(-1);
    expect(form.indexOf("data.closed ? data.closedMessage")).toBeLessThan(form.indexOf("연장이 필요하면"));
    expect(src("components/cro/ReplyDone.tsx")).toContain("{!closed && <Link href={editHref}");
    expect(src("app/q/[token]/reply/done/page.tsx")).toContain("closed={!!got?.closed}");
    expect(src("app/cro/r/[id]/reply/page.tsx")).toContain("closed={!!got?.closed}");
    expect(src("app/api/admin/invites/[id]/resend/route.ts")).toContain("비교표가 열린 요청이라 만료된 링크를 다시 열 수 없습니다.");
  });
  it("거절 문구는 정중한 한국어이고 대시가 없다", () => {
    for (const m of [COMPARE_LOCKED_DEADLINE, EARLY_CLOSE_REFUSED]) {
      expect(m).toMatch(/(니다|주세요)\.$/);
      expect(m).not.toMatch(/[—–]/);
    }
  });
});

describe("개인정보처리방침: 선정 때 연락처를 두 방향으로 제공 (결정 5)", () => {
  const privacy = flat(src("app/privacy/page.tsx"));
  it("선정된 CRO에 의뢰자 연락처, 의뢰자에게 선정된 CRO 담당자 연락처를 제공한다고 적는다", () => {
    expect(privacy).toContain("선정된 기관에는 이용자의 회사/기관명과 담당자 성명·이메일·휴대전화를");
    expect(privacy).toContain("이용자에게는 선정된 기관의 담당자 성명·이메일·전화번호를 제공하며, 목적은 두 당사자 사이의 계약 협의입니다");
    expect(privacy).toContain("선정되지 않은 기관의 담당자 연락처는 이용자에게 제공하지 않습니다");
  });
  it("4항 표에 의뢰자를 제공받는 자로, 항목·목적을 적는다", () => {
    expect(privacy).toMatch(/<td>기관을 선정한 이용자\(의뢰자\)<\/td> <td>선정된 기관의 기관명과 대표 담당자 성명·이메일·전화번호[^<]*<\/td> <td>선정한 기관과의 계약 협의<\/td>/);
    // 반대 방향(의뢰자 연락처는 선정한 CRO에만)도 그대로 남아 있다
    expect(privacy).toContain("회사/기관명과 담당자 성명·이메일·연락처는 이용자가 선정한 기관에만 제공");
  });
  it("수집 항목과 이용 목적에 참여 CRO 담당자 정보와 계약 협의용 연락처 전달이 있다", () => {
    expect(privacy).toContain("<td>기관 담당자</td>");
    expect(privacy).toContain("계약 협의를 위해 이용자와 선정된 기관의 담당자 연락처를 서로 전달");
  });
  it("참여 CRO 담당자 정보는 코드와 같은 출처(운영자 등록·수정, 대표 메일이 없으면 계정 메일)와 보유기간을 적는다", () => {
    expect(privacy).not.toContain("기관이 입력한 항목만");
    expect(privacy).toContain("기관이 알려 와 회사가 등록·수정한 항목");
    expect(privacy).toContain("대표 이메일이 없을 때는 기관 담당자 계정의 이메일");
    expect(privacy).toMatch(/<td>기관 담당자 정보<\/td> <td>기관 등록을 해지하거나 담당자 정보가 바뀌거나 담당자 계정을 삭제할 때까지\. 참여 기록의 접속 IP 주소와 브라우저 정보는 3개월<\/td>/);
  });
  it("방침 판(v1.1)과 시행일은 그대로, 요청마다 남는 동의 판과 기관 조건 판은 올렸다", () => {
    const raw = src("app/privacy/page.tsx");
    expect(raw).toContain('version="v1.1"');
    expect(raw).toContain('effectiveDate="2026년 11월 16일"');
    expect(CONSENT_VERSION).toBe("2026-10-28");
    expect(CRO_TERMS_VERSION).toBe("pilot-2026-10-21");
    expect(CRO_TERMS_VERSION.startsWith("pilot-")).toBe(true);
    expect(src("app/privacy/page.tsx")).not.toMatch(/[—–]/);
  });
});

describe("CAPTCHA 는 지금 코드 없이 출시 전 할 일로 (결정 4)", () => {
  it("README 출시 전 할 일에 Turnstile 이 있고, 코드에는 아직 없다", () => {
    const md = src("README.md");
    expect(md).toMatch(/## 출시 전 할 일[\s\S]*Cloudflare Turnstile/);
    for (const f of [...walk("app"), ...walk("lib"), ...walk("components")]) expect(src(f), f).not.toMatch(/turnstile/i);
  });
});
