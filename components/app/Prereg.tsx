"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";
import "./prereg.css";

/**
 * 사전예약 기간의 새 계정 화면 (2026-11-06 시안 판 15, lib/prereg.ts).
 * 역할 홈과 열리지 않은 화면에서는 대기 화면을, 프로필·기관 정보처럼 열린 화면에서는 원래 화면을 보여 준다.
 * 실제 요청·견적 보내기는 API 에서도 막는다 (app/api/rfq, app/api/rfq/pending).
 */
export function PreregGate({ role, days, reserved, hasOrg, children }: { role: "req" | "cro"; days: number; reserved: boolean; hasOrg?: boolean; children: React.ReactNode }) {
  const path = usePathname() || "/";
  const open = /^\/app\/profile(\/|$)/.test(path) || /^\/cro\/(profile|org)(\/|$)/.test(path);
  if (open) return <>{children}</>;
  return role === "req" ? <PreregReq days={days} reserved={reserved} /> : <PreregCro days={days} reserved={reserved} hasOrg={!!hasOrg} />;
}

function Status({ reserved }: { reserved: boolean }) {
  return reserved
    ? <span className="pr-chip">사전예약 완료</span>
    : <a className="pr-chip pr-chip--go" href="/early">사전예약하기 <CaretRight size={12} aria-hidden="true" /></a>;
}

function Count({ days }: { days: number }) {
  return (
    <p className="pr-count" aria-label={`시범 운영까지 ${days}일, 2027년 6월 1일`}>
      <span>시범 운영까지</span>
      <b className="tnum">{days}일</b>
      <span className="tnum">2027.06.01</span>
    </p>
  );
}

type Tab = "rfq" | "cmp" | "pick" | "lib";
const TABS: { k: Tab; t: string; d: string }[] = [
  { k: "rfq", t: "요청서", d: "한 번의 요청으로 여러 기관에." },
  { k: "cmp", t: "비교표", d: "금액만 비교 마시고 구성도 함께 비교하세요." },
  { k: "pick", t: "선정", d: "선정 전까지 회사명은 비공개로." },
  { k: "lib", t: "자료실", d: "ICH · 식약처 독성시험기준 원문을 확인하세요." },
];

/** 의뢰자 대기 화면: 왼쪽 네 가지를 고르면 오른쪽에 화면 확인용 예시가 바뀐다 */
function PreregReq({ days, reserved }: { days: number; reserved: boolean }) {
  const [tab, setTab] = useState<Tab>("cmp");
  const cur = TABS.find((x) => x.k === tab)!;
  return (
    <section className="pr" aria-labelledby="pr-t">
      <header className="pr-head">
        <div>
          <Status reserved={reserved} />
          <h1 id="pr-t">지금은 사전예약 기간이에요.</h1>
          <p className="pr-sub">시범 운영 전에 단추를 미리 둘러보세요.</p>
        </div>
        <Count days={days} />
      </header>
      <div className="pr-grid">
        <div className="pr-list" role="tablist" aria-label="둘러보기">
          {TABS.map((x) => (
            <button key={x.k} type="button" role="tab" id={`pr-tab-${x.k}`} aria-controls="pr-panel" aria-selected={tab === x.k} className="pr-item" onClick={() => setTab(x.k)}>
              <b>{x.t}</b><span>{x.d}</span>
            </button>
          ))}
        </div>
        <div className="pr-card" role="tabpanel" id="pr-panel" aria-labelledby={`pr-tab-${tab}`}>
          <p className="pr-cap">{cur.d}</p>
          {tab === "rfq" && <ReqPreview />}
          {tab === "cmp" && <CmpPreview />}
          {tab === "pick" && <PickPreview />}
          {tab === "lib" && <LibPreview />}
        </div>
      </div>
    </section>
  );
}

function CardHead({ t, s }: { t: string; s: string }) {
  return <div className="pr-ch"><b>{t}</b><span>{s}</span></div>;
}

function ReqPreview() {
  return (
    <>
      <CardHead t="요청서" s="반복투여독성 13주 · 화면 확인용 예시" />
      <dl className="pr-kv">
        <div><dt>시험</dt><dd>반복투여독성 13주</dd></div>
        <div><dt>동물</dt><dd>랫드</dd></div>
        <div><dt>투여 경로</dt><dd>경구</dd></div>
        <div><dt>보낼 기관</dt><dd>3곳</dd></div>
      </dl>
      <p className="pr-note">요청서 한 장이 고른 기관 모두에게 가요.</p>
      <a className="pr-btn" href="/request">요청서 둘러보기</a>
    </>
  );
}

const CMP: { k: string; v: [string, string, string]; diff?: boolean[] }[] = [
  { k: "총액(원)", v: ["1억 8,500만", "2억 1,000만", "1억 9,800만"] },
  { k: "회복군", v: ["포함", "포함", "별도"], diff: [false, false, true] },
  { k: "TK 분석", v: ["포함", "별도", "포함"], diff: [false, true, false] },
  { k: "보고서", v: ["국문", "국문·영문", "국문"], diff: [false, true, false] },
];

function CmpPreview() {
  return (
    <>
      <CardHead t="비교표" s="반복투여독성 13주 · 화면 확인용 예시" />
      <div className="pr-tbl">
        <table>
          <thead><tr><th scope="col"><span className="sr-only">항목</span></th><th scope="col">기관 A</th><th scope="col">기관 B</th><th scope="col">기관 C</th></tr></thead>
          <tbody>
            {CMP.map((r) => (
              <tr key={r.k}><th scope="row">{r.k}</th>{r.v.map((v, i) => <td key={i} data-diff={r.diff?.[i] || undefined}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pr-note"><mark>노란 칸</mark>이 기관마다 다른 부분이에요.</p>
      <a className="pr-btn" href="/#cmp">예시 비교표 열기</a>
    </>
  );
}

function PickPreview() {
  return (
    <>
      <CardHead t="선정" s="화면 확인용 예시" />
      <dl className="pr-kv">
        <div><dt>견적 받는 동안</dt><dd>회사명 비공개</dd></div>
        <div><dt>기관 선정 뒤</dt><dd>선정한 기관에만 공개</dd></div>
      </dl>
    </>
  );
}

function LibPreview() {
  return (
    <>
      <CardHead t="자료실" s="공식 원문 링크" />
      <dl className="pr-kv">
        <div><dt>ICH</dt><dd>M3 · S 시리즈</dd></div>
        <div><dt>식약처</dt><dd>독성시험기준</dd></div>
        <div><dt>OECD</dt><dd>시험 지침 (TG)</dd></div>
      </dl>
      <a className="pr-btn" href="/guide/library">자료실 열기</a>
    </>
  );
}

const PREP_KEY = "danchu.prereg.cro";
const PREP: { k: string; t: string; d: string; href: string }[] = [
  { k: "org", t: "기관 정보 등록", d: "견적 보낼 시험과 설비를 적어두세요.", href: "/cro/org" },
  { k: "sample", t: "예시 요청서 보기", d: "의뢰자의 요청서를 미리 확인하세요.", href: "/for-cro#st" },
  { k: "terms", t: "이용 조건 확인", d: "2027년 말까지 무료로 이용해보세요.", href: "/terms/cro" },
];

/** 기관 대기 화면: 미리 준비하기 세 가지. 본 항목은 이 브라우저에 기억한다 (기관 정보는 등록 여부로) */
function PreregCro({ days, reserved, hasOrg }: { days: number; reserved: boolean; hasOrg: boolean }) {
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    try { setSeen(JSON.parse(localStorage.getItem(PREP_KEY) || "[]")); } catch { /* 저장소를 못 쓰면 비운 채로 */ }
  }, []);
  const isDone = (k: string) => (k === "org" ? hasOrg : seen.includes(k));
  const doneN = PREP.filter((p) => isDone(p.k)).length;
  function mark(k: string) {
    if (k === "org") return;
    const n = Array.from(new Set([...seen, k]));
    setSeen(n);
    try { localStorage.setItem(PREP_KEY, JSON.stringify(n)); } catch { /* 저장 실패는 넘어간다 */ }
  }
  return (
    <section className="pr pr--cro" aria-labelledby="pr-t">
      <Count days={days} />
      <div className="pr-cro-t">
        <Status reserved={reserved} />
        <h1 id="pr-t">지금은 사전예약 기간이에요.</h1>
        <p className="pr-sub">6월 1일부터 들어오는 요청에 견적을 보내보세요.</p>
      </div>
      <div className="pr-prep">
        <p className="pr-prep-h"><b>미리 준비하기</b><span className="tnum" aria-label={`3개 중 ${doneN}개 완료`}>{doneN}/3</span></p>
        <ul>
          {PREP.map((p) => (
            <li key={p.k}>
              <Link href={p.href} className="pr-step" data-done={isDone(p.k) || undefined} onClick={() => mark(p.k)}>
                <i aria-hidden="true" />
                <span><b>{p.t}</b><small>{p.d}</small></span>
                <CaretRight size={16} aria-hidden="true" />
                {isDone(p.k) && <span className="sr-only">완료</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link className="pr-go" href="/cro/org">{hasOrg ? "기관 정보 보기" : "기관 정보 등록하기"}</Link>
    </section>
  );
}
