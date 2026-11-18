import { StudyMark } from "@/components/site/StudyMark";
import { KINDS, type Kind } from "@/lib/study-kinds";

const ORDER: Kind[] = ["tox", "pd", "pk", "other"];
/** 띠에서는 3D 구 장면을 빼고 용어 → 한 줄 → 웰 플레이트만 (2026-11-18 사용자 요청) */
const SCENES = ["word", "line", "plate"];
const SUB: Record<Kind, string> = { tox: "독성", pd: "효력", pk: "약동학", other: "개별 분석" };

/** 랜딩 첫 화면 아래: 견적 받을 수 있는 네 갈래. 견적 요청 첫 화면과 같은 그래픽, 누르면 각 갈래 화면으로 */
export function KindStrip() {
  return (
    <nav className="kst" id="fields" aria-label="견적 받을 수 있는 시험">
      <span className="lbl mono lab">이런 시험의 견적을 받아보세요</span>
      <ul>
        {ORDER.map((k) => (
          <li key={k}>
            <a href={`/request/${k}`}>
              <StudyMark kind={k} className="kmk" scenes={SCENES} />
              <span><b>{KINDS[k].tag}</b><small>{SUB[k]}</small></span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
