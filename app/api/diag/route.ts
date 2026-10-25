import { NextResponse } from "next/server";

/**
 * 공개 페이지 첫 제목 점검 기록(HeadWatch)을 받아 서버 로그에 남긴다.
 * 개인 정보는 받지 않는다(화면 크기·스크롤 위치·제목 위치·브라우저 종류만). 4KB를 넘으면 버린다.
 */
export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 4096) return new NextResponse(null, { status: 413 });
    const body = JSON.parse(text);
    console.log("[head-diag]", JSON.stringify(body));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
