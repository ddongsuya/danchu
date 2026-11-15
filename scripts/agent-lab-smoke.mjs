import assert from "node:assert/strict";

const base = process.env.DANCHU_AGENT_LAB_URL || "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname)) throw new Error("This synthetic smoke test only runs against a local development server.");
let cookie = "";
async function request(role, body) {
  const response = await fetch(`${base}/api/agent-lab?role=${role}`, {
    method: body ? "POST" : "GET",
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json", Origin: new URL(base).origin } : {}) },
    body: body ? JSON.stringify({ ...body, role }) : undefined,
    signal: AbortSignal.timeout(75000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await response.json();
  assert.equal(response.status, 200, data.error || "Test API failed");
  return data;
}
const say = (role, message) => request(role, { action: "message", message });
async function approve(role, data) {
  assert.ok(data.approval, `Expected an approval for ${role}`);
  return request(role, { action: "approval", approvalId: data.approval.id, approve: true });
}
const log = step => console.log(JSON.stringify({ step, passed: true }));

await request("requester");
let data = await say("requester", "테스트 요청서 초안을 저장해 줘. 제목 혈청 임상생화학 분석, 분야 other, 검체 혈청, 30개, ALT·AST·BUN·CREA 각각 분석, 희망 완료일 2026-12-10, 국문 결과 요약 필요. 빠진 조건은 없으니 초안만 저장해 줘. 아직 전달하지 마.");
assert.equal(data.view.draft?.samples, 30);
assert.deepEqual(data.view.draft?.items, ["ALT", "AST", "BUN", "CREA"]);
assert.equal(data.view.request, null);
assert.equal((await request("cro-a")).view.request, null);
log("request draft remains private");
data = await say("requester", "작성한 초안을 두 예시 기관에 전달할게. 전송 확인 화면을 열어 줘.");
assert.equal(data.view.request, null);
assert.ok(data.approval);
data = await request("requester", { action: "approval", approvalId: data.approval.id, approve: false });
assert.equal(data.view.request, null);
assert.equal(data.approval, null);
log("rejected approval leaves the request private");
data = await say("requester", "이제 이 요청서를 두 예시 기관에 전달할게. 전송 확인 화면을 다시 열어 줘.");
data = await approve("requester", data);
assert.ok(data.view.request);
log("request transmission requires approval");

for (const [role, total] of [["cro-a", 660000], ["cro-b", 600000]]) {
  data = await request(role);
  assert.equal("material" in data.view.request, false);
  data = await say(role, "이 테스트 요청에 참여할게. 참여 동의 확인 화면을 열어 줘.");
  assert.equal(data.view.joined, false);
  data = await approve(role, data);
  assert.equal(data.view.joined, true);
  assert.equal(data.view.request.material, "혈청");
  log(`${role}: participation approval unlocks request`);
  data = await say(role, "현재 우리 기관 예시 카탈로그로 견적 초안을 작성해 줘. 사용자가 제공한 검체 수와 항목 그대로 계산해. 포함되지 않은 보고서는 별도라고 표시하고 제출하지 마.");
  assert.equal(data.view.quoteDraft?.total, total);
  assert.equal(data.view.ownQuote, null);
  data = await say(role, "견적 초안을 검토했어. 이 견적을 의뢰자에게 제출할 수 있게 승인 화면을 열어 줘.");
  assert.equal(data.view.ownQuote, null);
  data = await approve(role, data);
  assert.equal(data.view.ownQuote?.total, total);
  assert.deepEqual(data.view.comparison, []);
  log(`${role}: deterministic quotation and approved submission`);
  const requester = await request("requester");
  assert.equal(requester.view.comparisonOpen, role === "cro-b");
}
data = await say("requester", "공개된 견적의 금액, 기간, 결과 요약 포함 여부를 비교해 줘. 기관 순위는 정하지 마.");
assert.deepEqual(data.view.comparison.map(q => q.total), [660000, 600000]);
assert.equal(data.view.chat.at(-1)?.from, "agent");
log("requester compares only after both submissions");
console.log(JSON.stringify({ complete: true, compared_totals: data.view.comparison.map(q => q.total), roles: 3, production_writes: 0 }));
