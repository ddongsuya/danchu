import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

/** 설정 첫 화면: 의뢰자는 일반(테마), 기관·운영자는 프로필 (/cro/profile · /admin/profile 이 다시 내보낸다) */
export default function Profile({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  return <SettingsPage section="general" searchParams={searchParams} />;
}
