import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readCsv, readXlsx } from "@/lib/xlsx-read";
import { workbook, zip } from "@/lib/xlsx";

/** deflate 로 압축한 zip (엑셀이 실제로 저장하는 방식) */
function deflateZip(files: { name: string; data: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let off = 0;
  for (const f of files) {
    const raw = enc.encode(f.data);
    const comp = deflateRawSync(raw);
    const name = Buffer.from(f.name);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8);
    loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(raw.length, 22); loc.writeUInt16LE(name.length, 26);
    parts.push(loc, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

describe("엑셀 읽기", () => {
  it("단추가 만든 엑셀(압축 없음)을 다시 읽는다", async () => {
    const b = workbook([{ name: "거래처", rows: [["거래처명", "견적금액"], ["가람바이오", { v: 214500000, num: true }]] }]);
    const r = await readXlsx(b);
    expect(r.sheets).toEqual(["거래처"]);
    expect(r.sheet.rows).toEqual([["거래처명", "견적금액"], ["가람바이오", 214500000]]);
  });
  it("엑셀이 저장한 deflate 압축·공유 문자열·빈 칸·제목 줄", async () => {
    const b = deflateZip([
      { name: "xl/workbook.xml", data: `<workbook xmlns:r="r"><sheets><sheet name="고객관리" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: `<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>` },
      { name: "xl/sharedStrings.xml", data: `<sst><si><t>2026 고객 목록</t></si><si><t>거래처명</t></si><si><t>진행상태</t></si><si><r><t>(주)가람</t></r><r><t>바이오</t></r></si><si><t>견적발송 &amp; 협의</t></si></sst>` },
      { name: "xl/worksheets/sheet1.xml", data: `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="3"><c r="A3" t="s"><v>1</v></c><c r="C3" t="s"><v>2</v></c></row><row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4"><v>46000</v></c><c r="C4" t="s"><v>4</v></c></row></sheetData></worksheet>` },
    ]);
    const r = await readXlsx(b);
    expect(r.sheet.rows).toEqual([["거래처명", "", "진행상태"], ["(주)가람바이오", 46000, "견적발송 & 협의"]]);
  });
  it("zip 이 아니면 알아듣는 오류", async () => {
    await expect(readXlsx(new TextEncoder().encode("hello"))).rejects.toThrow(/엑셀 파일이 아니에요/);
    expect(zip).toBeTypeOf("function");
  });
  it("CSV: BOM·따옴표·탭", () => {
    expect(readCsv('﻿거래처명,비고\n"나래제약, 본사","줄\n바꿈"\n').rows).toEqual([["거래처명", "비고"], ["나래제약, 본사", "줄\n바꿈"]]);
    expect(readCsv("a\tb\n1\t2").rows).toEqual([["a", "b"], ["1", "2"]]);
  });
});
