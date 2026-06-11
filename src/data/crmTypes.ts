export type LineOfBusiness = 'Commercial' | 'Personal lines' | 'Life & health'
export type ClientStatus = 'Client' | 'Prospect'
export type ClientAccountStatus = 'Active' | 'Inactive' | 'Prospect'
export type QuoteLine = 'Auto' | 'Home' | 'Commercial' | 'Other'

export type AgencyAccount = {
  id: string
  name: string
  plan: 'Demo' | 'Starter' | 'Pro' | 'Enterprise'
}

export type UserRole = 'Agent/Owner' | 'Principal Agent' | 'Producer' | 'CSR' | 'Admin'

export type UserProfile = {
  id: string
  accountId: string
  name: string
  initials: string
  role: UserRole
}

export type ClientType = 'Personal' | 'Business'

export type Client = {
  id: string
  accountId: string
  ownerUserId: string
  // ─── Client classification ──────────────────────────────────────
  clientType?: ClientType           // 'Personal' or 'Business'
  // ─── Personal identity (IVANS / ACORD required for personal lines)
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string                   // Jr., Sr., III, etc.
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say'
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Domestic Partner'
  ssnRef?: string                   // last 4 only stored in UI; full SSN never persisted
  driverLicenseNumber?: string
  driverLicenseState?: string
  // ─── Business identity (ACORD commercial required) ──────────────
  dbaName?: string
  businessType?: 'LLC' | 'Corporation' | 'S-Corp' | 'Partnership' | 'Sole Proprietor' | 'Non-Profit' | 'Other'
  taxId?: string                    // EIN for business, reference only for personal
  yearsInBusiness?: number
  numberOfEmployees?: number
  annualRevenue: number
  // ─── Core identity ───────────────────────────────────────────────
  name: string                      // display name (full name or business name)
  primaryContact: string            // person to contact
  status: ClientStatus
  accountStatus?: ClientAccountStatus
  lineOfBusiness: LineOfBusiness
  // ─── Contact ─────────────────────────────────────────────────────
  email?: string
  phone?: string
  alternatePhone?: string
  preferredContactMethod?: 'Phone' | 'Email' | 'Portal'
  // ─── Address ─────────────────────────────────────────────────────
  mailingAddress?: string
  physicalAddress?: string
  city?: string
  state?: string
  zip?: string
  county?: string
  website?: string
  // ─── Demographics (personal lines underwriting) ──────────────────
  dob?: string                      // date of birth YYYY-MM-DD
  // ─── Assignment & billing ────────────────────────────────────────
  assignedProducerId?: string
  assignedCsrId?: string
  billingMethod?: 'Direct Bill' | 'Agency Bill' | 'Mortgagee/Escrow' | 'Premium Finance'
  paymentPlan?: string
  // ─── Metadata ────────────────────────────────────────────────────
  clientSince?: string
  lastContactedAt?: string
  notes?: string
  policyCount: number
  health: 'Strong' | 'Needs review' | 'At risk'
}

export type PaymentMethod = 'Credit Card' | 'ACH / Bank Draft' | 'Check' | 'Cash' | 'Money Order' | 'Escrow / Mortgagee' | 'Premium Finance' | 'Online Portal' | 'Merchant / Card Processor' | 'Other'
export type PaymentPlanType = 'Annual (paid in full)' | 'Semi-Annual (2 pay)' | 'Quarterly (4 pay)' | '10-Pay' | 'Monthly (EFT)' | 'Monthly (CC)' | 'Financed' | 'Escrow / Mortgage' | 'Other'
export type BillingResponsibility = 'Insured pays carrier direct' | 'Agency collects & remits' | 'Mortgagee / Escrow pays' | 'Finance company pays carrier'

export type PolicyBilling = {
  paymentMethod?: PaymentMethod
  paymentPlanType?: PaymentPlanType
  billingResponsibility?: BillingResponsibility
  installmentCount?: number
  installmentAmount?: number
  downPaymentAmount?: number
  downPaymentDate?: string
  nextPaymentDate?: string
  nextPaymentAmount?: number
  lastPaymentDate?: string
  lastPaymentAmount?: number
  paymentStatus?: 'Current' | 'Due soon' | 'Past due' | 'Paid in full' | 'NSF / Returned'
  financeCompany?: string
  financeContractNumber?: string
  financeAmount?: number
  financeMonthlyPayment?: number
  financePayoffDate?: string
  mortgageeOrLienholder?: string
  mortgageeClause?: string
  escrowAccount?: string
  creditCardLast4?: string
  creditCardExpiry?: string
  achBankName?: string
  achAccountLast4?: string
  agencyBillInvoiceNumber?: string
  agencyBillDueDate?: string
  billingNotes?: string
}

export type Policy = {
  id: string
  accountId: string
  clientId: string
  carrier: string
  policyType: string
  lineOfBusiness?: LineOfBusiness
  policyNumber?: string
  effectiveDate?: string
  premium: number
  commissionRate?: number
  billingType?: 'Direct Bill' | 'Agency Bill' | 'Financed'
  paymentPlan?: string
  paymentStatus?: 'Current' | 'Due soon' | 'Past due' | 'Paid in full'
  renewalStatus?: 'Not started' | 'Review needed' | 'Marketing' | 'Quoted' | 'Ready to bind' | 'Renewed'
  limits?: string
  coverageDetails?: Record<string, string>
  mortgageeOrLienholder?: string
  downPayment?: number
  monthlyPayment?: number
  financeCompany?: string
  producerUserId?: string
  csrUserId?: string
  notes?: string
  expirationDate: string
  billing?: PolicyBilling
  status:
    | 'Active'
    | 'Pending'
    | 'Cancelled'
    | 'Expired'
    | 'Non-Renewed'
    | 'Renewed/Replaced'
    | 'Renewal review'
    | 'Quoted'
    | 'Bound'
}

export type RelatedPartyType =
  | 'Additional Contact'
  | 'Certificate Holder'
  | 'Mortgagee'
  | 'Lienholder'
  | 'Additional Insured'
  | 'Loss Payee'
  | 'Finance Company'
  | 'Property Manager'
  | 'Bookkeeper'
  | 'Emergency Contact'

export type RelatedParty = {
  id: string
  accountId: string
  clientId: string
  policyId?: string
  type: RelatedPartyType
  name: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  referenceNumber?: string
  preference?: 'Phone' | 'Email' | 'Mail'
  isPrimary?: boolean
  doNotEmail?: boolean
  doNotCall?: boolean
  notes?: string
}

export type PolicyTransactionType =
  | 'New Business'
  | 'Renewal'
  | 'Endorsement'
  | 'Cancellation'
  | 'Reinstatement'
  | 'Rewrite'
  | 'Non-Renewal'
  | 'Binder'
  | 'Broker of Record'

export type PolicyTransactionStatus =
  | 'Requested'
  | 'Sent to Carrier'
  | 'Received'
  | 'Invoiced'
  | 'Delivered to Client'
  | 'Completed'
  | 'Cancelled'

export type PolicyTransaction = {
  id: string
  accountId: string
  clientId: string
  policyId: string
  type: PolicyTransactionType
  status: PolicyTransactionStatus
  effectiveDate?: string
  requestedDate?: string
  completedDate?: string
  premiumChange?: number
  binderNumber?: string
  description: string
  carrierContact?: string
  requestedBy?: string
  notes?: string
}

export type ClaimStatus = 'Open' | 'Pending' | 'Closed' | 'Denied' | 'Reopened'

export type ClaimRecord = {
  id: string
  accountId: string
  clientId: string
  policyId?: string
  claimNumber?: string
  carrierClaimNumber?: string
  dateOfLoss: string
  reportedDate?: string
  status: ClaimStatus
  adjusterName?: string
  adjusterPhone?: string
  adjusterEmail?: string
  paidAmount?: number
  reserveAmount?: number
  description: string
  documentsStatus?: 'Needed' | 'Requested' | 'Received' | 'Reviewed'
  includeInLossRuns?: boolean
  followUpDate?: string
  notes?: string
}

export type RiskAssetType = 'Commercial Location' | 'Vehicle' | 'Driver' | 'Property'

export type RiskAsset = {
  id: string
  accountId: string
  clientId: string
  policyId?: string
  type: RiskAssetType
  name: string
  status?: 'Active' | 'Inactive' | 'Needs review'
  address?: string
  year?: string
  make?: string
  model?: string
  vin?: string
  driverName?: string
  driverLicenseNumber?: string
  driverLicenseState?: string
  dateOfBirth?: string
  annualMileage?: number
  usage?: string
  payroll?: number
  annualSales?: number
  squareFootage?: number
  constructionType?: string
  occupancy?: string
  roofYear?: string
  protectionClass?: string
  notes?: string
}

export type PaymentLedgerEntry = {
  id: string
  accountId: string
  clientId: string
  policyId?: string
  paymentDate: string
  amount: number
  method: PaymentMethod
  referenceNumber?: string
  receiptNumber?: string
  postedBy: string
  status: 'Posted' | 'Pending' | 'Returned' | 'Voided'
  remitTo?: string
  remittanceDueDate?: string
  carrierPayableAmount?: number
  remittanceStatus?: 'Not Due' | 'Needs Remittance' | 'Scheduled' | 'Paid' | 'On Hold'
  notes?: string
}

export type CommissionStatement = {
  id: string
  accountId: string
  clientId: string
  policyId?: string
  carrier: string
  statementDate: string
  premium: number
  commissionRate: number
  commissionAmount: number
  producerUserId?: string
  status: 'Expected' | 'Received' | 'Reconciled' | 'Disputed'
  notes?: string
}

export type Renewal = {
  id: string
  accountId: string
  clientId: string
  policyId: string
  dueDate: string
  status: 'Review docs' | 'Quote pending' | 'Client outreach' | 'Ready to bind'
}

export type TaskPriority = 'Low' | 'Normal' | 'Medium' | 'High' | 'Urgent'

export type Task = {
  id: string
  accountId: string
  clientId?: string
  relatedPolicyId?: string
  assignedToUserId: string
  createdByUserId: string
  title: string
  description?: string
  dueLabel: string
  dueDate?: string
  reminderDate?: string
  priority: TaskPriority
  completed: boolean
  status?: 'Open' | 'In Progress' | 'Completed'
}

export type OpportunityStage = 'New lead' | 'Discovery' | 'Quoting' | 'Proposal' | 'Bound' | 'Lost'

export type Opportunity = {
  id: string
  accountId: string
  ownerUserId: string
  clientName: string
  stage: OpportunityStage
  estimatedPremium: number
}

export type QuoteRequest = {
  id: string
  accountId: string
  clientId: string
  createdByUserId: string
  line: QuoteLine
  status: 'Started' | 'Submitted' | 'Quoted' | 'Bound' | 'Lost'
  createdAt: string
}

export type CarrierResource = {
  id: string
  accountId: string
  name: string
  category: 'Carrier portal' | 'Comparative rater' | 'Document library'
  lines: QuoteLine[]
  url: string
  note: string
}

export type ClientNote = {
  id: string
  accountId: string
  clientId: string
  createdByUserId: string
  createdAt: string
  type?: 'General' | 'Renewal' | 'Payment' | 'Claim' | 'Underwriting' | 'Follow-up'
  pinned?: boolean
  body: string
}

export type AcordFormStatus = 'draft' | 'generated' | 'completed'

export type AcordDraft = {
  id: string
  accountId: string
  clientId: string
  formType: string
  formTitle: string
  answers: Record<string, string>
  status: AcordFormStatus
  generatedFileName?: string
  generatedAt?: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type CloudDocumentFolderProvider =
  | 'google_drive'
  | 'microsoft_onedrive'
  | 'dropbox'
  | 'box'
  | 'other'

export type ClientCloudFolder = {
  id: string
  accountId: string
  clientId: string
  provider: CloudDocumentFolderProvider
  folderName: string
  folderUrl: string
  folderId?: string
  notes?: string
  connectedBy: string
  createdAt: string
  updatedAt: string
  active: boolean
}

export type CrmDataset = {
  agency: AgencyAccount
  currentUser: UserProfile
  users: UserProfile[]
  clients: Client[]
  policies: Policy[]
  renewals: Renewal[]
  tasks: Task[]
  opportunities: Opportunity[]
  quoteRequests: QuoteRequest[]
  carrierResources: CarrierResource[]
  notes: ClientNote[]
  relatedParties: RelatedParty[]
  policyTransactions: PolicyTransaction[]
  claims: ClaimRecord[]
  riskAssets: RiskAsset[]
  paymentLedger: PaymentLedgerEntry[]
  commissionStatements: CommissionStatement[]
  acordDrafts: AcordDraft[]
  clientCloudFolders: ClientCloudFolder[]
}
