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
    console.error("notification preferences unavailable", error);
    return [];
  }
  const muted = new Set(
    (data ?? [])
      .filter((p) => p.email_notifications === false)
      .map((p) => p.email.toLowerCase()),
  );
  return recipients.filter((a) => !muted.has(a));
}
