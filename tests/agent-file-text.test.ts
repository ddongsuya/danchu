import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { CLIENT_MASK, MAX_CHARS, docxText, extractText, fileKind, hwpxText, maskForCro, plainText, pptxText, unzip, xlsxText } from "@/lib/agent-file-text";
import { CONTACT_MASK } from "@/lib/contact-guard";
import { workbook, zip } from "@/lib/xlsx";

/*
 * 요청 첨부 글 뽑기 (2026-11-20 사용자 결정: AI가 첨부 내용까지 읽는다)
 * - Word·Excel·한글(hwpx)·PowerPoint·글 파일, PDF 는 unpdf
 * - 선정 전 기관에는 의뢰자 회사명·담당자·연락처를 가린다
 */
const enc = (s: string) => new TextEncoder().encode(s);

describe("파일 종류", () => {
  it("확장자와 형식으로 고른다", () => {
    expect(fileKind("계획서.PDF")).toBe("pdf");
    expect(fileKind("a.docx")).toBe("docx");
    expect(fileKind("a.hwpx")).toBe("hwpx");
    expect(fileKind("a.hwp")).toBe("hwp");
    expect(fileKind("a.png", "image/png")).toBe("image");
    expect(fileKind("a.zip")).toBe("unsupported");
    expect(fileKind("noext", "text/plain")).toBe("text");
  });
});

describe("zip 문서", () => {
  it("Word 문단과 표 칸을 읽는다", () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>시험물질: TST-101</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>동물종</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t xml:space="preserve">랫드 &amp; 비글</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
    const t = docxText(zip([{ name: "word/document.xml", data: enc(xml) }]));
    expect(t).toContain("시험물질: TST-101");
    expect(t).toContain("동물종");
    expect(t).toContain("랫드 & 비글");
  });
  it("Excel 은 시트별로 칸을 탭으로 나눈다 (단추 xlsx 로 만든 파일)", () => {
    const t = xlsxText(workbook([{ name: "설계", rows: [["군", "마리"], ["G1", 10], [null, "회복"]] }]));
    expect(t).toContain("[시트 설계]");
    expect(t).toContain("군\t마리");
    expect(t).toContain("G1\t10");
    expect(t).toContain("\t회복");
  });
  it("압축된 항목도 푼다 (deflate)", () => {
    const xml = `<hp:sec><hp:p><hp:run><hp:t>투여 경로 경구</hp:t></hp:run></hp:p></hp:sec>`;
    const data = deflateRawSync(enc(xml));
    // 직접 deflate zip 하나 만들기 (method 8)
    const name = enc("Contents/section0.xml");
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(enc(xml).length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(0, 42);
    const cdOff = 30 + name.length + data.length;
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(cdOff, 16);
    const buf = Buffer.concat([local, name, data, cen, name, end]);
    expect(hwpxText(buf)).toBe("투여 경로 경구");
  });
  it("PowerPoint 는 슬라이드 순서대로", () => {
    const s = (t: string) => enc(`<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`);
    const t = pptxText(zip([{ name: "ppt/slides/slide10.xml", data: s("열") }, { name: "ppt/slides/slide2.xml", data: s("둘") }]));
    expect(t.indexOf("둘")).toBeLessThan(t.indexOf("열"));
  });
  it("zip 이 아니면 읽지 못한다고 알린다", async () => {
    expect(() => unzip(enc("hello"), () => true)).toThrow();
    expect(await extractText(enc("hello"), "a.docx")).toEqual({ kind: "docx", error: "unreadable" });
  });
});

describe("글 파일·길이", () => {
  it("EUC-KR CSV 도 읽는다", () => {
    const euc = new Uint8Array([0xbd, 0xc3, 0xc7, 0xe8]); // "시험"
    expect(plainText(euc)).toBe("시험");
  });
  it("3만 자에서 자르고 알린다", async () => {
    const r = await extractText(enc("가".repeat(MAX_CHARS + 10)), "a.txt");
    expect(r).toMatchObject({ kind: "text", truncated: true, chars: MAX_CHARS + 10 });
    if ("text" in r) expect(r.text.length).toBe(MAX_CHARS);
  });
  it("모르는 형식은 unsupported, 깨진 hwp 는 unreadable", async () => {
    expect(await extractText(enc("x"), "a.zip")).toEqual({ kind: "unsupported", error: "unsupported" });
    expect(await extractText(enc("x"), "a.hwp")).toEqual({ kind: "hwp", error: "unreadable" });
  });
});

describe("PDF", () => {
  it("쪽마다 글을 뽑는다", async () => {
    const pdf = Buffer.from("JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMjAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA1NCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDIwIDEwMCBUZCAoQW1lcyBURyA0NzEgcmF0IDI4IGRheXMpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzQ1IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDE1CiUlRU9GCg==", "base64");
    const r = await extractText(new Uint8Array(pdf), "계획서.pdf");
    expect(r).toMatchObject({ kind: "pdf", truncated: false });
    if ("text" in r) expect(r.text).toContain("Ames TG 471");
  });
});

describe("선정 전 기관용 가리기", () => {
  it("회사명(주식회사 뗀 이름 포함)·담당자·연락처를 가린다", () => {
    const r = maskForCro("주식회사 테스트제약 홍길동 (a@test.local, 010-1234-5678) 테스트제약 연구소", ["주식회사 테스트제약", "홍길동"]);
    expect(r.masked).toBe(true);
    expect(r.text).not.toContain("테스트제약");
    expect(r.text).not.toContain("홍길동");
    expect(r.text).not.toContain("a@test.local");
    expect(r.text).toContain(CLIENT_MASK);
    expect(r.text).toContain(CONTACT_MASK);
  });
  it("가릴 게 없으면 그대로", () => {
    expect(maskForCro("랫드 28일 경구", ["테스트제약", "", null])).toEqual({ text: "랫드 28일 경구", masked: false });
  });
});
