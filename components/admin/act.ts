import { LONG_ACTION_TIMEOUT_MS } from "@/components/ui/toast-queue";

export type AdminReply = { message?: string; error?: string; [k: string]: unknown };

/**
 * 운영자 동작 요청 (시안 검토판 확인창). 실패하면 Error 를 던지고, 확인창(useConfirm action)이 그 문장을 창 안에 보여 준다.
 * 서버가 이유를 주면 그 문장을, 아니면 화면이 넘긴 fallback("…하지 못했어요. … 그대로예요.")을 쓴다. 연결 끊김·시간 초과도 fallback.
 */
export async function adminPost(url: string, body: unknown, fallback: string, method: "POST" | "DELETE" | "PATCH" = "POST"): Promise<AdminReply> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(LONG_ACTION_TIMEOUT_MS),
    });
  } catch {
    throw new Error(fallback);
  }
  const d = (await res.json().catch(() => ({}))) as AdminReply;
  if (!res.ok) throw new Error(d.error || fallback);
  return d;
}

/** 받침 있는 말 뒤에는 앞 조사, 없으면 뒤 조사. 예: josa("예시 기관 E", "을", "를") → "예시 기관 E를". 영문·숫자 끝은 읽는 소리로 본다 */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  return `${word}${hasFinal(word) ? withFinal : withoutFinal}`;
}

// 영문 글자·숫자를 한국어로 읽을 때 받침이 있는 것 (L M N R, 0 1 3 6 7 8)
const FINAL_LATIN = /[lmnr013678@]$/i;

export function hasFinal(word: string): boolean {
  const w = word.trim().replace(/[)\]'"\s.]+$/, "");
  const c = w.charCodeAt(w.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  return FINAL_LATIN.test(w);
}

/** 조사만. 예: `'${q}'${particle(q, "과", "와")} 맞는 …` */
export function particle(word: string, withFinal: string, withoutFinal: string): string {
  return hasFinal(word) ? withFinal : withoutFinal;
}
