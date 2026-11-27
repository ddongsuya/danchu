import { EmptyState } from "@/components/ui/EmptyState";

/** 토큰이 없거나 바뀐 회신 링크 (시안 v7 q-expired). 메일의 링크는 새로 보낼 때마다 바뀌므로 가장 최근 메일을 열어 보게 한다 */
export default function TokenNotFound() {
  return (
    <div className="q-center">
      <EmptyState title="이 링크로는 요청을 열 수 없어요" action={<a className="b1 bsm" href="/login?next=/cro">로그인</a>}>
        링크가 바뀌었거나 만료됐어요. 가장 최근 메일의 링크로 다시 열거나 로그인해 주세요.
      </EmptyState>
      <p className="q-state__foot">문의 <a href="mailto:support@danchu.kr">support@danchu.kr</a></p>
    </div>
  );
}
