import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

/** 기관 설정 · 보안 (시안 c-set-security) */
export default function SecuritySettingsPage() {
  return <SettingsPage section="security" />;
}
