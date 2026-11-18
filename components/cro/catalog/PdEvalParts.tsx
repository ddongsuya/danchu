"use client";

/**
 * 효력 평가항목 보조 칸 (0047): 검체 수, 점수 기준표, 결과 보고.
 * 모델 표준 설계(ModelStandard)와 요청 반영(PdReflect)이 같이 쓴다. 견적서 4쪽 평가항목 쪽에 나간다.
 */
import { Plus, X } from "@phosphor-icons/react";
import { pdUseKey, type PdDesign, type PdEval, type PdScale } from "@/lib/kind-design";
import type { PriceItem } from "@/lib/price-book";
import { evalSamples, scaleTitle } from "@/lib/pd-quote";

const won = (n: number) => n.toLocaleString("ko-KR");

/** 검체 수: 가리키는 사용량 줄에서 계산. 줄 고르기는 글자처럼 보이는 선택 칸 */
export function SampleCell({ pd, e, items, onChange, disabled }: { pd: PdDesign; e: PdEval; items: PriceItem[]; onChange: (use: string | undefined) => void; disabled: boolean }) {
  const n = evalSamples(pd, e, items);
  const uses = (pd.uses ?? []).filter((u) => u.who !== "none");
  const name = (u: { itemId: string; label?: string }) => u.label || items.find((i) => i.id === u.itemId)?.name || "단가 항목";
  return (
    <span className="ms__smp">
      <span className="ms__num">{n != null ? won(n) : "-"}</span>
      <select className="ms__smps" aria-label={`${e.item} 검체 수 기준`} value={e.use ?? ""} disabled={disabled} onChange={(x) => onChange(x.target.value || undefined)}>
        <option value="">이름으로</option>
        {uses.map((u) => <option key={pdUseKey(u)} value={pdUseKey(u)}>{name(u)}</option>)}
      </select>
    </span>
  );
}

export const newScale = (): PdScale => ({ cols: ["점수", "기준"], rows: ["0", "1", "2", "3", "4"].map((k) => [k, ""]) });

/** 점수 기준표 편집: 머리 줄과 칸이 모두 글자처럼 보이는 입력 */
export function ScaleEditor({ e, onChange, disabled }: { e: PdEval; onChange: (s: PdScale | undefined) => void; disabled: boolean }) {
  const sc = e.scale!;
  const setCol = (i: number, v: string) => onChange({ ...sc, cols: sc.cols.map((c, j) => (j === i ? v : c)) });
  const setCell = (r: number, i: number, v: string) => onChange({ ...sc, rows: sc.rows.map((row, k) => (k === r ? row.map((c, j) => (j === i ? v : c)) : row)) });
  return (
    <div className="ms__scale">
      <div className="ms__sec">
        <h3>{scaleTitle(e.item)}</h3>
        {!disabled && (
          <span className="ms__secr">
            {sc.cols.length < 6 && <button type="button" className="btxt ms__addu" onClick={() => onChange({ cols: [...sc.cols, "기준"], rows: sc.rows.map((r) => [...r, ""]) })}><Plus size={14} aria-hidden="true" />열</button>}
            {sc.rows.length < 12 && <button type="button" className="btxt ms__addu" onClick={() => onChange({ ...sc, rows: [...sc.rows, sc.cols.map((_, i) => (i === 0 ? String(sc.rows.length) : ""))] })}><Plus size={14} aria-hidden="true" />줄</button>}
            <button type="button" className="btxt ms__addu" onClick={() => onChange(undefined)}>기준표 빼기</button>
          </span>
        )}
      </div>
      <div className="ms__tw">
        <table className="ms__t">
          <thead>
            <tr>
              {sc.cols.map((c, i) => (
                <th key={i} scope="col">
                  <span className="ms__shd">
                    <input className="ms__in" aria-label={`${i + 1}번째 열 이름`} value={c} maxLength={30} disabled={disabled} onChange={(x) => setCol(i, x.target.value)} />
                    {!disabled && i > 0 && sc.cols.length > 2 && <button type="button" className="btxt ms__x" aria-label={`${c} 열 빼기`} onClick={() => onChange({ cols: sc.cols.filter((_, j) => j !== i), rows: sc.rows.map((r) => r.filter((_, j) => j !== i)) })}><X size={12} aria-hidden="true" /></button>}
                  </span>
                </th>
              ))}
              <th scope="col"><span className="sr-only">빼기</span></th>
            </tr>
          </thead>
          <tbody>
            {sc.rows.map((row, r) => (
              <tr key={r}>
                {row.map((c, i) => (
                  <td key={i}><input className={`ms__in${i === 0 ? " ms__num" : ""}`} aria-label={`${r + 1}번째 줄 ${sc.cols[i]}`} value={c} maxLength={40} placeholder="-" disabled={disabled} onChange={(x) => setCell(r, i, x.target.value)} /></td>
                ))}
                <td className="ms__xc">{!disabled && <button type="button" className="btxt ms__x" aria-label={`${r + 1}번째 줄 빼기`} onClick={() => onChange({ ...sc, rows: sc.rows.filter((_, k) => k !== r) })}><X size={14} aria-hidden="true" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 결과 보고 문단 */
export function ReportField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <section aria-labelledby="ms-report">
      <div className="ms__sec"><h2 id="ms-report">결과 보고</h2></div>
      <textarea className="inp ms__ta" aria-labelledby="ms-report" maxLength={1200} value={value} disabled={disabled} placeholder="통계 방법, 보고서 언어와 제출 시기" onChange={(x) => onChange(x.target.value)} />
    </section>
  );
}
