export type Role = "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited" | "removed";
export type AssetCategory =
  | "cash"
  | "bank"
  | "investment"
  | "property"
  | "crypto"
  | "stock"
  | "other";
export type LoanStatus = "active" | "partially_paid" | "settled";
// How interest compounds. "none" = no interest accrues (legacy loans default
// here so a stored rate never silently back-charges). Rate is an annual %.
export type CompoundingPeriod = "none" | "monthly" | "annually";
// "shared" = visible to the whole family; "private" = visible only to the
// owner (assets) or loan participants. Legacy docs without the field are shared.
export type Visibility = "private" | "shared";
export type TransactionType = "income" | "expense";
export type IncomeCategory = "salary" | "bonus" | "gift" | "investment" | "other";
export type ExpenseCategory =
  | "housing"
  | "groceries"
  | "utilities"
  | "transport"
  | "healthcare"
  | "entertainment"
  | "debt"
  | "other";
export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

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
  // MMK per 1 USD, per-family (stored at settings.mmkPerUsd). The FX provider has
  // no MMK rate, so this is the family-set rate used for MMK conversion.
  mmkPerUsd: number;
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
  // Live value for dynamic (stock/crypto) assets; otherwise the user-entered value.
  // For dynamic assets this is also the last-computed snapshot used as an offline fallback.
  amount: number;
  // Ticker symbol (e.g. "AAPL", "BTC") for stock/crypto assets; null for static assets.
  symbol: string | null;
  // Units held for stock/crypto assets; null for static assets.
  quantity: number | null;
  description: string;
  attachmentURL: string | null;
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringRule {
  id: string;
  ownerId: string;
  type: TransactionType;
  name: string; // "Salary — Acme Corp"
  category: IncomeCategory | ExpenseCategory;
  // Free-text label shown instead of "Other" when category === "other"; null otherwise.
  customLabel: string | null;
  currency: string;
  amount: number; // per-occurrence
  frequency: RecurringFrequency;
  // Next date the cron should post a Transaction for this rule; advances after each posting.
  nextDueDate: Date;
  active: boolean; // pause without deleting
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  ownerId: string;
  type: TransactionType;
  name: string;
  category: IncomeCategory | ExpenseCategory;
  customLabel: string | null;
  currency: string;
  amount: number;
  date: Date; // when it actually happened
  // The RecurringRule that generated this transaction, or null if logged by hand.
  recurringRuleId: string | null;
  description: string;
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlySummary {
  // "YYYY-MM" (also the document id), in the family's base currency. Includes
  // all transactions regardless of visibility — an objective family metric,
  // same precedent as NetWorthSnapshot.
  month: string;
  totalIncomeBase: number;
  totalExpenseBase: number;
  netBase: number;
  byCategoryBase: Record<string, number>;
  baseCurrency: string;
  recordedAt: Date;
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

export interface NetWorthSnapshot {
  // YYYY-MM-DD (also the document id), in the family's base currency.
  date: string;
  assetsTotal: number;
  receivablesTotal: number;
  liabilitiesTotal: number;
  totalNetWorth: number;
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
