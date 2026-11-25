"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageSkeleton } from "@/components/shell/PageSkeleton";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STATES = ["기본", "올림", "누름", "키보드 선택", "쓸 수 없음", "처리 중", "완료", "실패"];

/** 정지 화면으로 각 상태를 그린다. 올림·누름·키보드 선택은 실제 규칙과 같은 값을 직접 입힌다 */
function StateRow({ name, cls, label, done }: { name: string; cls: string; label: string; done: string }) {
  const hover: React.CSSProperties = cls.includes("b1") ? { background: cls.includes("danger") ? "color-mix(in srgb, var(--err) 86%, var(--ink))" : "var(--brand-dark)" } : { borderColor: cls.includes("danger") ? "var(--err)" : "var(--ink)" };
  return (
    <tr>
      <th scope="row">{name}</th>
      <td><button type="button" className={cls} tabIndex={-1}>{label}</button></td>
      <td><button type="button" className={cls} tabIndex={-1} style={hover}>{label}</button></td>
      <td><button type="button" className={cls} tabIndex={-1} style={{ transform: "scale(.97)" }}>{label}</button></td>
      <td><button type="button" className={cls} tabIndex={-1} style={{ outline: "2px solid var(--ink)", outlineOffset: 2 }}>{label}</button></td>
      <td><button type="button" className={cls} tabIndex={-1} disabled>{label}</button></td>
      <td><button type="button" className={`${cls} is-loading`} tabIndex={-1} aria-busy="true">{label}</button></td>
      <td><button type="button" className={`${cls} is-done`} tabIndex={-1}>{done}</button></td>
      <td><button type="button" className={`${cls} is-error`} tabIndex={-1}>다시 시도</button></td>
    </tr>
  );
}

export function IxDemo() {
  const toast = useToast();
  const confirm = useConfirm();
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState(["DC-2026-0031 반복투여 독성", "DC-2026-0029 유전독성 3종"]);
  const [skel, setSkel] = useState(0);
  const [answer, setAnswer] = useState("");

  const save = async () => { await wait(900); toast("저장했습니다"); };
  const fail = async () => {
    await wait(900);
    setFailed(true);
    toast("저장하지 못했습니다. 입력한 내용은 그대로 있습니다. 다시 시도하세요.", { tone: "error" });
  };
  const remove = (i: number) => {
    const before = rows;
    setRows(rows.filter((_, j) => j !== i));
    toast("목록에서 뺐습니다", { undo: () => setRows(before) });
  };

  return (
    <div className="ixp">
      <div className="ph"><div><h1>상호작용 규칙</h1><p>시안 v7의 버튼 상태, 처리 중, 토스트, 확인 창, 빈 화면과 오류 화면, 불러오기 뼈대를 실제 컴포넌트로 확인합니다. 저장되지 않는 검토용 화면입니다.</p></div></div>

      <section className="card card--pad ixp__sec" aria-labelledby="ix-states">
        <h2 id="ix-states">버튼의 8가지 상태</h2>
        <div className="tbl-wrap">
          <table className="tbl ixp__grid">
            <thead><tr><th scope="col"><span className="sr-only">버튼</span></th>{STATES.map((s) => <th key={s} scope="col">{s}</th>)}</tr></thead>
            <tbody>
              <StateRow name="기본 버튼" cls="b1 bsm" label="회신 보내기" done="보냄" />
              <StateRow name="보조 버튼" cls="b2 bsm" label="초안 저장" done="저장됨" />
              <StateRow name="위험 버튼" cls="b2 bsm b2--danger" label="삭제" done="삭제됨" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card--pad ixp__sec" aria-labelledby="ix-try">
        <h2 id="ix-try">직접 눌러 보기</h2>
        <p className="ixp__note">누르는 순간 0.97배로 작아지고, 처리 중에는 글자 대신 진행 표시가 돌며 너비는 그대로입니다. 두 번 눌러도 한 번만 처리됩니다.</p>
        <div className="ixp__row">
          <Button className="b2" onClick={save}>초안 저장</Button>
          <Button className="b1" onClick={async () => { await wait(900); toast("보냈습니다"); }}>회신 보내기</Button>
          <Button className={failed ? "b2 is-error" : "b2"} onClick={() => { setFailed(false); return fail(); }}>{failed ? "다시 시도" : "실패 예시"}</Button>
        </div>
        {failed && <p className="ix-msg ix-msg--err" role="alert">저장하지 못했습니다. 입력한 내용은 그대로 있습니다.</p>}
        <ul className="ixp__list">
          {rows.map((r, i) => (
            <li key={r}><span>{r}</span><button type="button" className="btxt" onClick={() => remove(i)}>빼기</button></li>
          ))}
          {rows.length === 0 && <li><span className="ix-msg">모두 뺐습니다. 토스트의 실행 취소로 되돌릴 수 있습니다.</span></li>}
        </ul>
      </section>

      <section className="card card--pad ixp__sec" aria-labelledby="ix-dialog">
        <h2 id="ix-dialog">확인 창</h2>
        <p className="ixp__note">넓은 화면은 가운데 창, 휴대폰은 아래 시트입니다. Esc나 바깥 누르기는 취소이고, 닫히면 연 버튼으로 포커스가 돌아갑니다. 키보드로 열면 움직이지 않습니다.</p>
        <div className="ixp__row">
          <button type="button" className="b2" onClick={async () => setAnswer((await confirm({ title: "DC-2026-0029 요청에 참여하시겠습니까?", body: "참여하면 회신 기한까지 견적을 보내야 합니다.", confirmLabel: "참여" })) ? "참여를 골랐습니다" : "취소했습니다")}>참여 확인 열기</button>
          <button type="button" className="b2 b2--danger" onClick={async () => setAnswer((await confirm({ title: "이 견적서를 삭제하시겠습니까?", body: "삭제하면 되돌릴 수 없습니다.", confirmLabel: "삭제", danger: true })) ? "삭제를 골랐습니다" : "취소했습니다")}>삭제 확인 열기</button>
        </div>
        <p className="ix-msg" role="status">{answer}</p>
      </section>

      <section className="ixp__sec" aria-labelledby="ix-empty">
        <h2 id="ix-empty">빈 화면과 오류 화면</h2>
        <div className="ixp__states">
          <EmptyState title="받은 요청이 없습니다" action={<button type="button" className="b1 bsm">알림 설정</button>}>다음 요청이 오면 메일로 알려 드립니다.</EmptyState>
          <EmptyState kind="filtered" title={'"GLP"에 맞는 요청이 없습니다'} clearHref="/design-preview/ix">검색어나 상태를 바꾸거나 필터를 지우세요.</EmptyState>
          <EmptyState kind="denied" title="이 요청을 볼 권한이 없습니다" action={<button type="button" className="b2 bsm">연결 요청</button>}>기관 대표에게 구성원 연결을 요청하세요.</EmptyState>
          <ErrorState cause="network" onRetry={() => wait(900)} />
          <ErrorState cause="server" code="503" onRetry={() => wait(900)} />
          <ErrorState cause="timeout" onRetry={() => wait(900)} />
        </div>
      </section>

      <section className="card card--pad ixp__sec" aria-labelledby="ix-skel">
        <h2 id="ix-skel">불러오기 뼈대</h2>
        <p className="ixp__note">처음 0.3초는 아무것도 보이지 않고, 그 뒤에 최종 화면 모양의 뼈대가 나타납니다. 페이지를 열 때는 원형 진행 표시를 쓰지 않습니다.</p>
        <div className="ixp__row"><button type="button" className="b2 bsm" onClick={() => setSkel((k) => k + 1)}>다시 보기</button></div>
        <PageSkeleton key={skel} />
      </section>
    </div>
  );
}
