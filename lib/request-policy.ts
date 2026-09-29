/** Display copy is not an access policy. Unknown nonempty legacy values fail closed. */
export function needsCda(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && value !== "일반";
}
export function confidentialAccess(
  value: unknown,
  signedAt?: string | null,
): boolean {
  return !needsCda(value) || !!signedAt;
}
export function invitationLimit(value: string | null | undefined): number {
  return value === "전체" ? Number.POSITIVE_INFINITY : value === "5곳" ? 5 : 3;
}
export function remainingInvites(
  value: string | null | undefined,
  existing: number,
): number {
  return Math.max(0, invitationLimit(value) - existing);
}
