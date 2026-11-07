import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { NAV, SESSION, TABS } from "./fixtures";
import "@/components/cro/crm/crm.css";

/** 검토 화면 셸 (로그인 없이, 저장 안 됨) */
export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV} tabs={TABS}>
        <p className="cx-preview" role="note">검토용 예시 화면이에요. 회사·사람·금액은 실제 값이 아니고, 저장 버튼을 눌러도 저장되지 않아요.</p>
        {children}
      </Shell>
    </AppState>
  );
}
