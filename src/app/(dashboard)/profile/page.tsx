import { ProfileForm } from "@/components/profile/ProfileForm";
import { requireUser } from "@/lib/auth.server";
import { ensureUserProfile, getUserProfile } from "@/lib/user.server";

export default async function ProfilePage() {
  const user = await requireUser();
  await ensureUserProfile(user.uid);
  const profile = await getUserProfile(user.uid);
  if (!profile) return null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Your profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update how you appear to the rest of your family.
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <ProfileForm defaultDisplayName={profile.displayName} email={profile.email} />
      </div>
    </div>
  );
}
