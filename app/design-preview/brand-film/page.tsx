import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandFilm } from "@/components/site/BrandFilm";
import { BRAND_FILMS, FILM_IDS, FILM_RATIOS, isFilmId, isFilmRatio, type FilmId, type FilmRatio } from "@/lib/brand-film";
import { ThemeLock } from "./ThemeLock";
import "./brand-film-preview.css";

export const metadata: Metadata = { title: "단추 브랜드 필름 검토", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Query = { film?: string; ratio?: string; theme?: string; t?: string; bare?: string; variant?: string };

const FILM_LABEL: Record<FilmId, string> = { mark: "B안 「단추를 채우다」", lab: "C안 「첫 단추」" };

/** 대표 검토 자료: 안마다 알려진 위험과 함께 볼 대안 */
const FILM_NOTES: Record<FilmId, string[]> = {
  mark: [],
  lab: [
    "알려진 위험: 실험실 사진이 이어져 단추가 직접 시험하는 회사로 읽힐 수 있습니다. 첫 문장에 비임상과 견적을 넣고, 컷3 문장은 흐린 플레이트 위로 옮기고, 마크 뒤에 채우기 동작을 붙여 줄였지만 위험은 남아 있습니다.",
    "함께 볼 첫 문장 대안: \"시험을 맡기기 전, 첫 단추가 있습니다.\" (맡기는 쪽 관점)",
    "세로(9:16)·정사각 배경은 가로 이미지를 줄여 쓴 임시 구성입니다. 세로 구도 이미지는 대표 검토 뒤 따로 생성합니다.",
  ],
};

/**
 * 브랜드 필름 디자인 검토 화면. DANCHU_DESIGN_PREVIEW=1 에서만 열린다. 운영 페이지에는 아직 없다.
 * ?film=mark|lab &ratio=16x9|9x16|1x1|4x5 &theme=light|dark &t=초(그 장면에 멈춤) &bare=1(무대만, 캡처용)
 * &variant=ink (C안 비교: 스크림 없이 진한 글자)
 */
export default async function BrandFilmPreview({ searchParams }: { searchParams: Promise<Query> }) {
  if (process.env.DANCHU_DESIGN_PREVIEW !== "1") notFound();
  const q = await searchParams;
  const film: FilmId = isFilmId(q.film) ? q.film : "mark";
  const ratio: FilmRatio | undefined = isFilmRatio(q.ratio) ? q.ratio : undefined;
  const theme = q.theme === "dark" || q.theme === "light" ? q.theme : undefined;
  const variant = q.variant === "ink" ? "ink" : undefined;
  const t = q.t !== undefined && q.t !== "" && Number.isFinite(Number(q.t)) ? Number(q.t) : undefined;

  if (q.bare === "1") {
    return (
      <div className="bfp-bare">
        {theme && <ThemeLock theme={theme} />}
        <BrandFilm key={film} film={film} ratio={ratio} seek={t} controls={false} fill variant={variant} />
      </div>
    );
  }

  const href = (patch: Partial<Query>) => {
    const next: Record<string, string> = {};
    const merged: Query = { film, ratio, theme, variant, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next[k] = v;
    return `/design-preview/brand-film?${new URLSearchParams(next).toString()}`;
  };

  return (
    <main className="bfp">
      {theme && <ThemeLock theme={theme} />}
      <header className="bfp__head">
        <h1>브랜드 필름</h1>
        <p>디자인 검토용. 운영 페이지에는 아직 없음.</p>
        <nav aria-label="필름 고르기" className="bfp__nav">
          {FILM_IDS.map((id) => (
            <Link key={id} href={href({ film: id })} aria-current={id === film ? "page" : undefined}>{FILM_LABEL[id]}</Link>
          ))}
        </nav>
        <nav aria-label="비율과 테마" className="bfp__nav bfp__nav--sub">
          <Link href={href({ ratio: undefined })} aria-current={!ratio ? "true" : undefined}>자동</Link>
          {FILM_RATIOS.map((r) => (
            <Link key={r} href={href({ ratio: r })} aria-current={ratio === r ? "true" : undefined}>{r.replace("x", ":")}</Link>
          ))}
          <span aria-hidden="true" className="bfp__sep" />
          <Link href={href({ theme: "light" })} aria-current={theme === "light" ? "true" : undefined}>라이트</Link>
          <Link href={href({ theme: "dark" })} aria-current={theme === "dark" ? "true" : undefined}>다크</Link>
          {film === "lab" && (
            <>
              <span aria-hidden="true" className="bfp__sep" />
              <Link href={href({ variant: undefined })} aria-current={!variant ? "true" : undefined}>스크림 글자</Link>
              <Link href={href({ variant: "ink" })} aria-current={variant ? "true" : undefined}>진한 글자(비교)</Link>
            </>
          )}
        </nav>
      </header>
      {/* t 가 있으면 그 장면의 정지 화면만(재생 제어 없음) */}
      <BrandFilm key={`${film}-${ratio ?? "auto"}-${variant ?? ""}`} film={film} ratio={ratio} seek={t} controls={t === undefined} variant={variant} />
      <p className="bfp__meta">{BRAND_FILMS[film].title} · {BRAND_FILMS[film].durationSec}초 · 화면에 절반 이상 보이면 한 번 재생하고 마지막 장면에서 멈춥니다.</p>
      {FILM_NOTES[film].length > 0 && (
        <ul className="bfp__notes">
          {FILM_NOTES[film].map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </main>
  );
}
