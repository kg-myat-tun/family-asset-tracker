export type Role = "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited" | "removed";
export type AssetCategory = "cash" | "bank" | "investment" | "property" | "crypto" | "other";
export type LoanStatus = "active" | "partially_paid" | "settled";
// How interest compounds. "none" = no interest accrues (legacy loans default
// here so a stored rate never silently back-charges). Rate is an annual %.
export type CompoundingPeriod = "none" | "monthly" | "annually";
// "shared" = visible to the whole family; "private" = visible only to the
// owner (assets) or loan participants. Legacy docs without the field are shared.
export type Visibility = "private" | "shared";

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
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: string;
  // A party is either a family member (id set, name null) or an external
  // person/org (id null, name set). At least one side is always a family member.
  lenderId: string | null;
  borrowerId: string | null;
  lenderName: string | null;
  borrowerName: string | null;
  visibility: Visibility;
  currency: string;
  principalAmount: number;
  // Total owed (principal + accrued interest) as of the last event. Kept for
  // back-compat and sorting; live figures come from liveLoanState().
  remainingAmount: number;
  interestRate: number | null;
  compoundingPeriod: CompoundingPeriod;
  // Optional monthly repayment plan (EMI). When set, the loan amortises over
  // this many equal monthly installments starting on firstPaymentDate.
  installmentCount: number | null;
  firstPaymentDate: Date | null;
  // Interest accrues from this date. Defaults to createdAt for new loans.
  interestStartDate: Date;
  // Snapshot of the balance at lastEventDate, so reads can accrue forward in
  // O(1) without walking the repayment ledger.
  principalOutstanding: number;
  accruedInterestSnapshot: number;
  lastEventDate: Date;
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
  // How this payment was split (in loan currency): interest is paid first.
  principalPortion: number;
  interestPortion: number;
  note: string;
  paidAt: Date;
  recordedBy: string;
}

export interface FxRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: Date;
}

export type NotificationType = "loan_due_soon" | "loan_overdue";

export interface Notification {
  id: string;
  recipientUid: string;
  loanId: string;
  type: NotificationType;
  title: string;
  body: string;
  dueDate: Date;
  read: boolean;
  createdAt: Date;
}
