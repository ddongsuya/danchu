import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

/** 설정 · 알림 (시안 r-set-noti · c-set-noti, /cro/profile/notifications 가 다시 내보낸다) */
export default function NotiSettingsPage() {
  return <SettingsPage section="noti" />;
}
