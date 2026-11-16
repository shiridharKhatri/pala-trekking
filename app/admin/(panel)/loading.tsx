import { AdminMainSkeleton } from "@/components/admin/AdminSkeleton";

// Shown inside the admin shell while a page streams in: the sidebar stays put
// and only the main area is a skeleton.
export default function Loading() {
  return <AdminMainSkeleton />;
}
