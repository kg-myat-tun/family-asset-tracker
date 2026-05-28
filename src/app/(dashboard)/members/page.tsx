import { InviteCodePanel } from "@/components/members/InviteCodePanel";
import { InviteForm } from "@/components/members/InviteForm";
import { MemberCard } from "@/components/members/MemberCard";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getMemberWithAssetCount } from "@/lib/members.server";

export default async function MembersPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);
  const membersWithCounts = await Promise.all(
    members.map((m) => getMemberWithAssetCount(family.id, m.uid)),
  );

  const currentMember = membersWithCounts.find((m) => m.uid === user.uid);
  const isAdmin = currentMember?.role === "admin";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
        {isAdmin && <InviteForm />}
      </div>

      {isAdmin && family.inviteCode && <InviteCodePanel code={family.inviteCode} />}

      <div className="space-y-3">
        {membersWithCounts.map((member) => (
          <MemberCard
            key={member.uid}
            member={member}
            isAdmin={isAdmin}
            isSelf={member.uid === user.uid}
          />
        ))}
      </div>
    </div>
  );
}
