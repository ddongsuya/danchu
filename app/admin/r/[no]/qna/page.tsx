import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Crumb } from "@/components/app/ui";
import { mdhm } from "@/lib/format";
import { audit } from "@/lib/audit";
import { QNA_TOPIC_LABEL, type QnaRow } from "@/lib/qna";
import { testNames } from "@/lib/qna-data";

export const dynamic = "force-dynamic";

/**
 * 운영자 질의응답 기록 (0045). 읽기 전용: 고치기·지우기 없음 (DB 트리거도 막는다).
 * 연락처를 가리지 않은 원문을 보여 주므로, 열 때마다 감사 기록(qna.view)을 남긴다.
 */
export default async function AdminQna({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("admin");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq) notFound();
  const sb = getSupabaseAdmin()!;
  const [{ data: rows }, { data: invites }] = await Promise.all([
    sb.from("rfq_questions").select("*").eq("rfq_id", rfq.id).order("created_at", { ascending: false }),
    sb.from("rfq_invites").select("id, cro_name").eq("rfq_id", rfq.id),
  ]);
  const list = (rows ?? []) as QnaRow[];
  await audit({ userId: s.userId, email: s.email }, "qna.view", { type: "rfq_request", id: rfq.id, label: rfq.rfq_no }, { note: `질의 ${list.length}건` });
  const names = new Map((invites ?? []).map((i) => [i.id, i.cro_name]));
  const tests = testNames(rfq.payload);

  return (
    <>
      <Crumb href={`/admin/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
      <div className="ph">
        <div>
          <h1>질의응답 기록</h1>
          <p>
            {rfq.rfq_no} {rfq.substance} · 질의 {list.length}건 · 답변 대기 {list.filter((r) => r.answer == null).length}건
          </p>
        </div>
      </div>
      <div className="card card--rows tbl-wrap" tabIndex={0} role="region" aria-label="질의응답 기록">
        <table className="tbl" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th scope="col">일시</th>
              <th scope="col">방향</th>
              <th scope="col">기관</th>
              <th scope="col">항목</th>
              <th scope="col">질의</th>
              <th scope="col">답변</th>
              <th scope="col">공개 범위</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--muted)" }}>질의 없음</td>
              </tr>
            )}
            {list.map((r) => (
              <tr key={r.id}>
                <td className="tnum" style={{ whiteSpace: "nowrap" }}>{mdhm(r.created_at)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.direction === "cro" ? "기관 → 의뢰자" : "의뢰자 → 기관"}</td>
                <td>{names.get(r.invite_id) ?? "-"}</td>
                <td>
                  {QNA_TOPIC_LABEL[r.topic]}
                  {r.test_seq != null && tests.get(r.test_seq) ? <span style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>{tests.get(r.test_seq)}</span> : null}
                </td>
                <td style={{ whiteSpace: "pre-wrap", maxWidth: 320 }}>
                  {r.body}
                  {r.body_has_contact && <span className="pill pill--warn" style={{ marginLeft: 6 }}>연락처 가림</span>}
                </td>
                <td style={{ whiteSpace: "pre-wrap", maxWidth: 320 }}>
                  {r.answer ?? <span style={{ color: "var(--muted)" }}>답변 대기</span>}
                  {r.answer_has_contact && <span className="pill pill--warn" style={{ marginLeft: 6 }}>연락처 가림</span>}
                  {r.answered_at && <span className="tnum" style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>{mdhm(r.answered_at)}</span>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{r.scope === "all" ? "참여 기관 전체" : r.scope === "private" ? "질의 기관만" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
