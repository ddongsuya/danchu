import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

/** 설정 · 계정 (시안 r-set-account). 이메일 변경 확인 뒤 돌아오는 알림도 여기서 보인다 */
export default function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  return <SettingsPage section="account" searchParams={searchParams} />;
}
