import { AdminSkeleton } from "@/components/admin/AdminSkeleton";

export default function Loading() {
  return <AdminSkeleton kind="split" label="접수 목록을 불러오는 중" />;
}
