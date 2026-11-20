/**
 * 요청 첨부 파일의 글 뽑기 (2026-11-20 사용자 결정: AI가 첨부 내용까지 읽는다).
 *   - 글: PDF, 한글(hwp·hwpx), Word(doc·docx), Excel(xls·xlsx), PowerPoint(pptx), 글 파일(txt·csv·md·json·tsv·xml).
 *     옛 형식(hwp·doc·xls)은 lib/agent-file-ole.ts.
 *   - 이미지(png·jpg)와 글이 없는 PDF(스캔본)는 AI가 직접 보도록 파일 그대로 준다(호출하는 쪽이 정한다).
 *   - 선정 전 기관에게는 의뢰자 회사명·담당자 이름·부서와 연락처를 가린다(반드시 지킬 것 4번).
 *   - 길이는 MAX_CHARS 에서 자른다. 파일을 저장하거나 기록에 남기지 않는다.
 * PDF 를 뺀 나머지는 순수 함수(테스트 대상). zip 은 node:zlib 로 직접 푼다(새 의존성 없음).
 */
import { inflateRawSync } from "node:zlib";
import { CONTACT_MASK, maskContacts } from "./contact-guard";
import { docText, hwpText, OleError, xlsText } from "./agent-file-ole";

export const MAX_CHARS = 30_000;
/** zip 안 파일 하나를 풀 때 최대 크기 (압축 폭탄 방지) */
const MAX_ENTRY = 40 * 1024 * 1024;

export type FileKind = "pdf" | "docx" | "xlsx" | "pptx" | "hwpx" | "hwp" | "doc" | "xls" | "image" | "text" | "unsupported";

const TEXT_EXT = ["txt", "csv", "tsv", "md", "json", "xml"];

export function fileKind(name: string, mime?: string | null): FileKind {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pptx") return "pptx";
  if (ext === "hwpx") return "hwpx";
  if (ext === "hwp") return "hwp";
  if (ext === "doc") return "doc";
  if (ext === "xls") return "xls";
  if (["png", "jpg", "jpeg"].includes(ext) || mime === "image/png" || mime === "image/jpeg") return "image";
  if (TEXT_EXT.includes(ext) || (mime ?? "").startsWith("text/")) return "text";
  return "unsupported";
}

/** zip 중앙 디렉터리를 읽어 고른 이름의 파일만 푼다 */
export function unzip(buf: Uint8Array, want: (name: string) => boolean): Map<string, Buffer> {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = new Map<string, Buffer>();
  // 끝에서 EOCD(0x06054b50) 찾기
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65_535); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not_zip");
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= b.length; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error("bad_zip");
    const method = b.readUInt16LE(p + 10);
    const csize = b.readUInt32LE(p + 20);
    const usize = b.readUInt32LE(p + 24);
    const nlen = b.readUInt16LE(p + 28);
    const xlen = b.readUInt16LE(p + 30);
    const clen = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (!want(name) || usize > MAX_ENTRY) continue;
    if (b.readUInt32LE(local) !== 0x04034b50) continue;
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(start, start + csize);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw, { maxOutputLength: MAX_ENTRY }));
  }
  return out;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENT[e.toLowerCase()] ?? "";
  });
}

/** 문단 끝 태그에서 줄을 바꾸고, 글자 태그(<w:t>, <a:t>, <hp:t>) 안 글만 모은다 */
function xmlRuns(xml: string, run: string, para: string): string {
  const lines: string[] = [];
  for (const p of xml.split(new RegExp(`</${para}>`))) {
    const parts: string[] = [];
    const re = new RegExp(`<${run}(?:\\s[^>]*)?>([\\s\\S]*?)</${run}>|<(?:w:tab|hp:tab)\\b[^>]*/>`, "g");
    for (const m of p.matchAll(re)) parts.push(m[1] === undefined ? "\t" : decodeXml(m[1]));
    const line = parts.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

const byNum = (a: string, b: string) => (Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0));

export function docxText(buf: Uint8Array): string {
  const z = unzip(buf, (n) => n === "word/document.xml" || /^word\/(header|footer)\d*\.xml$/.test(n) || n === "word/footnotes.xml");
  const doc = z.get("word/document.xml");
  if (!doc) throw new Error("bad_docx");
  // 표 칸은 탭으로 나눈다
  const xml = doc.toString("utf8").replace(/<\/w:tc>/g, "<w:tab/></w:tc>");
  const extra = [...z.entries()].filter(([n]) => n !== "word/document.xml").map(([, v]) => xmlRuns(v.toString("utf8"), "w:t", "w:p")).filter(Boolean);
  return [xmlRuns(xml, "w:t", "w:p"), ...extra].join("\n\n");
}

export function pptxText(buf: Uint8Array): string {
  const z = unzip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  if (!z.size) throw new Error("bad_pptx");
  return [...z.keys()].sort(byNum).map((n, i) => `[슬라이드 ${i + 1}]\n${xmlRuns(z.get(n)!.toString("utf8"), "a:t", "a:p")}`).join("\n\n");
}

export function hwpxText(buf: Uint8Array): string {
  const z = unzip(buf, (n) => /^Contents\/section\d+\.xml$/.test(n));
  if (!z.size) throw new Error("bad_hwpx");
  return [...z.keys()].sort(byNum).map((n) => xmlRuns(z.get(n)!.toString("utf8"), "hp:t", "hp:p")).join("\n\n");
}

/** 열 글자(A, B, AA)를 0부터 시작하는 번호로 */
function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function xlsxText(buf: Uint8Array): string {
  const z = unzip(buf, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared: string[] = [];
  const ss = z.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  for (const si of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push([...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join(""));
  const names = [...(z.get("xl/workbook.xml")?.toString("utf8") ?? "").matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const sheets = [...z.keys()].filter((n) => n.startsWith("xl/worksheets/")).sort(byNum);
  if (!sheets.length) throw new Error("bad_xlsx");
  return sheets.map((n, i) => {
    const xml = z.get(n)!.toString("utf8");
    const rows: string[] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? "";
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1] ?? "";
        const t = attrs.match(/\bt="(\w+)"/)?.[1];
        let v = "";
        if (t === "s") v = shared[Number(inner.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? "";
        else if (t === "inlineStr") v = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
        else v = decodeXml(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
        const at = ref ? colIndex(ref) : cells.length;
        while (cells.length < at) cells.push("");
        cells[at] = v;
      }
      const line = cells.join("\t").replace(/\t+$/, "");
      if (line.trim()) rows.push(line);
    }
    return `[시트 ${names[i] ?? i + 1}]\n${rows.join("\n")}`;
  }).join("\n\n");
}

/** UTF-8 이 깨지면 EUC-KR(옛 한국어 CSV)로 다시 읽는다 */
export function plainText(buf: Uint8Array): string {
  const u = new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
  if (!u.includes("�")) return u;
  try { return new TextDecoder("euc-kr").decode(buf); } catch { return u; }
}

/** 선정 전 기관용: 연락처와 의뢰자를 알아볼 수 있는 이름을 가린다 */
export const CLIENT_MASK = "[의뢰자]";
export function maskForCro(text: string, names: (string | null | undefined)[]): { text: string; masked: boolean } {
  let out = text;
  let masked = false;
  const list = [...new Set(names.map((n) => (n ?? "").trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  for (const n of list) {
    // "주식회사"·"(주)" 를 뗀 핵심 이름도 가린다
    const core = n.replace(/\(주\)|㈜|주식회사|\s+/g, "");
    for (const v of new Set([n, core].filter((x) => x.length >= 2))) {
      const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      if (re.test(out)) { masked = true; out = out.replace(re, CLIENT_MASK); }
    }
  }
  const c = maskContacts(out);
  return { text: c.text, masked: masked || c.masked };
}

export type FileText = { kind: FileKind; text: string; chars: number; truncated: boolean };
export type FileError = { kind: FileKind; error: "unsupported" | "unreadable" | "encrypted" };

/** 글을 뽑아 길이를 자른다. PDF 는 unpdf 를 그때 불러온다. 이미지는 글이 없으므로 unsupported(호출하는 쪽이 파일째 넘긴다) */
export async function extractText(buf: Uint8Array, name: string, mime?: string | null): Promise<FileText | FileError> {
  const kind = fileKind(name, mime);
  if (kind === "unsupported" || kind === "image") return { kind, error: "unsupported" };
  let text: string;
  try {
    if (kind === "pdf") {
      const { extractText: pdf, getDocumentProxy } = await import("unpdf");
      const doc = await getDocumentProxy(new Uint8Array(buf));
      const r = await pdf(doc, { mergePages: false });
      const pages = (r.text as string[]).map((t) => t.trim());
      text = pages.some(Boolean) ? pages.map((t, i) => `[${i + 1}쪽]\n${t}`).join("\n\n") : "";
    } else if (kind === "docx") text = docxText(buf);
    else if (kind === "xlsx") text = xlsxText(buf);
    else if (kind === "pptx") text = pptxText(buf);
    else if (kind === "hwpx") text = hwpxText(buf);
    else if (kind === "hwp") text = hwpText(buf);
    else if (kind === "doc") text = docText(buf);
    else if (kind === "xls") text = xlsText(buf);
    else text = plainText(buf);
  } catch (e) {
    return { kind, error: e instanceof OleError && e.message === "encrypted" ? "encrypted" : "unreadable" };
  }
  text = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = text.length > MAX_CHARS;
  return { kind, text: truncated ? text.slice(0, MAX_CHARS) : text, chars: text.length, truncated };
}

export { CONTACT_MASK };
