import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/components/query/Providers";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { ensureUserProfile } from "@/lib/user.server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensureUserProfile(user.uid);

  const family = await getFamilyForUser(user.uid);
  if (!family) redirect("/onboarding");

  const members = await getFamilyMembers(family.id);

  return (
    <Providers>
      <AppShell user={{ uid: user.uid, email: user.email ?? "" }} family={family} members={members}>
        {children}
      </AppShell>
    </Providers>
  );
}
