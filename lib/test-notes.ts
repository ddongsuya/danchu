/**
 * 비교 보고서 맨 끝 "시험 설명과 근거" (2026-10-29 대표 지시). 견적에 들어간 시험이 무엇을 보는지 한두 문장과 공개 가이드라인 근거.
 * 참고 자료다. 단추가 설계를 정하지 않으며 실제 설계는 기관의 견적서와 시험계획서로 확인한다.
 * 근거는 공개 문서(ICH, 식약처 고시, OECD TG)만 쓴다. 화면에는 components/Cite.tsx 가 짧게 줄여 보여 준다.
 */

export type TestNote = { key: string; title: string; what: string; basis: string };

/** 항목 이름에 맞는 첫 규칙을 쓴다. 더 구체적인 규칙을 앞에 둔다 */
const NOTES: (TestNote & { match: RegExp })[] = [
  { key: "drf", match: /용량결정|DRF|pEFD/, title: "용량결정시험", what: "본시험의 고용량과 용량 간격을 정하려고 먼저 하는 예비시험이에요. 보통 Non-GLP로 해요.", basis: "ICH M3(R2) · 식약처 「의약품등의 독성시험기준」" },
  { key: "single", match: /단회|급성/, title: "단회투여 독성", what: "한 번 투여했을 때 나타나는 독성 양상과 개략의 치사량을 봐요. 다른 시험에서 정보를 얻었다면 생략하기도 해요.", basis: "식약처 「의약품등의 독성시험기준」 · ICH M3(R2)" },
  { key: "repeat", match: /반복투여/, title: "반복투여 독성", what: "여러 번 투여했을 때의 독성과 표적 장기, 무독성량(NOAEL)을 봐요. 투여 기간은 계획한 임상 기간에 맞추고, 회복군으로 회복 여부도 확인해요.", basis: "ICH M3(R2) · 식약처 「의약품등의 독성시험기준」" },
  { key: "ames", match: /복귀돌연변이|Ames/i, title: "복귀돌연변이(Ames)", what: "세균에서 유전자 돌연변이를 일으키는지 봐요. 유전독성 기본 조합의 첫 시험이에요.", basis: "ICH S2(R1) · OECD TG 471" },
  { key: "ca", match: /염색체이상/, title: "염색체이상", what: "포유류 배양세포에서 염색체 구조에 이상을 만드는지 봐요.", basis: "ICH S2(R1) · OECD TG 473" },
  { key: "mn-vivo", match: /소핵 in vivo|소핵\s*\(?(마우스|랫드)/, title: "소핵(체내)", what: "동물에 투여한 뒤 골수나 말초혈액 적혈구에 소핵이 생기는지 봐요. 몸 안에서 유전독성을 확인하는 시험이에요.", basis: "ICH S2(R1) · OECD TG 474" },
  { key: "mn-vitro", match: /소핵/, title: "소핵(체외)", what: "배양세포에서 염색체 손상이나 수 이상으로 소핵이 생기는지 봐요.", basis: "ICH S2(R1) · OECD TG 487" },
  { key: "comet", match: /Comet|코멧/i, title: "Comet", what: "조직 세포의 DNA 가닥 손상을 직접 봐요. 체내 유전독성의 두 번째 시험으로 쓰기도 해요.", basis: "ICH S2(R1) · OECD TG 489" },
  { key: "herg", match: /hERG/i, title: "hERG", what: "심장 재분극(QT 간격)에 영향을 줄 수 있는지 이온 채널에서 미리 봐요.", basis: "ICH S7B" },
  { key: "cv", match: /심혈관|Telemetry/i, title: "심혈관계 안전성약리", what: "비설치류에서 혈압, 심박수, 심전도를 연속으로 재요. 안전성약리 기본 조합의 하나예요.", basis: "ICH S7A · ICH S7B" },
  { key: "cns", match: /중추신경|Irwin|FOB/i, title: "중추신경계 안전성약리", what: "행동, 운동 협조, 반사, 체온 같은 신경계 기능 변화를 관찰해요.", basis: "ICH S7A" },
  { key: "resp", match: /호흡/, title: "호흡계 안전성약리", what: "호흡수와 1회 호흡량 같은 호흡 기능 변화를 재요.", basis: "ICH S7A" },
  { key: "tk", match: /TK|독성동태/, title: "독성동태(TK)", what: "독성시험 중 혈중 농도를 재서, 독성이 어느 노출량에서 나왔는지 해석할 수 있게 해요.", basis: "ICH S3A" },
  { key: "pk", match: /^PK|약물동태|ADME|물질수지|조직분포/, title: "약물동태(PK·ADME)", what: "흡수, 분포, 대사, 배설을 봐서 동물과 사람의 노출을 비교하는 근거를 만들어요.", basis: "ICH M3(R2) · ICH S3A" },
  { key: "fertility", match: /수태능|Seg\.?\s*I\b/, title: "수태능·초기배발생", what: "교배 전후 투여로 생식 능력과 착상까지의 초기 발생에 미치는 영향을 봐요.", basis: "ICH S5(R3)" },
  { key: "efd", match: /배·태자|Seg\.?\s*II\b/, title: "배·태자 발생", what: "임신 중 투여로 태자의 발생 이상과 기형 유발 여부를 봐요.", basis: "ICH S5(R3)" },
  { key: "ppnd", match: /출생전후|Seg\.?\s*III/, title: "출생 전후 발생", what: "임신 후기부터 수유기까지 투여해 새끼의 성장과 발달을 봐요.", basis: "ICH S5(R3)" },
  { key: "sens", match: /감작/, title: "피부감작성", what: "반복 노출로 알레르기성 피부 반응을 일으키는지 봐요.", basis: "OECD TG 406 · OECD TG 429 · OECD TG 442" },
  { key: "irrit", match: /자극|부식/, title: "자극성", what: "피부나 눈, 점막에 닿았을 때 자극이나 손상을 일으키는지 봐요.", basis: "OECD TG 404 · OECD TG 405 · OECD TG 439" },
  { key: "photo", match: /광독성|광감작|광반응/, title: "광독성", what: "빛을 받았을 때 독성이나 알레르기 반응이 생기는지 봐요.", basis: "ICH S10 · OECD TG 432" },
  { key: "immuno", match: /면역독성|TDAR|면역표현형/, title: "면역독성", what: "면역 기능이 억제되거나 지나치게 활성되는지 봐요.", basis: "ICH S8" },
  { key: "carc", match: /발암|종양원성/, title: "발암성", what: "장기간 투여했을 때 종양이 생기는지 봐요.", basis: "ICH S1A · ICH S1B" },
];

export function noteFor(name: string): TestNote | null {
  const n = NOTES.find((x) => x.match.test(name));
  return n ? { key: n.key, title: n.title, what: n.what, basis: n.basis } : null;
}

/** 보고서에 넣을 설명: 같은 설명은 한 번만, 항목 순서대로 */
export function notesFor(names: string[]): (TestNote & { items: string[] })[] {
  const out = new Map<string, TestNote & { items: string[] }>();
  for (const name of names) {
    const n = noteFor(name);
    if (!n) continue;
    const prev = out.get(n.key);
    if (prev) prev.items.push(name);
    else out.set(n.key, { ...n, items: [name] });
  }
  return [...out.values()];
}
