import { getSupabaseAdmin } from "./supabase";
export async function notificationRecipients(
  addresses: string[],
): Promise<string[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const recipients = [...new Set(addresses.map((a) => a.trim().toLowerCase()))];
  if (!recipients.length) return [];
  const { data, error } = await sb
    .from("profiles")
    .select("email, email_notifications")
    .in("email", recipients);
  if (error) {
    // 수신 설정을 못 읽었다고 메일을 전부 버리면 안 된다. 거부 설정이 잠깐 무시되는 쪽이 낫다
    console.error("notification preferences unavailable", error);
    return recipients;
  }
  const muted = new Set(
    (data ?? [])
      .filter((p) => p.email_notifications === false)
      .map((p) => p.email.toLowerCase()),
  );
  return recipients.filter((a) => !muted.has(a));
}
