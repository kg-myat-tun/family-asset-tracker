export type Role = "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited" | "removed";
export type AssetCategory = "cash" | "bank" | "investment" | "property" | "crypto" | "other";
export type LoanStatus = "active" | "partially_paid" | "settled";

export interface FamilyMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: Role;
  status: MemberStatus;
  joinedAt: Date;
}

export interface Family {
  id: string;
  name: string;
  baseCurrency: string;
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
}

export interface Asset {
  id: string;
  ownerId: string;
  name: string;
  category: AssetCategory;
  currency: string;
  amount: number;
  description: string;
  attachmentURL: string | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: string;
  lenderId: string;
  borrowerId: string;
  currency: string;
  principalAmount: number;
  remainingAmount: number;
  interestRate: number | null;
  description: string;
  status: LoanStatus;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repayment {
  id: string;
  loanId: string;
  amount: number;
  currency: string;
  exchangeRateUsed: number | null;
  note: string;
  paidAt: Date;
  recordedBy: string;
}

export interface FxRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: Date;
}
