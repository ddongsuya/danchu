import { needsCda, confidentialAccess } from "@/lib/request-policy";
import { Resend } from "resend";
import { labelMap, type Values } from "./rfq-schema";
import { addBusinessDays, formatKo, nowSeoul } from "./dates";
import { captureError, maskEmail } from "./observe";
import { isProduction } from "./env";

// 운영에서 RESEND_FROM 이 비면 Resend 기본 발신자로 나가는데, 그 주소는 Resend 계정 소유자에게만 배달된다.
const FROM = process.env.RESEND_FROM || "단추 <onboarding@resend.dev>";
if (isProduction() && !process.env.RESEND_FROM) console.error("[danchu] RESEND_FROM 미설정 - 운영 메일이 외부로 배달되지 않습니다");
const ADMIN = (process.env.ADMIN_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);

export function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/**
 * 범용 발송. 키가 없으면 false.
 * 네트워크 예외는 한 번 더 시도한 뒤 false 로 돌려준다(던지지 않는다). 호출부가 루프 안에서 끊기지 않게.
 * 로그에는 수신자 주소를 마스킹해 남긴다.
 */
export async function sendMail(m: { to: string | string[]; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const toList = Array.isArray(m.to) ? m.to : [m.to];
  if (!key) {
    console.warn("[danchu] RESEND 미설정 - 메일 미발송:", m.subject, toList.map(maskEmail).join(","));
    return false;
  }
  const resend = new Resend(key);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await resend.emails.send({ from: FROM, to: m.to, subject: m.subject, html: m.html, replyTo: m.replyTo });
      if (!r.error) return true;
      // API 가 거부한 것(잘못된 주소·도메인 미인증)은 재시도해도 같다
      captureError(new Error(r.error.message), "mail:resend", { subject: m.subject, name: r.error.name });
      return false;
    } catch (e) {
      if (attempt === 1) {
        captureError(e, "mail:transport", { subject: m.subject });
        return false;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
}

const BTN = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#2A55A5;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600;font-size:15px">${esc(label)}</a>`;

/** 인증 메일 - 가입 확인·로그인 링크·비밀번호 재설정 */
export async function sendAuthMail(kind: "signup" | "magic" | "recovery", to: string, link: string): Promise<boolean> {
  const t = {
    signup: { subject: "[단추] 이메일 확인으로 가입을 완료하세요", h: "가입을 완료하세요", p: "아래 버튼을 누르면 이메일이 확인되고 바로 로그인됩니다. 링크는 1시간 동안 유효합니다.", b: "이메일 확인하고 시작" },
    magic: { subject: "[단추] 로그인 링크", h: "로그인 링크입니다", p: "아래 버튼을 누르면 비밀번호 없이 로그인됩니다. 링크는 1시간 동안 유효하며 한 번만 쓸 수 있습니다.", b: "단추 로그인" },
    recovery: { subject: "[단추] 비밀번호 재설정", h: "비밀번호를 재설정하세요", p: "아래 버튼을 누르면 새 비밀번호를 정할 수 있습니다. 요청하지 않았다면 이 메일은 무시하세요.", b: "새 비밀번호 정하기" },
  }[kind];
  return sendMail({
    to,
    subject: t.subject,
    html: mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">${t.h}</h2>
      <p>${t.p}</p>
      <p style="margin:24px 0">${BTN(link, t.b)}</p>
      <p style="font-size:13px;color:#6F6A63">버튼이 열리지 않으면 이 주소를 복사해 브라우저에 붙여 넣으세요.<br><span style="word-break:break-all">${esc(link)}</span></p>`),
  });
}

/**
 * 보내기 직전 가입의 인증 메일. 6자리 번호(화면에 입력)와 버튼(누르면 같은 요청서가 접수된다)을 함께 보낸다.
 * 번호와 버튼은 같은 일회용 토큰이라 어느 쪽을 쓰든 한 번만 통한다.
 */
export async function sendCodeMail(to: string, code: string, link: string): Promise<boolean> {
  return sendMail({
    to,
    subject: `[단추] 인증번호 ${code}`,
    html: mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">요청서를 보내기 전에 이메일을 확인합니다</h2>
      <p>요청서 화면에 아래 번호를 입력해 주세요. 확인이 끝나면 쓰신 요청서가 바로 접수됩니다.</p>
      <div style="display:inline-block;background:#F5F5F7;border-radius:12px;padding:14px 26px;margin:8px 0 20px;font-size:30px;font-weight:700;letter-spacing:.18em">${esc(code)}</div>
      <p>화면을 닫았다면 아래 버튼을 눌러도 같은 요청서가 접수됩니다.</p>
      <p style="margin:24px 0">${BTN(link, "인증하고 요청서 보내기")}</p>
      <p style="font-size:13px;color:#6F6A63">번호와 버튼은 1시간 동안 유효하고, 한 번만 쓸 수 있습니다. 요청하지 않았다면 이 메일은 무시하세요. 계정도 요청서도 만들어지지 않습니다.</p>`),
  });
}

function fmt(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (v === undefined || v === null || v === "") return "";
  return String(v);
}

export const mailWrap = (body: string) =>
  `<div style="font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1A1815;line-height:1.6;max-width:640px">${body}
   <p style="margin-top:32px;font-size:13px;color:#9A948B">단추 Danchu · hello@danchu.kr</p></div>`;
const wrap = mailWrap;

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
  /** 접수와 함께 올라간 첨부 수 */
  fileCount?: number;
  /** 접수와 함께 전달한 기관 수. 0이면 "전달할 기관을 찾고 있습니다" 안내 */
  sent?: number;
  /** 회신 마감일 YYYY-MM-DD */
  replyBy?: string;
}

/** 'YYYY-MM-DD' 다음 날 (비교표가 열리는 날) */
function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
const md = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : ymd);

/**
 * 접수 메일. 기관 전달 결과를 함께 담아 한 통으로 보낸다 (접수 메일과 배포 메일이 따로·거꾸로 가던 것을 합쳤다).
 * 운영자에게는 요청서 전체를 표로 보낸다.
 */
export async function sendRfqMails({ rfqNo, values, fileNames, fileCount, sent, replyBy }: MailArgs): Promise<{ requester: boolean; admin: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { requester: false, admin: false };
  const resend = new Resend(key);

  const to = String(values.email || "");
  const name = String(values.name || "");
  const company = String(values.company || "");
  const cats = Array.isArray(values.categories) ? values.categories.join(", ") : "";
  const cda = needsCda(values.confid);
  const due = String(replyBy || values.replyBy || "");
  const files = fileCount ?? fileNames.length;
  const delivered = (sent ?? 0) > 0;
  const shareNote = cda
    ? "기관에는 시험 개요만 먼저 전달했습니다. 첨부는 CDA 체결을 확인한 기관에만, 회사명과 연락처는 의뢰자가 선택한 기관에만 공개됩니다."
    : "회사명과 연락처는 의뢰자가 비교표에서 선택한 기관에만 공개됩니다.";
  const steps = delivered
    ? `<li>오늘 · 기관 ${sent}곳에 요청서를 전달했습니다.</li>
      <li>${esc(md(due))} · 회신 마감</li>
      <li>${esc(md(nextDay(due)))} 오전 9시 · 비교표 공개. 모든 기관이 회신하면 더 빨리 열립니다.</li>`
    : `<li>요청 분야에 바로 맞는 참여 기관이 없어 운영자가 직접 전달 기관을 정하고 있습니다.</li>
      <li>보통 영업일 1~2일 안에 전달 결과를 알려 드립니다.</li>`;

  const requesterHtml = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px">${delivered ? `요청서를 접수했고, 기관 ${sent}곳에 전달했습니다` : "요청서를 접수했습니다"}</h2>
    <p>${esc(company)} ${esc(name)} 님, 보내 주신 내용 그대로 접수했습니다.${files ? ` 첨부 ${files}개도 함께 올라갔습니다.` : ""}</p>
    <div style="display:inline-block;background:#F5F5F7;border-radius:12px;padding:12px 24px;margin:8px 0 20px">
      <div style="font-size:12px;font-weight:600;color:#6E6E73">접수 번호</div>
      <div style="font-size:22px;font-weight:700">${esc(rfqNo)}</div>
    </div>
    <h3 style="font-size:16px;margin:0 0 8px">다음 일정</h3>
    <ol style="padding-left:20px;margin:0 0 20px">${steps}</ol>
    <p style="font-size:14px;color:#6F6A63">그 사이에 하실 일은 없습니다. 첫 견적이 도착할 때와 비교표가 열릴 때 다시 메일로 알려 드립니다.</p>
    <p style="font-size:14px;color:#6F6A63">시험 항목: ${esc(cats)}<br>시험물질: ${esc(String(values.substance || ""))}</p>
    <p style="font-size:14px;color:#6F6A63">의뢰자는 비용이 들지 않습니다. ${shareNote}</p>`);

  const adminHtml = wrap(`
    <h2 style="margin:0 0 12px;font-size:20px">[단추] 새 RFQ 접수 ${esc(rfqNo)}</h2>
    <p><b>${esc(company)}</b> · ${esc(name)} · <a href="mailto:${esc(to)}">${esc(to)}</a> · ${esc(String(values.phone || ""))}</p>
    <p>첨부: ${files ? `${files}개` : "없음"} · 전달: ${delivered ? `${sent}곳` : "아직 없음"}</p>
    ${renderValuesTable(values)}`);

  const results = { requester: false, admin: false };

  if (to) {
    const r = await resend.emails.send({
      from: FROM,
      to,
      subject: delivered ? `[단추] ${rfqNo} 접수 · 기관 ${sent}곳에 전달했습니다` : `[단추] ${rfqNo} 접수 · 전달할 기관을 찾고 있습니다`,
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
      subject: `[단추] 새 RFQ ${rfqNo} - ${company} (${cats})`,
      html: adminHtml,
    });
    results.admin = !r.error;
    if (r.error) console.error("resend admin", r.error);
  }
  return results;
}

/** 앱 문의 화면 → 운영자 메일. 발송 성공 여부를 돌려준다. */
export async function sendSupportMail(a: { email: string; type: string; rfqNo: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !ADMIN.length) return false;
  const resend = new Resend(key);
  const r = await resend.emails.send({
    from: FROM,
    to: ADMIN,
    replyTo: a.email,
    subject: `[단추] 문의 · ${a.type}${a.rfqNo ? ` · ${a.rfqNo}` : ""}`,
    html: wrap(`
      <h2 style="margin:0 0 12px;font-size:20px">[단추] 앱 문의</h2>
      <p>보낸 사람: <a href="mailto:${esc(a.email)}">${esc(a.email)}</a><br>유형: ${esc(a.type)}${a.rfqNo ? `<br>관련 요청: ${esc(a.rfqNo)}` : ""}</p>
      <pre style="white-space:pre-wrap;font:inherit;padding:14px 16px;background:#F5F5F4;border-radius:6px">${esc(a.text)}</pre>`),
  });
  if (r.error) console.error("resend support", r.error);
  return !r.error;
}
