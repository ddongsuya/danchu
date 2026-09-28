import { FAQ, type Faq } from "@/lib/faq";

/** 자주 묻는 질문 목록. 가는 선으로 나눈 details */
export function FaqList({ items = FAQ }: { items?: Faq[] }) {
  return (
    <div className="faq">
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <div className="faq__a">
            {f.a.map((p) => <p key={p}>{p}</p>)}
          </div>
        </details>
      ))}
    </div>
  );
}
