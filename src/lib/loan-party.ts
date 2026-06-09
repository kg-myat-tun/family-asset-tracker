import type { Loan } from "@/types";

type MemberLike = { displayName: string };

/**
 * Resolve a loan party (lender or borrower) to a display name. A party is
 * either a family member (id set) or an external person/org (name set).
 */
export function partyName(
  id: string | null,
  name: string | null,
  memberMap: Record<string, MemberLike>,
): string {
  if (id) return memberMap[id]?.displayName ?? "Unknown member";
  return name?.trim() || "External party";
}

export function isExternalParty(id: string | null): boolean {
  return !id;
}

export function lenderName(loan: Loan, memberMap: Record<string, MemberLike>): string {
  return partyName(loan.lenderId, loan.lenderName, memberMap);
}

export function borrowerName(loan: Loan, memberMap: Record<string, MemberLike>): string {
  return partyName(loan.borrowerId, loan.borrowerName, memberMap);
}
