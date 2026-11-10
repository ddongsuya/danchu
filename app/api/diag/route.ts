import { NextResponse } from "next/server";
import { clientIp, rateLimited } from "@/lib/rate-limit";

/**
 * 공개 페이지 첫 제목 점검 기록(HeadWatch)을 받아 서버 로그에 남긴다.
 * 개인 정보는 받지 않는다(화면 크기·스크롤 위치·제목 위치·브라우저 종류만). 4KB를 넘으면 버린다.
 * 누구나 부를 수 있어서 IP 당 1분 60번으로 묶는다 (로그를 채우는 남용 방지).
 */
export async function POST(req: Request) {
  if (await rateLimited("diag", clientIp(req), 60, 60)) return new NextResponse(null, { status: 429 });
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
