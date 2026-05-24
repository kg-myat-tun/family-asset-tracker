import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth.server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <AppShell userId={user.uid}>{children}</AppShell>;
}
