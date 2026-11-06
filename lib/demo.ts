import type { Role } from "./auth";

/**
 * 개발 단계 임시 장치: 로그인 없이 의뢰자·기관·운영자 화면을 본다.
 *
 * - DANCHU_DEMO_LOGIN=1 이고 운영 배포(VERCEL_ENV=production)가 아닐 때만 켜진다. danchu.kr 에서는 어떤 설정으로도 켜지지 않는다.
 * - /demo?as=requester|cro|admin 이 쿠키를 심고, getSession 이 그 역할의 기존 계정 하나를 세션처럼 돌려준다.
 * - 저장은 막는다: proxy 가 쓰기 API(POST/PUT/PATCH/DELETE)를 403 으로 돌려준다 (로그아웃은 예외).
 * - 끄려면 /demo?off=1. 출시 전에 이 파일과 /demo 경로를 지운다.
 */
export const DEMO_COOKIE = "danchu_demo";
/** 미리보기에서 사전예약 대기 화면으로 보기 (/demo?as=requester&prereg=1) */
export const DEMO_PREREG_COOKIE = "danchu_demo_prereg";
export const DEMO_ROLES: Role[] = ["requester", "cro", "admin"];

export function demoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DANCHU_DEMO_LOGIN === "1" && env.VERCEL_ENV !== "production";
}

export function isDemoRole(v: unknown): v is Role {
  return typeof v === "string" && (DEMO_ROLES as string[]).includes(v);
}

/** 미리보기 세션의 안내 문구. 쓰기 API 가 403 과 함께 돌려주는 말과 같다 */
export const DEMO_READONLY = "미리보기에서는 저장할 수 없어요. 화면만 확인하는 임시 계정입니다.";
