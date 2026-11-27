import { CroSkeleton } from "@/components/cro/CroSkeleton";

export default function Loading() {
  return <CroSkeleton kind="board" label="받은 요청을 불러오는 중" />;
}
