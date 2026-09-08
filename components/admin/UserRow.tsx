"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type U = { id: string; email: string; role: string; name: string | null; company: string | null; cro_org_id: string | null; created_at: string };

export function UserRow({ user, orgs, self }: { user: U; orgs: { id: string; name: string }[]; self: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [org, setOrg] = useState(user.cro_org_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = role !== user.role || org !== (user.cro_org_id ?? "");

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{user.name || "—"}{self && <span className="pill pill--tint" style={{ marginLeft: 6 }}>나</span>}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{user.email}</div>
      </td>
      <td style={{ fontSize: 13 }}>{user.company || "—"}</td>
      <td>
        <select className="sel" style={{ height: 36, fontSize: 13, width: 120 }} value={role} disabled={self} onChange={(e) => setRole(e.target.value)}>
          <option value="requester">의뢰자</option>
          <option value="cro">CRO</option>
          <option value="admin">운영자</option>
        </select>
      </td>
      <td>
        <select className="sel" style={{ height: 36, fontSize: 13, minWidth: 160 }} value={org} onChange={(e) => setOrg(e.target.value)} disabled={role !== "cro"}>
          <option value="">— 없음 —</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="b2 bsm"
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            const res = await fetch(`/api/admin/users/${user.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, croOrgId: role === "cro" ? org || null : null }) });
            const d = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) setErr(d.error || "저장 실패");
            else router.refresh();
            setBusy(false);
          }}
        >
          {busy ? "…" : "저장"}
        </button>
        {err && <div style={{ fontSize: 12, color: "var(--err)" }}>{err}</div>}
      </td>
    </tr>
  );
}
