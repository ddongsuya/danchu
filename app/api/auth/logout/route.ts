import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sb = await createSessionClient();
  if (sb) await sb.auth.signOut();
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) return NextResponse.redirect(new URL("/login", req.url), 303);
  return NextResponse.json({ ok: true });
}
