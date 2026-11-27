"use client";

import { ConfirmProvider } from "./ConfirmDialog";
import { ToastProvider } from "./Toast";

/** 포털 공통 상호작용(토스트·확인 창)을 한 번에 단다. Shell·GuestShell·/q 레이아웃의 .pt 안에 하나만 둔다 */
export function UiProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
