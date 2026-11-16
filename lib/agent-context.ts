/**
 * 견적 에이전트가 사람 승인 뒤 단추에 쓰는 동안의 문맥 (연동 4·5단계).
 *
 * 에이전트 입구(/api/agent/*)는 사용자의 토큰으로 세션을 만든 다음, 단추 웹의 라우트 처리를 그대로 부른다.
 * 그동안 getSession()은 쿠키 대신 이 세션을 돌려주고, 기록(rfq_events 등)은 via='agent'로 남는다.
 * 검증·권한·알림·청구 규칙은 웹과 같은 코드를 지나므로 따로 만들지 않는다.
 */
import type { AsyncLocalStorage as ALS } from "node:async_hooks";
import type { Session } from "./auth";
import type { Via } from "./db-types";

type AgentCtx = { session: Session };

// lib/auth.ts 가 화면 묶음에도 끌려 들어가므로 node:async_hooks 를 정적으로 가져오지 않는다.
// 서버(Node)에서는 Next 가 올려 둔 전역 또는 내장 모듈을 쓰고, 브라우저에서는 없음(항상 web).
function makeStore(): ALS<AgentCtx> | null {
  const g = globalThis as { AsyncLocalStorage?: typeof ALS };
  const proc = typeof process === "undefined" ? undefined : (process as { getBuiltinModule?: (id: string) => unknown });
  const Ctor = g.AsyncLocalStorage ?? (proc?.getBuiltinModule?.("node:async_hooks") as { AsyncLocalStorage?: typeof ALS } | undefined)?.AsyncLocalStorage;
  return Ctor ? new Ctor<AgentCtx>() : null;
}
const store = makeStore();

/** 에이전트 입구에서 부른 처리 중이면 그 세션 */
export function agentContext(): AgentCtx | null {
  return store?.getStore() ?? null;
}

/** 지금 쓰는 기록의 출처 */
export function currentVia(): Via {
  return store?.getStore() ? "agent" : "web";
}

/** fn 안에서는 session 으로 로그인한 것처럼, 기록은 에이전트에서 처리한 것으로 */
export function runAsAgent<T>(session: Session, fn: () => Promise<T>): Promise<T> {
  if (!store) throw new Error("agent context unavailable");
  return store.run({ session }, fn);
}
