import type { Locale } from "./config";

// Full UI dictionary. Server components read it via getServerI18n(); client
// components via useI18n(). Keep `en` and `my` in sync with the Dictionary type.
export interface Dictionary {
  common: {
    saveChanges: string;
    saving: string;
    of: string;
    optional: string;
    external: string;
  };
  nav: { overview: string; assets: string; loans: string; members: string; profile: string };
  header: { baseCurrency: string; signOut: string; signingOut: string; notifications: string };
  sidebar: { family: string; appName: string };
  auth: {
    appName: string;
    signInSubtitle: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    signIn: string;
    signingIn: string;
    or: string;
    continueWithGoogle: string;
    loginFailed: string;
    googleLoginFailed: string;
    setupTitle: string;
    setupSubtitle: string;
    createTab: string;
    joinTab: string;
    familyName: string;
    familyNamePlaceholder: string;
    baseCurrency: string;
    createFamily: string;
    creating: string;
    inviteCode: string;
    inviteCodeHint: string;
    joinFamily: string;
    joining: string;
  };
  dashboard: {
    netWorthTitle: string;
    assets: string;
    owedToFamily: string;
    owedByFamily: string;
    netWorthOverTime: string;
    trendEmpty: string;
    assetsByMember: string;
    noAssetData: string;
    outstandingLoans: string;
    noOutstandingLoans: string;
    recentAssets: string;
    viewAll: string;
    noAssets: string;
    recentActivity: string;
    noActivity: string;
    activityError: string;
    overdueLoans: string;
  };
  assets: {
    title: string;
    unitOne: string;
    unitOther: string;
    addAsset: string;
    totalValue: string;
    noAssetsTitle: string;
    noAssetsDesc: string;
    category: string;
    amount: string;
    owner: string;
    description: string;
    unknownOwner: string;
    searchPlaceholder: string;
    allOwners: string;
    allCategories: string;
    noMatchTitle: string;
    noMatchDesc: string;
    addTitle: string;
    editTitle: string;
    createAsset: string;
    name: string;
    currency: string;
    descriptionOptional: string;
    delete: string;
    edit: string;
    deleteConfirm: string;
    privateLock: string;
    categories: {
      cash: string;
      bank: string;
      investment: string;
      property: string;
      crypto: string;
      other: string;
    };
  };
  loans: {
    title: string;
    unitOne: string;
    unitOther: string;
    newLoan: string;
    youreOwed: string;
    youOwe: string;
    netPosition: string;
    tabAll: string;
    tabLent: string;
    tabOwe: string;
    noLoansTitle: string;
    noLoansDesc: string;
    relLentTo: string;
    relYouOwe: string;
    paidSuffix: string;
    statusActive: string;
    statusPartiallyPaid: string;
    statusSettled: string;
    overdue: string;
    lender: string;
    borrower: string;
    dueDate: string;
    principalRepaid: string;
    principalOutstanding: string;
    accruedInterest: string;
    totalOwed: string;
    remaining: string;
    repaymentHistory: string;
    principal: string;
    interest: string;
    nextPayment: string;
    installmentOverdue: string;
    installmentOf: string;
    repaymentSchedule: string;
    scheduleInstallments: string;
    colNum: string;
    colDue: string;
    colPayment: string;
    colPrincipal: string;
    colInterest: string;
    colBalance: string;
    type: string;
    iLent: string;
    iBorrowed: string;
    familyMember: string;
    externalOption: string;
    selectMember: string;
    externalNamePlaceholder: string;
    principalAmount: string;
    interestRate: string;
    compounds: string;
    compNone: string;
    compMonthly: string;
    compAnnually: string;
    installments: string;
    firstPaymentDate: string;
    dueDateOnly: string;
    description: string;
    createLoan: string;
    editTitle: string;
    newTitle: string;
    lockedNote: string;
    recordRepayment: string;
    amountPaid: string;
    currency: string;
    noteOptional: string;
    notePlaceholder: string;
    recordPayment: string;
    recording: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
  };
  members: {
    title: string;
    invite: string;
    inviting: string;
    invitePlaceholder: string;
    inviteCodeTitle: string;
    inviteCodeDesc: string;
    copy: string;
    copied: string;
    you: string;
    assetsCount: string;
    roleAdmin: string;
    roleMember: string;
    roleViewer: string;
    remove: string;
    removeConfirm: string;
    mmkRateTitle: string;
    mmkRateDesc: string;
    mmkRateLabel: string;
    mmkRateSave: string;
    mmkRateSaving: string;
    mmkRateUseCbm: string;
    mmkRateSaved: string;
  };
  profile: {
    title: string;
    subtitle: string;
    displayName: string;
    displayNameHint: string;
    email: string;
    emailHint: string;
    saved: string;
  };
  ui: {
    visibility: string;
    shared: string;
    private: string;
    sharedHint: string;
    privateHint: string;
    privateLockAsset: string;
    crumbNew: string;
    crumbEdit: string;
    crumbAssetDetails: string;
    crumbLoanDetails: string;
    crumbItem: string;
    crumbAsset: string;
    crumbLoan: string;
    errorTitle: string;
    tryAgain: string;
    notFoundAsset: string;
    notFoundLoan: string;
    mayBeDeleted: string;
    backToAssets: string;
    backToLoans: string;
  };
  notifications: {
    markAllRead: string;
    allCaughtUp: string;
  };
}

const en: Dictionary = {
  common: {
    saveChanges: "Save changes",
    saving: "Saving...",
    of: "of",
    optional: "optional",
    external: "external",
  },
  nav: {
    overview: "Overview",
    assets: "Assets",
    loans: "Loans",
    members: "Members",
    profile: "Profile",
  },
  header: {
    baseCurrency: "Base currency",
    signOut: "Sign out",
    signingOut: "Signing out...",
    notifications: "Notifications",
  },
  sidebar: { family: "Family", appName: "Family Asset Tracker" },
  auth: {
    appName: "Family Asset Tracker",
    signInSubtitle: "Sign in to your family dashboard",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    or: "or",
    continueWithGoogle: "Continue with Google",
    loginFailed: "Login failed.",
    googleLoginFailed: "Google login failed.",
    setupTitle: "Set up your family",
    setupSubtitle: "Create a new family group or join an existing one",
    createTab: "Create a family",
    joinTab: "Join a family",
    familyName: "Family name",
    familyNamePlaceholder: "e.g. The Smiths",
    baseCurrency: "Base currency",
    createFamily: "Create family",
    creating: "Creating...",
    inviteCode: "Invite code",
    inviteCodeHint: "Ask a family admin for the 6-character code on their Members page.",
    joinFamily: "Join family",
    joining: "Joining...",
  },
  dashboard: {
    netWorthTitle: "Total family net worth",
    assets: "Assets",
    owedToFamily: "Owed to family",
    owedByFamily: "Owed by family",
    netWorthOverTime: "Net worth over time",
    trendEmpty:
      "Not enough history yet — a snapshot is recorded daily, so the trend will fill in over the coming days.",
    assetsByMember: "Assets by member",
    noAssetData: "No asset data yet.",
    outstandingLoans: "Outstanding loans",
    noOutstandingLoans: "No outstanding loans.",
    recentAssets: "Recent assets",
    viewAll: "View all",
    noAssets: "No assets yet.",
    recentActivity: "Recent activity",
    noActivity: "No activity yet.",
    activityError: "Couldn’t load recent activity. Check your connection and Firestore access.",
    overdueLoans: "Overdue loans",
  },
  assets: {
    title: "Assets",
    unitOne: "asset",
    unitOther: "assets",
    addAsset: "+ Add asset",
    totalValue: "Total value",
    noAssetsTitle: "No assets yet",
    noAssetsDesc: "Start tracking your family's wealth by adding your first asset.",
    category: "Category",
    amount: "Amount",
    owner: "Owner",
    description: "Description",
    unknownOwner: "Unknown",
    searchPlaceholder: "Search assets…",
    allOwners: "All owners",
    allCategories: "All categories",
    noMatchTitle: "No matching assets",
    noMatchDesc: "Try adjusting your search or filters.",
    addTitle: "Add asset",
    editTitle: "Edit asset",
    createAsset: "Create asset",
    name: "Name",
    currency: "Currency",
    descriptionOptional: "Description (optional)",
    delete: "Delete",
    edit: "Edit",
    deleteConfirm: "Delete",
    privateLock: "Private — only visible to you",
    categories: {
      cash: "Cash",
      bank: "Bank",
      investment: "Investment",
      property: "Property",
      crypto: "Crypto",
      other: "Other",
    },
  },
  loans: {
    title: "Loans",
    unitOne: "loan",
    unitOther: "loans",
    newLoan: "+ New loan",
    youreOwed: "You're owed",
    youOwe: "You owe",
    netPosition: "Net position",
    tabAll: "All",
    tabLent: "I lent",
    tabOwe: "I owe",
    noLoansTitle: "No loans yet",
    noLoansDesc: "Track money lent between family members so nothing slips through the cracks.",
    relLentTo: "You lent to",
    relYouOwe: "You owe",
    paidSuffix: "% paid",
    statusActive: "active",
    statusPartiallyPaid: "partially paid",
    statusSettled: "settled",
    overdue: "overdue",
    lender: "Lender",
    borrower: "Borrower",
    dueDate: "Due date",
    principalRepaid: "Principal repaid",
    principalOutstanding: "Principal outstanding",
    accruedInterest: "Accrued interest",
    totalOwed: "Total owed",
    remaining: "Remaining",
    repaymentHistory: "Repayment history",
    principal: "principal",
    interest: "interest",
    nextPayment: "Next payment",
    installmentOverdue: "Installment overdue",
    installmentOf: "installment",
    repaymentSchedule: "Repayment schedule",
    scheduleInstallments: "monthly installments",
    colNum: "#",
    colDue: "Due",
    colPayment: "Payment",
    colPrincipal: "Principal",
    colInterest: "Interest",
    colBalance: "Balance",
    type: "Type",
    iLent: "I lent money",
    iBorrowed: "I borrowed money",
    familyMember: "Family member",
    externalOption: "External",
    selectMember: "Select a family member",
    externalNamePlaceholder: "e.g. John Smith, Bank of Example",
    principalAmount: "Principal amount",
    interestRate: "Interest rate % / yr (optional)",
    compounds: "Compounds",
    compNone: "No interest",
    compMonthly: "Monthly",
    compAnnually: "Annually",
    installments: "Monthly installments (optional)",
    firstPaymentDate: "First payment date",
    dueDateOnly: "Due date (optional, for loans without a payment plan)",
    description: "Description",
    createLoan: "Create loan",
    editTitle: "Edit loan",
    newTitle: "New loan",
    lockedNote: "Principal and currency are locked once a repayment exists.",
    recordRepayment: "Record repayment",
    amountPaid: "Amount paid",
    currency: "Currency",
    noteOptional: "Note (optional)",
    notePlaceholder: "e.g. Cash payment",
    recordPayment: "Record payment",
    recording: "Recording...",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this loan? This also removes its repayment history.",
  },
  members: {
    title: "Members",
    invite: "Invite",
    inviting: "Inviting...",
    invitePlaceholder: "name@example.com",
    inviteCodeTitle: "Family invite code",
    inviteCodeDesc: "Share this code so others can join from the onboarding screen.",
    copy: "Copy",
    copied: "Copied!",
    you: "(you)",
    assetsCount: "assets",
    roleAdmin: "Admin",
    roleMember: "Member",
    roleViewer: "Viewer",
    remove: "Remove",
    removeConfirm: "Remove",
    mmkRateTitle: "Myanmar Kyat rate",
    mmkRateDesc:
      "Our FX provider doesn't quote MMK, so set how many kyat equal 1 USD. Used for all MMK conversions.",
    mmkRateLabel: "MMK per 1 USD",
    mmkRateSave: "Save rate",
    mmkRateSaving: "Saving...",
    mmkRateUseCbm: "Use CBM rate",
    mmkRateSaved: "Saved",
  },
  profile: {
    title: "Your profile",
    subtitle: "Update how you appear to the rest of your family.",
    displayName: "Display name",
    displayNameHint: "Shown to other family members on the Members page and activity feed.",
    email: "Email",
    emailHint: "Email is managed by your sign-in provider.",
    saved: "Saved.",
  },
  ui: {
    visibility: "Visibility",
    shared: "Shared",
    private: "Private",
    sharedHint: "Visible to the whole family",
    privateHint: "Only visible to you",
    privateLockAsset: "Private — only visible to you",
    crumbNew: "New",
    crumbEdit: "Edit",
    crumbAssetDetails: "Asset details",
    crumbLoanDetails: "Loan details",
    crumbItem: "Item",
    crumbAsset: "Asset",
    crumbLoan: "Loan",
    errorTitle: "Something went wrong",
    tryAgain: "Try again",
    notFoundAsset: "Asset not found",
    notFoundLoan: "Loan not found",
    mayBeDeleted: "It may have been deleted.",
    backToAssets: "Back to assets",
    backToLoans: "Back to loans",
  },
  notifications: {
    markAllRead: "Mark all read",
    allCaughtUp: "You're all caught up.",
  },
};

const my: Dictionary = {
  common: {
    saveChanges: "ပြောင်းလဲမှု သိမ်းမည်",
    saving: "သိမ်းနေသည်...",
    of: "မှ",
    optional: "ရွေးချယ်နိုင်",
    external: "ပြင်ပ",
  },
  nav: {
    overview: "ပင်မ",
    assets: "ပိုင်ဆိုင်မှုများ",
    loans: "ချေးငွေများ",
    members: "အဖွဲ့ဝင်များ",
    profile: "ကိုယ်ရေးအချက်အလက်",
  },
  header: {
    baseCurrency: "အခြေခံငွေကြေး",
    signOut: "ထွက်မည်",
    signingOut: "ထွက်နေသည်...",
    notifications: "အကြောင်းကြားချက်များ",
  },
  sidebar: { family: "မိသားစု", appName: "မိသားစု ပိုင်ဆိုင်မှု မှတ်တမ်း" },
  auth: {
    appName: "မိသားစု ပိုင်ဆိုင်မှု မှတ်တမ်း",
    signInSubtitle: "သင့်မိသားစု ဒက်ရှ်ဘုတ်သို့ ဝင်ရောက်ပါ",
    email: "အီးမေးလ်",
    emailPlaceholder: "you@example.com",
    password: "စကားဝှက်",
    passwordPlaceholder: "သင့်စကားဝှက်",
    showPassword: "စကားဝှက် ပြရန်",
    hidePassword: "စကားဝှက် ဖျောက်ရန်",
    signIn: "ဝင်မည်",
    signingIn: "ဝင်နေသည်...",
    or: "သို့မဟုတ်",
    continueWithGoogle: "Google ဖြင့် ဆက်လုပ်ရန်",
    loginFailed: "ဝင်ရောက်မှု မအောင်မြင်ပါ။",
    googleLoginFailed: "Google ဖြင့် ဝင်ရောက်မှု မအောင်မြင်ပါ။",
    setupTitle: "သင့်မိသားစုကို စတင်ပါ",
    setupSubtitle: "မိသားစုအဖွဲ့သစ် ဖန်တီးပါ သို့မဟုတ် ရှိပြီးသားသို့ ဝင်ပါ",
    createTab: "မိသားစု ဖန်တီးရန်",
    joinTab: "မိသားစုသို့ ဝင်ရန်",
    familyName: "မိသားစုအမည်",
    familyNamePlaceholder: "ဥပမာ - The Smiths",
    baseCurrency: "အခြေခံငွေကြေး",
    createFamily: "မိသားစု ဖန်တီးမည်",
    creating: "ဖန်တီးနေသည်...",
    inviteCode: "ဖိတ်ကြားကုဒ်",
    inviteCodeHint: "သင့်မိသားစု admin ထံမှ Members စာမျက်နှာရှိ စာလုံး ၆ လုံးကုဒ်ကို တောင်းပါ။",
    joinFamily: "မိသားစုသို့ ဝင်မည်",
    joining: "ဝင်နေသည်...",
  },
  dashboard: {
    netWorthTitle: "မိသားစု စုစုပေါင်း ပိုင်ဆိုင်မှု တန်ဖိုး",
    assets: "ပိုင်ဆိုင်မှုများ",
    owedToFamily: "မိသားစုသို့ ရရန်ရှိ",
    owedByFamily: "မိသားစုက ပေးရန်ရှိ",
    netWorthOverTime: "ကာလအလိုက် ပိုင်ဆိုင်မှု တန်ဖိုး",
    trendEmpty: "မှတ်တမ်း မလုံလောက်သေးပါ — နေ့စဉ် မှတ်တမ်းတင်သွားမည်ဖြစ်ပြီး လာမည့်ရက်များတွင် ပြည့်စုံလာပါမည်။",
    assetsByMember: "အဖွဲ့ဝင်အလိုက် ပိုင်ဆိုင်မှုများ",
    noAssetData: "ပိုင်ဆိုင်မှု အချက်အလက် မရှိသေးပါ။",
    outstandingLoans: "ပေးဆပ်ရန်ကျန် ချေးငွေများ",
    noOutstandingLoans: "ပေးဆပ်ရန်ကျန် ချေးငွေ မရှိပါ။",
    recentAssets: "မကြာသေးမီက ပိုင်ဆိုင်မှုများ",
    viewAll: "အားလုံးကြည့်ရန်",
    noAssets: "ပိုင်ဆိုင်မှု မရှိသေးပါ။",
    recentActivity: "မကြာသေးမီက လှုပ်ရှားမှုများ",
    noActivity: "လှုပ်ရှားမှု မရှိသေးပါ။",
    activityError: "မကြာသေးမီက လှုပ်ရှားမှုများကို ဖွင့်၍မရပါ။ ချိတ်ဆက်မှုနှင့် Firestore ဝင်ရောက်ခွင့်ကို စစ်ဆေးပါ။",
    overdueLoans: "ကျော်လွန်နေသော ချေးငွေများ",
  },
  assets: {
    title: "ပိုင်ဆိုင်မှုများ",
    unitOne: "ပိုင်ဆိုင်မှု",
    unitOther: "ပိုင်ဆိုင်မှု",
    addAsset: "+ ပိုင်ဆိုင်မှု ထည့်ရန်",
    totalValue: "စုစုပေါင်း တန်ဖိုး",
    noAssetsTitle: "ပိုင်ဆိုင်မှု မရှိသေးပါ",
    noAssetsDesc: "ပထမဆုံး ပိုင်ဆိုင်မှုကို ထည့်ခြင်းဖြင့် သင့်မိသားစု၏ ဥစ္စာဓနကို စတင်စောင့်ကြည့်ပါ။",
    category: "အမျိုးအစား",
    amount: "ပမာဏ",
    owner: "ပိုင်ရှင်",
    description: "ဖော်ပြချက်",
    unknownOwner: "မသိရှိ",
    searchPlaceholder: "ပိုင်ဆိုင်မှု ရှာရန်…",
    allOwners: "ပိုင်ရှင် အားလုံး",
    allCategories: "အမျိုးအစား အားလုံး",
    noMatchTitle: "ကိုက်ညီသော ပိုင်ဆိုင်မှု မရှိပါ",
    noMatchDesc: "ရှာဖွေမှု သို့မဟုတ် စစ်ထုတ်မှုကို ပြောင်းကြည့်ပါ။",
    addTitle: "ပိုင်ဆိုင်မှု ထည့်ရန်",
    editTitle: "ပိုင်ဆိုင်မှု ပြင်ဆင်ရန်",
    createAsset: "ပိုင်ဆိုင်မှု ဖန်တီးမည်",
    name: "အမည်",
    currency: "ငွေကြေး",
    descriptionOptional: "ဖော်ပြချက် (ရွေးချယ်နိုင်)",
    delete: "ဖျက်မည်",
    edit: "ပြင်မည်",
    deleteConfirm: "ဖျက်မှာသေချာပါသလား —",
    privateLock: "သီးသန့် — သင်သာ မြင်နိုင်သည်",
    categories: {
      cash: "ငွေသား",
      bank: "ဘဏ်",
      investment: "ရင်းနှီးမြှုပ်နှံမှု",
      property: "အိမ်ခြံမြေ",
      crypto: "ခရစ်တို",
      other: "အခြား",
    },
  },
  loans: {
    title: "ချေးငွေများ",
    unitOne: "ချေးငွေ",
    unitOther: "ချေးငွေ",
    newLoan: "+ ချေးငွေ အသစ်",
    youreOwed: "ရရန်ရှိ",
    youOwe: "ပေးရန်ရှိ",
    netPosition: "အသားတင်",
    tabAll: "အားလုံး",
    tabLent: "သင်ချေးထား",
    tabOwe: "သင်ပေးရန်",
    noLoansTitle: "ချေးငွေ မရှိသေးပါ",
    noLoansDesc: "မိသားစုဝင်များကြား ချေးငွေများကို မှတ်တမ်းတင်ထားပါ။",
    relLentTo: "သင် ချေးထားသည်",
    relYouOwe: "သင် ပေးရန်ရှိ",
    paidSuffix: "% ပေးပြီး",
    statusActive: "ဆောင်ရွက်ဆဲ",
    statusPartiallyPaid: "တစ်စိတ်တစ်ပိုင်း ပေးပြီး",
    statusSettled: "ပြီးပြတ်",
    overdue: "ကျော်လွန်",
    lender: "ချေးသူ",
    borrower: "ချေးယူသူ",
    dueDate: "ပေးရမည့်ရက်",
    principalRepaid: "အရင်း ပြန်ဆပ်ပြီး",
    principalOutstanding: "ကျန်အရင်း",
    accruedInterest: "တိုးပွားအတိုး",
    totalOwed: "စုစုပေါင်း ပေးရန်",
    remaining: "ကျန်ငွေ",
    repaymentHistory: "ပြန်ဆပ်မှု မှတ်တမ်း",
    principal: "အရင်း",
    interest: "အတိုး",
    nextPayment: "နောက်ပေးချေမှု",
    installmentOverdue: "အရစ်ကျ ကျော်လွန်",
    installmentOf: "အရစ်ကျ",
    repaymentSchedule: "ပြန်ဆပ်ရေး အစီအစဉ်",
    scheduleInstallments: "လစဉ် အရစ်ကျ",
    colNum: "#",
    colDue: "ရက်",
    colPayment: "ပေးချေမှု",
    colPrincipal: "အရင်း",
    colInterest: "အတိုး",
    colBalance: "လက်ကျန်",
    type: "အမျိုးအစား",
    iLent: "ငွေချေးပေးသည်",
    iBorrowed: "ငွေချေးယူသည်",
    familyMember: "မိသားစုဝင်",
    externalOption: "ပြင်ပ",
    selectMember: "မိသားစုဝင် ရွေးပါ",
    externalNamePlaceholder: "ဥပမာ - John Smith, Bank of Example",
    principalAmount: "အရင်းပမာဏ",
    interestRate: "အတိုးနှုန်း % / နှစ် (ရွေးချယ်နိုင်)",
    compounds: "အတိုးပေါင်း",
    compNone: "အတိုးမယူ",
    compMonthly: "လစဉ်",
    compAnnually: "နှစ်စဉ်",
    installments: "လစဉ် အရစ်ကျ (ရွေးချယ်နိုင်)",
    firstPaymentDate: "ပထမပေးချေမည့်ရက်",
    dueDateOnly: "ပေးရမည့်ရက် (အစီအစဉ်မရှိသော ချေးငွေအတွက်)",
    description: "ဖော်ပြချက်",
    createLoan: "ချေးငွေ ဖန်တီးမည်",
    editTitle: "ချေးငွေ ပြင်ဆင်ရန်",
    newTitle: "ချေးငွေ အသစ်",
    lockedNote: "ပြန်ဆပ်မှုရှိပြီးပါက အရင်းနှင့် ငွေကြေးကို ပြောင်း၍မရပါ။",
    recordRepayment: "ပြန်ဆပ်မှု မှတ်တမ်းတင်ရန်",
    amountPaid: "ပေးချေသည့်ပမာဏ",
    currency: "ငွေကြေး",
    noteOptional: "မှတ်ချက် (ရွေးချယ်နိုင်)",
    notePlaceholder: "ဥပမာ - ငွေသားပေးချေမှု",
    recordPayment: "ပေးချေမှု မှတ်တမ်းတင်မည်",
    recording: "မှတ်တမ်းတင်နေသည်...",
    edit: "ပြင်မည်",
    delete: "ဖျက်မည်",
    deleteConfirm: "ဤချေးငွေကို ဖျက်မလား။ ပြန်ဆပ်မှု မှတ်တမ်းပါ ဖျက်သွားပါမည်။",
  },
  members: {
    title: "အဖွဲ့ဝင်များ",
    invite: "ဖိတ်ခေါ်မည်",
    inviting: "ဖိတ်ခေါ်နေသည်...",
    invitePlaceholder: "name@example.com",
    inviteCodeTitle: "မိသားစု ဖိတ်ကြားကုဒ်",
    inviteCodeDesc: "ဤကုဒ်ကို မျှဝေပါက အခြားသူများ onboarding မှ ဝင်နိုင်ပါသည်။",
    copy: "ကူးမည်",
    copied: "ကူးပြီး!",
    you: "(သင်)",
    assetsCount: "ပိုင်ဆိုင်မှု",
    roleAdmin: "Admin",
    roleMember: "အဖွဲ့ဝင်",
    roleViewer: "ကြည့်ရှုသူ",
    remove: "ဖယ်ရှားမည်",
    removeConfirm: "ဖယ်ရှားမှာသေချာပါသလား —",
    mmkRateTitle: "မြန်မာကျပ် ငွေလဲနှုန်း",
    mmkRateDesc:
      "ကျွန်ုပ်တို့၏ FX ဝန်ဆောင်မှုတွင် MMK မပါသဖြင့် ၁ ဒေါ်လာ = ကျပ်မည်မျှဟု သတ်မှတ်ပါ။ MMK ပြောင်းလဲမှုအားလုံးအတွက် သုံးပါသည်။",
    mmkRateLabel: "၁ USD = ကျပ်",
    mmkRateSave: "နှုန်း သိမ်းမည်",
    mmkRateSaving: "သိမ်းနေသည်...",
    mmkRateUseCbm: "CBM နှုန်း သုံးမည်",
    mmkRateSaved: "သိမ်းပြီး",
  },
  profile: {
    title: "သင့်ကိုယ်ရေးအချက်အလက်",
    subtitle: "မိသားစုဝင်များအား သင် မည်သို့မြင်ရမည်ကို ပြင်ဆင်ပါ။",
    displayName: "ပြသမည့်အမည်",
    displayNameHint: "Members စာမျက်နှာနှင့် လှုပ်ရှားမှုတွင် အခြားသူများ မြင်ရပါမည်။",
    email: "အီးမေးလ်",
    emailHint: "အီးမေးလ်ကို သင့်ဝင်ရောက်မှု provider က စီမံပါသည်။",
    saved: "သိမ်းပြီး။",
  },
  ui: {
    visibility: "မြင်နိုင်မှု",
    shared: "မျှဝေ",
    private: "သီးသန့်",
    sharedHint: "မိသားစုတစ်ခုလုံး မြင်နိုင်သည်",
    privateHint: "သင်သာ မြင်နိုင်သည်",
    privateLockAsset: "သီးသန့် — သင်သာ မြင်နိုင်သည်",
    crumbNew: "အသစ်",
    crumbEdit: "ပြင်ဆင်",
    crumbAssetDetails: "ပိုင်ဆိုင်မှု အသေးစိတ်",
    crumbLoanDetails: "ချေးငွေ အသေးစိတ်",
    crumbItem: "အရာ",
    crumbAsset: "ပိုင်ဆိုင်မှု",
    crumbLoan: "ချေးငွေ",
    errorTitle: "တစ်ခုခု မှားယွင်းသွားပါသည်",
    tryAgain: "ထပ်ကြိုးစားပါ",
    notFoundAsset: "ပိုင်ဆိုင်မှု မတွေ့ပါ",
    notFoundLoan: "ချေးငွေ မတွေ့ပါ",
    mayBeDeleted: "ဖျက်လိုက်ပြီး ဖြစ်နိုင်ပါသည်။",
    backToAssets: "ပိုင်ဆိုင်မှုများသို့ ပြန်သွားရန်",
    backToLoans: "ချေးငွေများသို့ ပြန်သွားရန်",
  },
  notifications: {
    markAllRead: "အားလုံးဖတ်ပြီးအဖြစ် မှတ်မည်",
    allCaughtUp: "အားလုံး ပြီးပြတ်ပါပြီ။",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { en, my };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Tiny pluralisation helper (English has two forms; Burmese passes the same). */
export function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other;
}
