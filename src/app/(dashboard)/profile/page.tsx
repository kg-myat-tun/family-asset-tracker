import { ProfileForm } from "@/components/profile/ProfileForm";
import { requireUser } from "@/lib/auth.server";
import { getServerI18n } from "@/lib/i18n/server";
import { ensureUserProfile, getUserProfile } from "@/lib/user.server";

export default async function ProfilePage() {
  const user = await requireUser();
  await ensureUserProfile(user.uid);
  const profile = await getUserProfile(user.uid);
  if (!profile) return null;

  const { dict } = await getServerI18n();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{dict.profile.title}</h1>
        <p className="text-sm text-muted mt-1">{dict.profile.subtitle}</p>
      </div>
      <div className="bg-card rounded-2xl border border-line p-6">
        <ProfileForm defaultDisplayName={profile.displayName} email={profile.email} />
      </div>
    </div>
  );
}
