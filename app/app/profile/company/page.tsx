import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

/** 설정 · 담당자 정보 (시안 r-set-company) */
export default function CompanySettingsPage() {
  return <SettingsPage section="company" />;
}
