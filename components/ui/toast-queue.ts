/**
 * 토스트 줄 (시안 v7 상호작용 규칙 3·4절). 화면 없이 시험할 수 있게 상태 변화만 모은다.
 * 결과 알림은 2.4초, 실행 취소나 다른 행동이 붙었거나 실패 알림이면 5초. 마우스·포커스가 올라가 있으면 멈춘다(Toast.tsx).
 */
export type ToastTone = "status" | "error";
export type ToastAction = { label: string; onClick: () => void };
export type ToastItem = { id: number; message: string; tone: ToastTone; action?: ToastAction; leaving?: boolean };
export type ToastEvent = { type: "add"; toast: ToastItem } | { type: "leave"; id: number } | { type: "remove"; id: number };

/** 한 번에 보이는 토스트 수. 넘치면 가장 오래된 것부터 뺀다 */
export const MAX_TOASTS = 3;
export const TOAST_MS = 2400;
export const TOAST_LONG_MS = 5000;
/** 사라지는 전환 시간. 이 시간 뒤에 줄에서 지운다 */
export const TOAST_LEAVE_MS = 180;

export function toastReducer(list: ToastItem[], ev: ToastEvent): ToastItem[] {
  switch (ev.type) {
    case "add":
      return [...list, ev.toast].slice(-MAX_TOASTS);
    case "leave":
      return list.map((t) => (t.id === ev.id && !t.leaving ? { ...t, leaving: true } : t));
    case "remove":
      return list.filter((t) => t.id !== ev.id);
  }
}

export function toastDuration(t: Pick<ToastItem, "tone" | "action">): number {
  return t.action || t.tone === "error" ? TOAST_LONG_MS : TOAST_MS;
}

/** 오래 걸리는 요청의 기한. fetch 에 signal: AbortSignal.timeout(LONG_ACTION_TIMEOUT_MS) 로 붙인다 */
export const LONG_ACTION_TIMEOUT_MS = 30_000;

/**
 * 실패 문구: 무엇이 안 됐는지 + 어떻게 다시 할지. 시간 초과와 연결 끊김은 서버 문구 대신 원인을 말한다.
 * fallback 은 서버가 이유를 주지 않았을 때 쓰는 문장.
 */
export function failureText(e: unknown, fallback: string): string {
  const name = e instanceof Error || (typeof DOMException !== "undefined" && e instanceof DOMException) ? (e as Error).name : "";
  if (name === "TimeoutError") return "응답이 30초 넘게 없어 멈췄습니다. 잠시 뒤 다시 시도하세요.";
  if (name === "TypeError") return "서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.";
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
