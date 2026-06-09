import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser } from "@/lib/family.server";
import { ensureUserProfile } from "@/lib/user.server";

export default async function OnboardingPage() {
  const user = await requireUser();
  await ensureUserProfile(user.uid);
  const family = await getFamilyForUser(user.uid);
  if (family) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card rounded-2xl shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Set up your family</h1>
        <p className="text-muted mb-8">Create a new family group or join an existing one</p>
        <OnboardingForm />
      </div>
    </main>
  );
}
