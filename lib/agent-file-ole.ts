/**
 * 옛 형식 첨부(한글 hwp, Word doc, Excel xls)의 글 뽑기. 셋 다 MS 복합 문서(CFB) 안에 들어 있다.
 * 순수 함수(테스트 대상). 새 의존성 없이 node:zlib 만 쓴다. 암호가 걸린 문서는 encrypted 로 알린다.
 * 참고: MS-CFB, 한컴 HWP 5.0 공개 문서, MS-DOC(조각 표), MS-XLS(BIFF8).
 */
import { inflateRawSync, inflateSync } from "node:zlib";

const END = 0xfffffffa;
const MAX_STREAM = 40 * 1024 * 1024;

export class OleError extends Error {}

/** 복합 문서 → 경로("BodyText/Section0") 별 스트림 */
export function readCfb(buf: Uint8Array): Map<string, Buffer> {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 512 || b.readUInt32LE(0) !== 0xe011cfd0 || b.readUInt32LE(4) !== 0xe11ab1a1) throw new OleError("not_cfb");
  const ss = 1 << b.readUInt16LE(0x1e);
  const ms = 1 << b.readUInt16LE(0x20);
  const firstDir = b.readUInt32LE(0x30);
  const cutoff = b.readUInt32LE(0x38);
  const firstMini = b.readUInt32LE(0x3c);
  let difat = b.readUInt32LE(0x44);
  const sec = (n: number) => { const o = (n + 1) * ss; return b.subarray(o, o + ss); };
  // FAT 섹터 목록
  const fatSecs: number[] = [];
  for (let i = 0; i < 109; i++) { const v = b.readUInt32LE(0x4c + i * 4); if (v < END) fatSecs.push(v); }
  for (let guard = 0; difat < END && guard < 10_000; guard++) {
    const s = sec(difat);
    for (let i = 0; i < ss / 4 - 1; i++) { const v = s.readUInt32LE(i * 4); if (v < END) fatSecs.push(v); }
    difat = s.readUInt32LE(ss - 4);
  }
  const fat: number[] = [];
  for (const f of fatSecs) { const s = sec(f); for (let i = 0; i < ss / 4; i++) fat.push(s.readUInt32LE(i * 4)); }
  const chain = (start: number, table: number[]) => {
    const out: number[] = [];
    for (let n = start; n < END && out.length <= table.length; n = table[n] ?? END) out.push(n);
    return out;
  };
  const big = (start: number, size?: number) => {
    const parts = chain(start, fat).map(sec);
    const all = Buffer.concat(parts);
    return size === undefined ? all : all.subarray(0, size);
  };
  const dir = big(firstDir);
  type Ent = { name: string; type: number; left: number; right: number; child: number; start: number; size: number };
  const ents: Ent[] = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nl = dir.readUInt16LE(o + 0x40);
    ents.push({ name: dir.toString("utf16le", o, o + Math.max(0, nl - 2)), type: dir[o + 0x42], left: dir.readUInt32LE(o + 0x44), right: dir.readUInt32LE(o + 0x48), child: dir.readUInt32LE(o + 0x4c), start: dir.readUInt32LE(o + 0x74), size: dir.readUInt32LE(o + 0x78) });
  }
  const root = ents[0];
  if (!root || root.type !== 5) throw new OleError("bad_cfb");
  const miniStream = big(root.start, root.size);
  const minifat: number[] = [];
  if (firstMini < END) { const m = big(firstMini); for (let i = 0; i + 4 <= m.length; i += 4) minifat.push(m.readUInt32LE(i)); }
  const mini = (start: number, size: number) => Buffer.concat(chain(start, minifat).map((n) => miniStream.subarray(n * ms, n * ms + ms))).subarray(0, size);
  const out = new Map<string, Buffer>();
  const seen = new Set<number>();
  const walk = (i: number, prefix: string) => {
    if (i >= END || i >= ents.length || seen.has(i)) return;
    seen.add(i);
    const e = ents[i];
    walk(e.left, prefix);
    walk(e.right, prefix);
    const path = prefix + e.name;
    if (e.type === 2 && e.size <= MAX_STREAM) out.set(path, e.size < cutoff ? mini(e.start, e.size) : big(e.start, e.size));
    else if (e.type === 1) walk(e.child, path + "/");
  };
  walk(root.child, "");
  return out;
}

/* ── 한글 hwp 5.0 ── */

/** 문단 글 레코드(HWPTAG_PARA_TEXT=67)의 글자. 조절 문자 중 인라인·확장 조절은 8글자 폭이다 */
function paraText(rec: Buffer): string {
  let s = "";
  for (let i = 0; i + 1 < rec.length; ) {
    const c = rec.readUInt16LE(i);
    if (c >= 32) { s += String.fromCharCode(c); i += 2; continue; }
    if (c === 9) { s += "\t"; i += 16; continue; }
    if (c === 10) { s += "\n"; i += 2; continue; }
    if (c === 13) { i += 2; continue; }
    if ([0, 24, 25, 26, 27, 28, 29, 30, 31].includes(c)) { if (c === 30 || c === 31) s += " "; i += 2; continue; }
    i += 16; // 1~8, 11~12, 14~23: 8글자 폭 조절(표·그림·필드 등)
  }
  return s;
}

export function hwpText(buf: Uint8Array): string {
  const f = readCfb(buf);
  const head = f.get("FileHeader");
  if (!head || !head.toString("latin1", 0, 17).startsWith("HWP Document File")) throw new OleError("bad_hwp");
  const props = head.readUInt32LE(36);
  if (props & 0b110) throw new OleError("encrypted"); // 암호·배포용 문서
  const compressed = (props & 1) === 1;
  const secs = [...f.keys()].filter((k) => /^BodyText\/Section\d+$/.test(k)).sort((a, b) => Number(a.slice(16)) - Number(b.slice(16)));
  if (!secs.length) throw new OleError("bad_hwp");
  const paras: string[] = [];
  for (const k of secs) {
    let d = f.get(k)!;
    if (compressed) { try { d = inflateRawSync(d, { maxOutputLength: MAX_STREAM }); } catch { d = inflateSync(d, { maxOutputLength: MAX_STREAM }); } }
    for (let o = 0; o + 4 <= d.length; ) {
      const h = d.readUInt32LE(o);
      const tag = h & 0x3ff;
      let size = h >>> 20;
      o += 4;
      if (size === 0xfff) { size = d.readUInt32LE(o); o += 4; }
      if (tag === 67) { const t = paraText(d.subarray(o, o + size)).trim(); if (t) paras.push(t); }
      o += size;
    }
  }
  return paras.join("\n");
}

/* ── Word 97~2003 doc ── */

const CP1252: Record<number, string> = { 0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "-", 0x97: "-", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ" };

export function docText(buf: Uint8Array): string {
  const f = readCfb(buf);
  const wd = f.get("WordDocument");
  if (!wd || wd.readUInt16LE(0) !== 0xa5ec) throw new OleError("bad_doc");
  const flags = wd.readUInt16LE(0x0a);
  if (flags & 0x0100) throw new OleError("encrypted");
  const table = f.get(flags & 0x0200 ? "1Table" : "0Table");
  if (!table) throw new OleError("bad_doc");
  const fcClx = wd.readUInt32LE(0x01a2);
  const lcbClx = wd.readUInt32LE(0x01a6);
  const clx = table.subarray(fcClx, fcClx + lcbClx);
  let o = 0;
  while (o < clx.length && clx[o] === 0x01) o += 3 + clx.readUInt16LE(o + 1);
  if (clx[o] !== 0x02) throw new OleError("bad_doc");
  const lcb = clx.readUInt32LE(o + 1);
  const plc = clx.subarray(o + 5, o + 5 + lcb);
  const n = (lcb - 4) / 12;
  let s = "";
  for (let i = 0; i < n; i++) {
    const cp0 = plc.readUInt32LE(i * 4);
    const cp1 = plc.readUInt32LE((i + 1) * 4);
    const fc = plc.readUInt32LE((n + 1) * 4 + i * 8 + 2);
    const len = cp1 - cp0;
    if (len <= 0 || len > MAX_STREAM) continue;
    if (fc & 0x40000000) {
      const at = (fc & 0x3fffffff) / 2;
      for (const c of wd.subarray(at, at + len)) s += CP1252[c] ?? String.fromCharCode(c);
    } else s += wd.toString("utf16le", fc, fc + len * 2);
  }
  return s
    .replace(/\x13[^\x14\x15]*\x14?/g, "") // 필드 코드
    .replace(/[\x07]/g, "\t")
    .replace(/[\r\x0b\x0c]/g, "\n")
    .replace(/[\x00-\x08\x0e-\x1f]/g, "");
}

/* ── Excel 97~2003 xls (BIFF8) ── */

type Rec = { type: number; data: Buffer };
function records(w: Buffer): Rec[] {
  const out: Rec[] = [];
  for (let o = 0; o + 4 <= w.length; ) {
    const type = w.readUInt16LE(o);
    const len = w.readUInt16LE(o + 2);
    out.push({ type, data: w.subarray(o + 4, o + 4 + len) });
    o += 4 + len;
  }
  return out;
}

/** SST 처럼 CONTINUE 로 나뉜 조각을 읽는 커서. 글자 중간에서 조각이 바뀌면 새 플래그 바이트가 온다 */
class Pieces {
  i = 0; o = 0;
  constructor(private parts: Buffer[]) {}
  private ensure() { while (this.i < this.parts.length && this.o >= this.parts[this.i].length) { this.i++; this.o = 0; } }
  u8() { this.ensure(); const p = this.parts[this.i]; if (!p) throw new OleError("bad_xls"); return p[this.o++]; }
  u16() { return this.u8() | (this.u8() << 8); }
  u32() { return (this.u16() | (this.u16() << 16)) >>> 0; }
  skip(n: number) { for (let k = 0; k < n; k++) this.u8(); }
  str(cch: number, high: boolean): string {
    let s = "";
    let wide = high;
    for (let k = 0; k < cch; k++) {
      if (this.i < this.parts.length && this.o >= this.parts[this.i].length && k > 0) { this.i++; this.o = 0; wide = (this.u8() & 1) === 1; }
      s += String.fromCharCode(wide ? this.u16() : this.u8());
    }
    return s;
  }
}

function xlString(p: Pieces, cchBytes: 1 | 2): string {
  const cch = cchBytes === 2 ? p.u16() : p.u8();
  const fl = p.u8();
  const rich = fl & 8 ? p.u16() : 0;
  const ext = fl & 4 ? p.u32() : 0;
  const s = p.str(cch, (fl & 1) === 1);
  p.skip(rich * 4 + ext);
  return s;
}

function rkNum(rk: number): number {
  let v: number;
  if (rk & 2) v = rk >> 2;
  else { const b = Buffer.alloc(8); b.writeUInt32LE(rk & 0xfffffffc, 4); v = b.readDoubleLE(0); }
  return rk & 1 ? v / 100 : v;
}

export function xlsText(buf: Uint8Array): string {
  const f = readCfb(buf);
  const w = f.get("Workbook") ?? f.get("Book");
  if (!w) throw new OleError("bad_xls");
  const recs = records(w);
  if (recs.some((r) => r.type === 0x002f)) throw new OleError("encrypted");
  const sst: string[] = [];
  const names: string[] = [];
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.type === 0x0085) { const cch = r.data[6]; const high = r.data[7] & 1; names.push(high ? r.data.toString("utf16le", 8, 8 + cch * 2) : r.data.toString("latin1", 8, 8 + cch)); }
    if (r.type === 0x00fc) {
      const parts = [r.data];
      for (let j = i + 1; j < recs.length && recs[j].type === 0x003c; j++) parts.push(recs[j].data);
      const p = new Pieces(parts);
      p.u32();
      const unique = p.u32();
      try { for (let k = 0; k < unique; k++) sst.push(xlString(p, 2)); } catch { /* 잘린 SST 는 읽은 만큼 */ }
    }
  }
  const sheets: Map<number, Map<number, string>>[] = [];
  let cur: Map<number, Map<number, string>> | null = null;
  const put = (row: number, col: number, v: string) => { if (!cur) return; const r = cur.get(row) ?? new Map(); r.set(col, v); cur.set(row, r); };
  const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6));
  for (const r of recs) {
    const d = r.data;
    if (r.type === 0x0809 && d.length >= 4) { if (d.readUInt16LE(2) === 0x0010) { cur = new Map(); sheets.push(cur); } else cur = null; continue; }
    if (!cur || d.length < 6) continue;
    const row = d.readUInt16LE(0), col = d.readUInt16LE(2);
    if (r.type === 0x00fd && d.length >= 10) put(row, col, sst[d.readUInt32LE(6)] ?? "");
    else if (r.type === 0x0203 && d.length >= 14) put(row, col, num(d.readDoubleLE(6)));
    else if (r.type === 0x027e && d.length >= 10) put(row, col, num(rkNum(d.readInt32LE(6))));
    else if (r.type === 0x00bd) { const last = d.readUInt16LE(d.length - 2); for (let c = col, o = 4; c <= last && o + 6 <= d.length - 2; c++, o += 6) put(row, c, num(rkNum(d.readInt32LE(o + 2)))); }
    else if (r.type === 0x0204 && d.length >= 9) { try { put(row, col, xlString(new Pieces([d.subarray(6)]), 2)); } catch { /* 깨진 칸 */ } }
    else if (r.type === 0x0006 && d.length >= 14 && d.readUInt16LE(12) !== 0xffff) put(row, col, num(d.readDoubleLE(6)));
  }
  return sheets.map((s, i) => {
    const rows = [...s.keys()].sort((a, b) => a - b).map((ri) => {
      const r = s.get(ri)!;
      const max = Math.max(...r.keys());
      return Array.from({ length: max + 1 }, (_, c) => r.get(c) ?? "").join("\t").replace(/\t+$/, "");
    }).filter((l) => l.trim());
    return `[시트 ${names[i] ?? i + 1}]\n${rows.join("\n")}`;
  }).join("\n\n");
}
