import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Handshake,
  MessageSquare,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  Palette,
  Search,
  SlidersHorizontal,
  Settings,
  Sun,
  UsersRound,
  X,
} from 'lucide-react'
import agencyIqLogo from './assets/agencyiq-logo.png'
import { canViewOwnerAnalytics } from './auth/permissions'
import type { CrmDataset, Policy, UserRole } from './data/crmTypes'
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

type AppView = 'dashboard' | 'clients' | 'profile' | 'leads'
type DashboardWidgetId =
  | 'communications'
  | 'recentActivity'
  | 'followUps'
  | 'renewals'
  | 'keyAccounts'
  | 'ownerReports'
type ClientFilter = 'All' | 'Personal Lines' | 'Commercial Lines' | 'Active' | 'Prospect' | 'Inactive' | 'Renewal Due'
type ClientTab =
  | 'Overview'
  | 'Contact & Account'
  | 'Policies'
  | 'Tasks'
  | 'Notes & History'
  | 'Communications'
  | 'Activity'
type PolicyFilter = 'All' | 'Active' | 'Renewal Review' | 'Expired' | 'Cancelled' | 'Rewritten' | 'Prior History'

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
  { label: 'Leads', icon: Handshake },
  { label: 'Reports', icon: Gauge },
  { label: 'Administration', icon: Settings },
]

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

  useEffect(() => {
    localStorage.setItem('agencyiq-palette', palette)
  }, [palette])

  useEffect(() => {
    localStorage.setItem('agencyiq-mode', mode)
  }, [mode])

  useEffect(() => {
    saveDataset(dataset)
  }, [dataset])

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
  const accounts = dataset.clients.slice(0, 3)
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

  return (
    <div className="app-shell" data-mode={mode} data-palette={palette}>
      <aside className="sidebar">
        <div className="logo-wrap sidebar-logo">
          <button
            className="logo-button"
            type="button"
            aria-label="Open AgencyIQ AI help"
            onClick={() => setAiHelpOpen(true)}
          >
            <img src={agencyIqLogo} alt="AgencyIQ Insurance CRM" />
          </button>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={[
                  'nav-item',
                  (item.label === 'Dashboard' && activeView === 'dashboard') ||
                  (item.label === 'Clients' && ['clients', 'profile'].includes(activeView)) ||
                  (item.label === 'Leads' && activeView === 'leads')
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
            <button
              className="logo-button"
              type="button"
              aria-label="Open AgencyIQ AI help"
              onClick={() => setAiHelpOpen(true)}
            >
              <img src={agencyIqLogo} alt="AgencyIQ Insurance CRM" />
            </button>
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
          <button className="icon-button" type="button" aria-label="Filter view">
            <SlidersHorizontal size={19} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" aria-label="Notifications">
            <Bell size={19} aria-hidden="true" />
          </button>
          <div className="profile-chip">{dataset.currentUser.initials}</div>
        </header>

        {activeView === 'leads' ? (
          <section className="clients-page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Lead hub</p>
                <h1>New Leads & Prospects</h1>
                <p className="account-context">
                  Website quote requests, producer referrals, walk-ins, and prospects before they become client folders.
                </p>
              </div>
              <button className="primary-action" type="button">
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
        ) : activeView === 'clients' ? (
          <section className="clients-page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Client folders</p>
                <h1>Clients</h1>
                <p className="account-context">
                  QuickFile-style account access with modern search, filters, and insurance details.
                </p>
              </div>
              <button className="primary-action" type="button">
                Add New Client
              </button>
            </div>

            <section className="panel client-list-panel">
              <div className="client-list-toolbar">
                <div className="search-box client-table-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    aria-label="Search clients"
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Search clients, policies, leads, phone numbers, emails, policy numbers"
                  />
                </div>
                <div className="filter-tabs" role="group" aria-label="Client filters">
                  {clientFilters.map((filter) => (
                    <button
                      className={clientFilter === filter ? 'filter-tab active' : 'filter-tab'}
                      type="button"
                      key={filter}
                      onClick={() => setClientFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap client-table-wrap">
                <table className="client-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Type</th>
                      <th>Main Contact</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Policy Count</th>
                      <th>Total Premium</th>
                      <th>Next Renewal Date</th>
                      <th>CSR / Producer</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => {
                      const policies = dataset.policies.filter((policy) => policy.clientId === client.id)
                      const nextRenewal = policies
                        .map((policy) => policy.expirationDate)
                        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]
                      const totalPremium = policies.reduce((total, policy) => total + policy.premium, 0)
                      return (
                        <tr
                          className="clickable-row"
                          key={client.id}
                          onClick={() => {
                            setSelectedClientId(client.id)
                            setClientTab('Overview')
                            setPolicyFilter('All')
                            setActiveView('profile')
                          }}
                        >
                          <td>
                            <strong>{client.name}</strong>
                            {client.dbaName && <span>{client.dbaName}</span>}
                          </td>
                          <td>{getClientTypeLabel(client.lineOfBusiness)}</td>
                          <td>{client.primaryContact}</td>
                          <td>{client.phone}</td>
                          <td>{client.email}</td>
                          <td>{policies.length}</td>
                          <td>{currency.format(totalPremium)}</td>
                          <td>{nextRenewal ? formatDate(nextRenewal) : 'None'}</td>
                          <td>
                            {getUserName(dataset, client.assignedCsrId ?? '')} /{' '}
                            {getUserName(dataset, client.assignedProducerId ?? '')}
                          </td>
                          <td>
                            <span className="status-pill">{client.accountStatus ?? client.status}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : activeView === 'profile' && selectedClient ? (
          <section className="client-page">
            <div className="page-heading client-file-heading">
              <div>
                <button
                  className="text-button back-button"
                  type="button"
                  onClick={() => setActiveView('clients')}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Clients
                </button>
                <p className="eyebrow">Client folder</p>
                <h1>{selectedClient.name}</h1>
                <p className="account-context">
                  {selectedClient.phone} - {selectedClient.email} - {selectedClient.mailingAddress}
                </p>
              </div>
              <div className="client-header-badges">
                <span className="status-pill">{getClientTypeLabel(selectedClient.lineOfBusiness)}</span>
                <span className="status-pill">{selectedClient.accountStatus ?? selectedClient.status}</span>
              </div>
            </div>

            <section className="quick-actions client-quick-actions" aria-label="Client quick actions">
              <div className="action-group primary-action-group">
                <button className="primary-action" type="button">Add New Policy</button>
              </div>
              <div className="action-group secondary-action-group">
                <button className="secondary-action" type="button">Add Task</button>
                <button className="secondary-action" type="button">Create Follow-Up</button>
                <button className="secondary-action" type="button">Add Note</button>
              </div>
              <div className="action-group utility-action-group">
                <button className="utility-action" type="button">Send Email</button>
                <button className="utility-action" type="button">Send Text</button>
                <button className="utility-action" type="button">Add Payment Reminder</button>
              </div>
            </section>

            <section className="client-summary-strip">
              <div><span>Assigned Producer</span><strong>{getUserName(dataset, selectedClient.assignedProducerId ?? '')}</strong></div>
              <div><span>CSR / Service Rep</span><strong>{getUserName(dataset, selectedClient.assignedCsrId ?? '')}</strong></div>
              <div><span>Active Policies</span><strong>{activeClientPolicies.length}</strong></div>
              <div><span>Total Premium</span><strong>{currency.format(selectedClientPremium)}</strong></div>
              <div><span>Total Commission</span><strong>{currency.format(selectedClientCommission)}</strong></div>
              <div><span>Next Renewal</span><strong>{selectedClientNextRenewal ? formatDate(selectedClientNextRenewal) : 'None'}</strong></div>
              <div><span>Last Contacted</span><strong>{selectedClientLastContacted}</strong></div>
            </section>

            <div className="client-tabs" role="tablist" aria-label="Client profile tabs">
              {clientTabs.map((tab) => (
                <button
                  className={clientTab === tab ? 'client-tab active' : 'client-tab'}
                  type="button"
                  key={tab}
                  onClick={() => setClientTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <section className="panel client-tab-panel">
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
                  <button className="primary-action inline-action" type="button">Add Note</button>
                  {clientNotes.map((note) => (
                    <div className={note.pinned ? 'note-row pinned-note' : 'note-row'} key={note.id}>
                      <strong>{note.type ?? 'General'} note {note.pinned ? '- Pinned' : ''}</strong>
                      <span>{formatDateTime(note.createdAt)} - Added by {getUserName(dataset, note.createdByUserId)}</span>
                      <p>{note.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {clientTab === 'Tasks' && (
                <div className="mini-list">
                  <div className="quick-actions">
                    <button className="primary-action inline-action" type="button">Add Task</button>
                    <button className="secondary-action inline-action" type="button">Create Follow-Up</button>
                    <button className="secondary-action inline-action" type="button">Add Payment Reminder</button>
                  </div>
                  {clientTasks.map((task) => (
                    <div className="mini-row" key={task.id}>
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.description} - Due {task.dueDate ? formatDate(task.dueDate) : task.dueLabel}</span>
                      </div>
                      <div>
                        <small className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</small>
                        <small>{task.status ?? (task.completed ? 'Completed' : 'Open')}</small>
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
            <p>Quick-view widgets for the work that needs attention today.</p>
          </div>
          <div className="widget-toggle-list">
            {dashboardWidgets.map((widget) => (
              <button
                className={isWidgetVisible(widget.id) ? 'widget-toggle active' : 'widget-toggle'}
                type="button"
                key={widget.id}
                onClick={() => toggleDashboardWidget(widget.id)}
              >
                {widget.label}
              </button>
            ))}
          </div>
        </section>

        <section className="content-grid">
          {isWidgetVisible('communications') && (
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

          {isWidgetVisible('recentActivity') && (
          <article className="panel pipeline-panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Recent Client Activity</h2>
                <p>Latest notes, policy updates, and service touches.</p>
              </div>
              <button className="text-button" type="button">
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

          {isWidgetVisible('followUps') && (
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

          {isWidgetVisible('renewals') && (
          <article className="panel wide-panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>Renewals & Expiring Policies</h2>
                <p>Prioritize accounts before premium is at risk.</p>
              </div>
              <button className="secondary-action" type="button">
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

          {isWidgetVisible('keyAccounts') && (
          <article className="panel widget-panel">
            <div className="panel-header">
              <div>
                <h2>New Prospects & Key Accounts</h2>
                <p>Keep today&apos;s pipeline and high-value client files close.</p>
              </div>
              <CircleDollarSign size={22} aria-hidden="true" />
            </div>
            <div className="account-list">
              {accounts.map((account) => (
                <div className="account-row" key={account.name}>
                  <div>
                    <strong>{account.name}</strong>
                    <span>
                      {account.lineOfBusiness} - {account.primaryContact}
                    </span>
                  </div>
                  <div>
                    {canSeeOwnerAnalytics && <b>{currency.format(account.annualRevenue)}</b>}
                    <small>
                      {account.policyCount} policies - {account.health}
                    </small>
                    <button
                      className="text-button account-file-link"
                      type="button"
                      onClick={() => {
                        setSelectedClientId(account.id)
                        setActiveView('profile')
                      }}
                    >
                      Open file
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
          )}

          {canSeeOwnerAnalytics && isWidgetVisible('ownerReports') && (
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
        </section>
          </>
        )}
      </main>

      {aiHelpOpen && (
        <aside className="ai-help-panel" aria-label="AgencyIQ AI help">
          <div className="ai-help-header">
            <div>
              <span className="ai-kicker">
                <Bot size={15} aria-hidden="true" />
                Agent answer assistant
              </span>
              <h2>Help explain client questions</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close AI help"
              onClick={() => setAiHelpOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="ai-prompt-box">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Ask AgencyIQ AI"
              placeholder="Ask about coverage, premiums, limits, deductibles, renewals, or billing"
            />
          </div>

          <div className="ai-suggestion-grid">
            <button type="button">Explain why a client&apos;s premium increased</button>
            <button type="button">Explain what this coverage does in plain English</button>
            <button type="button">Explain why a limit may be too high or too low</button>
            <button type="button">Draft a professional response to a client question</button>
            <button type="button">Compare deductible and premium tradeoffs</button>
            <button type="button">Summarize renewal changes for the agent</button>
          </div>

          <div className="ai-guidance-panel">
            <strong>Designed for agent review</strong>
            <span>
              Use this for suggested explanations, coverage education, renewal talking points, and
              response drafts. Final answers should be reviewed by a licensed agent before sending.
            </span>
          </div>
        </aside>
      )}
    </div>
  )
}

export default App



