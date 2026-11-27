import { AdminSkeleton } from "@/components/admin/AdminSkeleton";

export default function Loading() {
  return <AdminSkeleton kind="split" label="요청을 불러오는 중" />;
}
