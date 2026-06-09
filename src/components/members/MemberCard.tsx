"use client";

import Image from "next/image";
import { changeRoleAction, removeMemberAction } from "@/actions/member.actions";
import type { FamilyMember, Role } from "@/types";

interface Props {
  member: FamilyMember & { assetCount: number };
  isAdmin: boolean;
  isSelf: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-purple-100 text-purple-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-foreground/6 text-foreground/80",
};

export function MemberCard({ member, isAdmin, isSelf }: Props) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-accent-soft text-accent-strong overflow-hidden shrink-0">
        {member.photoURL ? (
          <Image src={member.photoURL} alt={member.displayName} width={44} height={44} />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-semibold">
            {member.displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground truncate">{member.displayName}</p>
          {isSelf && <span className="text-xs text-muted">(you)</span>}
        </div>
        <p className="text-sm text-muted truncate">{member.email}</p>
        <p className="text-xs text-muted">{member.assetCount} assets</p>
      </div>

      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
        {ROLE_LABELS[member.role]}
      </span>

      {isAdmin && !isSelf && (
        <div className="flex gap-2">
          <form action={changeRoleAction}>
            <input type="hidden" name="targetUid" value={member.uid} />
            <select
              name="role"
              defaultValue={member.role}
              onChange={(e) => {
                const form = e.target.closest("form") as HTMLFormElement | null;
                form?.requestSubmit();
              }}
              className="text-sm border border-line rounded-lg px-2 py-1"
              aria-label={`Role for ${member.displayName}`}
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </form>

          <form action={removeMemberAction}>
            <input type="hidden" name="targetUid" value={member.uid} />
            <button
              type="submit"
              className="text-sm text-red-500 hover:text-red-700 px-2 py-1"
              onClick={(e) => {
                if (!confirm(`Remove ${member.displayName}?`)) e.preventDefault();
              }}
            >
              Remove
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
