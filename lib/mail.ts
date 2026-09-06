import { Resend } from "resend";
import { labelMap, type Values } from "./rfq-schema";
import { addBusinessDays, formatKo, nowSeoul } from "./dates";

const FROM = process.env.RESEND_FROM || "단추 <onboarding@resend.dev>";
const ADMIN = (process.env.ADMIN_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (v === undefined || v === null || v === "") return "";
  return String(v);
}

/** 입력값 전체를 라벨 순으로 표 형태 HTML로 */
export function renderValuesTable(values: Values): string {
  const labels = labelMap();
  const rows: string[] = [];
  for (const [id, label] of Object.entries(labels)) {
    const v = fmt(values[id]);
    if (!v) continue;
    rows.push(`<tr><td style="padding:6px 10px;color:#6F6A63;border-bottom:1px solid #F0EDE7;white-space:nowrap">${esc(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #F0EDE7">${esc(v)}</td></tr>`);
  }
  return `<table style="border-collapse:collapse;font-size:14px;width:100%">${rows.join("")}</table>`;
}

export interface MailArgs {
  rfqNo: string;
  values: Values;
  fileNames: string[];
}

export async function sendRfqMails({ rfqNo, values, fileNames }: MailArgs): Promise<{ requester: boolean; admin: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { requester: false, admin: false };
  const resend = new Resend(key);

  const now = nowSeoul();
  const d1 = formatKo(addBusinessDays(now, 1));
  const d2 = formatKo(addBusinessDays(now, 5));
  const d3 = formatKo(addBusinessDays(now, 7));
  const to = String(values.email || "");
  const name = String(values.name || "");
  const company = String(values.company || "");
  const cats = Array.isArray(values.categories) ? values.categories.join(", ") : "";

  const wrap = (body: string) =>
    `<div style="font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1A1815;line-height:1.6;max-width:640px">${body}
     <p style="margin-top:32px;font-size:13px;color:#9A948B">단추 Danchu · hello@danchu.kr</p></div>`;

  const requesterHtml = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px">견적 요청이 접수되었습니다</h2>
    <p>${esc(company)} ${esc(name)} 님, 요청 내용을 확인한 뒤 참여 CRO에 배포합니다.</p>
    <div style="display:inline-block;background:#FAF3E6;border:1px solid #EAD9B8;border-radius:12px;padding:12px 24px;margin:8px 0 20px">
      <div style="font-size:12px;font-weight:600;color:#8A5A12;letter-spacing:.04em">RFQ 번호</div>
      <div style="font-size:22px;font-weight:700">${esc(rfqNo)}</div>
    </div>
    <h3 style="font-size:16px;margin:0 0 8px">다음 단계</h3>
    <ol style="padding-left:20px;margin:0 0 20px">
      <li>참여 CRO에 배포 — ${d1} · CDA 필요 시 체결 후 전달</li>
      <li>CRO 견적 회신 — ${d2}까지 · 같은 양식으로 회신</li>
      <li>비교표 발송 — ${d3} 예정 · 이메일로 발송</li>
    </ol>
    <p style="font-size:14px;color:#6F6A63">시험 항목: ${esc(cats)}<br>시험물질: ${esc(String(values.substance || ""))}</p>
    <p style="font-size:14px;color:#6F6A63">의뢰자 무료 · 입력 내용은 CDA 체결 후 참여 CRO에만 전달됩니다.</p>`);

  const adminHtml = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px">[단추] 새 RFQ 접수 ${esc(rfqNo)}</h2>
    <p><b>${esc(company)}</b> · ${esc(name)} · <a href="mailto:${esc(to)}">${esc(to)}</a> · ${esc(String(values.phone || ""))}</p>
    <p>제출 단계: ${esc(String(values.submittedStep || 1))} / 첨부: ${fileNames.length ? esc(fileNames.join(", ")) : "없음"}</p>
    ${renderValuesTable(values)}`);

  const results = { requester: false, admin: false };

  if (to) {
    const r = await resend.emails.send({
      from: FROM,
      to,
      subject: `[단추] 견적 요청 접수 — ${rfqNo}`,
      html: requesterHtml,
    });
    results.requester = !r.error;
    if (r.error) console.error("resend requester", r.error);
  }
  if (ADMIN.length) {
    const r = await resend.emails.send({
      from: FROM,
      to: ADMIN,
      replyTo: to || undefined,
      subject: `[단추] 새 RFQ ${rfqNo} — ${company} (${cats})`,
      html: adminHtml,
    });
    results.admin = !r.error;
    if (r.error) console.error("resend admin", r.error);
  }
  return results;
}
