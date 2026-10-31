import Link from "next/link";

type Step = { t: string; s: string; href?: string; go?: string };

/**
 * 역할별 "진행 순서" 안내 (2026-10-31 대표 지시 "어떻게 쓰라는 건지 모르겠다").
 * 홈 첫 장면 바로 아래에 접힌 채로 두고, 처음 쓰는 사람(요청·받은 요청 0건)에게만 펼쳐서 보인다.
 * <details> 라 스크립트 없이 키보드로 열고 닫힌다.
 */
const STEPS: Record<"requester" | "cro" | "admin", { title: string; steps: Step[] }> = {
  requester: {
    title: "견적 요청은 이렇게 진행돼요",
    steps: [
      { t: "요청서 쓰기", s: "독성·효력·약동학·개별 분석 중 하나를 고르고 물질과 시험 항목, 희망 일정을 적어요.", href: "/app/new", go: "새 견적 요청" },
      { t: "기관에 참여 안내", s: "분야가 맞는 기관에 요청 요약이 가요. 회사명과 연락처는 기관을 선택하기 전까지 가려져요." },
      { t: "견적 도착", s: "참여한 기관이 회신 기한까지 항목마다 가능 여부와 금액·기간을 보내요." },
      { t: "비교 보고서", s: "참여한 곳이 모두 내거나 회신 기한이 지나면 열려요. 같은 항목끼리 나란히 볼 수 있어요." },
      { t: "기관 선택", s: "보고서에서 기관의 정식 견적서를 열고 한 곳을 고르면 서로 연락처가 공개돼요. 계약은 기관과 직접 진행해요." },
    ],
  },
  cro: {
    title: "요청 회신은 이렇게 진행돼요",
    steps: [
      { t: "참여 안내 받기", s: "분야가 맞는 요청이 오면 이메일과 알림으로 알려요. 의뢰자 회사명과 연락처는 선정 전까지 가려져요." },
      { t: "참여 정하기", s: "요청 요약을 보고 참여를 누르면 시험물질명, 의뢰자 설명, 첨부가 열려요." },
      { t: "견적 회신", s: "회신 기한까지 항목마다 가능 여부와 금액·기간을 적고, 정식 견적서 PDF를 붙여 제출해요." },
      { t: "선정과 계약", s: "의뢰자가 선택하면 서로 연락처가 공개돼요. 계약을 맺었는지 수주 화면에서 알려 주세요.", href: "/cro/awards", go: "수주" },
      { t: "카탈로그 저장", s: "자주 하는 시험의 금액·기간을 저장해 두면 참여할 때 회신 초안이 채워져요.", href: "/cro/catalog", go: "카탈로그" },
    ],
  },
  admin: {
    title: "운영은 이렇게 돌아가요",
    steps: [
      { t: "접수", s: "첨부 업로드가 끝난 요청은 분야가 맞는 기관에 참여 안내가 자동으로 나가요." },
      { t: "사람 손이 필요한 요청", s: "맞는 기관이 없거나, 참여 기관이 없거나, 기한이 지난 요청은 이 화면의 지금 할 일에 모여요. 요청 화면에서 기관을 고르거나 기한을 늘려요." },
      { t: "기관 가입", s: "기관 화면에서 가입 신청을 확인하고 승인해요.", href: "/admin/cros?status=pending", go: "기관" },
      { t: "계약 확인", s: "기관이 보고한 계약은 수주·계약 화면에서 확인해요.", href: "/admin/awards", go: "수주·계약" },
      { t: "청구", s: "기관이 제출한 견적이 달마다 청구 명세에 모여요.", href: "/admin/billing", go: "청구 명세" },
    ],
  },
};

export function HowItWorks({ role, open = false }: { role: keyof typeof STEPS; open?: boolean }) {
  const g = STEPS[role];
  return (
    <details className="rs-how" open={open}>
      <summary>
        <span>{g.title}</span>
        <span className="rs-how__hint" aria-hidden="true"><span className="rs-how__more">펼쳐 보기</span><span className="rs-how__less">접기</span></span>
      </summary>
      <ol>
        {g.steps.map((s) => (
          <li key={s.t}>
            <b>{s.t}</b>
            <span>{s.s}</span>
            {s.href && <Link href={s.href}>{s.go}</Link>}
          </li>
        ))}
      </ol>
    </details>
  );
}
