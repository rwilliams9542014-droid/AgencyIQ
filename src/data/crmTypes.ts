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

export type Client = {
  id: string
  accountId: string
  ownerUserId: string
  assignedProducerId?: string
  assignedCsrId?: string
  clientSince?: string
  preferredContactMethod?: 'Phone' | 'Email' | 'Text' | 'Portal'
  billingMethod?: 'Direct Bill' | 'Agency Bill' | 'Mortgagee/Escrow' | 'Premium Finance'
  paymentPlan?: string
  lastContactedAt?: string
  name: string
  dbaName?: string
  status: ClientStatus
  accountStatus?: ClientAccountStatus
  lineOfBusiness: LineOfBusiness
  primaryContact: string
  email?: string
  phone?: string
  alternatePhone?: string
  mailingAddress?: string
  physicalAddress?: string
  website?: string
  taxId?: string
  dob?: string
  notes?: string
  policyCount: number
  annualRevenue: number
  health: 'Strong' | 'Needs review' | 'At risk'
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
  mortgageeOrLienholder?: string
  downPayment?: number
  monthlyPayment?: number
  financeCompany?: string
  producerUserId?: string
  csrUserId?: string
  notes?: string
  expirationDate: string
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

export type OpportunityStage = 'New lead' | 'Discovery' | 'Quoting' | 'Proposal' | 'Bound'

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
}
