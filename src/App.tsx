import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bell, Bot, BriefcaseBusiness, CalendarClock, CircleCheck as CheckCircle2, ChevronRight, ChevronDown, CircleDollarSign, Gauge, Handshake, MessageSquare, LayoutDashboard, Lock, Mail, Menu, Moon, Palette, RefreshCcw, Search, Send, SlidersHorizontal, Settings, Sparkles, Sun, UsersRound, X, Zap } from 'lucide-react'
import agencyIqLogo from './assets/agencyiq-logo.png'
import { canViewOwnerAnalytics } from './auth/permissions'
import { IvansPanel } from './components/IvansPanel'
import { NewClientWizard } from './components/NewClientWizard'
import { supabase } from './lib/supabase'
import mascotImg from './assets/AGENCYIQ_MASCOT_CLEAR.png'
import type { Client, CrmDataset, Policy, PolicyBilling, UserRole } from './data/crmTypes'
import { createRecordId, loadDataset, saveDataset } from './data/scopedStorage'
import './App.css'

type Metric = {
  label: string
  value: string
  detail: string
  trend: string
}

type OwnerReport = {
  label: string
  value: string
  detail: string
  status: string
  breakdown: {
    userName: string
    meta: string
    value: string
  }[]
}

type AppView = 'dashboard' | 'clients' | 'profile' | 'leads' | 'renewals' | 'ivans'
type DashboardWidgetId =
  | 'communications'
  | 'recentActivity'
  | 'followUps'
  | 'renewals'
  | 'keyAccounts'
  | 'ownerReports'
type ClientFilter = 'All' | 'Personal Lines' | 'Commercial Lines' | 'Active' | 'Prospect' | 'Inactive' | 'Renewal Due'
type ClientSort = 'name-asc' | 'name-desc' | 'renewal-asc' | 'premium-desc'
type ClientTab =
  | 'Overview'
  | 'Contact & Account'
  | 'Policies'
  | 'Billing'
  | 'Tasks'
  | 'Notes & History'
  | 'Communications'
  | 'Activity'
type PolicyFilter = 'All' | 'Active' | 'Renewal Review' | 'Expired' | 'Cancelled' | 'Rewritten' | 'Prior History'

type ModalType =
  | 'addClient'
  | 'addPolicy'
  | 'editClient'
  | 'editPolicy'
  | 'editBilling'
  | 'addTask'
  | 'addNote'
  | 'addLead'
  | 'carrierPortal'
  | null

type Toast = { id: number; message: string }

type Notification = {
  id: string
  title: string
  body: string
  type: 'renewal' | 'task' | 'payment' | 'lead' | 'system'
  read: boolean
  createdAt: string
}

type CarrierPortalEntry = {
  id: string
  name: string
  url: string
  username: string
  notes: string
}

const ISO_POLICY_TYPES = [
  'Personal auto',
  'Homeowners (HO-3)',
  'Homeowners (HO-5)',
  'DP-1 (dwelling fire)',
  'DP-3 (dwelling fire)',
  'HO-3 excluding wind',
  'Umbrella – personal',
  'General liability',
  'Business owners policy (BOP)',
  'Commercial property',
  'Commercial auto',
  'Workers compensation',
  'Professional liability (E&O)',
  'Commercial package policy (CPP)',
  'Inland marine',
  'Liquor liability',
  'Motor truck cargo',
  'Cyber liability',
  'Directors & officers (D&O)',
  'Employment practices liability (EPLI)',
  'Umbrella – commercial',
  'Auto fleet',
  'Equipment floater',
  'Contractors equipment',
]

const KNOWN_CARRIERS = [
  'Travelers',
  'Progressive',
  'CNA',
  'Chubb',
  'Safeco',
  'The Hartford',
  'Nationwide',
  'Liberty Mutual',
  'Zurich',
  'AmTrust',
  'State Auto',
  'Westfield',
  'Employers',
  'ICW Group',
  'Berkley One',
  'State Farm',
  'Allstate',
  'USAA',
  'Farmers',
  'Erie Insurance',
  'Cincinnati Financial',
  'Auto-Owners',
  'Great West',
  'Bristol West',
  'Markel',
  'Philadelphia Insurance',
  'Hanover Insurance',
  'Acuity',
  'Sentry',
  'EMPLOYERS Holdings',
]

type PaletteId =
  | 'coastal'
  | 'sapphire'
  | 'graphite'
  | 'agencyiq'
  | 'evergreen'
  | 'plum'
  | 'classic'
  | 'contrast'
type ColorMode = 'light' | 'dark'

type ThemeOption = {
  id: PaletteId
  label: string
  colors: string[]
}

const defaultPalette: PaletteId = 'agencyiq'

const themeOptions: ThemeOption[] = [
  {
    id: 'coastal',
    label: 'Coastal Teal',
    colors: ['#1d6f76', '#347a9b', '#c58a20'],
  },
  {
    id: 'sapphire',
    label: 'Sapphire Trust',
    colors: ['#1e40af', '#0d9488', '#64748b'],
  },
  {
    id: 'graphite',
    label: 'Graphite Amber',
    colors: ['#0f172a', '#d97706', '#475569'],
  },
  {
    id: 'agencyiq',
    label: 'AgencyIQ Glow',
    colors: ['#050b16', '#18d4c3', '#f5b21b'],
  },
  {
    id: 'evergreen',
    label: 'Evergreen Copper',
    colors: ['#124034', '#2f7d62', '#b7791f'],
  },
  {
    id: 'plum',
    label: 'Plum Executive',
    colors: ['#34233b', '#7c3aed', '#0f766e'],
  },
  {
    id: 'classic',
    label: 'Classic Simple',
    colors: ['#1f2937', '#2563eb', '#f8fafc'],
  },
  {
    id: 'contrast',
    label: 'High Contrast',
    colors: ['#111827', '#0f766e', '#ffffff'],
  },
]

const isPaletteId = (value: string | null): value is PaletteId => {
  return themeOptions.some((option) => option.id === value)
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  notation: 'compact',
})

const roleOptions: UserRole[] = ['Agent/Owner', 'Admin', 'Producer', 'CSR']
const clientFilters: ClientFilter[] = [
  'All',
  'Personal Lines',
  'Commercial Lines',
  'Active',
  'Prospect',
  'Inactive',
  'Renewal Due',
]
const clientTabs: ClientTab[] = [
  'Overview',
  'Contact & Account',
  'Policies',
  'Billing',
  'Tasks',
  'Notes & History',
  'Communications',
  'Activity',
]

const policyFilters: PolicyFilter[] = [
  'All',
  'Active',
  'Renewal Review',
  'Expired',
  'Cancelled',
  'Rewritten',
  'Prior History',
]

const dashboardWidgets: { id: DashboardWidgetId; label: string }[] = [
  { id: 'communications', label: 'Communications' },
  { id: 'recentActivity', label: 'Recent Activity' },
  { id: 'followUps', label: "Today's Follow-Ups" },
  { id: 'renewals', label: 'Upcoming Renewals' },
  { id: 'keyAccounts', label: 'Key Accounts' },
  { id: 'ownerReports', label: 'Owner Reports' },
]

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

const formatDateTime = (date: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

const formatFullDate = (date: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

const getClientTypeLabel = (lineOfBusiness: string) => {
  if (lineOfBusiness === 'Commercial') {
    return 'Commercial'
  }

  if (lineOfBusiness === 'Personal lines') {
    return 'Personal Lines'
  }

  return 'Both'
}

const addYears = (date: string, years: number) => {
  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setFullYear(nextDate.getFullYear() + years)
  return nextDate.toISOString().slice(0, 10)
}

const activePolicyStatuses = ['Active', 'Renewal review', 'Bound'] as const

const getPolicyCoverageBucket = (policyType: string) => {
  const normalized = policyType.toLowerCase()

  if (normalized.includes('auto') || normalized.includes('fleet')) {
    return 'auto'
  }

  if (normalized.includes('home')) {
    return 'home'
  }

  if (
    normalized.includes('commercial') ||
    normalized.includes('business') ||
    normalized.includes('liability') ||
    normalized.includes('workers') ||
    normalized.includes('property') ||
    normalized.includes('cargo')
  ) {
    return 'commercial'
  }

  return normalized
}

const isActivePolicy = (status: string) => activePolicyStatuses.some((activeStatus) => activeStatus === status)

const getUserName = (dataset: CrmDataset, userId: string) => {
  return dataset.users.find((user) => user.id === userId)?.name ?? 'Unassigned'
}

const groupByUser = <T extends { userId: string }>(items: T[]) => {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    return {
      ...groups,
      [item.userId]: [...(groups[item.userId] ?? []), item],
    }
  }, {})
}

const getOwnerReports = (dataset: CrmDataset): OwnerReport[] => {
  const boundOpportunities = dataset.opportunities.filter((opportunity) => opportunity.stage === 'Bound')
  const newBusinessPremium = boundOpportunities
    .reduce((total, opportunity) => total + opportunity.estimatedPremium, 0)
  const renewalPremium = dataset.renewals.reduce((total, renewal) => {
    const policy = dataset.policies.find((item) => item.id === renewal.policyId)
    return total + (policy?.premium ?? 0)
  }, 0)
  const missedSales = dataset.opportunities.filter((opportunity) => opportunity.stage === 'Proposal')
  const missedSalesValue = missedSales.reduce(
    (total, opportunity) => total + opportunity.estimatedPremium,
    0,
  )
  const incompleteTasks = dataset.tasks.filter((task) => !task.completed)
  const highPriorityIncomplete = incompleteTasks.filter((task) => task.priority === 'High')
  const writtenByUser = groupByUser(
    boundOpportunities.map((opportunity) => ({
      ...opportunity,
      userId: opportunity.ownerUserId,
    })),
  )
  const missedByUser = groupByUser(
    missedSales.map((opportunity) => ({
      ...opportunity,
      userId: opportunity.ownerUserId,
    })),
  )
  const incompleteByUser = groupByUser(
    incompleteTasks.map((task) => ({
      ...task,
      userId: task.assignedToUserId,
    })),
  )

  return [
    {
      label: 'New business written premium',
      value: compactCurrency.format(newBusinessPremium),
      detail: 'Bound opportunities this period',
      status: `${boundOpportunities.length} bound accounts`,
      breakdown: Object.entries(writtenByUser).map(([userId, items]) => ({
        userName: getUserName(dataset, userId),
        meta: `${items.length} bound`,
        value: compactCurrency.format(
          items.reduce((total, opportunity) => total + opportunity.estimatedPremium, 0),
        ),
      })),
    },
    {
      label: 'Renewal premium retention',
      value: compactCurrency.format(renewalPremium),
      detail: 'Premium currently in renewal queue',
      status: 'Retention tracking ready',
      breakdown: dataset.renewals.slice(0, 3).map((renewal) => {
        const policy = dataset.policies.find((item) => item.id === renewal.policyId)
        const client = dataset.clients.find((item) => item.id === renewal.clientId)
        return {
          userName: client?.name ?? 'Unknown client',
          meta: renewal.status,
          value: compactCurrency.format(policy?.premium ?? 0),
        }
      }),
    },
    {
      label: 'Missed sale report',
      value: compactCurrency.format(missedSalesValue),
      detail: 'Proposal-stage quotes not yet won',
      status: `${missedSales.length} quotes need review`,
      breakdown: Object.entries(missedByUser).map(([userId, items]) => ({
        userName: getUserName(dataset, userId),
        meta: `${items.length} missed/at-risk quote${items.length === 1 ? '' : 's'}`,
        value: compactCurrency.format(
          items.reduce((total, opportunity) => total + opportunity.estimatedPremium, 0),
        ),
      })),
    },
    {
      label: 'Follow-up incompletion',
      value: String(incompleteTasks.length),
      detail: 'Open tasks and follow-ups',
      status: `${highPriorityIncomplete.length} high priority`,
      breakdown: Object.entries(incompleteByUser).map(([userId, items]) => ({
        userName: getUserName(dataset, userId),
        meta: `${items.filter((task) => task.priority === 'High').length} high priority`,
        value: `${items.length} open`,
      })),
    },
  ]
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Clients', icon: UsersRound },
  { label: 'Renewals', icon: RefreshCcw },
  { label: 'Leads', icon: Handshake },
  { label: 'Reports', icon: Gauge },
  { label: 'Administration', icon: Settings },
]

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  type: 'renewal' | 'followup' | 'custom'
}

function defaultEmailTemplates(): EmailTemplate[] {
  return [
    {
      id: 'tpl-1',
      name: 'Standard Renewal Reminder',
      subject: 'Your policy is coming up for renewal',
      type: 'renewal',
      body: "Hi [CLIENT_NAME],\n\nYour [POLICY_TYPE] policy with [CARRIER] is coming up for renewal on [RENEWAL_DATE]. We want to make sure you have the best coverage at the best rate.\n\nI'll be reaching out shortly to review your options, but please don't hesitate to call or email us if you have questions in the meantime.\n\nThank you for your continued trust.\n\n[AGENT_NAME]\n[AGENCY_NAME]",
    },
    {
      id: 'tpl-2',
      name: '30-Day Urgency Reminder',
      subject: 'Action needed — policy renews in 30 days',
      type: 'renewal',
      body: 'Hi [CLIENT_NAME],\n\nThis is a reminder that your [POLICY_TYPE] policy expires on [RENEWAL_DATE] — just 30 days away.\n\nWe\'ve been preparing your renewal options and would love to schedule a quick review. Reply to this email or call us at [AGENT_PHONE] to confirm your renewal or explore alternatives.\n\nWe value your business and want to ensure there are no gaps in coverage.\n\n[AGENT_NAME]\n[AGENCY_NAME]',
    },
    {
      id: 'tpl-3',
      name: 'Final Notice — 7 Days',
      subject: 'URGENT: Your policy expires in 7 days',
      type: 'renewal',
      body: 'Hi [CLIENT_NAME],\n\nThis is an important notice that your [POLICY_TYPE] policy with [CARRIER] expires in 7 days on [RENEWAL_DATE].\n\nPlease contact us immediately to avoid a lapse in coverage. A lapse can affect your rates and leave you unprotected.\n\nCall us now at [AGENT_PHONE] or reply to this email.\n\n[AGENT_NAME]\n[AGENCY_NAME]',
    },
    {
      id: 'tpl-4',
      name: 'Auto-Follow-Up (No Response)',
      subject: 'Following up on your upcoming renewal',
      type: 'followup',
      body: 'Hi [CLIENT_NAME],\n\nI wanted to follow up on my previous message regarding your [POLICY_TYPE] renewal due [RENEWAL_DATE]. I haven\'t heard back and want to make sure everything is taken care of.\n\nPlease reach out at your earliest convenience — we\'re here to make this renewal easy.\n\n[AGENT_NAME]\n[AGENCY_NAME]',
    },
  ]
}

const getRenewalAiSuggestion = (daysUntil: number, billingType?: string, paymentMethod?: string): { label: string; color: string; tip: string } => {
  const isEscrow = billingType?.toLowerCase().includes('escrow') || paymentMethod?.toLowerCase().includes('escrow')
  const isAutopay = paymentMethod?.toLowerCase().includes('eft') || paymentMethod?.toLowerCase().includes('ach') || paymentMethod?.toLowerCase().includes('monthly (eft)')
  if (isEscrow) return { label: 'Escrow — verify active', color: 'ai-tag--info', tip: 'Mortgage company handles premium. Verify mortgagee clause is current, confirm escrow is funded, and check for any billing notices from carrier.' }
  if (isAutopay) return { label: 'Auto-pay — confirm drafted', color: 'ai-tag--active', tip: 'Payment should draft automatically. Confirm the draft posted, review coverage levels, and check for any limit or exposure changes needed.' }
  if (daysUntil < 0) return { label: 'PAST DUE — act now', color: 'ai-tag--critical', tip: 'Policy has lapsed or is at risk of lapse. Contact client immediately, confirm carrier grace period, and process renewal or reinstatement.' }
  if (daysUntil <= 7) return { label: 'Expires in 7 days — urgent', color: 'ai-tag--urgent', tip: 'Less than 7 days remaining. If renewal is not bound, call client today. Confirm payment method and secure signed application.' }
  if (daysUntil <= 30) return { label: 'Follow up — 30-day window', color: 'ai-tag--active', tip: 'Active renewal window. Send renewal package, request updated exposures or application, and quote alternatives if premium increased.' }
  if (daysUntil <= 60) return { label: 'Start review — 60 days', color: 'ai-tag--active', tip: 'Good time to pull loss runs, review current limits, and begin market search if needed. Set a 30-day follow-up task.' }
  return { label: 'Early tracking', color: 'ai-tag--neutral', tip: 'Not yet in active renewal window. Monitor and flag for 60-day outreach.' }
}

function buildNotifications(): Notification[] {
  return [
    { id: 'notif-1', title: 'Renewal due in 7 days', body: 'Northstar Logistics – Auto Fleet policy expires Jun 19.', type: 'renewal', read: false, createdAt: new Date().toISOString() },
    { id: 'notif-2', title: 'Payment past due', body: 'Harbor View Dental – BOP monthly payment is overdue.', type: 'payment', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'notif-3', title: 'New lead assigned', body: 'Blue Peak Roofing proposal is awaiting your review.', type: 'lead', read: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'notif-4', title: 'Task overdue', body: 'Collect driver list from Northstar Logistics was due yesterday.', type: 'task', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'notif-5', title: 'Renewal queue update', body: 'Cedar & Main Workers Comp is in client outreach stage.', type: 'renewal', read: true, createdAt: new Date(Date.now() - 172800000).toISOString() },
  ]
}

const AI_ANSWERS: Record<string, string> = {
  default: 'This is a demo AI assistant. In the full version, questions about coverage, premiums, limits, deductibles, renewals, and billing will receive detailed plain-English explanations tailored to your client\'s specific policy. You can use this for renewal talking points, client education, and draft responses.',
  premium: 'Premium increases are driven by several factors: claims history (loss runs), carrier rate changes in your state, increased replacement cost values, changes to the insured\'s operations or exposures, and market conditions. For personal lines, credit score, driving record, and claims history are primary drivers. For commercial, payroll, revenues, square footage, and fleet size all affect the premium calculation.',
  coverage: 'A General Liability policy covers third-party bodily injury and property damage claims arising from your business operations. It does not cover employee injuries (that\'s Workers\' Comp), professional errors (that\'s E&O), or your own property. The key numbers to know are: per-occurrence limit (max per single claim), aggregate limit (max for the entire policy period), and products-completed operations limit.',
  limit: 'Whether a limit is adequate depends on the client\'s exposure. For a small retail business, $1M/$2M GL is common. For contractors, $2M/$4M is often required by general contractors. The rule of thumb: the limit should exceed the worst realistic single claim scenario. If the client has high-value customers or works on large projects, always consider whether an umbrella is needed.',
  draft: 'Here is a professional response template:\n\n"Thank you for reaching out about your recent premium change. Your policy renewed at $[AMOUNT] this year, reflecting [carrier name]\'s updated rates for [coverage type]. I\'d be happy to schedule a quick call to walk through the changes, review your current coverage levels, and explore whether any adjustments make sense. Please let me know a convenient time."',
  deductible: 'A higher deductible lowers your annual premium but means you pay more out-of-pocket at claim time. For clients who rarely file claims and have cash reserves, a higher deductible is a smart savings strategy. For clients with tight cash flow, a lower deductible provides predictability. The break-even point is usually 3-5 years of premium savings equaling the deductible increase.',
  renewal: 'Key renewal talking points: 1) Review any coverage gaps identified during the year. 2) Update values – replacement costs rise with inflation. 3) Check if operations or exposures changed (new vehicles, employees, locations). 4) Ask about any claims or incidents not yet reported. 5) Compare incumbent carrier terms against market alternatives. 6) Confirm billing method and payment plan preferences.',
}

function getAiAnswer(query: string): string {
  const q = query.toLowerCase()
  if (q.includes('premium') || q.includes('increase') || q.includes('rate')) return AI_ANSWERS.premium
  if (q.includes('coverage') || q.includes('what does') || q.includes('plain english')) return AI_ANSWERS.coverage
  if (q.includes('limit') || q.includes('too high') || q.includes('too low')) return AI_ANSWERS.limit
  if (q.includes('draft') || q.includes('response') || q.includes('professional')) return AI_ANSWERS.draft
  if (q.includes('deductible') || q.includes('tradeoff') || q.includes('compare')) return AI_ANSWERS.deductible
  if (q.includes('renewal') || q.includes('talking point') || q.includes('summarize')) return AI_ANSWERS.renewal
  return AI_ANSWERS.default
}

function App() {
  const [dataset, setDataset] = useState<CrmDataset>(() => loadDataset())
  const [palette, setPalette] = useState<PaletteId>(() => {
    const savedPalette = localStorage.getItem('agencyiq-palette')
    return isPaletteId(savedPalette) ? savedPalette : defaultPalette
  })
  const [mode, setMode] = useState<ColorMode>(() => {
    return localStorage.getItem('agencyiq-mode') === 'dark' ? 'dark' : 'light'
  })
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [aiHelpOpen, setAiHelpOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('profile')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientFilter>('All')
  const [clientTab, setClientTab] = useState<ClientTab>('Overview')
  const [policyFilter, setPolicyFilter] = useState<PolicyFilter>('All')
  const [hiddenDashboardWidgets, setHiddenDashboardWidgets] = useState<DashboardWidgetId[]>([])
  const [selectedClientId, setSelectedClientId] = useState(() => dataset.clients[0]?.id ?? '')
  const [modal, setModal] = useState<ModalType>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(() => buildNotifications())
  const [dashboardWidgetOrder, setDashboardWidgetOrder] = useState<DashboardWidgetId[]>([
    'communications', 'recentActivity', 'followUps', 'renewals', 'keyAccounts', 'ownerReports',
  ])
  const [dragWidgetId, setDragWidgetId] = useState<DashboardWidgetId | null>(null)
  const [dragOverWidgetId, setDragOverWidgetId] = useState<DashboardWidgetId | null>(null)
  const [customPolicyTypes, setCustomPolicyTypes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-policy-types') ?? '[]') } catch { return [] }
  })
  const [customCarriers, setCustomCarriers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-carriers') ?? '[]') } catch { return [] }
  })
  const [carrierPortals, setCarrierPortals] = useState<CarrierPortalEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-carrier-portals') ?? '[]') } catch { return [] }
  })
  const [aiQuery, setAiQuery] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [billingPolicyId, setBillingPolicyId] = useState<string | null>(null)
  const [clientPage, setClientPage] = useState(0)
  const [clientSort, setClientSort] = useState<ClientSort>('name-asc')
  const CLIENT_PAGE_SIZE = 24
  // Renewal center state
  const todayDate = new Date()
  const [renewalMonth, setRenewalMonth] = useState(() => `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`)
  const [renewalDateFrom, setRenewalDateFrom] = useState('')
  const [renewalDateTo, setRenewalDateTo] = useState('')
  const [hideEscrow, setHideEscrow] = useState(false)
  const [hideAutopay, setHideAutopay] = useState(false)
  const [selectedRenewalIds, setSelectedRenewalIds] = useState<Set<string>>(new Set())
  const [renewalOutreachModal, setRenewalOutreachModal] = useState<'email' | 'text' | null>(null)
  const [renewalSort, setRenewalSort] = useState<'date' | 'name' | 'carrier' | 'billing'>('date')
  const [renewalPremiumEdits, setRenewalPremiumEdits] = useState<Record<string, string>>({})
  // IVANS sync tracking: map of policyNumber -> { syncedAt, carrierName, renewalStatus }
  // keyed by policy number so we can match against CRM policies by number
  const [ivansSyncMap, setIvansSyncMap] = useState<Record<string, { syncedAt: string; carrierName: string; renewalStatus: string; policyNumber: string }>>({})
  const [ivansLastGlobalSync, setIvansLastGlobalSync] = useState<string | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-email-templates') ?? 'null') ?? defaultEmailTemplates() } catch { return defaultEmailTemplates() }
  })
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [renewalViewMode, setRenewalViewMode] = useState<'month' | 'range'>('month')

  // Load IVANS sync data from Supabase so client cards show last-synced indicators
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('ivans_policy_sync')
          .select('policy_number, carrier_name, renewal_status, synced_at, merge_status')
          .eq('account_id', dataset.agency.id)
          .order('synced_at', { ascending: false })
          .limit(500)
        if (data && data.length > 0) {
          const map: Record<string, { syncedAt: string; carrierName: string; renewalStatus: string; policyNumber: string }> = {}
          for (const row of data) {
            if (!map[row.policy_number]) {
              map[row.policy_number] = { syncedAt: row.synced_at, carrierName: row.carrier_name, renewalStatus: row.renewal_status, policyNumber: row.policy_number }
            }
          }
          setIvansSyncMap(map)
          setIvansLastGlobalSync(data[0].synced_at)
        }
      } catch (_e) {
        // Supabase not configured — IVANS sync indicators stay hidden
      }
    }
    load()
  }, [dataset.agency.id])

  useEffect(() => {
    localStorage.setItem('agencyiq-palette', palette)
  }, [palette])

  useEffect(() => {
    localStorage.setItem('agencyiq-mode', mode)
  }, [mode])

  useEffect(() => {
    saveDataset(dataset)
  }, [dataset])

  useEffect(() => {
    localStorage.setItem('agencyiq-policy-types', JSON.stringify(customPolicyTypes))
  }, [customPolicyTypes])

  useEffect(() => {
    localStorage.setItem('agencyiq-carriers', JSON.stringify(customCarriers))
  }, [customCarriers])

  useEffect(() => {
    localStorage.setItem('ag
    )
  }
  )
}encyiq-carrier-portals', JSON.stringify(carrierPortals))
  }, [carrierPortals])

  useEffect(() => {
    localStorage.setItem('agencyiq-email-templates', JSON.stringify(emailTemplates))
  }, [emailTemplates])

  const canSeeOwnerAnalytics = canViewOwnerAnalytics(dataset.currentUser)
  const ownerReports = useMemo(() => getOwnerReports(dataset), [dataset])
  const visibleNavItems = navItems
  const todayIso = new Date().toISOString().slice(0, 10)
  const openTasks = dataset.tasks.filter((task) => !task.completed)
  const tasksDueToday = openTasks.filter((task) => task.dueDate === todayIso || task.dueLabel === 'Today')
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < todayIso)
  const followUpsDueToday = openTasks.filter((task) => task.reminderDate === todayIso || task.dueLabel === 'Today')
  const policiesExpiringSoon = dataset.policies.filter((policy) => {
    const daysUntilExpiration =
      (new Date(`${policy.expirationDate}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime()) /
      86_400_000

    return daysUntilExpiration >= 0 && daysUntilExpiration <= 60
  })
  const activeProspects = dataset.opportunities.filter((opportunity) => opportunity.stage !== 'Bound')
  const dashboardFocusMetrics: Metric[] = [
    {
      label: 'Tasks Due Today',
      value: String(tasksDueToday.length),
      detail: 'Client work scheduled for today',
      trend: `${followUpsDueToday.length} follow-ups due`,
    },
    {
      label: 'Overdue Tasks',
      value: String(overdueTasks.length),
      detail: 'Items needing immediate recovery',
      trend: 'Escalate before end of day',
    },
    {
      label: 'Renewals Needing Attention',
      value: String(dataset.renewals.length),
      detail: 'Open renewal queue',
      trend: `${policiesExpiringSoon.length} policies expiring soon`,
    },
    {
      label: 'New Prospects / Leads',
      value: String(activeProspects.length),
      detail: 'Open opportunities before conversion',
      trend: `${dataset.quoteRequests.filter((quote) => quote.status === 'Quoted').length} quoted`,
    },
  ]
  const renewals = useMemo(() => {
    return dataset.renewals.map((renewal) => {
      const client = dataset.clients.find((item) => item.id === renewal.clientId)
      const policy = dataset.policies.find((item) => item.id === renewal.policyId)

      return {
        id: renewal.id,
        client: client?.name ?? 'Unknown client',
        policy: policy?.policyType ?? 'Unknown policy',
        carrier: policy?.carrier ?? 'Unknown carrier',
        due: formatDate(renewal.dueDate),
        premiumDisplay: currency.format(policy?.premium ?? 0),
        status: renewal.status,
      }
    })
  }, [dataset])
  const xDatePolicies = dataset.policies
    .filter((policy) => {
      if (!['Expired', 'Non-Renewed'].includes(policy.status)) {
        return false
      }

      const coverageBucket = getPolicyCoverageBucket(policy.policyType)
      const hasActiveReplacement = dataset.policies.some((candidate) => {
        return (
          candidate.clientId === policy.clientId &&
          candidate.id !== policy.id &&
          isActivePolicy(candidate.status) &&
          getPolicyCoverageBucket(candidate.policyType) === coverageBucket
        )
      })

      return !hasActiveReplacement
    })
    .sort((left, right) => new Date(left.expirationDate).getTime() - new Date(right.expirationDate).getTime())
  const selectedClient =
    dataset.clients.find((client) => client.id === selectedClientId) ?? dataset.clients[0] ?? null
  const clientPolicies = selectedClient
    ? dataset.policies
        .filter((policy) => policy.clientId === selectedClient.id)
        .sort((left, right) => new Date(right.expirationDate).getTime() - new Date(left.expirationDate).getTime())
    : []
  const clientRenewals = selectedClient
    ? dataset.renewals.filter((renewal) => renewal.clientId === selectedClient.id)
    : []
  const clientTasks = selectedClient
    ? dataset.tasks.filter((task) => task.clientId === selectedClient.id)
    : []
  const clientNotes = selectedClient
    ? dataset.notes.filter((note) => note.clientId === selectedClient.id)
    : []
  const activeClientPolicies = clientPolicies.filter((policy) =>
    isActivePolicy(policy.status),
  )
  const filteredClientPolicies = clientPolicies.filter((policy) => {
    if (policyFilter === 'All') {
      return true
    }

    if (policyFilter === 'Active') {
      return isActivePolicy(policy.status)
    }

    if (policyFilter === 'Renewal Review') {
      return policy.status === 'Renewal review'
    }

    if (policyFilter === 'Rewritten') {
      return policy.status === 'Renewed/Replaced'
    }

    if (policyFilter === 'Prior History') {
      return ['Expired', 'Non-Renewed', 'Renewed/Replaced'].includes(policy.status)
    }

    return policy.status === policyFilter
  })
  const selectedClientPremium = clientPolicies.reduce((total, policy) => total + policy.premium, 0)
  const selectedClientCommission = clientPolicies.reduce(
    (total, policy) => total + (policy.premium * (policy.commissionRate ?? 0)) / 100,
    0,
  )
  const selectedClientNextRenewal = clientPolicies
    .map((policy) => policy.expirationDate)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]
  const selectedClientLastContacted = selectedClient?.lastContactedAt
    ? formatDateTime(selectedClient.lastContactedAt)
    : clientNotes[0]?.createdAt
      ? formatDateTime(clientNotes[0].createdAt)
      : 'No contact logged'
  const selectedClientBillingMethod =
    selectedClient?.billingMethod ?? activeClientPolicies[0]?.billingType ?? 'Not set'
  const selectedClientPaymentPlan =
    selectedClient?.paymentPlan ?? activeClientPolicies[0]?.paymentPlan ?? 'Not set'
  const filteredClients = dataset.clients.filter((client) => {
    const clientPoliciesForSearch = dataset.policies.filter((policy) => policy.clientId === client.id)
    const nextRenewal = clientPoliciesForSearch
      .map((policy) => policy.expirationDate)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]
    const query = clientSearch.trim().toLowerCase()
    const matchesSearch = !query || [
      client.name,
      client.dbaName,
      client.primaryContact,
      client.phone,
      client.alternatePhone,
      client.email,
      client.mailingAddress,
      ...clientPoliciesForSearch.flatMap((policy) => [
        policy.policyType,
        policy.policyNumber,
        policy.carrier,
      ]),
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query))

    const isRenewalDue = dataset.renewals.some((renewal) => renewal.clientId === client.id)
    const matchesFilter =
      clientFilter === 'All' ||
      (clientFilter === 'Personal Lines' && client.lineOfBusiness === 'Personal lines') ||
      (clientFilter === 'Commercial Lines' && client.lineOfBusiness === 'Commercial') ||
      (clientFilter === 'Active' && client.accountStatus === 'Active') ||
      (clientFilter === 'Prospect' && client.accountStatus === 'Prospect') ||
      (clientFilter === 'Inactive' && client.accountStatus === 'Inactive') ||
      (clientFilter === 'Renewal Due' && isRenewalDue)

    return matchesSearch && matchesFilter && Boolean(nextRenewal || client)
  })

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (clientSort === 'name-asc') return a.name.localeCompare(b.name)
    if (clientSort === 'name-desc') return b.name.localeCompare(a.name)
    if (clientSort === 'renewal-asc') {
      const aRen = dataset.policies.filter((p) => p.clientId === a.id).map((p) => p.expirationDate).sort()[0] ?? '9999'
      const bRen = dataset.policies.filter((p) => p.clientId === b.id).map((p) => p.expirationDate).sort()[0] ?? '9999'
      return aRen.localeCompare(bRen)
    }
    if (clientSort === 'premium-desc') {
      const aP = dataset.policies.filter((p) => p.clientId === a.id).reduce((s, p) => s + p.premium, 0)
      const bP = dataset.policies.filter((p) => p.clientId === b.id).reduce((s, p) => s + p.premium, 0)
      return bP - aP
    }
    return 0
  })
  const pagedClients = sortedClients.slice(clientPage * CLIENT_PAGE_SIZE, (clientPage + 1) * CLIENT_PAGE_SIZE)
  const totalPages = Math.ceil(filteredClients.length / CLIENT_PAGE_SIZE)

  const updateRole = (role: UserRole) => {
    setDataset((current) => ({
      ...current,
      currentUser: {
        ...current.currentUser,
        role,
      },
    }))
  }

  const toggleDashboardWidget = (widgetId: DashboardWidgetId) => {
    setHiddenDashboardWidgets((current) =>
      current.includes(widgetId)
        ? current.filter((id) => id !== widgetId)
        : [...current, widgetId],
    )
  }

  const isWidgetVisible = (widgetId: DashboardWidgetId) => !hiddenDashboardWidgets.includes(widgetId)

  const renewPolicy = (policy: Policy) => {
    const renewalEffectiveDate = policy.expirationDate
    const renewalExpirationDate = addYears(policy.expirationDate, 1)
    const renewalYear = new Date(`${renewalExpirationDate}T12:00:00`).getFullYear()
    const renewedPolicy: Policy = {
      ...policy,
      id: createRecordId('policy'),
      policyNumber: `${policy.policyNumber ?? 'POL'}-R${renewalYear}`,
      effectiveDate: renewalEffectiveDate,
      expirationDate: renewalExpirationDate,
      premium: Math.round(policy.premium * 1.05),
      status: 'Active',
      notes: `Renewed from ${policy.policyNumber ?? policy.policyType}. Review premium, policy number, billing, and commission before finalizing.`,
    }

    setDataset((current) => ({
      ...current,
      policies: [
        renewedPolicy,
        ...current.policies.map((item) =>
          item.id === policy.id
            ? {
                ...item,
                status: 'Renewed/Replaced' as const,
                notes: `${item.notes ? `${item.notes} ` : ''}Renewed into ${renewedPolicy.policyNumber}.`,
              }
            : item,
        ),
      ],
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: policy.clientId,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'Renewal',
          pinned: false,
          body: `${policy.policyType} renewed. Prior term ${policy.policyNumber ?? ''} was replaced by ${renewedPolicy.policyNumber}.`,
        },
        ...current.notes,
      ],
    }))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))

  const reorderWidgets = (dragId: DashboardWidgetId, overId: DashboardWidgetId) => {
    setDashboardWidgetOrder((order) => {
      const from = order.indexOf(dragId)
      const to = order.indexOf(overId)
      if (from === -1 || to === -1 || from === to) return order
      const next = [...order]
      next.splice(from, 1)
      next.splice(to, 0, dragId)
      return next
    })
  }

  const addCustomPolicyType = (type: string) => {
    const trimmed = type.trim()
    if (trimmed && !ISO_POLICY_TYPES.includes(trimmed) && !customPolicyTypes.includes(trimmed)) {
      setCustomPolicyTypes((prev) => [...prev, trimmed])
    }
  }

  const addCustomCarrier = (carrier: string) => {
    const trimmed = carrier.trim()
    if (trimmed && !KNOWN_CARRIERS.includes(trimmed) && !customCarriers.includes(trimmed)) {
      setCustomCarriers((prev) => [...prev, trimmed])
    }
  }

  const saveCarrierPortal = (entry: CarrierPortalEntry) => {
    setCarrierPortals((prev) => {
      const existing = prev.findIndex((p) => p.id === entry.id)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = entry
        return next
      }
      return [...prev, entry]
    })
    setModal(null)
    showToast(`Carrier portal saved: ${entry.name}`)
  }

  const handleAiQuery = (query: string) => {
    if (!query.trim()) return
    setAiLoading(true)
    setAiAnswer('')
    setTimeout(() => {
      setAiAnswer(getAiAnswer(query))
      setAiLoading(false)
    }, 700)
  }

  const switchUser = (userId: string) => {
    const user = dataset.users.find((u) => u.id === userId)
    if (!user) return
    setDataset((current) => ({ ...current, currentUser: user }))
    setUserMenuOpen(false)
    showToast(`Switched to ${user.name}`)
  }

  const showToast = (message: string) => {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const addClient = (data: Partial<Client>, nextAction?: 'add-policy' | 'sync-carrier' | 'later') => {
    const newClient: Client = {
      id: createRecordId('client'),
      accountId: dataset.agency.id,
      ownerUserId: dataset.currentUser.id,
      name: data.name ?? '',
      primaryContact: data.primaryContact ?? data.name ?? '',
      status: 'Client',
      lineOfBusiness: data.lineOfBusiness ?? 'Personal lines',
      policyCount: 0,
      annualRevenue: data.annualRevenue ?? 0,
      health: 'Strong',
      clientSince: new Date().toISOString().slice(0, 10),
      ...data,
    }
    setDataset((current) => ({ ...current, clients: [newClient, ...current.clients] }))
    setSelectedClientId(newClient.id)
    setClientTab('Overview')
    setModal(null)
    showToast(`Client folder created for ${newClient.name}`)
    if (nextAction === 'add-policy') {
      setActiveView('profile')
      setTimeout(() => setModal('addPolicy'), 50)
    } else if (nextAction === 'sync-carrier') {
      setActiveView('ivans')
    } else {
      setActiveView('profile')
    }
  }

  const addPolicy = (data: {
    policyType: string
    carrier: string
    policyNumber: string
    premium: string
    commissionRate: string
    effectiveDate: string
    expirationDate: string
    billingType: string
    lineOfBusiness: string
  }) => {
    if (!selectedClient) return
    const newPolicy: Policy = {
      id: createRecordId('policy'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      policyType: data.policyType,
      carrier: data.carrier,
      policyNumber: data.policyNumber || undefined,
      premium: parseFloat(data.premium) || 0,
      commissionRate: parseFloat(data.commissionRate) || 0,
      effectiveDate: data.effectiveDate || undefined,
      expirationDate: data.expirationDate,
      billingType: data.billingType as 'Direct Bill' | 'Agency Bill' | 'Financed' | undefined,
      lineOfBusiness: data.lineOfBusiness as 'Commercial' | 'Personal lines' | 'Life & health' | undefined,
      status: 'Active',
      producerUserId: selectedClient.assignedProducerId,
      csrUserId: selectedClient.assignedCsrId,
    }
    setDataset((current) => ({
      ...current,
      policies: [newPolicy, ...current.policies],
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'General',
          pinned: false,
          body: `New policy added: ${newPolicy.policyType} with ${newPolicy.carrier}. Policy #${newPolicy.policyNumber ?? 'TBD'}.`,
        },
        ...current.notes,
      ],
    }))
    setModal(null)
    setClientTab('Policies')
    showToast(`Policy added: ${newPolicy.policyType}`)
  }

  const addTask = (data: {
    title: string
    description: string
    dueDate: string
    priority: string
    assignedToUserId: string
    isFollowUp: boolean
    isPaymentReminder: boolean
  }) => {
    if (!selectedClient) return
    const newTask = {
      id: createRecordId('task'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      assignedToUserId: data.assignedToUserId || dataset.currentUser.id,
      createdByUserId: dataset.currentUser.id,
      title: data.title,
      description: data.description || undefined,
      dueLabel: data.dueDate ? formatDate(data.dueDate) : 'No due date',
      dueDate: data.dueDate || undefined,
      priority: data.priority as 'Low' | 'Normal' | 'Medium' | 'High' | 'Urgent',
      completed: false,
      status: 'Open' as const,
    }
    setDataset((current) => ({ ...current, tasks: [newTask, ...current.tasks] }))
    setModal(null)
    setClientTab('Tasks')
    showToast(data.isPaymentReminder ? 'Payment reminder added' : data.isFollowUp ? 'Follow-up created' : 'Task added')
  }

  const addNote = (data: { body: string; type: string; pinned: boolean }) => {
    if (!selectedClient) return
    const newNote = {
      id: createRecordId('note'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      createdByUserId: dataset.currentUser.id,
      createdAt: new Date().toISOString(),
      type: data.type as 'General' | 'Renewal' | 'Payment' | 'Claim' | 'Underwriting' | 'Follow-up',
      pinned: data.pinned,
      body: data.body,
    }
    setDataset((current) => ({ ...current, notes: [newNote, ...current.notes] }))
    setModal(null)
    setClientTab('Notes & History')
    showToast('Note added to client file')
  }

  const addLead = (data: {
    clientName: string
    estimatedPremium: string
    stage: string
    ownerUserId: string
  }) => {
    const newLead = {
      id: createRecordId('opportunity'),
      accountId: dataset.agency.id,
      ownerUserId: data.ownerUserId || dataset.currentUser.id,
      clientName: data.clientName,
      stage: data.stage as 'New lead' | 'Discovery' | 'Quoting' | 'Proposal' | 'Bound',
      estimatedPremium: parseFloat(data.estimatedPremium) || 0,
    }
    setDataset((current) => ({ ...current, opportunities: [newLead, ...current.opportunities] }))
    setModal(null)
    showToast(`New lead added: ${newLead.clientName}`)
  }

  const completeTask = (taskId: string) => {
    setDataset((current) => ({
      ...current,
      tasks: current.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed, status: t.completed ? 'Open' : 'Completed' as const } : t
      ),
    }))
  }

  const updateClient = (data: {
    name: string
    dbaName: string
    primaryContact: string
    phone: string
    alternatePhone: string
    email: string
    mailingAddress: string
    physicalAddress: string
    website: string
    lineOfBusiness: string
    accountStatus: string
    preferredContactMethod: string
    billingMethod: string
    paymentPlan: string
    notes: string
    assignedProducerId: string
    assignedCsrId: string
  }) => {
    if (!selectedClient) return
    setDataset((current) => ({
      ...current,
      clients: current.clients.map((c) =>
        c.id === selectedClient.id
          ? {
              ...c,
              name: data.name,
              dbaName: data.dbaName || undefined,
              primaryContact: data.primaryContact,
              phone: data.phone || undefined,
              alternatePhone: data.alternatePhone || undefined,
              email: data.email || undefined,
              mailingAddress: data.mailingAddress || undefined,
              physicalAddress: data.physicalAddress || undefined,
              website: data.website || undefined,
              lineOfBusiness: data.lineOfBusiness as 'Commercial' | 'Personal lines' | 'Life & health',
              accountStatus: data.accountStatus as 'Active' | 'Inactive' | 'Prospect',
              preferredContactMethod: (data.preferredContactMethod || undefined) as 'Phone' | 'Email' | 'Text' | 'Portal' | undefined,
              billingMethod: (data.billingMethod || undefined) as 'Direct Bill' | 'Agency Bill' | 'Mortgagee/Escrow' | 'Premium Finance' | undefined,
              paymentPlan: data.paymentPlan || undefined,
              notes: data.notes || undefined,
              assignedProducerId: data.assignedProducerId || undefined,
              assignedCsrId: data.assignedCsrId || undefined,
            }
          : c
      ),
    }))
    setModal(null)
    showToast(`Client record updated for ${data.name}`)
  }

  const updatePolicy = (policyId: string, data: {
    policyType: string
    carrier: string
    policyNumber: string
    premium: string
    commissionRate: string
    effectiveDate: string
    expirationDate: string
    billingType: string
    status: string
    limits: string
    notes: string
  }) => {
    setDataset((current) => ({
      ...current,
      policies: current.policies.map((p) =>
        p.id === policyId
          ? {
              ...p,
              policyType: data.policyType,
              carrier: data.carrier,
              policyNumber: data.policyNumber || undefined,
              premium: parseFloat(data.premium) || p.premium,
              commissionRate: parseFloat(data.commissionRate) || p.commissionRate,
              effectiveDate: data.effectiveDate || p.effectiveDate,
              expirationDate: data.expirationDate || p.expirationDate,
              billingType: (data.billingType || undefined) as 'Direct Bill' | 'Agency Bill' | 'Financed' | undefined,
              status: data.status as Policy['status'],
              limits: data.limits || undefined,
              notes: data.notes || undefined,
            }
          : p
      ),
    }))
    setModal(null)
    setEditingPolicyId(null)
    showToast('Policy updated')
  }

  const savePolicyBilling = (policyId: string, billing: PolicyBilling) => {
    setDataset((current) => ({
      ...current,
      policies: current.policies.map((p) =>
        p.id === policyId ? { ...p, billing } : p
      ),
    }))
    setModal(null)
    setBillingPolicyId(null)
    showToast('Billing details saved')
  }

  const saveRenewalPremium = (policyId: string, premiumStr: string) => {
    const val = parseFloat(premiumStr.replace(/[^0-9.]/g, ''))
    if (!isNaN(val) && val > 0) {
      setDataset((cur) => ({
        ...cur,
        policies: cur.policies.map((p) => p.id === policyId ? { ...p, renewalPremium: val } as Policy & { renewalPremium: number } : p),
      }))
      setRenewalPremiumEdits((prev) => { const n = { ...prev }; delete n[policyId]; return n })
      showToast('Renewal premium saved')
    }
  }

  const exportRenewalsCsv = (items: RenewalPolicyItem[]) => {
    const rows = [
      ['Client', 'Policy Type', 'Carrier', 'Expiration Date', 'Days Until', 'Current Premium', 'Renewal Premium', 'Billing', 'Payment Plan', 'Status', 'Renewal Status', 'Escrow', 'Auto-pay'].join(','),
      ...items.map((r) => [
        `"${r.client?.name ?? ''}"`,
        `"${r.policy.policyType}"`,
        `"${r.policy.carrier}"`,
        r.expDate,
        r.daysUntil,
        r.policy.premium,
        (r.policy as Policy & { renewalPremium?: number }).renewalPremium ?? '',
        `"${r.billingMethod}"`,
        `"${r.paymentPlan}"`,
        `"${r.policy.status}"`,
        `"${r.renewal?.status ?? 'Not started'}"`,
        r.isEscrow ? 'Yes' : 'No',
        r.isAutopay ? 'Yes' : 'No',
      ].join(',')),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `renewals-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${items.length} renewals to CSV`)
  }

  const saveEmailTemplate = (tpl: EmailTemplate) => {
    setEmailTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === tpl.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = tpl; return next }
      return [...prev, tpl]
    })
    setEditingTemplate(null)
    showToast(`Template "${tpl.name}" saved`)
  }

  const deleteEmailTemplate = (id: string) => {
    setEmailTemplates((prev) => prev.filter((t) => t.id !== id))
    showToast('Template deleted')
  }

  const toggleRenewalSelection = (id: string) => {
    setSelectedRenewalIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const keyAccounts = useMemo(() => {
    return [...dataset.clients]
      .map((client) => {
        const premium = dataset.policies
          .filter((p) => p.clientId === client.id)
          .reduce((sum, p) => sum + p.premium, 0)
        return { client, premium }
      })
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 5)
      .map((item) => item.client)
  }, [dataset.clients, dataset.policies])

  // ─── Renewal center computed ─────────────────────────────────
  const renewalPolicies = useMemo(() => {
    return dataset.policies
      .filter((p) => isActivePolicy(p.status) || p.status === 'Renewal review')
      .map((p) => {
        const client = dataset.clients.find((c) => c.id === p.clientId)
        const renewal = dataset.renewals.find((r) => r.policyId === p.id)
        const expDate = p.expirationDate
        const daysUntil = Math.round((new Date(`${expDate}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime()) / 86_400_000)
        const billingMethod = p.billing?.paymentMethod ?? p.billingType ?? ''
        const paymentPlan = p.billing?.paymentPlanType ?? p.paymentPlan ?? ''
        const isEscrow = billingMethod.toLowerCase().includes('escrow') || paymentPlan.toLowerCase().includes('escrow') || (p.mortgageeOrLienholder ?? '').length > 0
        const isAutopay = billingMethod.toLowerCase().includes('ach') || billingMethod.toLowerCase().includes('eft') || paymentPlan.toLowerCase().includes('eft') || paymentPlan.toLowerCase().includes('monthly (eft)')
        return { policy: p, client, renewal, expDate, daysUntil, isEscrow, isAutopay, billingMethod, paymentPlan }
      })
      .sort((a, b) => a.expDate.localeCompare(b.expDate))
  }, [dataset, todayIso])

  const filteredRenewalPolicies = useMemo(() => {
    const filtered = renewalPolicies.filter((item) => {
      if (hideEscrow && item.isEscrow) return false
      if (hideAutopay && item.isAutopay) return false
      if (renewalViewMode === 'range' && renewalDateFrom && renewalDateTo) {
        return item.expDate >= renewalDateFrom && item.expDate <= renewalDateTo
      }
      if (renewalViewMode === 'month' && renewalMonth) {
        return item.expDate.startsWith(renewalMonth)
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (renewalSort === 'name') return (a.client?.name ?? '').localeCompare(b.client?.name ?? '')
      if (renewalSort === 'carrier') return a.policy.carrier.localeCompare(b.policy.carrier)
      if (renewalSort === 'billing') {
        const billingOrder = (item: RenewalPolicyItem) =>
          item.isEscrow ? 0 : item.isAutopay ? 1 : (item.paymentPlan.toLowerCase().includes('financ') ? 2 : 3)
        return billingOrder(a) - billingOrder(b)
      }
      return a.expDate.localeCompare(b.expDate)
    })
  }, [renewalPolicies, hideEscrow, hideAutopay, renewalViewMode, renewalMonth, renewalDateFrom, renewalDateTo, renewalSort])

  return (
    <div className="app-shell" data-mode={mode} data-palette={palette}>
      <aside className="sidebar">
        <div className="logo-wrap sidebar-logo">
          <div className="logo-button">
            <img src={agencyIqLogo} alt="AgencyIQ Insurance CRM" />
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={[
                  'nav-item',
                  (item.label === 'Dashboard' && activeView === 'dashboard') ||
                  (item.label === 'Clients' && ['clients', 'profile', 'ivans'].includes(activeView)) ||
                  (item.label === 'Leads' && activeView === 'leads') ||
                  (item.label === 'Renewals' && activeView === 'renewals')
                    ? 'active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                key={item.label}
                aria-label={item.label}
                onClick={() => {
                  if (item.label === 'Clients') {
                    setActiveView('clients')
                  }
                  if (item.label === 'Dashboard') {
                    setActiveView('dashboard')
                  }
                  if (item.label === 'Leads') {
                    setActiveView('leads')
                  }
                  if (item.label === 'Renewals') {
                    setActiveView('renewals')
                  }
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <BriefcaseBusiness size={20} aria-hidden="true" />
          <strong>Data scoped</strong>
          <span>
            Saving records under {dataset.currentUser.name} in {dataset.agency.name}.
          </span>
          <label className="role-preview">
            <span>Access role</span>
            <select
              value={dataset.currentUser.role}
              onChange={(event) => updateRole(event.target.value as UserRole)}
            >
              {roleOptions.map((role) => (
                <option value={role} key={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" aria-label="Open menu">
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="logo-wrap header-logo mobile-only">
            <div className="logo-button">
              <img src={agencyIqLogo} alt="AgencyIQ Insurance CRM" />
            </div>
          </div>
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Search AgencyIQ"
              value={clientSearch}
              onChange={(event) => {
                setClientSearch(event.target.value)
                setActiveView('clients')
              }}
              placeholder="Search clients, policies, leads, phone, email, policy #"
            />
          </div>
          <div className="appearance-menu">
            <button
              className="icon-button"
              type="button"
              aria-label="Appearance settings"
              aria-expanded={appearanceOpen}
              aria-controls="appearance-panel"
              onClick={() => setAppearanceOpen((open) => !open)}
            >
              <Palette size={19} aria-hidden="true" />
            </button>
            {appearanceOpen && (
              <div className="appearance-panel" id="appearance-panel">
                <div>
                  <span className="setting-label">Color scheme</span>
                  <div className="palette-options" role="group" aria-label="Color scheme">
                    {themeOptions.map((theme) => (
                      <button
                        className={palette === theme.id ? 'scheme-option active' : 'scheme-option'}
                        type="button"
                        key={theme.id}
                        aria-pressed={palette === theme.id}
                        onClick={() => setPalette(theme.id)}
                      >
                        <span className="scheme-swatches" aria-hidden="true">
                          {theme.colors.map((color) => (
                            <span key={color} style={{ background: color }} />
                          ))}
                        </span>
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="setting-label">Display mode</span>
                  <button
                    className="mode-toggle"
                    type="button"
                    aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
                    onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
                  >
                    {mode === 'light' ? (
                      <Moon size={16} aria-hidden="true" />
                    ) : (
                      <Sun size={16} aria-hidden="true" />
                    )}
                    <span>{mode === 'light' ? 'Dark mode' : 'Light mode'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            className={`iq-ai-trigger${aiHelpOpen ? ' iq-ai-trigger--active' : ''}`}
            type="button"
            aria-label="Open AgencyIQ AI assistant"
            title="Ask IQ"
            onClick={() => setAiHelpOpen((v) => !v)}
          >
            <img src={mascotImg} alt="" aria-hidden="true" className="iq-ai-trigger-mascot" />
            <span className="iq-ai-trigger-label">Ask IQ</span>
          </button>
          <button className="icon-button" type="button" aria-label="Carrier portals" title="Carrier Portals" onClick={() => setModal('carrierPortal')}>
            <SlidersHorizontal size={19} aria-hidden="true" />
          </button>
          <div className="notif-wrap">
            <button
              className={unreadCount > 0 ? 'icon-button notif-bell notif-bell--active' : 'icon-button notif-bell'}
              type="button"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              aria-expanded={notifOpen}
              onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false) }}
            >
              <Bell size={19} aria-hidden="true" />
              {unreadCount > 0 && <span className="notif-badge" aria-hidden="true">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="notif-panel">
                <div className="notif-panel-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="text-button" type="button" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.map((notif) => (
                    <button
                      className={notif.read ? 'notif-item notif-item--read' : 'notif-item'}
                      type="button"
                      key={notif.id}
                      onClick={() => { markRead(notif.id); setNotifOpen(false) }}
                    >
                      <span className={`notif-dot notif-dot--${notif.type}`} aria-hidden="true" />
                      <div className="notif-item-body">
                        <strong>{notif.title}</strong>
                        <span>{notif.body}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="user-menu-wrap">
            <button
              className="profile-chip"
              type="button"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false) }}
            >
              {dataset.currentUser.initials}
            </button>
            {userMenuOpen && (
              <div className="user-menu-panel">
                <div className="user-menu-header">
                  <strong>{dataset.currentUser.name}</strong>
                  <span>{dataset.currentUser.role}</span>
                </div>
                <div className="user-menu-section-label">Switch user</div>
                {dataset.users.filter((u) => u.id !== dataset.currentUser.id).map((u) => (
                  <button
                    className="user-menu-item"
                    type="button"
                    key={u.id}
                    onClick={() => switchUser(u.id)}
                  >
                    <span className="user-menu-avatar">{u.initials}</span>
                    <div>
                      <strong>{u.name}</strong>
                      <span>{u.role}</span>
                    </div>
                  </button>
                ))}
                <div className="user-menu-divider" />
                <button
                  className="user-menu-item user-menu-signout"
                  type="button"
                  onClick={() => { setUserMenuOpen(false); showToast('Signed out (demo — page will reload)'); setTimeout(() => window.location.reload(), 1500) }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {activeView === 'renewals' ? (
          <RenewalCenter
            renewalPolicies={filteredRenewalPolicies}
            allRenewalPolicies={renewalPolicies}
            accountId={dataset.agency.id}
            dataset={dataset}
            todayIso={todayIso}
            renewalViewMode={renewalViewMode}
            setRenewalViewMode={setRenewalViewMode}
            renewalMonth={renewalMonth}
            setRenewalMonth={setRenewalMonth}
            renewalDateFrom={renewalDateFrom}
            setRenewalDateFrom={setRenewalDateFrom}
            renewalDateTo={renewalDateTo}
            setRenewalDateTo={setRenewalDateTo}
            hideEscrow={hideEscrow}
            setHideEscrow={setHideEscrow}
            hideAutopay={hideAutopay}
            setHideAutopay={setHideAutopay}
            selectedIds={selectedRenewalIds}
            setSelectedIds={setSelectedRenewalIds}
            toggleSelection={toggleRenewalSelection}
            emailTemplates={emailTemplates}
            editingTemplate={editingTemplate}
            setEditingTemplate={setEditingTemplate}
            saveEmailTemplate={saveEmailTemplate}
            deleteEmailTemplate={deleteEmailTemplate}
            renewalOutreachModal={renewalOutreachModal}
            setRenewalOutreachModal={setRenewalOutreachModal}
            renewalSort={renewalSort}
            setRenewalSort={setRenewalSort}
            renewalPremiumEdits={renewalPremiumEdits}
            setRenewalPremiumEdits={setRenewalPremiumEdits}
            saveRenewalPremium={saveRenewalPremium}
            exportRenewalsCsv={exportRenewalsCsv}
            onOpenClient={(clientId) => { setSelectedClientId(clientId); setClientTab('Policies'); setActiveView('profile') }}
            onOpenIvans={() => setActiveView('ivans')}
            ivansLastGlobalSync={ivansLastGlobalSync}
            showToast={showToast}
            currency={currency}
            formatDate={formatDate}
            formatFullDate={formatFullDate}
            getUserName={(id) => getUserName(dataset, id)}
          />
        ) : activeView === 'leads' ? (
          <section className="clients-page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Lead hub</p>
                <h1>New Leads & Prospects</h1>
                <p className="account-context">
                  Website quote requests, producer referrals, walk-ins, and prospects before they become client folders.
                </p>
              </div>
              <button className="primary-action" type="button" onClick={() => setModal('addLead')}>
                Add New Lead
              </button>
            </div>

            <section className="content-grid">
              <article className="panel wide-panel">
                <div className="panel-header">
                  <div>
                    <h2>Lead intake queue</h2>
                    <p>Prospects and quote opportunities waiting for review.</p>
                  </div>
                  <span className="status-pill">{dataset.opportunities.length} active</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Lead / Prospect</th>
                        <th>Stage</th>
                        <th>Lead Source</th>
                        <th>Estimated Premium</th>
                        <th>Assigned</th>
                        <th>Next Step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.opportunities.map((opportunity) => (
                        <tr key={opportunity.id}>
                          <td>{opportunity.clientName}</td>
                          <td><span className="status-pill">{opportunity.stage}</span></td>
                          <td>Producer referral</td>
                          <td>{currency.format(opportunity.estimatedPremium)}</td>
                          <td>{getUserName(dataset, opportunity.ownerUserId)}</td>
                          <td>{opportunity.stage === 'Bound' ? 'Move full file into Clients' : 'Follow up and advance quote'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel wide-panel">
                <div className="panel-header">
                  <div>
                    <h2>X-Date Marketing List</h2>
                    <p>Lost or expired policies automatically queued by last known renewal date.</p>
                  </div>
                  <span className="status-pill">{xDatePolicies.length} x-dates</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Policy</th>
                        <th>Prior Carrier</th>
                        <th>Last Renewal Ended</th>
                        <th>Premium</th>
                        <th>Marketing Window</th>
                      </tr>
                    </thead>
                    <tbody>
                      {xDatePolicies.map((policy) => {
                        const client = dataset.clients.find((item) => item.id === policy.clientId)
                        return (
                          <tr
                            className="clickable-row"
                            key={policy.id}
                            onClick={() => {
                              setSelectedClientId(policy.clientId)
                              setClientTab('Policies')
                              setActiveView('profile')
                            }}
                          >
                            <td>{client?.name ?? 'Unknown client'}</td>
                            <td>{policy.policyType}</td>
                            <td>{policy.carrier}</td>
                            <td>{formatDate(policy.expirationDate)}</td>
                            <td>{currency.format(policy.premium)}</td>
                            <td>Start outreach 45-60 days before renewal</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Website quote forms</h2>
                    <p>Placeholder for incoming website submissions.</p>
                  </div>
                  <MessageSquare size={22} aria-hidden="true" />
                </div>
                <div className="placeholder-grid">
                  <div><strong>Auto quote request</strong><span>Map form fields into lead intake.</span></div>
                  <div><strong>Home quote request</strong><span>Convert prospect to client folder after review.</span></div>
                  <div><strong>Commercial intake</strong><span>Route to producer and CSR queue.</span></div>
                </div>
              </article>
            </section>
          </section>
        ) : activeView === 'ivans' ? (
          <section className="clients-page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Client folders</p>
                <h1>IVANS Download Center</h1>
                <p className="account-context">
                  Carrier data sync · ACORD file parsing · automated renewal detection
                  {ivansLastGlobalSync && <span className="ivans-global-sync-note"> · Last sync: {formatDate(ivansLastGlobalSync)}</span>}
                </p>
              </div>
              <button className="secondary-action" type="button" onClick={() => setActiveView('clients')}>
                <ArrowLeft size={15} /> Back to Clients
              </button>
            </div>
            <IvansPanel
              accountId={dataset.agency.id}
              currency={currency}
              formatDate={formatDate}
              onMergePolicy={(synced) => {
                showToast(`Policy ${synced.policy_number} (${synced.insured_name}) accepted — client folder will update on next sync`)
                // Refresh IVANS sync map so indicators update immediately
                setIvansSyncMap((prev) => ({
                  ...prev,
                  [synced.policy_number]: { syncedAt: synced.synced_at, carrierName: synced.carrier_name, renewalStatus: synced.renewal_status, policyNumber: synced.policy_number },
                }))
                setIvansLastGlobalSync(synced.synced_at)
              }}
            />
          </section>
        ) : activeView === 'clients' ? (
          <section className="clients-page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Client folders</p>
                <h1>Clients</h1>
                <p className="account-context">
                  {filteredClients.length} client {filteredClients.length === 1 ? 'folder' : 'folders'} on file
                  {ivansLastGlobalSync && <span className="ivans-global-sync-note"> · IVANS synced {formatDate(ivansLastGlobalSync)}</span>}
                </p>
              </div>
              <div className="clients-page-actions">
                <button className="utility-action ivans-launch-btn" type="button" onClick={() => setActiveView('ivans')}>
                  <Zap size={15} /> IVANS Sync
                </button>
                <button className="primary-action" type="button" onClick={() => setModal('addClient')}>
                  + New Client
                </button>
              </div>
            </div>

            <div className="folder-workspace">
              <div className="folder-toolbar">
                <div className="search-box client-table-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    aria-label="Search clients"
                    value={clientSearch}
                    onChange={(event) => { setClientSearch(event.target.value); setClientPage(0) }}
                    placeholder="Search by name, phone, email, policy number, carrier..."
                  />
                </div>
                <div className="filter-tabs" role="group" aria-label="Client filters">
                  {clientFilters.map((filter) => (
                    <button
                      className={clientFilter === filter ? 'filter-tab active' : 'filter-tab'}
                      type="button"
                      key={filter}
                      onClick={() => { setClientFilter(filter); setClientPage(0) }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="sort-controls" role="group" aria-label="Sort clients">
                  <span className="sort-label">Sort:</span>
                  {([
                    ['name-asc', 'Name A–Z'],
                    ['name-desc', 'Name Z–A'],
                    ['renewal-asc', 'Renewal Soon'],
                    ['premium-desc', 'Highest Premium'],
                  ] as [ClientSort, string][]).map(([val, label]) => (
                    <button
                      className={clientSort === val ? 'sort-tab active' : 'sort-tab'}
                      type="button"
                      key={val}
                      onClick={() => { setClientSort(val); setClientPage(0) }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="folder-grid">
                {pagedClients.map((client) => {
                  const policies = dataset.policies.filter((policy) => policy.clientId === client.id)
                  const activePolicies = policies.filter((p) => isActivePolicy(p.status))
                  const nextRenewal = policies
                    .map((policy) => policy.expirationDate)
                    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]
                  const totalPremium = policies.reduce((total, policy) => total + policy.premium, 0)
                  const hasRenewalDue = dataset.renewals.some((r) => r.clientId === client.id)
                  const status = client.accountStatus ?? client.status
                  // IVANS sync: check if any of this client's policies appear in the sync map
                  const clientSyncEntries = policies
                    .filter((p) => p.policyNumber && ivansSyncMap[p.policyNumber])
                    .map((p) => ivansSyncMap[p.policyNumber!])
                  const latestSync = clientSyncEntries.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt))[0]
                  const hasRenewalPending = clientSyncEntries.some((e) => e.renewalStatus === 'renewal_pending')
                  return (
                    <button
                      className={`folder-card folder-card--${status?.toLowerCase().replace(/\s+/g, '-') ?? 'active'}`}
                      type="button"
                      key={client.id}
                      onClick={() => {
                        setSelectedClientId(client.id)
                        setClientTab('Overview')
                        setPolicyFilter('All')
                        setActiveView('profile')
                      }}
                    >
                      <div className="folder-card-tab">
                        <span className="folder-card-type">{getClientTypeLabel(client.lineOfBusiness)}</span>
                        <div className="folder-card-tab-right">
                          {latestSync && (
                            <span className={`folder-ivans-badge ${hasRenewalPending ? 'folder-ivans-badge--renewal' : 'folder-ivans-badge--synced'}`} title={`IVANS synced ${latestSync.syncedAt.slice(0, 10)}`}>
                              <Zap size={10} />
                              {hasRenewalPending ? 'Renewal' : 'Synced'}
                            </span>
                          )}
                          <span className={`folder-status-dot folder-status-dot--${status?.toLowerCase().replace(/\s+/g, '-') ?? 'active'}`} aria-hidden="true" />
                        </div>
                      </div>
                      <div className="folder-card-body">
                        <div className="folder-card-identity">
                          <strong className="folder-card-name">{client.name}</strong>
                          {client.dbaName && <span className="folder-card-dba">{client.dbaName}</span>}
                          <span className="folder-card-contact">{client.primaryContact}</span>
                        </div>
                        <div className="folder-card-stats">
                          <div className="folder-stat">
                            <span>Policies</span>
                            <strong>{activePolicies.length} active</strong>
                          </div>
                          <div className="folder-stat">
                            <span>Premium</span>
                            <strong>{compactCurrency.format(totalPremium)}</strong>
                          </div>
                          <div className="folder-stat">
                            <span>Next renewal</span>
                            <strong className={hasRenewalDue ? 'folder-stat-alert' : ''}>{nextRenewal ? formatDate(nextRenewal) : 'None'}</strong>
                          </div>
                        </div>
                        <div className="folder-card-footer">
                          <span className="folder-card-phone">{client.phone ?? client.email ?? 'No contact on file'}</span>
                          {latestSync ? (
                            <span className="folder-ivans-sync-time">
                              <Zap size={11} /> IVANS {latestSync.syncedAt.slice(0, 10)}
                            </span>
                          ) : (
                            <span className="folder-open-cta">
                              Open folder
                              <ChevronRight size={14} aria-hidden="true" />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {filteredClients.length === 0 && (
                  <div className="empty-state folder-empty-state">
                    No client folders match your search or filter.
                  </div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="folder-pagination">
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={clientPage === 0}
                    onClick={() => setClientPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {clientPage + 1} of {totalPages} &mdash; {filteredClients.length} folders
                  </span>
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={clientPage >= totalPages - 1}
                    onClick={() => setClientPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : activeView === 'profile' && selectedClient ? (
          <section className="client-page">

            <div className="open-folder-shell">
              <div className="open-folder-header">
                <button
                  className="text-button back-button"
                  type="button"
                  onClick={() => setActiveView('clients')}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  All folders
                </button>
                <div className="open-folder-identity">
                  <div className="open-folder-title-row">
                    <div>
                      <p className="eyebrow">Open client folder</p>
                      <h1>{selectedClient.name}</h1>
                      {selectedClient.dbaName && <p className="folder-dba-label">{selectedClient.dbaName}</p>}
                    </div>
                    <div className="open-folder-badges">
                      <span className="status-pill">{getClientTypeLabel(selectedClient.lineOfBusiness)}</span>
                      <span className={`folder-health-badge folder-health-badge--${(selectedClient.health ?? 'strong').toLowerCase().replace(/\s+/g, '-')}`}>{selectedClient.health ?? 'Strong'}</span>
                      <span className="status-pill">{selectedClient.accountStatus ?? selectedClient.status}</span>
                    </div>
                  </div>
                  <div className="open-folder-contact-row">
                    {selectedClient.phone && <span>{selectedClient.phone}</span>}
                    {selectedClient.email && <span>{selectedClient.email}</span>}
                    {selectedClient.mailingAddress && <span>{selectedClient.mailingAddress}</span>}
                    {selectedClient.clientSince && <span>Client since {formatFullDate(selectedClient.clientSince)}</span>}
                  </div>
                </div>
              </div>

              <div className="open-folder-strip">
                <div className="folder-strip-stat">
                  <span>Producer</span>
                  <strong>{getUserName(dataset, selectedClient.assignedProducerId ?? '')}</strong>
                </div>
                <div className="folder-strip-stat">
                  <span>CSR</span>
                  <strong>{getUserName(dataset, selectedClient.assignedCsrId ?? '')}</strong>
                </div>
                <div className="folder-strip-stat folder-strip-stat--accent">
                  <span>Active Policies</span>
                  <strong>{activeClientPolicies.length}</strong>
                </div>
                <div className="folder-strip-stat folder-strip-stat--accent">
                  <span>Total Premium</span>
                  <strong>{currency.format(selectedClientPremium)}</strong>
                </div>
                <div className="folder-strip-stat">
                  <span>Commission</span>
                  <strong>{currency.format(selectedClientCommission)}</strong>
                </div>
                <div className="folder-strip-stat folder-strip-stat--renewal">
                  <span>Next Renewal</span>
                  <strong>{selectedClientNextRenewal ? formatDate(selectedClientNextRenewal) : 'None'}</strong>
                </div>
                <div className="folder-strip-stat">
                  <span>Last Contacted</span>
                  <strong>{selectedClientLastContacted}</strong>
                </div>
                {(() => {
                  const clientPolicies = dataset.policies.filter((p) => p.clientId === selectedClient.id)
                  const syncEntries = clientPolicies
                    .filter((p) => p.policyNumber && ivansSyncMap[p.policyNumber])
                    .map((p) => ivansSyncMap[p.policyNumber!])
                  const latest = syncEntries.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt))[0]
                  if (!latest) return null
                  const hasRenewal = syncEntries.some((e) => e.renewalStatus === 'renewal_pending')
                  return (
                    <div className={`folder-strip-stat folder-strip-stat--ivans ${hasRenewal ? 'folder-strip-stat--ivans-renewal' : ''}`}>
                      <span><Zap size={11} /> IVANS Last Sync</span>
                      <strong>{formatDate(latest.syncedAt)}</strong>
                      {hasRenewal && <em>Renewal pending</em>}
                    </div>
                  )
                })()}
              </div>

              <div className="open-folder-actions">
                <div className="action-group primary-action-group">
                  <button className="primary-action" type="button" onClick={() => setModal('addPolicy')}>Add New Policy</button>
                  <button className="secondary-action" type="button" onClick={() => setModal('editClient')}>Edit Client</button>
                </div>
                <div className="action-group secondary-action-group">
                  <button className="secondary-action" type="button" onClick={() => setModal('addTask')}>Add Task</button>
                  <button className="secondary-action" type="button" onClick={() => setModal('addTask')}>Create Follow-Up</button>
                  <button className="secondary-action" type="button" onClick={() => setModal('addNote')}>Add Note</button>
                </div>
                <div className="action-group utility-action-group">
                  <button className="utility-action" type="button" onClick={() => { showToast(`Email drafted to ${selectedClient?.email ?? selectedClient?.primaryContact ?? 'client'}`) }}>Send Email</button>
                  <button className="utility-action" type="button" onClick={() => { showToast(`Text queued to ${selectedClient?.phone ?? 'client'}`) }}>Send Text</button>
                  <button className="utility-action" type="button" onClick={() => setModal('addTask')}>Add Payment Reminder</button>
                </div>
              </div>
            </div>

            <div className="folder-tab-row" role="tablist" aria-label="Client folder sections">
              {clientTabs.map((tab) => (
                <button
                  className={clientTab === tab ? 'folder-tab active' : 'folder-tab'}
                  type="button"
                  key={tab}
                  role="tab"
                  aria-selected={clientTab === tab}
                  onClick={() => setClientTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <section className="panel folder-tab-panel">
              {clientTab === 'Overview' && (
                <div className="profile-grid">
                  <div className="detail-list">
                    <div><span>Client name</span><strong>{selectedClient.name}</strong></div>
                    <div><span>Email</span><strong>{selectedClient.email ?? 'Not added'}</strong></div>
                    <div><span>Phone</span><strong>{selectedClient.phone ?? 'Not added'}</strong></div>
                    <div><span>Address</span><strong>{selectedClient.mailingAddress ?? 'Not added'}</strong></div>
                    <div><span>Client type</span><strong>{selectedClient.lineOfBusiness}</strong></div>
                    <div><span>Client status</span><strong>{selectedClient.accountStatus ?? selectedClient.status}</strong></div>
                    <div><span>Client since</span><strong>{selectedClient.clientSince ? formatFullDate(selectedClient.clientSince) : 'Not set'}</strong></div>
                    <div><span>Main contact</span><strong>{selectedClient.primaryContact}</strong></div>
                    <div><span>Producer</span><strong>{getUserName(dataset, selectedClient.assignedProducerId ?? '')}</strong></div>
                    <div><span>CSR / Service rep</span><strong>{getUserName(dataset, selectedClient.assignedCsrId ?? '')}</strong></div>
                    <div><span>Preferred contact</span><strong>{selectedClient.preferredContactMethod ?? 'Not set'}</strong></div>
                    <div><span>Billing method</span><strong>{selectedClientBillingMethod}</strong></div>
                    <div><span>Payment plan</span><strong>{selectedClientPaymentPlan}</strong></div>
                    <div><span>Active policies</span><strong>{activeClientPolicies.length}</strong></div>
                    <div><span>Total annual premium</span><strong>{currency.format(selectedClientPremium)}</strong></div>
                    <div><span>Estimated commission</span><strong>{currency.format(selectedClientCommission)}</strong></div>
                    <div><span>Next renewal</span><strong>{selectedClientNextRenewal ? formatDate(selectedClientNextRenewal) : 'None'}</strong></div>
                    <div><span>Last contacted</span><strong>{selectedClientLastContacted}</strong></div>
                    <div><span>Open tasks</span><strong>{clientTasks.filter((task) => !task.completed).length}</strong></div>
                    <div><span>Recent notes</span><strong>{clientNotes.length}</strong></div>
                    <div className="important-note"><span>Important notes</span><strong>{selectedClient.notes ?? 'No profile notes'}</strong></div>
                  </div>
                  <div className="mini-list">
                    <div className="section-kicker">Pinned and recent client history</div>
                    {clientNotes.slice(0, 3).map((note) => (
                      <div className="note-row" key={note.id}>
                        <strong>{note.pinned ? 'Pinned note' : note.type ?? 'General'}</strong>
                        <span>{formatDateTime(note.createdAt)} - {getUserName(dataset, note.createdByUserId)}</span>
                        <p>{note.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {clientTab === 'Contact & Account' && (
                <div className="detail-list wide-detail-list">
                  <div><span>Client name</span><strong>{selectedClient.name}</strong></div>
                  <div><span>DBA/business name</span><strong>{selectedClient.dbaName ?? 'Not added'}</strong></div>
                  <div><span>Main contact</span><strong>{selectedClient.primaryContact}</strong></div>
                  <div><span>Phone</span><strong>{selectedClient.phone ?? 'Not added'}</strong></div>
                  <div><span>Alternate phone</span><strong>{selectedClient.alternatePhone ?? 'Not added'}</strong></div>
                  <div><span>Email</span><strong>{selectedClient.email ?? 'Not added'}</strong></div>
                  <div><span>Mailing address</span><strong>{selectedClient.mailingAddress ?? 'Not added'}</strong></div>
                  <div><span>Physical/location address</span><strong>{selectedClient.physicalAddress ?? 'Not added'}</strong></div>
                  <div><span>Website</span><strong>{selectedClient.website || 'Not added'}</strong></div>
                  <div><span>Tax ID / FEIN</span><strong>{selectedClient.taxId ?? 'Optional'}</strong></div>
                  <div><span>DOB</span><strong>{selectedClient.dob ?? 'Optional'}</strong></div>
                  <div><span>Preferred contact</span><strong>{selectedClient.preferredContactMethod ?? 'Not set'}</strong></div>
                  <div><span>Client since</span><strong>{selectedClient.clientSince ? formatFullDate(selectedClient.clientSince) : 'Not set'}</strong></div>
                  <div><span>Billing method</span><strong>{selectedClientBillingMethod}</strong></div>
                  <div><span>Payment plan</span><strong>{selectedClientPaymentPlan}</strong></div>
                  <div><span>Notes</span><strong>{selectedClient.notes ?? 'No profile notes'}</strong></div>
                </div>
              )}

              {clientTab === 'Policies' && (
                <div className="policy-card-grid">
                  <div className="policy-portfolio-header">
                    <div>
                      <span className="section-kicker">Policy portfolio and history</span>
                      <h2>{filteredClientPolicies.length} of {clientPolicies.length} policies on file</h2>
                    </div>
                    <div className="policy-status-filter-row" aria-label="Policy status summary">
                      {policyFilters.map((filter) => {
                        const count = clientPolicies.filter((policy) => {
                          if (filter === 'All') return true
                          if (filter === 'Active') return isActivePolicy(policy.status)
                          if (filter === 'Renewal Review') return policy.status === 'Renewal review'
                          if (filter === 'Rewritten') return policy.status === 'Renewed/Replaced'
                          if (filter === 'Prior History') return ['Expired', 'Non-Renewed', 'Renewed/Replaced'].includes(policy.status)
                          return policy.status === filter
                        }).length

                        return (
                          <button
                            className={policyFilter === filter ? 'policy-filter active' : 'policy-filter'}
                            type="button"
                            key={filter}
                            onClick={() => setPolicyFilter(filter)}
                          >
                            {filter} {count}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {filteredClientPolicies.map((policy) => {
                    const commission = (policy.premium * (policy.commissionRate ?? 0)) / 100
                    const policyYear = new Date(`${policy.expirationDate}T12:00:00`).getFullYear()
                    const hasActiveReplacement = clientPolicies.some((candidate) => {
                      return (
                        candidate.id !== policy.id &&
                        isActivePolicy(candidate.status) &&
                        getPolicyCoverageBucket(candidate.policyType) === getPolicyCoverageBucket(policy.policyType)
                      )
                    })
                    const shouldShowXDate = ['Expired', 'Non-Renewed'].includes(policy.status) && !hasActiveReplacement
                    const ivansEntry = policy.policyNumber ? ivansSyncMap[policy.policyNumber] : null
                    return (
                      <details className="policy-card policy-accordion" key={policy.id}>
                        <summary>
                          <div className="policy-summary-name">
                            <h2>{policy.policyType}</h2>
                            <div className="policy-summary-badges">
                              <span className="status-pill">{policy.status}</span>
                              {shouldShowXDate && (
                                <span className="status-pill xdate-pill">X-Date</span>
                              )}
                              {ivansEntry && (
                                <span className={`policy-ivans-badge ${ivansEntry.renewalStatus === 'renewal_pending' ? 'policy-ivans-badge--renewal' : 'policy-ivans-badge--synced'}`} title={`Last IVANS sync: ${ivansEntry.syncedAt.slice(0, 10)}`}>
                                  <Zap size={10} />
                                  {ivansEntry.renewalStatus === 'renewal_pending' ? 'IVANS: Renewal' : `IVANS ${ivansEntry.syncedAt.slice(0, 10)}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="policy-summary-meta">
                            <span><b>Year</b>{policyYear}</span>
                            <span><b>Carrier</b>{policy.carrier}</span>
                            <span><b>Policy #</b>{policy.policyNumber}</span>
                            <span><b>Effective</b>{policy.effectiveDate ? formatDate(policy.effectiveDate) : 'Pending'}</span>
                            <span><b>Expires</b>{formatDate(policy.expirationDate)}</span>
                            <span><b>Premium</b>{currency.format(policy.premium)}</span>
                            <span><b>Commission</b>{currency.format(commission)}</span>
                            <span><b>Billing</b>{policy.billingType ?? 'Not set'}</span>
                          </div>
                        </summary>
                        <div className="policy-accordion-body">
                          <div className="detail-list">
                            <div><span>Line</span><strong>{policy.lineOfBusiness}</strong></div>
                            <div><span>Carrier</span><strong>{policy.carrier}</strong></div>
                            <div><span>Policy number</span><strong>{policy.policyNumber}</strong></div>
                            <div><span>Effective date</span><strong>{policy.effectiveDate ? formatDate(policy.effectiveDate) : 'Pending'}</strong></div>
                            <div><span>Expiration date</span><strong>{formatDate(policy.expirationDate)}</strong></div>
                            <div><span>Policy year</span><strong>{policyYear}</strong></div>
                            <div><span>Annual premium</span><strong>{currency.format(policy.premium)}</strong></div>
                            <div><span>Commission %</span><strong>{policy.commissionRate ?? 0}%</strong></div>
                            <div><span>Commission amount</span><strong>{currency.format(commission)}</strong></div>
                            <div><span>Billing type</span><strong>{policy.billingType ?? 'Not set'}</strong></div>
                            <div><span>Payment plan</span><strong>{policy.paymentPlan ?? 'Not set'}</strong></div>
                            <div><span>Payment status</span><strong>{policy.paymentStatus ?? 'Current'}</strong></div>
                            <div><span>Renewal status</span><strong>{policy.renewalStatus ?? (isActivePolicy(policy.status) ? 'Not started' : 'Prior policy history')}</strong></div>
                            <div><span>Limits / coverage amount</span><strong>{policy.limits ?? 'Not entered'}</strong></div>
                            <div><span>Mortgagee / lienholder</span><strong>{policy.mortgageeOrLienholder ?? 'None on file'}</strong></div>
                            <div><span>Policy status</span><strong>{policy.status}</strong></div>
                            <div><span>Producer / CSR</span><strong>{getUserName(dataset, policy.producerUserId ?? '')} / {getUserName(dataset, policy.csrUserId ?? '')}</strong></div>
                            {ivansEntry && (
                              <div className="policy-ivans-detail-row">
                                <span><Zap size={11} /> IVANS Last Sync</span>
                                <strong>{formatDate(ivansEntry.syncedAt)} · {ivansEntry.carrierName || 'Carrier'}{ivansEntry.renewalStatus === 'renewal_pending' ? ' — Renewal pending' : ''}</strong>
                              </div>
                            )}
                          </div>
                          <div className="billing-block">
                            <h2>Billing & Payment</h2>
                            <div className="detail-list">
                              <div><span>How client pays</span><strong>{policy.billingType ?? 'Not set'}</strong></div>
                              <div><span>Payment plan</span><strong>{policy.paymentPlan ?? 'Not set'}</strong></div>
                              <div><span>Down payment</span><strong>{currency.format(policy.downPayment ?? 0)}</strong></div>
                              <div><span>Installments</span><strong>{policy.monthlyPayment ? currency.format(policy.monthlyPayment) : 'Not scheduled'}</strong></div>
                              <div><span>Finance company</span><strong>{policy.financeCompany ?? 'None'}</strong></div>
                              <div><span>Amount financed</span><strong>{policy.financeCompany ? currency.format(policy.premium - (policy.downPayment ?? 0)) : currency.format(0)}</strong></div>
                              <div><span>Remaining balance</span><strong>{policy.monthlyPayment ? currency.format(policy.monthlyPayment * 7) : 'Carrier billed'}</strong></div>
                              <div><span>Payment notes</span><strong>Receipts, agency bill tracking, and finance updates will live here.</strong></div>
                            </div>
                          </div>
                          <div className="policy-action-row">
                            {isActivePolicy(policy.status) && (
                              <button
                                className="primary-action inline-action"
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  renewPolicy(policy)
                                }}
                              >
                                Renew Policy
                              </button>
                            )}
                            <button
                              className="secondary-action inline-action"
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                setEditingPolicyId(policy.id)
                                setModal('editPolicy')
                              }}
                            >
                              Edit Policy
                            </button>
                          </div>
                          <p className="policy-note">{policy.notes ?? 'No policy notes.'}</p>
                        </div>
                      </details>
                    )
                  })}
                  {filteredClientPolicies.length === 0 && (
                    <div className="empty-state">No policies match this portfolio filter.</div>
                  )}
                </div>
              )}

              {clientTab === 'Notes & History' && (
                <div className="mini-list">
                  <button className="primary-action inline-action" type="button" onClick={() => setModal('addNote')}>Add Note</button>
                  {clientNotes.map((note) => (
                    <div className={note.pinned ? 'note-row pinned-note' : 'note-row'} key={note.id}>
                      <strong>{note.type ?? 'General'} note {note.pinned ? '- Pinned' : ''}</strong>
                      <span>{formatDateTime(note.createdAt)} - Added by {getUserName(dataset, note.createdByUserId)}</span>
                      <p>{note.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {clientTab === 'Billing' && (
                <div className="billing-tab">
                  <div className="billing-tab-header">
                    <div>
                      <h2>Billing &amp; Payment Tracker</h2>
                      <p>Manage how each policy is billed and track payment details across all carriers and plans.</p>
                    </div>
                  </div>
                  {activeClientPolicies.length === 0 && (
                    <div className="empty-state">No active policies on this client yet. Add a policy to start tracking billing.</div>
                  )}
                  {activeClientPolicies.map((policy) => {
                    const b = policy.billing ?? {}
                    const commission = (policy.premium * (policy.commissionRate ?? 0)) / 100
                    return (
                      <div className="billing-policy-card" key={policy.id}>
                        <div className="billing-policy-header">
                          <div className="billing-policy-identity">
                            <span className="billing-policy-type">{policy.policyType}</span>
                            <span className="billing-policy-carrier">{policy.carrier}</span>
                            <span className="status-pill">{policy.status}</span>
                          </div>
                          <div className="billing-policy-premium-row">
                            <span>{currency.format(policy.premium)} premium</span>
                            <span className="billing-sep">·</span>
                            <span>{currency.format(commission)} commission</span>
                            <button
                              className="secondary-action billing-edit-btn"
                              type="button"
                              onClick={() => { setBillingPolicyId(policy.id); setModal('editBilling') }}
                            >
                              Edit Billing
                            </button>
                          </div>
                        </div>
                        <div className="billing-detail-grid">
                          <div className="billing-detail-section">
                            <h3>Payment Method &amp; Plan</h3>
                            <div className="detail-list">
                              <div><span>Payment method</span><strong>{b.paymentMethod ?? 'Not set'}</strong></div>
                              <div><span>Payment plan</span><strong>{b.paymentPlanType ?? policy.paymentPlan ?? 'Not set'}</strong></div>
                              <div><span>Billing responsibility</span><strong>{b.billingResponsibility ?? policy.billingType ?? 'Not set'}</strong></div>
                              <div><span>Payment status</span><strong className={b.paymentStatus === 'Past due' || b.paymentStatus === 'NSF / Returned' ? 'billing-status-alert' : ''}>{b.paymentStatus ?? policy.paymentStatus ?? 'Current'}</strong></div>
                              {b.installmentCount && <div><span>Installments</span><strong>{b.installmentCount}-pay plan</strong></div>}
                              {b.installmentAmount && <div><span>Installment amount</span><strong>{currency.format(b.installmentAmount)}</strong></div>}
                            </div>
                          </div>

                          <div className="billing-detail-section">
                            <h3>Payment Schedule</h3>
                            <div className="detail-list">
                              <div><span>Down payment</span><strong>{b.downPaymentAmount ? currency.format(b.downPaymentAmount) : (policy.downPayment ? currency.format(policy.downPayment) : 'N/A')}</strong></div>
                              {b.downPaymentDate && <div><span>Down payment date</span><strong>{formatFullDate(b.downPaymentDate)}</strong></div>}
                              <div><span>Next payment due</span><strong>{b.nextPaymentDate ? formatFullDate(b.nextPaymentDate) : 'Not scheduled'}</strong></div>
                              {b.nextPaymentAmount && <div><span>Next payment amount</span><strong>{currency.format(b.nextPaymentAmount)}</strong></div>}
                              <div><span>Last payment</span><strong>{b.lastPaymentDate ? formatFullDate(b.lastPaymentDate) : 'None recorded'}</strong></div>
                              {b.lastPaymentAmount && <div><span>Last payment amount</span><strong>{currency.format(b.lastPaymentAmount)}</strong></div>}
                            </div>
                          </div>

                          {(b.paymentMethod === 'Premium Finance' || b.paymentPlanType === 'Financed' || b.financeCompany || policy.financeCompany) && (
                            <div className="billing-detail-section">
                              <h3>Premium Finance</h3>
                              <div className="detail-list">
                                <div><span>Finance company</span><strong>{b.financeCompany ?? policy.financeCompany ?? 'Not set'}</strong></div>
                                {b.financeContractNumber && <div><span>Contract #</span><strong>{b.financeContractNumber}</strong></div>}
                                {b.financeAmount && <div><span>Amount financed</span><strong>{currency.format(b.financeAmount)}</strong></div>}
                                {b.financeMonthlyPayment && <div><span>Monthly payment</span><strong>{currency.format(b.financeMonthlyPayment)}</strong></div>}
                                {b.financePayoffDate && <div><span>Payoff date</span><strong>{formatFullDate(b.financePayoffDate)}</strong></div>}
                              </div>
                            </div>
                          )}

                          {(b.paymentMethod === 'Escrow / Mortgagee' || b.paymentPlanType === 'Escrow / Mortgage' || b.mortgageeOrLienholder || policy.mortgageeOrLienholder) && (
                            <div className="billing-detail-section">
                              <h3>Mortgagee / Escrow</h3>
                              <div className="detail-list">
                                <div><span>Mortgagee / lienholder</span><strong>{b.mortgageeOrLienholder ?? policy.mortgageeOrLienholder ?? 'Not set'}</strong></div>
                                {b.mortgageeClause && <div><span>Mortgagee clause</span><strong>{b.mortgageeClause}</strong></div>}
                                {b.escrowAccount && <div><span>Escrow account #</span><strong>{b.escrowAccount}</strong></div>}
                              </div>
                            </div>
                          )}

                          {(b.paymentMethod === 'Credit Card' || b.creditCardLast4) && (
                            <div className="billing-detail-section">
                              <h3>Credit Card on File</h3>
                              <div className="detail-list">
                                {b.creditCardLast4 && <div><span>Card ending in</span><strong>•••• {b.creditCardLast4}</strong></div>}
                                {b.creditCardExpiry && <div><span>Expiry</span><strong>{b.creditCardExpiry}</strong></div>}
                              </div>
                            </div>
                          )}

                          {(b.paymentMethod === 'ACH / Bank Draft' || b.achBankName) && (
                            <div className="billing-detail-section">
                              <h3>ACH / Bank Draft</h3>
                              <div className="detail-list">
                                {b.achBankName && <div><span>Bank</span><strong>{b.achBankName}</strong></div>}
                                {b.achAccountLast4 && <div><span>Account ending in</span><strong>•••• {b.achAccountLast4}</strong></div>}
                              </div>
                            </div>
                          )}

                          {b.billingNotes && (
                            <div className="billing-detail-section billing-notes-section">
                              <h3>Billing Notes</h3>
                              <p className="billing-notes-body">{b.billingNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {clientTab === 'Tasks' && (
                <div className="mini-list">
                  <div className="quick-actions">
                    <button className="primary-action inline-action" type="button" onClick={() => setModal('addTask')}>Add Task</button>
                    <button className="secondary-action inline-action" type="button" onClick={() => setModal('addTask')}>Create Follow-Up</button>
                    <button className="secondary-action inline-action" type="button" onClick={() => setModal('addTask')}>Add Payment Reminder</button>
                  </div>
                  {clientTasks.map((task) => (
                    <div className={`mini-row${task.completed ? ' task-completed' : ''}`} key={task.id}>
                      <div className="task-row-content">
                        <button
                          className={`task-check-btn${task.completed ? ' task-check-btn--done' : ''}`}
                          type="button"
                          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                          onClick={() => completeTask(task.id)}
                        >
                          <CheckCircle2 size={18} aria-hidden="true" />
                        </button>
                        <div>
                          <strong>{task.title}</strong>
                          <span>{task.description} - Due {task.dueDate ? formatDate(task.dueDate) : task.dueLabel}</span>
                        </div>
                      </div>
                      <div>
                        <small className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</small>
                        <small>{task.completed ? 'Completed' : task.status ?? 'Open'}</small>
                        <small>{getUserName(dataset, task.assignedToUserId)}</small>
                      </div>
                    </div>
                  ))}
                  {clientTasks.length === 0 && <div className="empty-state">No tasks are tied to this client yet.</div>}
                </div>
              )}

              {clientTab === 'Communications' && (
                <div className="profile-grid">
                  <div className="placeholder-grid">
                    <div><strong>Send Email</strong><span>Compose an email to {selectedClient.email ?? selectedClient.primaryContact} and store it on this client file.</span></div>
                    <div><strong>Send SMS</strong><span>Text {selectedClient.phone ?? 'the main contact'} and save the conversation history.</span></div>
                    <div><strong>Email templates</strong><span>Renewal reminders, missing info requests, certificate delivery, and payment follow-ups.</span></div>
                    <div><strong>Communication log</strong><span>Every outbound and inbound message will stay tied to this client folder.</span></div>
                  </div>
                  <div className="timeline-list compact-timeline">
                    <div><strong>Email sent</strong><span>Renewal reminder to {selectedClient.primaryContact} - stored on client file.</span></div>
                    <div><strong>SMS received</strong><span>Client confirmed best callback time for policy review.</span></div>
                    <div><strong>Email draft</strong><span>Certificate delivery template ready for CSR review.</span></div>
                  </div>
                </div>
              )}

              {clientTab === 'Activity' && (
                <div className="timeline-list">
                  <div><strong>Client created</strong><span>{selectedClient.name} added to AgencyIQ.</span></div>
                  {clientPolicies.map((policy) => <div key={policy.id}><strong>Policy added</strong><span>{policy.policyType} - {policy.policyNumber}</span></div>)}
                  {clientNotes.map((note) => <div key={note.id}><strong>Note added</strong><span>{note.type ?? 'General'} - {formatDateTime(note.createdAt)}</span></div>)}
                  {clientTasks.map((task) => <div key={task.id}><strong>Task created</strong><span>{task.title}</span></div>)}
                  <div><strong>Payment update</strong><span>Placeholder billing activity.</span></div>
                  {clientRenewals.map((renewal) => <div key={renewal.id}><strong>Policy renewal update</strong><span>{renewal.status} - {formatDate(renewal.dueDate)}</span></div>)}
                </div>
              )}
            </section>
          </section>
        ) : (
          <>
        <section className="page-heading">
          <div>
            <p className="eyebrow">Dashboard setup</p>
            <h1>Agency Command Center</h1>
            <p className="account-context">
              {dataset.currentUser.role} - {dataset.agency.plan} account -{' '}
              {canSeeOwnerAnalytics ? 'Owner analytics enabled' : 'Operational workspace'}
            </p>
          </div>
        </section>

        <section className="metric-grid command-metric-grid" aria-label="Daily command metrics">
          {dashboardFocusMetrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
              <small>{metric.trend}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-customizer panel" aria-label="Dashboard widget settings">
          <div>
            <h2>Daily command center</h2>
            <p>Toggle widgets on/off or drag to reorder.</p>
          </div>
          <div className="widget-toggle-list">
            {dashboardWidgetOrder.map((widgetId) => {
              const widget = dashboardWidgets.find((w) => w.id === widgetId)
              if (!widget) return null
              return (
                <button
                  className={[
                    isWidgetVisible(widget.id) ? 'widget-toggle active' : 'widget-toggle',
                    dragOverWidgetId === widget.id ? 'widget-toggle--drag-over' : '',
                  ].filter(Boolean).join(' ')}
                  type="button"
                  key={widget.id}
                  draggable
                  onDragStart={() => setDragWidgetId(widget.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverWidgetId(widget.id) }}
                  onDragLeave={() => setDragOverWidgetId(null)}
                  onDrop={() => { if (dragWidgetId && dragWidgetId !== widget.id) reorderWidgets(dragWidgetId, widget.id); setDragWidgetId(null); setDragOverWidgetId(null) }}
                  onDragEnd={() => { setDragWidgetId(null); setDragOverWidgetId(null) }}
                  onClick={() => toggleDashboardWidget(widget.id)}
                >
                  <span className="widget-drag-handle" aria-hidden="true">⠿</span>
                  {widget.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="content-grid">
          {dashboardWidgetOrder.map((widgetId) => (<React.Fragment key={widgetId}>
          {widgetId === 'communications' && isWidgetVisible('communications') && (
          <article className="panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Important Alerts</h2>
                <p>Messages and service signals that should not wait.</p>
              </div>
              <span className="status-pill">5 unread</span>
            </div>
            <div className="timeline-list compact-timeline">
              <div><strong>New SMS</strong><span>Northstar Logistics - Driver list is ready for review.</span></div>
              <div><strong>New email</strong><span>Harbor View Dental - Renewal documents attached.</span></div>
              <div><strong>Missed call</strong><span>Luna Family Trust - Callback requested this afternoon.</span></div>
              <div><strong>Email reply</strong><span>Blue Peak Roofing - Asked for revised deductible option.</span></div>
            </div>
          </article>
          )}

          {widgetId === 'recentActivity' && isWidgetVisible('recentActivity') && (
          <article className="panel pipeline-panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Recent Client Activity</h2>
                <p>Latest notes, policy updates, and service touches.</p>
              </div>
              <button className="text-button" type="button" onClick={() => setActiveView('clients')}>
                View all
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="timeline-list compact-timeline">
              {dataset.notes.slice(0, 4).map((note) => {
                const client = dataset.clients.find((item) => item.id === note.clientId)
                return (
                  <div key={note.id}>
                    <strong>{note.type ?? 'General'} note</strong>
                    <span>{client?.name ?? 'Client'} - {formatDateTime(note.createdAt)}</span>
                  </div>
                )
              })}
              {dataset.policies.slice(0, 2).map((policy) => {
                const client = dataset.clients.find((item) => item.id === policy.clientId)
                return (
                  <div key={policy.id}>
                    <strong>Policy record updated</strong>
                    <span>{client?.name ?? 'Client'} - {policy.policyType}</span>
                  </div>
                )
              })}
            </div>
          </article>
          )}

          {widgetId === 'followUps' && isWidgetVisible('followUps') && (
          <article className="panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Tasks & Follow-Ups Due Today</h2>
                <p>Open client work scheduled for today.</p>
              </div>
              <CheckCircle2 size={22} aria-hidden="true" />
            </div>
            <div className="task-list">
              {tasksDueToday.map((task) => (
                <div className="task-row" key={task.title}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{getUserName(dataset, task.assignedToUserId)} owner</span>
                  </div>
                  <div>
                    <small className={`priority ${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </small>
                    <small>{task.dueLabel}</small>
                  </div>
                </div>
              ))}
              {tasksDueToday.length === 0 && <div className="empty-state">No tasks are due today.</div>}
            </div>
          </article>
          )}

          {widgetId === 'renewals' && isWidgetVisible('renewals') && (
          <article className="panel wide-panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Renewals & Expiring Policies</h2>
                <p>Prioritize accounts before premium is at risk.</p>
              </div>
              <button className="secondary-action" type="button" onClick={() => { setActiveView('clients'); setClientFilter('Renewal Due') }}>
                <CalendarClock size={17} aria-hidden="true" />
                Renewal calendar
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Policy</th>
                    <th>Carrier</th>
                    <th>Due</th>
                    <th>Premium</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {renewals.map((renewal) => (
                    <tr key={renewal.id}>
                      <td>{renewal.client}</td>
                      <td>{renewal.policy}</td>
                      <td>{renewal.carrier}</td>
                      <td>{renewal.due}</td>
                      <td>{renewal.premiumDisplay}</td>
                      <td>
                        <span className="status-pill">{renewal.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          )}

          {widgetId === 'keyAccounts' && isWidgetVisible('keyAccounts') && (
          <article className="panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Key Accounts</h2>
                <p>High-value client folders and pipeline at a glance.</p>
              </div>
              <CircleDollarSign size={22} aria-hidden="true" />
            </div>
            <div className="key-account-folder-list">
              {keyAccounts.map((account) => {
                const accountPolicies = dataset.policies.filter((p) => p.clientId === account.id)
                const activePols = accountPolicies.filter((p) => isActivePolicy(p.status))
                const nextRen = accountPolicies
                  .map((p) => p.expirationDate)
                  .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
                return (
                  <button
                    className="key-account-folder"
                    type="button"
                    key={account.id}
                    onClick={() => {
                      setSelectedClientId(account.id)
                      setActiveView('profile')
                    }}
                  >
                    <div className="key-account-folder-accent" aria-hidden="true" />
                    <div className="key-account-folder-main">
                      <div className="key-account-folder-top">
                        <strong>{account.name}</strong>
                        <span className={`key-account-health key-account-health--${account.health.toLowerCase().replace(/\s+/g, '-')}`}>{account.health}</span>
                      </div>
                      <div className="key-account-folder-meta">
                        <span>{account.lineOfBusiness} · {activePols.length} active</span>
                        {nextRen && <span>Renews {formatDate(nextRen)}</span>}
                      </div>
                      {canSeeOwnerAnalytics && (
                        <div className="key-account-folder-premium">
                          {compactCurrency.format(account.annualRevenue)}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className="key-account-folder-arrow" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </article>
          )}

          {widgetId === 'ownerReports' && canSeeOwnerAnalytics && isWidgetVisible('ownerReports') && (
            <article className="panel wide-panel owner-reports-panel">
              <div className="panel-header">
                <div>
                  <h2>Owner sales reports</h2>
                  <p>Company-level revenue, retention, missed sale, and follow-up analytics.</p>
                </div>
                <span className="owner-only-pill">
                  <Lock size={14} aria-hidden="true" />
                  Owner only
                </span>
              </div>

              <div className="owner-report-grid">
                {ownerReports.map((report) => (
                  <div className="owner-report-card" key={report.label}>
                    <span>{report.label}</span>
                    <strong>{report.value}</strong>
                    <p>{report.detail}</p>
                    <div className="owner-breakdown-list">
                      {report.breakdown.length > 0 ? (
                        report.breakdown.map((item) => (
                          <div className="owner-breakdown-row" key={`${report.label}-${item.userName}`}>
                            <div>
                              <b>{item.userName}</b>
                              <em>{item.meta}</em>
                            </div>
                            <strong>{item.value}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="owner-breakdown-row muted">
                          <div>
                            <b>No activity yet</b>
                            <em>Nothing to report</em>
                          </div>
                          <strong>0</strong>
                        </div>
                      )}
                    </div>
                    <small>{report.status}</small>
                  </div>
                ))}
              </div>
            </article>
          )}
          </React.Fragment>))}
        </section>
          </>
        )}
      </main>

      {aiHelpOpen && (
        <aside className="ai-help-panel" aria-label="AgencyIQ AI help">
          <div className="ai-help-header">
            <div className="ai-help-mascot-row">
              <img src={mascotImg} alt="AgencyIQ assistant" className="ai-panel-mascot" />
              <div>
                <span className="ai-kicker">
                  <Bot size={15} aria-hidden="true" />
                  Agent answer assistant
                </span>
                <h2>Help explain client questions</h2>
              </div>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close AI help"
              onClick={() => { setAiHelpOpen(false); setAiAnswer(''); setAiQuery('') }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form
            className="ai-prompt-box"
            onSubmit={(e) => { e.preventDefault(); handleAiQuery(aiQuery) }}
          >
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Ask AgencyIQ AI"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ask about coverage, premiums, limits, deductibles, renewals, or billing"
            />
            {aiQuery && (
              <button className="ai-send-btn" type="submit" aria-label="Submit question">
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </form>

          {!aiAnswer && !aiLoading && (
            <div className="ai-suggestion-grid">
              {[
                'Explain why a client\'s premium increased',
                'Explain what this coverage does in plain English',
                'Explain why a limit may be too high or too low',
                'Draft a professional response to a client question',
                'Compare deductible and premium tradeoffs',
                'Summarize renewal changes for the agent',
              ].map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => { setAiQuery(q); handleAiQuery(q) }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {aiLoading && (
            <div className="ai-loading">
              <img src={mascotImg} alt="" className="ai-loading-mascot" aria-hidden="true" />
              <span className="ai-loading-dot" /><span className="ai-loading-dot" /><span className="ai-loading-dot" />
              <span>Thinking…</span>
            </div>
          )}

          {aiAnswer && !aiLoading && (
            <div className="ai-answer-panel">
              <div className="ai-answer-header">
                <img src={mascotImg} alt="" className="ai-answer-mascot" aria-hidden="true" />
                <strong>AgencyIQ says:</strong>
                <button className="text-button ai-clear-btn" type="button" onClick={() => { setAiAnswer(''); setAiQuery('') }}>
                  Ask another
                </button>
              </div>
              <p className="ai-answer-body">{aiAnswer}</p>
            </div>
          )}

          <div className="ai-guidance-panel">
            <strong>Designed for agent review</strong>
            <span>
              Review all answers before sharing with clients. This assistant provides educational
              talking points — final advice should come from a licensed agent.
            </span>
          </div>
        </aside>
      )}

      {/* ─── Add Client Modal ─────────────────────────────────── */}
      {modal === 'addClient' && (
        <NewClientWizard
          users={dataset.users}
          onClose={() => setModal(null)}
          onSave={(clientData, action) => addClient(clientData, action)}
        />
      )}

      {/* ─── Edit Billing Modal ──────────────────────────────── */}
      {modal === 'editBilling' && billingPolicyId && (() => {
        const pol = dataset.policies.find((p) => p.id === billingPolicyId)
        if (!pol) return null
        return (
          <EditBillingModal
            policy={pol}
            onClose={() => { setModal(null); setBillingPolicyId(null) }}
            onSave={(billing) => savePolicyBilling(billingPolicyId, billing)}
          />
        )
      })()}

      {/* ─── Edit Client Modal ───────────────────────────────── */}
      {modal === 'editClient' && selectedClient && (
        <EditClientModal
          client={selectedClient}
          users={dataset.users}
          onClose={() => setModal(null)}
          onSave={updateClient}
        />
      )}

      {/* ─── Edit Policy Modal ───────────────────────────────── */}
      {modal === 'editPolicy' && editingPolicyId && (() => {
        const pol = dataset.policies.find((p) => p.id === editingPolicyId)
        if (!pol) return null
        return (
          <EditPolicyModal
            policy={pol}
            allPolicyTypes={[...ISO_POLICY_TYPES, ...customPolicyTypes]}
            allCarriers={[...KNOWN_CARRIERS, ...customCarriers]}
            onAddPolicyType={addCustomPolicyType}
            onAddCarrier={addCustomCarrier}
            onClose={() => { setModal(null); setEditingPolicyId(null) }}
            onSave={(data) => updatePolicy(editingPolicyId, data)}
          />
        )
      })()}

      {/* ─── Add Policy Modal ─────────────────────────────────── */}
      {modal === 'addPolicy' && selectedClient && (
        <AddPolicyModal
          clientName={selectedClient.name}
          onClose={() => setModal(null)}
          onSave={addPolicy}
          allPolicyTypes={[...ISO_POLICY_TYPES, ...customPolicyTypes]}
          allCarriers={[...KNOWN_CARRIERS, ...customCarriers]}
          onAddPolicyType={addCustomPolicyType}
          onAddCarrier={addCustomCarrier}
        />
      )}

      {/* ─── Add Task Modal ───────────────────────────────────── */}
      {modal === 'addTask' && selectedClient && (
        <AddTaskModal
          clientName={selectedClient.name}
          users={dataset.users}
          currentUserId={dataset.currentUser.id}
          onClose={() => setModal(null)}
          onSave={addTask}
        />
      )}

      {/* ─── Add Note Modal ───────────────────────────────────── */}
      {modal === 'addNote' && selectedClient && (
        <AddNoteModal
          clientName={selectedClient.name}
          onClose={() => setModal(null)}
          onSave={addNote}
        />
      )}

      {/* ─── Add Lead Modal ───────────────────────────────────── */}
      {modal === 'carrierPortal' && (
        <CarrierPortalModal
          portals={carrierPortals}
          onClose={() => setModal(null)}
          onSave={saveCarrierPortal}
          onDelete={(id) => { setCarrierPortals((prev) => prev.filter((p) => p.id !== id)); showToast('Carrier portal removed') }}
        />
      )}

      {modal === 'addLead' && (
        <AddLeadModal
          users={dataset.users}
          currentUserId={dataset.currentUser.id}
          onClose={() => setModal(null)}
          onSave={addLead}
        />
      )}

      {/* ─── Toast Notifications ──────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <CheckCircle2 size={16} aria-hidden="true" />
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {/* ─── IQ Buddy floating mascot ────────────────────────── */}
      {!aiHelpOpen && (
        <IqBuddy
          onOpen={() => setAiHelpOpen(true)}
          activeView={activeView}
          clientTab={clientTab}
        />
      )}
    </div>
  )
}

/* ─── Renewal Center ────────────────────────────────────────────── */

type RenewalPolicyItem = {
  policy: Policy
  client: import('./data/crmTypes').Client | undefined
  renewal: import('./data/crmTypes').Renewal | undefined
  expDate: string
  daysUntil: number
  isEscrow: boolean
  isAutopay: boolean
  billingMethod: string
  paymentPlan: string
}

function RenewalCenter({
  renewalPolicies, allRenewalPolicies, accountId: _accountId, dataset: _dataset, todayIso: _todayIso,
  renewalViewMode, setRenewalViewMode,
  renewalMonth, setRenewalMonth,
  renewalDateFrom, setRenewalDateFrom,
  renewalDateTo, setRenewalDateTo,
  hideEscrow, setHideEscrow,
  hideAutopay, setHideAutopay,
  selectedIds, setSelectedIds, toggleSelection,
  emailTemplates, editingTemplate, setEditingTemplate, saveEmailTemplate, deleteEmailTemplate,
  renewalOutreachModal, setRenewalOutreachModal,
  renewalSort, setRenewalSort,
  renewalPremiumEdits, setRenewalPremiumEdits, saveRenewalPremium,
  exportRenewalsCsv,
  onOpenClient, onOpenIvans, ivansLastGlobalSync,
  showToast,
  currency, formatDate, formatFullDate: _formatFullDate, getUserName: _getUserName,
}: {
  renewalPolicies: RenewalPolicyItem[]
  allRenewalPolicies: RenewalPolicyItem[]
  accountId: string
  dataset: CrmDataset
  todayIso: string
  renewalViewMode: 'month' | 'range'
  setRenewalViewMode: (v: 'month' | 'range') => void
  renewalMonth: string
  setRenewalMonth: (v: string) => void
  renewalDateFrom: string
  setRenewalDateFrom: (v: string) => void
  renewalDateTo: string
  setRenewalDateTo: (v: string) => void
  hideEscrow: boolean
  setHideEscrow: (v: boolean) => void
  hideAutopay: boolean
  setHideAutopay: (v: boolean) => void
  selectedIds: Set<string>
  setSelectedIds: (v: Set<string>) => void
  toggleSelection: (id: string) => void
  emailTemplates: EmailTemplate[]
  editingTemplate: EmailTemplate | null
  setEditingTemplate: (t: EmailTemplate | null) => void
  saveEmailTemplate: (t: EmailTemplate) => void
  deleteEmailTemplate: (id: string) => void
  renewalOutreachModal: 'email' | 'text' | null
  setRenewalOutreachModal: (v: 'email' | 'text' | null) => void
  renewalSort: 'date' | 'name' | 'carrier' | 'billing'
  setRenewalSort: (v: 'date' | 'name' | 'carrier' | 'billing') => void
  renewalPremiumEdits: Record<string, string>
  setRenewalPremiumEdits: (v: Record<string, string>) => void
  saveRenewalPremium: (policyId: string, val: string) => void
  exportRenewalsCsv: (items: RenewalPolicyItem[]) => void
  onOpenClient: (clientId: string) => void
  onOpenIvans: () => void
  ivansLastGlobalSync: string | null
  showToast: (msg: string) => void
  currency: Intl.NumberFormat
  formatDate: (d: string) => string
  formatFullDate: (d: string) => string
  getUserName: (id: string) => string
}) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const allIds = renewalPolicies.map((r) => r.policy.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  const overdueCount = allRenewalPolicies.filter((r) => r.daysUntil < 0 && !r.isEscrow && !r.isAutopay).length
  const criticalCount = allRenewalPolicies.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 7 && !r.isEscrow && !r.isAutopay).length
  const dueThisMonth = allRenewalPolicies.filter((r) => r.expDate.startsWith(renewalMonth)).length
  const escrowCount = allRenewalPolicies.filter((r) => r.isEscrow).length
  const autopayCount = allRenewalPolicies.filter((r) => r.isAutopay).length

  const monthLabel = new Date(`${renewalMonth}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (showTemplates) {
    return (
      <section className="renewal-center">
        <div className="renewal-topbar">
          <div>
            <p className="eyebrow">Renewal Command Center</p>
            <h1>Email Templates</h1>
            <p className="account-context">Create and manage outreach templates for renewal campaigns.</p>
          </div>
          <button className="secondary-action" type="button" onClick={() => setShowTemplates(false)}>
            <ArrowLeft size={16} /> Back to Renewals
          </button>
        </div>
        <div className="template-grid">
          {emailTemplates.map((tpl) => (
            <div className={`template-card template-card--${tpl.type}`} key={tpl.id}>
              <div className="template-card-header">
                <div>
                  <span className="template-type-tag">{tpl.type}</span>
                  <strong>{tpl.name}</strong>
                  <em>{tpl.subject}</em>
                </div>
                <div className="template-card-actions">
                  <button className="utility-action" type="button" onClick={() => setEditingTemplate({ ...tpl })}>Edit</button>
                  {!['tpl-1','tpl-2','tpl-3','tpl-4'].includes(tpl.id) && (
                    <button className="utility-action" type="button" onClick={() => deleteEmailTemplate(tpl.id)}>Delete</button>
                  )}
                </div>
              </div>
              <pre className="template-body-preview">{tpl.body.slice(0, 160)}…</pre>
            </div>
          ))}
          <button
            className="template-add-card"
            type="button"
            onClick={() => setEditingTemplate({ id: `tpl-${Date.now()}`, name: '', subject: '', body: '', type: 'custom' })}
          >
            <Mail size={28} />
            <span>New Template</span>
          </button>
        </div>
        {editingTemplate && (
          <TemplateEditorModal
            template={editingTemplate}
            onClose={() => setEditingTemplate(null)}
            onSave={saveEmailTemplate}
          />
        )}
      </section>
    )
  }

  return (
    <section className="renewal-center">
      {/* Header */}
      <div className="renewal-topbar">
        <div>
          <p className="eyebrow">Renewal Command Center</p>
          <h1>Policy Renewals</h1>
          <p className="account-context">
            {renewalPolicies.length} policies in view
            {overdueCount > 0 && <span className="rc-header-badge rc-header-badge--red">{overdueCount} past due</span>}
            {criticalCount > 0 && <span className="rc-header-badge rc-header-badge--orange">{criticalCount} due within 7 days</span>}
          </p>
        </div>
        <div className="renewal-header-actions">
          <button className="utility-action ivans-launch-btn" type="button" onClick={onOpenIvans} title="Go to IVANS Sync in Clients">
            <Zap size={15} />
            IVANS Sync
            {ivansLastGlobalSync && <span className="ivans-btn-sync-time">{ivansLastGlobalSync.slice(0, 10)}</span>}
          </button>
          <button className="utility-action" type="button" onClick={() => exportRenewalsCsv(someSelected ? renewalPolicies.filter((r) => selectedIds.has(r.policy.id)) : renewalPolicies)}>
            <CircleDollarSign size={15} /> Export {someSelected ? `${selectedIds.size} selected` : 'all'}
          </button>
          <button className="utility-action" type="button" onClick={() => setShowTemplates(true)}>
            <Mail size={15} /> Email Templates
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="renewal-kpi-strip">
        <div className="renewal-kpi renewal-kpi--red">
          <Zap size={18} />
          <div>
            <strong>{overdueCount}</strong>
            <span>Past Due</span>
          </div>
        </div>
        <div className="renewal-kpi renewal-kpi--orange">
          <CalendarClock size={18} />
          <div>
            <strong>{criticalCount}</strong>
            <span>Due in 7 Days</span>
          </div>
        </div>
        <div className="renewal-kpi renewal-kpi--month">
          <CalendarClock size={18} />
          <div>
            <strong>{dueThisMonth}</strong>
            <span>Due in {monthLabel}</span>
          </div>
        </div>
        <div className="renewal-kpi renewal-kpi--escrow">
          <RefreshCcw size={18} />
          <div>
            <strong>{escrowCount}</strong>
            <span>Escrow / Mortgagee</span>
          </div>
        </div>
        <div className="renewal-kpi renewal-kpi--auto">
          <Sparkles size={18} />
          <div>
            <strong>{autopayCount}</strong>
            <span>Auto-pay</span>
          </div>
        </div>
        <div className="renewal-kpi renewal-kpi--total">
          <CircleDollarSign size={18} />
          <div>
            <strong>{currency.format(renewalPolicies.reduce((s, r) => s + r.policy.premium, 0))}</strong>
            <span>Premium in view</span>
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div className="renewal-legend">
        <div className="renewal-legend-item renewal-legend--red"><span className="legend-swatch" />Past due — immediate action</div>
        <div className="renewal-legend-item renewal-legend--orange"><span className="legend-swatch" />Expires within 7 days — urgent outreach</div>
        <div className="renewal-legend-item renewal-legend--green"><span className="legend-swatch" />More than 7 days — follow-up &amp; review</div>
        <div className="renewal-legend-item renewal-legend--neutral"><span className="legend-swatch" />Escrow or auto-pay — confirm &amp; monitor</div>
      </div>

      {/* Filter Row */}
      <div className="renewal-filter-bar">
        <div className="renewal-view-toggle">
          <button className={renewalViewMode === 'month' ? 'sort-tab active' : 'sort-tab'} type="button" onClick={() => setRenewalViewMode('month')}>By Month</button>
          <button className={renewalViewMode === 'range' ? 'sort-tab active' : 'sort-tab'} type="button" onClick={() => setRenewalViewMode('range')}>Date Range</button>
        </div>
        {renewalViewMode === 'month' ? (
          <div className="renewal-month-nav">
            <button className="icon-button" type="button" aria-label="Previous month" onClick={() => {
              const [y, m] = renewalMonth.split('-').map(Number)
              const prev = new Date(y, m - 2, 1)
              setRenewalMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
            }}><ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} /></button>
            <input type="month" value={renewalMonth} onChange={(e) => setRenewalMonth(e.target.value)} className="month-input" />
            <button className="icon-button" type="button" aria-label="Next month" onClick={() => {
              const [y, m] = renewalMonth.split('-').map(Number)
              const next = new Date(y, m, 1)
              setRenewalMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
            }}><ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
          </div>
        ) : (
          <div className="renewal-date-range">
            <label>From <input type="date" value={renewalDateFrom} onChange={(e) => setRenewalDateFrom(e.target.value)} /></label>
            <label>To <input type="date" value={renewalDateTo} onChange={(e) => setRenewalDateTo(e.target.value)} /></label>
          </div>
        )}
        <div className="renewal-sort-controls">
          <span className="sort-label">Sort:</span>
          {([['date','Renewal Date'],['name','Client Name'],['carrier','Carrier'],['billing','Billing Type']] as ['date'|'name'|'carrier'|'billing', string][]).map(([val, lbl]) => (
            <button key={val} className={renewalSort === val ? 'sort-tab active' : 'sort-tab'} type="button" onClick={() => setRenewalSort(val)}>{lbl}</button>
          ))}
        </div>
        <div className="renewal-checkboxes">
          <label className="renewal-filter-check">
            <input type="checkbox" checked={hideEscrow} onChange={(e) => setHideEscrow(e.target.checked)} />
            Hide Escrow
          </label>
          <label className="renewal-filter-check">
            <input type="checkbox" checked={hideAutopay} onChange={(e) => setHideAutopay(e.target.checked)} />
            Hide Auto-Pay
          </label>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="renewal-bulk-bar">
          <span className="renewal-bulk-count">{selectedIds.size} selected</span>
          <button className="primary-action renewal-bulk-btn" type="button" onClick={() => setRenewalOutreachModal('email')}>
            <Send size={15} /> Email Reminder
          </button>
          <button className="secondary-action renewal-bulk-btn" type="button" onClick={() => setRenewalOutreachModal('text')}>
            <MessageSquare size={15} /> Send Text
          </button>
          <button className="utility-action" type="button" onClick={() => exportRenewalsCsv(renewalPolicies.filter((r) => selectedIds.has(r.policy.id)))}>
            Export Selected
          </button>
          <button className="utility-action" type="button" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="renewal-table-wrap panel">
        <div className="renewal-table-header">
          <label className="renewal-select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
          </label>
          <div className="renewal-col-labels">
            <span className="rcl-client">Client / Policy</span>
            <span className="rcl-date">Exp. Date</span>
            <span className="rcl-premium">Current / Renewal</span>
            <span className="rcl-billing">Billing</span>
            <span className="rcl-ai">AI Recommendation</span>
            <span className="rcl-actions">Actions</span>
          </div>
        </div>
        <div className="renewal-rows">
          {renewalPolicies.map((item) => {
            const { policy, client, daysUntil, isEscrow, isAutopay } = item
            const isPastDue = daysUntil < 0
            const isWithin7 = daysUntil >= 0 && daysUntil <= 7
            const isNeutral = isEscrow || isAutopay
            const rowClass = isNeutral ? 'renewal-row--neutral' : isPastDue ? 'renewal-row--red' : isWithin7 ? 'renewal-row--orange' : 'renewal-row--green'
            const ai = getRenewalAiSuggestion(daysUntil, item.billingMethod, item.paymentPlan)
            const isSelected = selectedIds.has(policy.id)
            const renewalPremium = (policy as Policy & { renewalPremium?: number }).renewalPremium
            const editVal = renewalPremiumEdits[policy.id]
            const isFinanced = item.paymentPlan.toLowerCase().includes('financ') || item.billingMethod.toLowerCase().includes('financ')
            const billingDisplay = item.billingMethod || item.paymentPlan || policy.billingType || '—'
            return (
              <div className={`renewal-row ${rowClass} ${isSelected ? 'renewal-row--selected' : ''}`} key={policy.id}>
                {/* Checkbox */}
                <label className="renewal-row-check">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(policy.id)} />
                </label>

                {/* Col 1: Client / Policy */}
                <div className="rc-col rc-col-client">
                  <button className="renewal-client-link" type="button" onClick={() => onOpenClient(policy.clientId)}>
                    {client?.name ?? 'Unknown'}
                  </button>
                  <div className="rc-policy-line">
                    <span className="renewal-policy-type">{policy.policyType}</span>
                    <span className="renewal-carrier">{policy.carrier}</span>
                  </div>
                  <div className="renewal-row-tags">
                    {isEscrow && <span className="renewal-tag renewal-tag--escrow">Escrow</span>}
                    {isAutopay && <span className="renewal-tag renewal-tag--autopay">Auto-pay</span>}
                    {isFinanced && <span className="renewal-tag renewal-tag--financed">Financed</span>}
                    <span className="status-pill">{item.renewal?.status ?? 'Not started'}</span>
                  </div>
                </div>

                {/* Col 2: Date + urgency */}
                <div className="rc-col rc-col-date">
                  <span className="renewal-date-chip">
                    <CalendarClock size={12} />
                    {formatDate(policy.expirationDate)}
                  </span>
                  <span className={`renewal-days-badge ${isPastDue ? 'days-badge--red' : isWithin7 ? 'days-badge--orange' : 'days-badge--green'}`}>
                    {isPastDue ? `${Math.abs(daysUntil)}d PAST DUE` : `${daysUntil}d left`}
                  </span>
                </div>

                {/* Col 3: Premiums */}
                <div className="rc-col rc-col-premium">
                  <div className="rc-premium-row">
                    <span className="premium-label">Current</span>
                    <strong className="rc-premium-val">{currency.format(policy.premium)}</strong>
                  </div>
                  <div className="rc-premium-row">
                    <span className="premium-label">Renewal</span>
                    {editVal !== undefined ? (
                      <div className="renewal-premium-input-row">
                        <input
                          className="renewal-premium-input"
                          type="number"
                          value={editVal}
                          autoFocus
                          onChange={(e) => setRenewalPremiumEdits({ ...renewalPremiumEdits, [policy.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenewalPremium(policy.id, editVal)
                            if (e.key === 'Escape') setRenewalPremiumEdits(Object.fromEntries(Object.entries(renewalPremiumEdits).filter(([k]) => k !== policy.id)))
                          }}
                        />
                        <button className="renewal-premium-save" type="button" onClick={() => saveRenewalPremium(policy.id, editVal)}>✓</button>
                      </div>
                    ) : renewalPremium ? (
                      <button className="renewal-premium-entered" type="button" onClick={() => setRenewalPremiumEdits({ ...renewalPremiumEdits, [policy.id]: String(renewalPremium) })}>
                        {currency.format(renewalPremium)}
                        {renewalPremium > policy.premium && <span className="premium-change premium-change--up">+{Math.round(((renewalPremium - policy.premium) / policy.premium) * 100)}%</span>}
                        {renewalPremium < policy.premium && <span className="premium-change premium-change--down">-{Math.round(((policy.premium - renewalPremium) / policy.premium) * 100)}%</span>}
                      </button>
                    ) : (
                      <button className="renewal-premium-add" type="button" onClick={() => setRenewalPremiumEdits({ ...renewalPremiumEdits, [policy.id]: '' })}>
                        + Enter premium
                      </button>
                    )}
                  </div>
                </div>

                {/* Col 4: Billing */}
                <div className="rc-col rc-col-billing">
                  <span className="rc-billing-method">{billingDisplay}</span>
                  {item.paymentPlan && item.paymentPlan !== billingDisplay && (
                    <span className="rc-billing-plan">{item.paymentPlan}</span>
                  )}
                </div>

                {/* Col 5: AI */}
                <div className="rc-col rc-col-ai">
                  <span className={`ai-tag ${ai.color}`}>
                    <Sparkles size={11} />
                    {ai.label}
                  </span>
                  <span className="ai-tip">{ai.tip}</span>
                </div>

                {/* Col 6: Actions */}
                <div className="rc-col rc-col-actions">
                  <button className="utility-action renewal-quick-action" type="button" title="Send email reminder"
                    onClick={() => { if (!selectedIds.has(policy.id)) toggleSelection(policy.id); setRenewalOutreachModal('email') }}>
                    <Mail size={14} />
                  </button>
                  <button className="utility-action renewal-quick-action" type="button" title="Send text"
                    onClick={() => { if (!selectedIds.has(policy.id)) toggleSelection(policy.id); setRenewalOutreachModal('text') }}>
                    <MessageSquare size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {renewalPolicies.length === 0 && (
            <div className="empty-state renewal-empty">No renewals match your current filters.</div>
          )}
        </div>
      </div>

      {/* Outreach Modal */}
      {renewalOutreachModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setRenewalOutreachModal(null) }}>
          <div className="modal-panel renewal-outreach-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>{renewalOutreachModal === 'email' ? 'Send Email Reminder' : 'Send Text Message'} — {selectedIds.size} client{selectedIds.size === 1 ? '' : 's'}</h2>
              <button className="icon-button modal-close" type="button" onClick={() => setRenewalOutreachModal(null)}><X size={18} /></button>
            </div>
            {renewalOutreachModal === 'email' ? (
              <div className="modal-form">
                <div className="outreach-recipients">
                  <strong>To:</strong>
                  <div className="outreach-chips">
                    {[...selectedIds].map((id) => {
                      const item = renewalPolicies.find((r) => r.policy.id === id)
                      return item ? (
                        <span className="outreach-chip" key={id}>{item.client?.name ?? 'Unknown'}</span>
                      ) : null
                    })}
                  </div>
                </div>
                <label className="modal-field modal-field--full">
                  <span>Email Template</span>
                  <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                    <option value="">— Select a template —</option>
                    {emailTemplates.map((t) => (
                      <option value={t.id} key={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                {selectedTemplate && (() => {
                  const tpl = emailTemplates.find((t) => t.id === selectedTemplate)
                  return tpl ? (
                    <div className="template-preview-box">
                      <strong>Subject:</strong> {tpl.subject}
                      <pre className="template-preview-body">{tpl.body}</pre>
                      <p className="template-preview-note">Variables like [CLIENT_NAME], [POLICY_TYPE], [RENEWAL_DATE] will be personalized per recipient.</p>
                    </div>
                  ) : null
                })()}
                <label className="renewal-filter-check" style={{ margin: '8px 0' }}>
                  <input type="checkbox" defaultChecked />
                  Schedule auto follow-up if no renewal is entered within 14 days
                </label>
              </div>
            ) : (
              <div className="modal-form">
                <div className="outreach-recipients">
                  <strong>To:</strong>
                  <div className="outreach-chips">
                    {[...selectedIds].map((id) => {
                      const item = renewalPolicies.find((r) => r.policy.id === id)
                      return item ? (
                        <span className="outreach-chip" key={id}>{item.client?.name ?? 'Unknown'} {item.client?.phone ? `(${item.client.phone})` : '(no phone)'}</span>
                      ) : null
                    })}
                  </div>
                </div>
                <label className="modal-field modal-field--full">
                  <span>Message</span>
                  <textarea className="modal-textarea" rows={4} defaultValue={`Hi [CLIENT_NAME], your [POLICY_TYPE] policy renews on [RENEWAL_DATE]. Reply or call us to review your options. — [AGENCY_NAME]`} />
                </label>
                <label className="renewal-filter-check" style={{ margin: '8px 0' }}>
                  <input type="checkbox" defaultChecked />
                  Auto follow-up text in 7 days if no response
                </label>
              </div>
            )}
            <div className="modal-footer">
              <button className="secondary-action" type="button" onClick={() => setRenewalOutreachModal(null)}>Cancel</button>
              <button
                className="primary-action"
                type="button"
                onClick={() => {
                  showToast(`${renewalOutreachModal === 'email' ? 'Email' : 'Text'} queued for ${selectedIds.size} client${selectedIds.size === 1 ? '' : 's'}`)
                  setRenewalOutreachModal(null)
                }}
              >
                <Send size={15} /> Send {renewalOutreachModal === 'email' ? 'Emails' : 'Texts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function TemplateEditorModal({ template, onClose, onSave }: {
  template: EmailTemplate
  onClose: () => void
  onSave: (t: EmailTemplate) => void
}) {
  const [form, setForm] = useState(template)
  const set = (key: keyof EmailTemplate, val: string) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title={form.id.startsWith('tpl-') && !['tpl-1','tpl-2','tpl-3','tpl-4'].includes(form.id) ? 'New Template' : `Edit — ${template.name}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Template Name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="e.g. 30-Day Reminder" />
        </label>
        <label className="modal-field">
          <span>Type</span>
          <select value={form.type} onChange={(e) => set('type', e.target.value as EmailTemplate['type'])}>
            <option value="renewal">Renewal</option>
            <option value="followup">Follow-up</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Subject Line *</span>
          <input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Email subject" />
        </label>
        <label className="modal-field modal-field--full">
          <span>Body *</span>
          <textarea className="modal-textarea" rows={10} value={form.body} onChange={(e) => set('body', e.target.value)} />
        </label>
        <div className="template-variables-hint">
          Available variables: <code>[CLIENT_NAME]</code> <code>[POLICY_TYPE]</code> <code>[CARRIER]</code> <code>[RENEWAL_DATE]</code> <code>[AGENT_NAME]</code> <code>[AGENCY_NAME]</code> <code>[AGENT_PHONE]</code>
        </div>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.name.trim() || !form.subject.trim() || !form.body.trim()} onClick={() => onSave(form)}>Save Template</button>
      </div>
    </ModalShell>
  )
}

/* ─── Modal Components ──────────────────────────────────────────── */

type UserOption = { id: string; name: string }

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button modal-close" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}


function ComboInput({ label, value, onChange, options, onAddCustom, placeholder, required, autoFocus }: {
  label: string
  value: string
  onChange: (val: string) => void
  options: string[]
  onAddCustom?: (val: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value)
  const filtered = options.filter((o) => o.toLowerCase().includes(inputVal.toLowerCase()))
  const isCustom = inputVal.trim() && !options.includes(inputVal.trim())
  return (
    <div className="modal-field combo-field" style={{ position: 'relative' }}>
      <span>{label}{required ? ' *' : ''}</span>
      <input
        value={inputVal}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => { setInputVal(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        autoComplete="off"
      />
      {open && (filtered.length > 0 || isCustom) && (
        <div className="combo-dropdown">
          {filtered.slice(0, 12).map((opt) => (
            <button
              className="combo-option"
              type="button"
              key={opt}
              onMouseDown={() => { onChange(opt); setInputVal(opt); setOpen(false) }}
            >
              {opt}
            </button>
          ))}
          {isCustom && onAddCustom && (
            <button
              className="combo-option combo-option--add"
              type="button"
              onMouseDown={() => { onAddCustom(inputVal.trim()); onChange(inputVal.trim()); setOpen(false) }}
            >
              + Add &quot;{inputVal.trim()}&quot; to your list
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const POLICY_IQ_TIPS: Record<string, { title: string; body: string }[]> = {
  policyType: [
    { title: 'Why it matters', body: 'Policy type determines the coverage form, rating factors, and which carrier programs apply. Select the most specific type available.' },
    { title: 'Pro tip', body: 'If you offer both HO3 and HO5 homeowners, HO5 provides broader open-peril coverage — worth mentioning to the client.' },
  ],
  carrier: [
    { title: 'Carrier selection', body: 'Different carriers have different appetites. Match the risk profile to the right carrier to avoid future non-renewals.' },
    { title: 'Remember', body: 'Verify the carrier is currently appointed and writing in this state before binding.' },
  ],
  policyNumber: [
    { title: 'Policy number', body: "Enter the exact policy number from the carrier's declaration page or confirmation. This is used for IVANS sync and billing reconciliation." },
  ],
  premium: [
    { title: 'Annual premium', body: 'Enter the total annual premium, not the monthly installment. Your commission calculation is based on this figure.' },
    { title: 'Accuracy', body: 'Accurate premium entry keeps your agency revenue reports reliable and your E&O exposure low.' },
  ],
  commissionRate: [
    { title: 'Commission rate', body: 'Standard P&C commissions range 10–15%. Life & Health can be higher. Check your carrier appointment agreement.' },
    { title: 'New business vs renewal', body: 'New business commissions are often higher than renewal rates — confirm which applies here.' },
  ],
  lineOfBusiness: [
    { title: 'Line of business', body: 'This drives reporting, compliance tracking, and E&O coverage. Misclassifying commercial as personal can create coverage gaps.' },
  ],
  effectiveDate: [
    { title: 'Effective date', body: "This is when coverage begins. Make sure it matches the binder or carrier confirmation — even a one-day gap can void a claim." },
  ],
  expirationDate: [
    { title: 'Expiration date', body: 'The renewal pipeline pulls from this date. An accurate expiration triggers your 90/60/30-day renewal workflow automatically.' },
    { title: 'Required field', body: 'Expiration date is required so the system can alert you before the policy lapses.' },
  ],
  billingType: [
    { title: 'Direct Bill', body: 'Carrier invoices the client directly. Agency is not responsible for collecting premium.' },
    { title: 'Agency Bill', body: 'Agency collects from client and remits to carrier. Greater cash flow control but requires tight reconciliation.' },
    { title: 'Financed', body: "Client finances the premium through a premium finance company. Confirm the finance company's cancellation terms." },
  ],
  default: [
    { title: 'Adding a policy', body: 'Complete all required fields (Policy Type, Carrier, Expiration Date) to save. The more detail you enter, the more useful the renewal workflow becomes.' },
    { title: 'Need help?', body: 'Click "Ask IQ" anytime to get plain-language explanations of coverage terms or carrier guidelines.' },
  ],
}

function AddPolicyModal({ clientName, onClose, onSave, allPolicyTypes, allCarriers, onAddPolicyType, onAddCarrier }: {
  clientName: string
  onClose: () => void
  onSave: (data: { policyType: string; carrier: string; policyNumber: string; premium: string; commissionRate: string; effectiveDate: string; expirationDate: string; billingType: string; lineOfBusiness: string }) => void
  allPolicyTypes: string[]
  allCarriers: string[]
  onAddPolicyType: (t: string) => void
  onAddCarrier: (c: string) => void
}) {
  const [form, setForm] = useState({ policyType: '', carrier: '', policyNumber: '', premium: '', commissionRate: '', effectiveDate: '', expirationDate: '', billingType: 'Direct Bill', lineOfBusiness: 'Personal lines' })
  const [focusedField, setFocusedField] = useState('default')
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  const tips = POLICY_IQ_TIPS[focusedField] ?? POLICY_IQ_TIPS.default
  return (
    <ModalShell title={`Add Policy — ${clientName}`} onClose={onClose}>
      <div className="policy-modal-body-with-iq">
        <div className="policy-modal-fields">
          <div className="modal-form" onFocus={(e) => {
            const field = (e.target as HTMLElement).closest('[data-field]')?.getAttribute('data-field')
            if (field) setFocusedField(field)
          }}>
            <div data-field="policyType">
              <ComboInput
                label="Policy Type"
                required
                autoFocus
                value={form.policyType}
                onChange={(v) => set('policyType', v)}
                options={allPolicyTypes}
                onAddCustom={onAddPolicyType}
                placeholder="Search or type policy type..."
              />
            </div>
            <div data-field="carrier">
              <ComboInput
                label="Carrier"
                required
                value={form.carrier}
                onChange={(v) => set('carrier', v)}
                options={allCarriers}
                onAddCustom={onAddCarrier}
                placeholder="Search or type carrier name..."
              />
            </div>
            <label className="modal-field" data-field="policyNumber">
              <span>Policy Number</span>
              <input value={form.policyNumber} onChange={(e) => set('policyNumber', e.target.value)} placeholder="Policy # from carrier" />
            </label>
            <label className="modal-field" data-field="premium">
              <span>Annual Premium ($)</span>
              <input type="number" min="0" value={form.premium} onChange={(e) => set('premium', e.target.value)} placeholder="0.00" />
            </label>
            <label className="modal-field" data-field="commissionRate">
              <span>Commission Rate (%)</span>
              <input type="number" min="0" max="100" value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} placeholder="e.g. 12" />
            </label>
            <label className="modal-field" data-field="lineOfBusiness">
              <span>Line of Business</span>
              <select value={form.lineOfBusiness} onChange={(e) => set('lineOfBusiness', e.target.value)}>
                <option value="Personal lines">Personal Lines</option>
                <option value="Commercial">Commercial</option>
                <option value="Life & health">Life & Health</option>
              </select>
            </label>
            <label className="modal-field" data-field="effectiveDate">
              <span>Effective Date</span>
              <input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} />
            </label>
            <label className="modal-field" data-field="expirationDate">
              <span>Expiration Date *</span>
              <input type="date" value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} />
            </label>
            <label className="modal-field modal-field--full" data-field="billingType">
              <span>Billing Type</span>
              <select value={form.billingType} onChange={(e) => set('billingType', e.target.value)}>
                <option value="Direct Bill">Direct Bill</option>
                <option value="Agency Bill">Agency Bill</option>
                <option value="Financed">Financed</option>
              </select>
            </label>
          </div>
        </div>
        <aside className="policy-modal-iq">
          <div className="policy-iq-mascot-wrap">
            <img src={mascotImg} alt="" aria-hidden="true" className="policy-iq-mascot" />
          </div>
          <div className="policy-iq-tips">
            {tips.map((tip, i) => (
              <div key={`${focusedField}-${i}`} className="policy-iq-tip">
                <strong>{tip.title}</strong>
                <p>{tip.body}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.policyType.trim() || !form.carrier.trim() || !form.expirationDate}
          onClick={() => onSave(form)}
        >
          Add Policy
        </button>
      </div>
    </ModalShell>
  )
}

function AddTaskModal({ clientName, users, currentUserId, onClose, onSave }: {
  clientName: string
  users: UserOption[]
  currentUserId: string
  onClose: () => void
  onSave: (data: { title: string; description: string; dueDate: string; priority: string; assignedToUserId: string; isFollowUp: boolean; isPaymentReminder: boolean }) => void
}) {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'Normal', assignedToUserId: currentUserId, isFollowUp: false, isPaymentReminder: false })
  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title={`Add Task — ${clientName}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field modal-field--full">
          <span>Task Title *</span>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs to be done?" autoFocus />
        </label>
        <label className="modal-field modal-field--full">
          <span>Description / Notes</span>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Additional context (optional)" />
        </label>
        <label className="modal-field">
          <span>Due Date</span>
          <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Priority</span>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Assign To</span>
          <select value={form.assignedToUserId} onChange={(e) => set('assignedToUserId', e.target.value)}>
            {users.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
          </select>
        </label>
        <div className="modal-checkbox-row">
          <label className="modal-checkbox">
            <input type="checkbox" checked={form.isFollowUp} onChange={(e) => set('isFollowUp', e.target.checked)} />
            Mark as follow-up
          </label>
          <label className="modal-checkbox">
            <input type="checkbox" checked={form.isPaymentReminder} onChange={(e) => set('isPaymentReminder', e.target.checked)} />
            Payment reminder
          </label>
        </div>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.title.trim()}
          onClick={() => onSave(form)}
        >
          Save Task
        </button>
      </div>
    </ModalShell>
  )
}

function AddNoteModal({ clientName, onClose, onSave }: {
  clientName: string
  onClose: () => void
  onSave: (data: { body: string; type: string; pinned: boolean }) => void
}) {
  const [form, setForm] = useState({ body: '', type: 'General', pinned: false })
  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title={`Add Note — ${clientName}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Note Type</span>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="General">General</option>
            <option value="Renewal">Renewal</option>
            <option value="Payment">Payment</option>
            <option value="Claim">Claim</option>
            <option value="Underwriting">Underwriting</option>
            <option value="Follow-up">Follow-up</option>
          </select>
        </label>
        <label className="modal-field modal-checkbox">
          <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} />
          Pin this note to the top of the file
        </label>
        <label className="modal-field modal-field--full">
          <span>Note *</span>
          <textarea
            className="modal-textarea"
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="Enter your note about this client..."
            rows={5}
            autoFocus
          />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.body.trim()}
          onClick={() => onSave(form)}
        >
          Save Note
        </button>
      </div>
    </ModalShell>
  )
}

function AddLeadModal({ users, currentUserId, onClose, onSave }: {
  users: UserOption[]
  currentUserId: string
  onClose: () => void
  onSave: (data: { clientName: string; estimatedPremium: string; stage: string; ownerUserId: string }) => void
}) {
  const [form, setForm] = useState({ clientName: '', estimatedPremium: '', stage: 'New lead', ownerUserId: currentUserId })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title="New Lead" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field modal-field--full">
          <span>Prospect Name *</span>
          <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Name of the prospect or business" autoFocus />
        </label>
        <label className="modal-field">
          <span>Estimated Premium ($)</span>
          <input type="number" min="0" value={form.estimatedPremium} onChange={(e) => set('estimatedPremium', e.target.value)} placeholder="0.00" />
        </label>
        <label className="modal-field">
          <span>Stage</span>
          <select value={form.stage} onChange={(e) => set('stage', e.target.value)}>
            <option value="New lead">New Lead</option>
            <option value="Discovery">Discovery</option>
            <option value="Quoting">Quoting</option>
            <option value="Proposal">Proposal</option>
            <option value="Bound">Bound</option>
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Assigned To</span>
          <select value={form.ownerUserId} onChange={(e) => set('ownerUserId', e.target.value)}>
            {users.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.clientName.trim()}
          onClick={() => onSave(form)}
        >
          Add Lead
        </button>
      </div>
    </ModalShell>
  )
}

function EditBillingModal({ policy, onClose, onSave }: {
  policy: import('./data/crmTypes').Policy
  onClose: () => void
  onSave: (billing: PolicyBilling) => void
}) {
  const b = policy.billing ?? {}
  const [form, setForm] = useState<PolicyBilling>({
    paymentMethod: b.paymentMethod,
    paymentPlanType: b.paymentPlanType,
    billingResponsibility: b.billingResponsibility,
    installmentCount: b.installmentCount,
    installmentAmount: b.installmentAmount,
    downPaymentAmount: b.downPaymentAmount ?? policy.downPayment,
    downPaymentDate: b.downPaymentDate ?? '',
    nextPaymentDate: b.nextPaymentDate ?? '',
    nextPaymentAmount: b.nextPaymentAmount,
    lastPaymentDate: b.lastPaymentDate ?? '',
    lastPaymentAmount: b.lastPaymentAmount,
    paymentStatus: b.paymentStatus ?? policy.paymentStatus,
    financeCompany: b.financeCompany ?? policy.financeCompany ?? '',
    financeContractNumber: b.financeContractNumber ?? '',
    financeAmount: b.financeAmount,
    financeMonthlyPayment: b.financeMonthlyPayment ?? policy.monthlyPayment,
    financePayoffDate: b.financePayoffDate ?? '',
    mortgageeOrLienholder: b.mortgageeOrLienholder ?? policy.mortgageeOrLienholder ?? '',
    mortgageeClause: b.mortgageeClause ?? '',
    escrowAccount: b.escrowAccount ?? '',
    creditCardLast4: b.creditCardLast4 ?? '',
    creditCardExpiry: b.creditCardExpiry ?? '',
    achBankName: b.achBankName ?? '',
    achAccountLast4: b.achAccountLast4 ?? '',
    agencyBillInvoiceNumber: b.agencyBillInvoiceNumber ?? '',
    agencyBillDueDate: b.agencyBillDueDate ?? '',
    billingNotes: b.billingNotes ?? '',
  })
  const set = <K extends keyof PolicyBilling>(key: K, val: PolicyBilling[K]) =>
    setForm((f) => ({ ...f, [key]: val }))
  const method = form.paymentMethod
  const plan = form.paymentPlanType
  const isFinanced = method === 'Premium Finance' || plan === 'Financed'
  const isEscrow = method === 'Escrow / Mortgagee' || plan === 'Escrow / Mortgage'
  const isCC = method === 'Credit Card'
  const isACH = method === 'ACH / Bank Draft'
  const isAgencyBill = form.billingResponsibility === 'Agency collects & remits'

  return (
    <ModalShell title={`Billing — ${policy.policyType} (${policy.carrier})`} onClose={onClose}>
      <div className="modal-form billing-modal-form">
        <div className="billing-modal-section-label">Payment Setup</div>
        <label className="modal-field">
          <span>Payment Method</span>
          <select value={form.paymentMethod ?? ''} onChange={(e) => set('paymentMethod', e.target.value as import('./data/crmTypes').PaymentMethod || undefined)}>
            <option value="">Not set</option>
            <option value="Credit Card">Credit Card</option>
            <option value="ACH / Bank Draft">ACH / Bank Draft</option>
            <option value="Check">Check</option>
            <option value="Cash">Cash</option>
            <option value="Money Order">Money Order</option>
            <option value="Escrow / Mortgagee">Escrow / Mortgagee</option>
            <option value="Premium Finance">Premium Finance</option>
            <option value="Online Portal">Online Portal</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Payment Plan</span>
          <select value={form.paymentPlanType ?? ''} onChange={(e) => set('paymentPlanType', e.target.value as import('./data/crmTypes').PaymentPlanType || undefined)}>
            <option value="">Not set</option>
            <option value="Annual (paid in full)">Annual (paid in full)</option>
            <option value="Semi-Annual (2 pay)">Semi-Annual (2 pay)</option>
            <option value="Quarterly (4 pay)">Quarterly (4 pay)</option>
            <option value="10-Pay">10-Pay</option>
            <option value="Monthly (EFT)">Monthly (EFT)</option>
            <option value="Monthly (CC)">Monthly (CC)</option>
            <option value="Financed">Financed</option>
            <option value="Escrow / Mortgage">Escrow / Mortgage</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Billing Responsibility</span>
          <select value={form.billingResponsibility ?? ''} onChange={(e) => set('billingResponsibility', e.target.value as import('./data/crmTypes').BillingResponsibility || undefined)}>
            <option value="">Not set</option>
            <option value="Insured pays carrier direct">Insured pays carrier direct</option>
            <option value="Agency collects &amp; remits">Agency collects &amp; remits</option>
            <option value="Mortgagee / Escrow pays">Mortgagee / Escrow pays</option>
            <option value="Finance company pays carrier">Finance company pays carrier</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Payment Status</span>
          <select value={form.paymentStatus ?? ''} onChange={(e) => set('paymentStatus', e.target.value as PolicyBilling['paymentStatus'] || undefined)}>
            <option value="">Not set</option>
            <option value="Current">Current</option>
            <option value="Due soon">Due soon</option>
            <option value="Past due">Past due</option>
            <option value="Paid in full">Paid in full</option>
            <option value="NSF / Returned">NSF / Returned</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Number of Installments</span>
          <input type="number" min="1" max="12" value={form.installmentCount ?? ''} onChange={(e) => set('installmentCount', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 10" />
        </label>
        <label className="modal-field">
          <span>Installment Amount ($)</span>
          <input type="number" min="0" value={form.installmentAmount ?? ''} onChange={(e) => set('installmentAmount', e.target.value ? Number(e.target.value) : undefined)} placeholder="0.00" />
        </label>

        <div className="billing-modal-section-label">Down Payment</div>
        <label className="modal-field">
          <span>Down Payment Amount ($)</span>
          <input type="number" min="0" value={form.downPaymentAmount ?? ''} onChange={(e) => set('downPaymentAmount', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="modal-field">
          <span>Down Payment Date</span>
          <input type="date" value={form.downPaymentDate ?? ''} onChange={(e) => set('downPaymentDate', e.target.value)} />
        </label>

        <div className="billing-modal-section-label">Next &amp; Last Payment</div>
        <label className="modal-field">
          <span>Next Payment Date</span>
          <input type="date" value={form.nextPaymentDate ?? ''} onChange={(e) => set('nextPaymentDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Next Payment Amount ($)</span>
          <input type="number" min="0" value={form.nextPaymentAmount ?? ''} onChange={(e) => set('nextPaymentAmount', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="modal-field">
          <span>Last Payment Date</span>
          <input type="date" value={form.lastPaymentDate ?? ''} onChange={(e) => set('lastPaymentDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Last Payment Amount ($)</span>
          <input type="number" min="0" value={form.lastPaymentAmount ?? ''} onChange={(e) => set('lastPaymentAmount', e.target.value ? Number(e.target.value) : undefined)} />
        </label>

        {isFinanced && (<>
          <div className="billing-modal-section-label">Premium Finance Details</div>
          <label className="modal-field">
            <span>Finance Company</span>
            <input value={form.financeCompany ?? ''} onChange={(e) => set('financeCompany', e.target.value)} placeholder="e.g. IPFS, First Insurance Funding" />
          </label>
          <label className="modal-field">
            <span>Finance Contract #</span>
            <input value={form.financeContractNumber ?? ''} onChange={(e) => set('financeContractNumber', e.target.value)} />
          </label>
          <label className="modal-field">
            <span>Amount Financed ($)</span>
            <input type="number" min="0" value={form.financeAmount ?? ''} onChange={(e) => set('financeAmount', e.target.value ? Number(e.target.value) : undefined)} />
          </label>
          <label className="modal-field">
            <span>Monthly Payment ($)</span>
            <input type="number" min="0" value={form.financeMonthlyPayment ?? ''} onChange={(e) => set('financeMonthlyPayment', e.target.value ? Number(e.target.value) : undefined)} />
          </label>
          <label className="modal-field">
            <span>Finance Payoff Date</span>
            <input type="date" value={form.financePayoffDate ?? ''} onChange={(e) => set('financePayoffDate', e.target.value)} />
          </label>
        </>)}

        {isEscrow && (<>
          <div className="billing-modal-section-label">Mortgagee / Escrow</div>
          <label className="modal-field modal-field--full">
            <span>Mortgagee / Lienholder</span>
            <input value={form.mortgageeOrLienholder ?? ''} onChange={(e) => set('mortgageeOrLienholder', e.target.value)} placeholder="Bank or mortgage company name" />
          </label>
          <label className="modal-field modal-field--full">
            <span>Mortgagee Clause</span>
            <input value={form.mortgageeClause ?? ''} onChange={(e) => set('mortgageeClause', e.target.value)} placeholder="e.g. Its Successors and/or Assigns" />
          </label>
          <label className="modal-field">
            <span>Escrow Account #</span>
            <input value={form.escrowAccount ?? ''} onChange={(e) => set('escrowAccount', e.target.value)} />
          </label>
        </>)}

        {isCC && (<>
          <div className="billing-modal-section-label">Credit Card on File</div>
          <label className="modal-field">
            <span>Last 4 Digits</span>
            <input maxLength={4} value={form.creditCardLast4 ?? ''} onChange={(e) => set('creditCardLast4', e.target.value)} placeholder="1234" />
          </label>
          <label className="modal-field">
            <span>Expiry (MM/YY)</span>
            <input value={form.creditCardExpiry ?? ''} onChange={(e) => set('creditCardExpiry', e.target.value)} placeholder="09/27" />
          </label>
        </>)}

        {isACH && (<>
          <div className="billing-modal-section-label">ACH / Bank Draft</div>
          <label className="modal-field">
            <span>Bank Name</span>
            <input value={form.achBankName ?? ''} onChange={(e) => set('achBankName', e.target.value)} placeholder="e.g. Chase, Wells Fargo" />
          </label>
          <label className="modal-field">
            <span>Account Last 4</span>
            <input maxLength={4} value={form.achAccountLast4 ?? ''} onChange={(e) => set('achAccountLast4', e.target.value)} placeholder="5678" />
          </label>
        </>)}

        {isAgencyBill && (<>
          <div className="billing-modal-section-label">Agency Bill</div>
          <label className="modal-field">
            <span>Invoice Number</span>
            <input value={form.agencyBillInvoiceNumber ?? ''} onChange={(e) => set('agencyBillInvoiceNumber', e.target.value)} />
          </label>
          <label className="modal-field">
            <span>Invoice Due Date</span>
            <input type="date" value={form.agencyBillDueDate ?? ''} onChange={(e) => set('agencyBillDueDate', e.target.value)} />
          </label>
        </>)}

        <div className="billing-modal-section-label">Notes</div>
        <label className="modal-field modal-field--full">
          <span>Billing Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.billingNotes ?? ''} onChange={(e) => set('billingNotes', e.target.value)} placeholder="Payment arrangements, special instructions, notes on remittance..." />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => onSave(form)}>Save Billing</button>
      </div>
    </ModalShell>
  )
}

function EditClientModal({ client, users, onClose, onSave }: {
  client: import('./data/crmTypes').Client
  users: UserOption[]
  onClose: () => void
  onSave: (data: {
    name: string; dbaName: string; primaryContact: string; phone: string; alternatePhone: string;
    email: string; mailingAddress: string; physicalAddress: string; website: string;
    lineOfBusiness: string; accountStatus: string; preferredContactMethod: string;
    billingMethod: string; paymentPlan: string; notes: string;
    assignedProducerId: string; assignedCsrId: string;
  }) => void
}) {
  const [form, setForm] = useState({
    name: client.name,
    dbaName: client.dbaName ?? '',
    primaryContact: client.primaryContact,
    phone: client.phone ?? '',
    alternatePhone: client.alternatePhone ?? '',
    email: client.email ?? '',
    mailingAddress: client.mailingAddress ?? '',
    physicalAddress: client.physicalAddress ?? '',
    website: client.website ?? '',
    lineOfBusiness: client.lineOfBusiness,
    accountStatus: client.accountStatus ?? 'Active',
    preferredContactMethod: client.preferredContactMethod ?? '',
    billingMethod: client.billingMethod ?? '',
    paymentPlan: client.paymentPlan ?? '',
    notes: client.notes ?? '',
    assignedProducerId: client.assignedProducerId ?? '',
    assignedCsrId: client.assignedCsrId ?? '',
  })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title={`Edit Client — ${client.name}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field modal-field--full">
          <span>Client / Business Name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </label>
        <label className="modal-field">
          <span>DBA / Trade Name</span>
          <input value={form.dbaName} onChange={(e) => set('dbaName', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Primary Contact</span>
          <input value={form.primaryContact} onChange={(e) => set('primaryContact', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Phone</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Alternate Phone</span>
          <input value={form.alternatePhone} onChange={(e) => set('alternatePhone', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="modal-field modal-field--full">
          <span>Mailing Address</span>
          <input value={form.mailingAddress} onChange={(e) => set('mailingAddress', e.target.value)} />
        </label>
        <label className="modal-field modal-field--full">
          <span>Physical / Location Address</span>
          <input value={form.physicalAddress} onChange={(e) => set('physicalAddress', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Website</span>
          <input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
        </label>
        <label className="modal-field">
          <span>Line of Business</span>
          <select value={form.lineOfBusiness} onChange={(e) => set('lineOfBusiness', e.target.value)}>
            <option value="Personal lines">Personal Lines</option>
            <option value="Commercial">Commercial</option>
            <option value="Life & health">Life &amp; Health</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Account Status</span>
          <select value={form.accountStatus} onChange={(e) => set('accountStatus', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Prospect">Prospect</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Preferred Contact</span>
          <select value={form.preferredContactMethod} onChange={(e) => set('preferredContactMethod', e.target.value)}>
            <option value="">Not set</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
            <option value="Text">Text</option>
            <option value="Portal">Portal</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Billing Method</span>
          <select value={form.billingMethod} onChange={(e) => set('billingMethod', e.target.value)}>
            <option value="">Not set</option>
            <option value="Direct Bill">Direct Bill</option>
            <option value="Agency Bill">Agency Bill</option>
            <option value="Mortgagee/Escrow">Mortgagee/Escrow</option>
            <option value="Premium Finance">Premium Finance</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Payment Plan</span>
          <input value={form.paymentPlan} onChange={(e) => set('paymentPlan', e.target.value)} placeholder="e.g. Monthly, Annual" />
        </label>
        <label className="modal-field">
          <span>Producer</span>
          <select value={form.assignedProducerId} onChange={(e) => set('assignedProducerId', e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>CSR</span>
          <select value={form.assignedCsrId} onChange={(e) => set('assignedCsrId', e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Client Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.name.trim()} onClick={() => onSave(form)}>Save Changes</button>
      </div>
    </ModalShell>
  )
}

function EditPolicyModal({ policy, allPolicyTypes, allCarriers, onAddPolicyType, onAddCarrier, onClose, onSave }: {
  policy: import('./data/crmTypes').Policy
  allPolicyTypes: string[]
  allCarriers: string[]
  onAddPolicyType: (t: string) => void
  onAddCarrier: (c: string) => void
  onClose: () => void
  onSave: (data: {
    policyType: string; carrier: string; policyNumber: string; premium: string;
    commissionRate: string; effectiveDate: string; expirationDate: string;
    billingType: string; status: string; limits: string; notes: string;
  }) => void
}) {
  const [form, setForm] = useState({
    policyType: policy.policyType,
    carrier: policy.carrier,
    policyNumber: policy.policyNumber ?? '',
    premium: String(policy.premium),
    commissionRate: String(policy.commissionRate ?? ''),
    effectiveDate: policy.effectiveDate ?? '',
    expirationDate: policy.expirationDate,
    billingType: policy.billingType ?? '',
    status: policy.status,
    limits: policy.limits ?? '',
    notes: policy.notes ?? '',
  })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title={`Edit Policy — ${policy.policyType}`} onClose={onClose}>
      <div className="modal-form">
        <ComboInput
          label="Policy Type"
          required
          value={form.policyType}
          options={allPolicyTypes}
          onChange={(v) => set('policyType', v)}
          onAddCustom={onAddPolicyType}
          placeholder="Search or type policy type..."
        />
        <ComboInput
          label="Carrier"
          required
          value={form.carrier}
          options={allCarriers}
          onChange={(v) => set('carrier', v)}
          onAddCustom={onAddCarrier}
          placeholder="Search or type carrier name..."
        />
        <label className="modal-field">
          <span>Policy Number</span>
          <input value={form.policyNumber} onChange={(e) => set('policyNumber', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Renewal review">Renewal Review</option>
            <option value="Quoted">Quoted</option>
            <option value="Bound">Bound</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Expired">Expired</option>
            <option value="Non-Renewed">Non-Renewed</option>
            <option value="Renewed/Replaced">Renewed/Replaced</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Annual Premium ($)</span>
          <input type="number" min="0" value={form.premium} onChange={(e) => set('premium', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Commission Rate (%)</span>
          <input type="number" min="0" max="100" value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Effective Date</span>
          <input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Expiration Date *</span>
          <input type="date" value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Billing Type</span>
          <select value={form.billingType} onChange={(e) => set('billingType', e.target.value)}>
            <option value="">Not set</option>
            <option value="Direct Bill">Direct Bill</option>
            <option value="Agency Bill">Agency Bill</option>
            <option value="Financed">Financed</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Coverage Limits</span>
          <input value={form.limits} onChange={(e) => set('limits', e.target.value)} placeholder="e.g. $1M/$2M GL" />
        </label>
        <label className="modal-field modal-field--full">
          <span>Policy Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.policyType.trim() || !form.carrier.trim() || !form.expirationDate} onClick={() => onSave(form)}>Save Changes</button>
      </div>
    </ModalShell>
  )
}

function CarrierPortalModal({ portals, onClose, onSave, onDelete }: {
  portals: CarrierPortalEntry[]
  onClose: () => void
  onSave: (entry: CarrierPortalEntry) => void
  onDelete: (id: string) => void
}) {
  const blank = (): CarrierPortalEntry => ({ id: `portal-${Date.now()}`, name: '', url: '', username: '', notes: '' })
  const [editing, setEditing] = useState<CarrierPortalEntry | null>(null)
  const setField = (key: keyof CarrierPortalEntry, val: string) =>
    setEditing((prev) => prev ? { ...prev, [key]: val } : prev)
  return (
    <ModalShell title="Carrier Portals" onClose={onClose}>
      {!editing ? (
        <>
          <div className="carrier-portal-list">
            {portals.length === 0 && (
              <div className="empty-state" style={{ margin: '16px 20px' }}>No carrier portals saved yet. Add your carriers below.</div>
            )}
            {portals.map((p) => (
              <div className="carrier-portal-row" key={p.id}>
                <div className="carrier-portal-info">
                  <strong>{p.name}</strong>
                  {p.username && <span>User: {p.username}</span>}
                  {p.notes && <em>{p.notes}</em>}
                </div>
                <div className="carrier-portal-actions">
                  {p.url && (
                    <a href={p.url.startsWith('http') ? p.url : `https://${p.url}`} target="_blank" rel="noopener noreferrer" className="secondary-action carrier-portal-link">
                      Open portal
                    </a>
                  )}
                  <button className="utility-action" type="button" onClick={() => setEditing({ ...p })}>Edit</button>
                  <button className="utility-action" type="button" onClick={() => onDelete(p.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="secondary-action" type="button" onClick={onClose}>Close</button>
            <button className="primary-action" type="button" onClick={() => setEditing(blank())}>+ Add Carrier Portal</button>
          </div>
        </>
      ) : (
        <>
          <div className="modal-form">
            <label className="modal-field modal-field--full">
              <span>Carrier Name *</span>
              <input value={editing.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Travelers" autoFocus />
            </label>
            <label className="modal-field modal-field--full">
              <span>Portal URL</span>
              <input value={editing.url} onChange={(e) => setField('url', e.target.value)} placeholder="https://agent.travelers.com" />
            </label>
            <label className="modal-field modal-field--full">
              <span>Username / Agent Code</span>
              <input value={editing.username} onChange={(e) => setField('username', e.target.value)} placeholder="Your login username" />
            </label>
            <label className="modal-field modal-field--full">
              <span>Notes</span>
              <input value={editing.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Quick notes (e.g. appointment #, contact)" />
            </label>
          </div>
          <div className="modal-footer">
            <button className="secondary-action" type="button" onClick={() => setEditing(null)}>Back</button>
            <button className="primary-action" type="button" disabled={!editing.name.trim()} onClick={() => onSave(editing)}>Save Portal</button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

// ─── IQ Buddy — floating animated mascot ─────────────────────────────────────
const IQ_CONTEXT_TIPS: Record<string, string[]> = {
  'dashboard': [
    "Your dashboard shows the pulse of your agency. Any KPIs looking off?",
    "Check your renewal pipeline daily — early outreach wins retention.",
    "Need help explaining a metric or coverage term to a client? Ask me!",
  ],
  'clients': [
    "Looking for a client? Try searching by phone number or policy number too.",
    "Client health scores help you prioritize who needs attention first.",
    "Sort by Last Contacted to find clients who may be feeling forgotten.",
  ],
  'profile-Overview': [
    "The Overview tab is your quick snapshot — key contacts, policies, and status all in one place.",
    "Check the client's health score here. 'At risk' means it's time to reach out.",
    "You can add a note or task from the Overview without leaving this screen.",
  ],
  'profile-Policies': [
    "Review expiration dates here — proactive renewal calls boost retention significantly.",
    "Cross-selling tip: if a client only has auto, consider offering a home bundle.",
    "A lapse in coverage can create liability for the agency. Keep dates current!",
    "Expired policies should be flagged for re-write or non-renewal notation.",
  ],
  'profile-Billing': [
    "Billing issues are a top reason clients leave. Catching them early saves the relationship.",
    "Direct Bill means the carrier bills the client — Agency Bill means the agency does.",
    "Mortgagee billing goes to the lender — confirm the mortgage company info is accurate.",
    "If a client's on payment plan, confirm they haven't missed installments.",
  ],
  'profile-Tasks': [
    "Tasks keep you organized and clients feeling well-served.",
    "Use Follow-Up tasks after every client call — it creates an audit trail too.",
    "Payment reminders reduce late payments and policy lapses.",
  ],
  'profile-Notes & History': [
    "Document every significant client conversation — it protects you and helps the team.",
    "Notes create a story of the relationship that any agent can pick up.",
    "Pin important notes so they surface instantly when you open the folder.",
  ],
  'profile-Communications': [
    "Email templates save time and keep your messaging consistent.",
    "Personalized outreach dramatically improves renewal retention rates.",
  ],
  'profile-Activity': [
    "Activity logs show every change made to this client — great for auditing.",
    "If something looks off in the activity feed, it may indicate a data issue to review.",
  ],
  'profile-Contact & Account': [
    "Keep contact info current — wrong numbers mean missed renewal calls.",
    "Preferred contact method matters — some clients prefer text over calls.",
    "Make sure the billing method here matches what's set on their policies.",
  ],
  'leads': [
    "Move leads through stages quickly — the faster you quote, the higher the close rate.",
    "Follow up within 24 hours of a new lead coming in. Speed wins.",
    "A stalled lead at 'Quoted' stage usually needs a personal touch to close.",
  ],
  'renewals': [
    "Renewals within 30 days need immediate outreach — the window is short.",
    "Escrow policies auto-renew through the lender — still worth a courtesy call.",
    "Premium increases at renewal are the #1 reason clients shop around. Be ready.",
    "Reviewing a renewal? I can help you explain coverage changes or price differences.",
  ],
  'ivans': [
    "Syncing from IVANS keeps your book of business accurate and up to date.",
    "After a sync, review the Renewal flag — those need immediate agent action.",
    "Match IVANS records to existing client folders to keep your CRM clean.",
  ],
}

const IQ_DEFAULT_TIPS = [
  "Great agents anticipate — need help with anything?",
  "Ask me anything about coverage, compliance, or client communication.",
  "Your renewal pipeline is the heartbeat of the agency.",
  "A quick check-in call keeps clients loyal.",
]

function getContextTips(activeView: AppView, clientTab: ClientTab): string[] {
  const profileKey = `profile-${clientTab}`
  if (activeView === 'profile' && IQ_CONTEXT_TIPS[profileKey]) return IQ_CONTEXT_TIPS[profileKey]
  return IQ_CONTEXT_TIPS[activeView] ?? IQ_DEFAULT_TIPS
}

function IqBuddy({ onOpen, activeView, clientTab }: {
  onOpen: () => void
  activeView: AppView
  clientTab: ClientTab
}) {
  const [tipIndex, setTipIndex] = useState(0)
  const [showBubble, setShowBubble] = useState(false)
  const [anim, setAnim] = useState<'idle' | 'wave' | 'bounce'>('idle')
  const [dismissed, setDismissed] = useState(false)
  const contextTips = getContextTips(activeView, clientTab)
  const currentTip = contextTips[tipIndex % contextTips.length]

  // Reset tip index when context changes, wave to signal new tip
  useEffect(() => {
    setTipIndex(0)
    if (showBubble) {
      setAnim('bounce')
      setTimeout(() => setAnim('idle'), 600)
    }
  }, [activeView, clientTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const intro = setTimeout(() => {
      setShowBubble(true)
      setAnim('wave')
      setTimeout(() => setAnim('idle'), 800)
    }, 3000)
    return () => clearTimeout(intro)
  }, [])

  useEffect(() => {
    if (!showBubble) return
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % contextTips.length)
      setAnim('bounce')
      setTimeout(() => setAnim('idle'), 600)
    }, 12000)
    return () => clearInterval(interval)
  }, [showBubble, contextTips.length])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay = 22000 + Math.random() * 18000
      timeout = setTimeout(() => {
        setAnim('wave')
        setTimeout(() => setAnim('idle'), 800)
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(timeout)
  }, [])

  if (dismissed) return null

  return (
    <div className={`iq-buddy iq-buddy--${anim}`}>
      {showBubble && (
        <div className="iq-buddy-bubble">
          <button
            className="iq-buddy-dismiss"
            type="button"
            aria-label="Dismiss tip"
            onClick={(e) => { e.stopPropagation(); setShowBubble(false) }}
          >
            ×
          </button>
          <p key={`${activeView}-${clientTab}-${tipIndex}`} className="iq-buddy-tip">{currentTip}</p>
          <button className="iq-buddy-ask-btn" type="button" onClick={onOpen}>
            Ask IQ
          </button>
        </div>
      )}
      <button
        className="iq-buddy-avatar"
        type="button"
        aria-label="Open IQ AI assistant"
        onClick={() => {
          if (!showBubble) {
            setShowBubble(true)
            setAnim('wave')
            setTimeout(() => setAnim('idle'), 800)
          } else {
            onOpen()
          }
        }}
        onMouseEnter={() => { if (anim === 'idle') { setAnim('bounce'); setTimeout(() => setAnim('idle'), 600) } }}
      >
        <div className="iq-buddy-glow" />
        <img src={mascotImg} alt="IQ assistant" className="iq-buddy-img" />
      </button>
      <button
        className="iq-buddy-hide"
        type="button"
        aria-label="Hide IQ buddy"
        onClick={() => setDismissed(true)}
        title="Hide for this session"
      >
        ×
      </button>
    </div>
  )
}

export default App



