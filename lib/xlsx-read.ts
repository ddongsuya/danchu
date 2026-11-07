/**
 * 작은 엑셀(.xlsx)·CSV 읽기 (기관 CRM 엑셀 가져오기, 2026-11-07). 의존성 없이 브라우저에서 돈다.
 * xlsx 는 XML 묶음을 zip 으로 싼 것이다. 압축(deflate)은 브라우저의 DecompressionStream("deflate-raw")로 푼다.
 * 첫 시트(또는 고른 시트)의 값만 읽는다: 공유 문자열·숫자·인라인 문자열·불리언. 서식·수식은 계산된 값만.
 */

export type ReadSheet = { name: string; rows: (string | number)[][] };

const dec = new TextDecoder();

type Entry = { name: string; method: number; size: number; offset: number };

function entries(b: Uint8Array): Entry[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // 끝에서 중앙 디렉터리 끝 표시(0x06054b50)를 찾는다
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("엑셀 파일이 아니에요. .xlsx 나 .csv 로 저장한 파일을 골라 주세요.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true);
    const el = v.getUint16(p + 30, true);
    const cl = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    out.push({ name: dec.decode(b.subarray(p + 46, p + 46 + nl)), method, size, offset });
    p += 46 + nl + el + cl;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function file(b: Uint8Array, e: Entry): Promise<string> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const nl = v.getUint16(e.offset + 26, true);
  const el = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nl + el;
  const raw = b.subarray(start, start + e.size);
  if (e.method === 0) return dec.decode(raw);
  if (e.method === 8) return dec.decode(await inflate(raw));
  throw new Error("이 엑셀 파일은 읽을 수 없는 방식으로 압축돼 있어요. 엑셀에서 다른 이름으로 저장(.xlsx)한 뒤 다시 골라 주세요.");
}

const unx = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
/** <si> 안의 <t> 를 모두 이어 붙인다 (서식이 섞인 글자 포함, 읽는 법 표기 <rPh> 는 뺀다) */
const textOf = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unx(m[1])).join("");
const colIdx = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export async function readXlsx(bytes: Uint8Array, sheetIndex = 0): Promise<{ sheets: string[]; sheet: ReadSheet }> {
  const es = entries(bytes);
  const get = (n: string) => es.find((e) => e.name === n);
  const wb = get("xl/workbook.xml");
  if (!wb) throw new Error("엑셀 시트를 찾지 못했어요. .xlsx 파일인지 확인해 주세요.");
  const wbXml = await file(bytes, wb);
  const relsE = get("xl/_rels/workbook.xml.rels");
  const rels = relsE ? await file(bytes, relsE) : "";
  const sheetsMeta = [...wbXml.matchAll(/<sheet\b[^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g)].map((m) => ({ name: unx(m[1]), rid: m[2] }));
  const names = sheetsMeta.map((x) => x.name);
  const pick = sheetsMeta[Math.min(sheetIndex, sheetsMeta.length - 1)] ?? { name: "Sheet1", rid: "" };
  const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${pick.rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${pick.rid}"`))?.[1];
  const path = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : `xl/worksheets/sheet${sheetIndex + 1}.xml`;
  const se = get(path) ?? get("xl/worksheets/sheet1.xml");
  if (!se) throw new Error("엑셀 시트를 찾지 못했어요.");
  const ssE = get("xl/sharedStrings.xml");
  const shared = ssE ? [...(await file(bytes, ssE)).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  const xml = await file(bytes, se);
  const rows: (string | number)[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rn = Number(rm[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1) - 1;
    const row: (string | number)[] = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const t = attrs.match(/\bt="(\w+)"/)?.[1];
      const body = cm[2] ?? "";
      const vv = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val: string | number = "";
      if (t === "s") val = shared[Number(vv)] ?? "";
      else if (t === "inlineStr") val = textOf(body);
      else if (t === "str" || t === "e") val = unx(vv ?? "");
      else if (t === "b") val = vv === "1" ? "TRUE" : "FALSE";
      else if (vv != null && vv !== "") val = Number.isFinite(Number(vv)) ? Number(vv) : unx(vv);
      row[ref ? colIdx(ref) : row.length] = val;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = "";
    rows[rn] = row;
  }
  const dense = Array.from(rows, (r) => r ?? []);
  return { sheets: names, sheet: { name: pick.name, rows: trim(dense) } };
}

/** CSV (쉼표·탭, 따옴표 안 줄바꿈). 첫 줄 BOM 은 뺀다 */
export function readCsv(text: string): ReadSheet {
  const s = text.replace(/^﻿/, "");
  const first = s.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return { name: "CSV", rows: trim(rows) };
}

/** 머리줄 위의 빈 줄·제목 줄을 건너뛰고(값이 2칸 이상인 첫 줄이 머리줄), 끝의 빈 줄을 뺀다 */
function trim<T extends string | number>(rows: T[][]): T[][] {
  const filled = (r: T[]) => r.filter((x) => String(x ?? "").trim() !== "").length;
  const start = rows.findIndex((r) => filled(r) >= 2);
  const out = start < 0 ? [] : rows.slice(start);
  while (out.length && filled(out[out.length - 1]) === 0) out.pop();
  return out.filter((r, i) => i === 0 || filled(r) > 0);
}
