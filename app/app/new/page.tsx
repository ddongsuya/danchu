import { requireSession } from "@/lib/auth";
import { NewRequest } from "@/components/NewRequest";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const s = await requireSession("requester", "/app/new");
  const p = s.profile;
  return (
    <NewRequest
      contact={{
        company: p.company ?? "",
        name: p.name ?? "",
        dept: p.dept ?? "",
        email: s.email,
        phone: p.phone ?? "",
        orgType: p.org_type ?? "",
      }}
    />
  );
}
