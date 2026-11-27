"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** 모두 읽음 (시안 r-noti~read). 되돌릴 것이 없는 결과라 토스트만 띄운다 */
export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      className="b2 bsm"
      onClick={async () => {
        const res = await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
        if (!res?.ok) return toast("알림을 읽음으로 바꾸지 못했어요. 다시 시도해 주세요.", { tone: "error" });
        toast(`읽지 않은 알림 ${count}개를 읽음으로 바꿨어요`);
        router.refresh();
      }}
    >
      모두 읽음
    </Button>
  );
}
