"use client";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { adminPost } from "./act";

/** 운영자가 계정을 삭제한다 (시안 검토판 a-users~del). 확인창이 지우고, 실패하면 창 안에 "계정은 그대로예요"를 보여 준다 */
export function DeleteUserButton({ userId, email, name }: { userId: string; email: string; name?: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const del = async () => {
    const ok = await confirm({
      title: `${name || email} 계정을 삭제할까요?`,
      body: `삭제하면 ${email} 계정은 로그인할 수 없고, 복구할 수 없습니다.`,
      confirmLabel: "계정 삭제",
      pendingLabel: "삭제하는 중",
      danger: true,
      action: async () => { await adminPost(`/api/admin/users/${userId}`, undefined, "계정을 삭제하지 못했어요. 계정은 그대로예요.", "DELETE"); },
    });
    if (ok) router.refresh();
  };
  return <button type="button" className="btxt" style={{ fontSize: 12, color: "var(--err)" }} onClick={del}>삭제</button>;
}
