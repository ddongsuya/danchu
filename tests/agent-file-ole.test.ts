import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { docText, hwpText, readCfb, xlsText } from "@/lib/agent-file-ole";
import { extractText } from "@/lib/agent-file-text";

/*
 * 옛 형식 첨부 글 뽑기 (2026-11-20 사용자 결정: AI가 첨부 내용까지 읽는다)
 * 단추가 받는 형식: pdf·png·jpg·doc·docx·xls·xlsx·hwp (lib/upload.ts RFQ_FILE_EXTS)
 * doc·xls 견본은 LibreOffice 로 만든 가상의 내용이다.
 */
const fx = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/agent-files/${n}`));

/** 시험용 복합 문서(CFB) 만들기: 모든 스트림을 일반 섹터에 둔다(작은 스트림 기준 0) */
function cfb(streams: { path: string; data: Buffer }[]): Buffer {
  const SS = 512, END = 0xfffffffe, FREE = 0xffffffff, FATSEC = 0xfffffffd;
  const storages = [...new Set(streams.flatMap((s) => s.path.split("/").slice(0, -1)))];
  const ents: { name: string; type: number; child: number; right: number; start: number; size: number }[] = [{ name: "Root Entry", type: 5, child: FREE, right: FREE, start: END, size: 0 }];
  const idx = new Map<string, number>();
  for (const st of storages) { idx.set(st, ents.length); ents.push({ name: st, type: 1, child: FREE, right: FREE, start: 0, size: 0 }); }
  const sectors: Buffer[] = [];
  const fat: number[] = [FATSEC]; // 섹터 0 = FAT
  // 섹터 1 = 디렉터리(4개 항목/섹터, 최대 4개만 쓴다)
  fat.push(END);
  for (const s of streams) {
    const name = s.path.split("/").pop()!;
    const n = Math.max(1, Math.ceil(s.data.length / SS));
    const start = 2 + sectors.length;
    for (let i = 0; i < n; i++) { sectors.push(Buffer.concat([s.data.subarray(i * SS, (i + 1) * SS), Buffer.alloc(SS)]).subarray(0, SS)); fat.push(i === n - 1 ? END : start + i + 1); }
    const id = ents.length;
    ents.push({ name, type: 2, child: FREE, right: FREE, start, size: s.data.length });
    const parent = s.path.includes("/") ? idx.get(s.path.split("/")[0])! : 0;
    // 형제는 오른쪽으로 잇는다
    if (ents[parent].child === FREE) ents[parent].child = id;
    else { let k = ents[parent].child; while (ents[k].right !== FREE) k = ents[k].right; ents[k].right = id; }
  }
  for (const st of storages) { const id = idx.get(st)!; if (ents[0].child === FREE) ents[0].child = id; else { let k = ents[0].child; while (ents[k].right !== FREE) k = ents[k].right; ents[k].right = id; } }
  if (ents.length > 4) throw new Error("fixture too big");
  const head = Buffer.alloc(512);
  head.writeUInt32LE(0xe011cfd0, 0); head.writeUInt32LE(0xe11ab1a1, 4);
  head.writeUInt16LE(9, 0x1e); head.writeUInt16LE(6, 0x20); head.writeUInt32LE(1, 0x2c); head.writeUInt32LE(1, 0x30);
  head.writeUInt32LE(0, 0x38); head.writeUInt32LE(END, 0x3c); head.writeUInt32LE(END, 0x44);
  for (let i = 0; i < 109; i++) head.writeUInt32LE(i === 0 ? 0 : FREE, 0x4c + i * 4);
  const fatSec = Buffer.alloc(SS, 0xff);
  fat.forEach((v, i) => fatSec.writeUInt32LE(v, i * 4));
  const dir = Buffer.alloc(SS);
  ents.forEach((e, i) => {
    const o = i * 128;
    dir.write(e.name, o, "utf16le"); dir.writeUInt16LE((e.name.length + 1) * 2, o + 0x40); dir[o + 0x42] = e.type;
    dir.writeUInt32LE(FREE, o + 0x44); dir.writeUInt32LE(e.right, o + 0x48); dir.writeUInt32LE(e.child, o + 0x4c);
    dir.writeUInt32LE(e.start, o + 0x74); dir.writeUInt32LE(e.size, o + 0x78);
  });
  return Buffer.concat([head, fatSec, dir, ...sectors]);
}

/** HWP 레코드: 머리(태그·크기) + 본문 */
const rec = (tag: number, data: Buffer) => { const h = Buffer.alloc(4); h.writeUInt32LE(tag | (data.length << 20)); return Buffer.concat([h, data]); };
const u16 = (s: string) => Buffer.from(s + "\r", "utf16le");
function hwp(paras: string[], props = 1): Buffer {
  const head = Buffer.alloc(256);
  head.write("HWP Document File", 0, "latin1"); head.writeUInt32LE(props, 36);
  const body = Buffer.concat(paras.map((p) => rec(67, u16(p))));
  return cfb([{ path: "FileHeader", data: head }, { path: "BodyText/Section0", data: props & 1 ? deflateRawSync(body) : body }]);
}

describe("복합 문서", () => {
  it("저장소 안 스트림을 경로로 읽는다", () => {
    const f = readCfb(cfb([{ path: "A", data: Buffer.from("x".repeat(700)) }, { path: "S/B", data: Buffer.from("yz") }]));
    expect(f.get("A")?.length).toBe(700);
    expect(f.get("S/B")?.toString()).toBe("yz");
  });
  it("복합 문서가 아니면 막는다", () => {
    expect(() => readCfb(new Uint8Array(600))).toThrow();
  });
});

describe("한글 hwp", () => {
  it("압축된 본문의 문단을 읽는다", () => {
    expect(hwpText(hwp(["시험물질 TST-101", "투여 경로: 경구"]))).toBe("시험물질 TST-101\n투여 경로: 경구");
  });
  it("압축 안 된 본문도 읽는다", () => {
    expect(hwpText(hwp(["랫드 28일"], 0))).toBe("랫드 28일");
  });
  it("암호 문서는 encrypted", async () => {
    expect(await extractText(hwp(["x"], 0b11), "a.hwp")).toEqual({ kind: "hwp", error: "encrypted" });
  });
});

describe("Word doc · Excel xls", () => {
  it("doc 본문", () => {
    expect(docText(fx("plan.doc"))).toContain("시험물질 TST-101 랫드 28일 반복투여");
  });
  it("xls 시트와 칸", () => {
    const t = xlsText(fx("groups.xls"));
    expect(t).toContain("군\t동물종\t마리");
    expect(t).toContain("G2\t비글\t3.5");
  });
  it("extractText 가 형식을 골라 부른다", async () => {
    expect(await extractText(fx("plan.doc"), "계획.doc")).toMatchObject({ kind: "doc", truncated: false });
    expect(await extractText(new Uint8Array(10), "a.png")).toEqual({ kind: "image", error: "unsupported" });
  });
});
