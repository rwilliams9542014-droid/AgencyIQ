import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bell, Bot, BriefcaseBusiness, CalendarClock, Car, CircleCheck as CheckCircle2, ChevronRight, ChevronDown, CircleDollarSign, ClipboardCheck, Cloud, Copy, Database, Download, ExternalLink, FileText, FolderOpen, Handshake, Home, Link as LinkIcon, LayoutDashboard, Lock, Mail, Menu, Monitor, Moon, Palette, Pencil, PhoneCall, RefreshCcw, Search, Send, ShieldCheck, SlidersHorizontal, Settings, Sparkles, Sun, Trash2, Upload, UsersRound, X, Zap } from 'lucide-react'
import agencyIqLogo from './assets/agencyiq-logo.png'
import { canViewOwnerAnalytics } from './auth/permissions'
import { IvansPanel } from './components/IvansPanel'
import { AcordFormsPanel } from './components/AcordFormsPanel'
import { NewClientWizard } from './components/NewClientWizard'
import { supabase, supabaseFunctionsUrl, supabasePublicAnonKey, type CarrierAccess } from './lib/supabase'
import { clearSession } from './lib/sessionGuard'
import { createExportJob, createImportBatch, downloadJsonExport, guessImportMapping, IMPORT_FIELDS, parseCsvText, parsePortableDataset, type ImportMapping, type ImportPreview } from './lib/dataPortability'
import mascotImg from './assets/IQ_MASCOT-removebg-preview.png'
import type { AcordDraft, ClaimRecord, ClaimStatus, Client, ClientCloudFolder, CloudDocumentFolderProvider, CrmDataset, OpportunityStage, PaymentLedgerEntry, Policy, PolicyBilling, PolicyTransaction, PolicyTransactionStatus, PolicyTransactionType, RelatedParty, RelatedPartyType, RiskAsset, RiskAssetType, UserRole } from './data/crmTypes'
import { createRecordId, loadDataset, saveDataset } from './data/scopedStorage'
import './App.css'

type Metric = {
  id: 'tasksToday' | 'overdueTasks' | 'renewals' | 'leads'
  label: string
  value: string
  detail: string
  trend: string
}

type AppView = 'dashboard' | 'clients' | 'profile' | 'leads' | 'renewals' | 'ivans' | 'data' | 'acord' | 'binder' | 'admin'
type ClientFilter = 'All' | 'Personal Lines' | 'Commercial Lines' | 'Active' | 'Prospect' | 'Inactive' | 'Renewal Due'
type ClientSort = 'name-asc' | 'name-desc' | 'renewal-asc' | 'premium-desc'
type ClientTab =
  | 'Overview'
  | 'Contact & Account'
  | 'Related Parties'
  | 'Assets & Exposures'
  | 'Policies'
  | 'Billing'
  | 'Documents'
  | 'Claims'
  | 'Tasks'
  | 'Notes & History'
  | 'Activity'
type PolicyFilter = 'All' | 'Active' | 'Renewal Review' | 'Expired' | 'Cancelled' | 'Rewritten' | 'Prior History'

type ModalType =
  | 'addClient'
  | 'addPolicy'
  | 'editClient'
  | 'editPolicy'
  | 'editCoverage'
  | 'editBilling'
  | 'addRelatedParty'
  | 'addPolicyTransaction'
  | 'addClaim'
  | 'addRiskAsset'
  | 'addPayment'
  | 'addBinderEntry'
  | 'editBinderEntry'
  | 'cloudFolder'
  | 'addTask'
  | 'addNote'
  | 'addLead'
  | 'carrierPortal'
  | null

type BinderEntryFormData = {
  clientMode: 'existing' | 'new'
  clientId: string
  clientName: string
  primaryContact: string
  email: string
  phone: string
  lineOfBusiness: string
  policyType: string
  carrier: string
  policyNumber: string
  effectiveDate: string
  expirationDate: string
  premium: string
  paymentTaken: string
  paymentMethod: PaymentLedgerEntry['method']
  remitTo: string
  remittanceDueDate: string
  binderNotes: string
}

type CloudFolderFormData = {
  provider: CloudDocumentFolderProvider
  folderName: string
  folderUrl: string
  folderId: string
  notes: string
}

type Toast = { id: number; message: string }

type ClientDocument = {
  id: string
  clientId: string
  policyId?: string
  name: string
  type: 'Declarations' | 'Application' | 'ID Cards' | 'Certificate' | 'Invoice' | 'Loss Runs' | 'Correspondence'
  status: 'Current' | 'Needs review' | 'Missing signature' | 'Archived'
  addedAt: string
  source: 'Carrier' | 'Agency' | 'Client' | 'IVANS'
}

type FolderAction = {
  id: string
  title: string
  detail: string
  priority: 'urgent' | 'warning' | 'normal'
  action: string
}

type WorkbenchAction =
  | { type: 'client-tab'; clientId: string; tab: ClientTab }
  | { type: 'edit-policy'; policyId: string }
  | { type: 'renewals' }
  | { type: 'leads' }

type WorkbenchItem = {
  id: string
  title: string
  detail: string
  meta: string
  tone: 'urgent' | 'warning' | 'normal' | 'success'
  actionLabel: string
  action: WorkbenchAction
}

type WorkbenchQueue = {
  id: string
  title: string
  subtitle: string
  count: number
  items: WorkbenchItem[]
  viewAllLabel: string
  viewAllAction: WorkbenchAction
}

type AuditEvent = {
  id: string
  title: string
  detail: string
  actor: string
  at: string
  type: 'policy' | 'note' | 'task' | 'document' | 'renewal'
}
type CoverageField = {
  id: string
  label: string
  required?: boolean
}
type CoverageFieldGroup = {
  title: string
  fields: CoverageField[]
}
type CoverageSchema = {
  key: 'personal_auto' | 'homeowners' | 'commercial_auto' | 'general_liability' | 'workers_comp' | 'commercial_property' | 'bop' | 'flood' | 'umbrella' | 'other'
  title: string
  groups: CoverageFieldGroup[]
}
type PolicyCoverageDetails = Record<string, string>

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
  aliases?: string[]
  url: string
  portalUrl?: string
  policyLookupUrl?: string
  billingUrl?: string
  claimsUrl?: string
  username: string
  hasPassword?: boolean
  passwordUpdatedAt?: string
  producerCode?: string
  agencyCode?: string
  notes: string
  active?: boolean
}

type CarrierSecretAction = 'reveal-password' | 'copy-access'

const isCredentialManagerRole = (role: UserRole) =>
  role === 'Agent/Owner' || role === 'Principal Agent' || role === 'Admin'

const cloudFolderProviderLabels: Record<CloudDocumentFolderProvider, string> = {
  google_drive: 'Google Drive',
  microsoft_onedrive: 'OneDrive',
  dropbox: 'Dropbox',
  box: 'Box',
  other: 'Other',
}

const cloudFolderProviders = Object.entries(cloudFolderProviderLabels) as [CloudDocumentFolderProvider, string][]

const isValidCloudFolderUrl = (value: string) => {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

const looksLikePublicCloudShare = (value: string) => {
  const lower = value.toLowerCase()
  return lower.includes('/sharing/') ||
    lower.includes('share=') ||
    lower.includes('/s/') ||
    lower.includes('/sh/') ||
    lower.includes('usp=sharing') ||
    lower.includes('anonymous') ||
    lower.includes('public')
}

const normalizeCarrierName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const normalizeUrl = (value?: string | null) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return ''
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
}

const toCarrierPortalEntry = (row: CarrierAccess): CarrierPortalEntry => ({
  id: row.id,
  name: row.carrier_name,
  aliases: row.carrier_aliases ?? [],
  url: row.portal_url ?? '',
  portalUrl: row.portal_url ?? '',
  policyLookupUrl: row.policy_lookup_url ?? '',
  billingUrl: row.billing_url ?? '',
  claimsUrl: row.claims_url ?? '',
  username: row.username ?? '',
  hasPassword: !!row.has_password,
  passwordUpdatedAt: row.password_updated_at ?? undefined,
  producerCode: row.producer_code ?? '',
  agencyCode: row.agency_code ?? '',
  notes: row.login_notes ?? '',
  active: row.active,
})

const toCarrierAccessPayload = (entry: CarrierPortalEntry, accountId: string) => ({
  account_id: accountId,
  carrier_name: entry.name,
  carrier_aliases: entry.aliases ?? [],
  portal_url: entry.portalUrl ?? entry.url,
  policy_lookup_url: entry.policyLookupUrl ?? '',
  billing_url: entry.billingUrl ?? '',
  claims_url: entry.claimsUrl ?? '',
  producer_code: entry.producerCode ?? '',
  agency_code: entry.agencyCode ?? '',
  username: entry.username,
  login_notes: entry.notes,
  active: entry.active ?? true,
})

const findCarrierPortalForPolicy = (portals: CarrierPortalEntry[], policy: Policy) => {
  const carrierName = normalizeCarrierName(policy.carrier)
  return portals.find((portal) => {
    const names = [portal.name, ...(portal.aliases ?? [])].map(normalizeCarrierName)
    return names.some((name) => name && (name === carrierName || carrierName.includes(name) || name.includes(carrierName)))
  }) ?? null
}

const field = (id: string, label: string, required = false): CoverageField => ({ id, label, required })

const COVERAGE_SCHEMAS: Record<CoverageSchema['key'], CoverageSchema> = {
  personal_auto: {
    key: 'personal_auto',
    title: 'Personal Auto Coverage',
    groups: [
      { title: 'Liability Coverages', fields: [field('bodilyInjury', 'Bodily Injury Liability', true), field('propertyDamage', 'Property Damage Liability', true), field('pip', 'Personal Injury Protection / PIP', true), field('medicalPayments', 'Medical Payments'), field('uninsuredMotorist', 'Uninsured Motorist / UM', true), field('underinsuredMotorist', 'Underinsured Motorist / UIM')] },
      { title: 'Physical Damage', fields: [field('comprehensiveDeductible', 'Comprehensive Deductible', true), field('collisionDeductible', 'Collision Deductible', true)] },
      { title: 'Policy Extras', fields: [field('rentalReimbursement', 'Rental Reimbursement'), field('roadsideAssistance', 'Roadside Assistance'), field('towing', 'Towing'), field('gapCoverage', 'Gap Coverage')] },
      { title: 'People & Vehicles', fields: [field('vehicleSchedule', 'Vehicle Schedule', true), field('driverSchedule', 'Driver Schedule', true), field('garagingAddress', 'Garaging Address'), field('excludedDrivers', 'Excluded Drivers'), field('additionalInterests', 'Additional Interests / Lienholders')] },
    ],
  },
  homeowners: {
    key: 'homeowners',
    title: 'Homeowners Coverage',
    groups: [
      { title: 'Property Limits', fields: [field('coverageA', 'Coverage A - Dwelling', true), field('coverageB', 'Coverage B - Other Structures'), field('coverageC', 'Coverage C - Personal Property'), field('coverageD', 'Coverage D - Loss of Use')] },
      { title: 'Liability', fields: [field('coverageE', 'Coverage E - Personal Liability'), field('coverageF', 'Coverage F - Medical Payments')] },
      { title: 'Deductibles', fields: [field('hurricaneDeductible', 'Hurricane Deductible', true), field('aopDeductible', 'All Other Perils Deductible'), field('waterDeductible', 'Water Deductible')] },
      { title: 'Endorsements', fields: [field('waterBackup', 'Water Backup'), field('ordinanceOrLaw', 'Ordinance or Law'), field('sinkholeCoverage', 'Sinkhole Coverage'), field('screenedEnclosure', 'Screened Enclosure'), field('replacementCostContents', 'Replacement Cost Contents')] },
      { title: 'Risk Details', fields: [field('yearBuilt', 'Year Built'), field('roofYear', 'Roof Year', true), field('roofType', 'Roof Type'), field('constructionType', 'Construction Type'), field('protectionClass', 'Protection Class'), field('windMitigation', 'Wind Mitigation', true), field('fourPointInspection', '4-Point Inspection'), field('mortgagee', 'Mortgagee', true)] },
    ],
  },
  commercial_auto: {
    key: 'commercial_auto',
    title: 'Commercial Auto Coverage',
    groups: [
      { title: 'Liability', fields: [field('liabilityLimit', 'Liability Limit', true), field('cslSplitLimits', 'CSL / Split Limits'), field('umUim', 'UM / UIM'), field('pip', 'PIP if applicable'), field('hiredAuto', 'Hired Auto'), field('nonOwnedAuto', 'Non-Owned Auto'), field('anyAutoSymbol', 'Any Auto / Symbol')] },
      { title: 'Physical Damage', fields: [field('scheduledAutos', 'Scheduled Autos', true), field('comprehensiveDeductible', 'Comprehensive Deductible'), field('collisionDeductible', 'Collision Deductible')] },
      { title: 'Trucking / Operations', fields: [field('cargoCoverage', 'Cargo Coverage'), field('trailerInterchange', 'Trailer Interchange'), field('radius', 'Radius'), field('filings', 'Filings'), field('vehicleSchedule', 'Vehicle Schedule', true), field('driverSchedule', 'Driver Schedule', true), field('garagingLocation', 'Garaging Location'), field('dotNumber', 'DOT Number'), field('mcNumber', 'MC Number'), field('cargoHauled', 'Cargo Hauled')] },
    ],
  },
  general_liability: {
    key: 'general_liability',
    title: 'General Liability Coverage',
    groups: [
      { title: 'Core Limits', fields: [field('eachOccurrence', 'Each Occurrence Limit', true), field('generalAggregate', 'General Aggregate', true), field('productsCompletedOps', 'Products / Completed Operations Aggregate'), field('personalAdvertisingInjury', 'Personal & Advertising Injury'), field('damageToPremises', 'Damage to Premises Rented to You'), field('medicalExpense', 'Medical Expense'), field('deductibleSir', 'Deductible / SIR')] },
      { title: 'Business Exposure', fields: [field('classCodes', 'Class Codes', true), field('businessDescription', 'Business Description'), field('annualSales', 'Annual Sales', true), field('payroll', 'Payroll'), field('subcontractorCost', 'Subcontractor Cost')] },
      { title: 'Endorsements', fields: [field('additionalInsureds', 'Additional Insureds'), field('waiverOfSubrogation', 'Waiver of Subrogation'), field('primaryNoncontributory', 'Primary & Noncontributory'), field('perProjectAggregate', 'Per Project Aggregate')] },
    ],
  },
  workers_comp: {
    key: 'workers_comp',
    title: 'Workers Compensation Coverage',
    groups: [
      { title: 'Employer Liability', fields: [field('elEachAccident', 'Employer Liability Each Accident', true), field('diseaseEachEmployee', 'Disease Each Employee', true), field('diseasePolicyLimit', 'Disease Policy Limit', true), field('state', 'State')] },
      { title: 'Payroll & Rating', fields: [field('classCodes', 'Class Codes', true), field('payrollByClassCode', 'Payroll by Class Code', true), field('experienceMod', 'Experience Mod', true), field('officersIncludedExcluded', 'Officers Included/Excluded')] },
      { title: 'Endorsements / Audit', fields: [field('waiverOfSubrogation', 'Waiver of Subrogation'), field('alternateEmployer', 'Alternate Employer'), field('priorCarrier', 'Prior Carrier'), field('auditDate', 'Audit Date'), field('depositPremium', 'Deposit Premium')] },
    ],
  },
  flood: {
    key: 'flood',
    title: 'Flood Coverage',
    groups: [
      { title: 'Limits & Deductibles', fields: [field('buildingCoverage', 'Building Coverage', true), field('contentsCoverage', 'Contents Coverage'), field('replacementCost', 'Replacement Cost'), field('deductible', 'Deductible', true)] },
      { title: 'Flood Rating', fields: [field('floodZone', 'Flood Zone', true), field('communityNumber', 'Community Number'), field('mapPanel', 'Map Panel'), field('elevationCertificate', 'Elevation Certificate'), field('foundationType', 'Foundation Type'), field('occupancy', 'Occupancy'), field('waitingPeriod', 'Waiting Period')] },
      { title: 'Policy Details', fields: [field('lenderMortgagee', 'Lender / Mortgagee'), field('nfipOrPrivate', 'NFIP or Private Flood'), field('lossHistory', 'Loss History')] },
    ],
  },
  commercial_property: {
    key: 'commercial_property',
    title: 'Commercial Property / BOP Coverage',
    groups: [
      { title: 'Property Limits', fields: [field('buildingLimit', 'Building Limit', true), field('businessPersonalProperty', 'Business Personal Property', true), field('businessIncome', 'Business Income'), field('extraExpense', 'Extra Expense'), field('generalLiabilityIncluded', 'General Liability Included'), field('equipmentBreakdown', 'Equipment Breakdown')] },
      { title: 'Deductibles & Endorsements', fields: [field('ordinanceOrLaw', 'Ordinance or Law'), field('deductible', 'Deductible', true), field('windHailDeductible', 'Wind/Hail Deductible'), field('theftDeductible', 'Theft Deductible')] },
      { title: 'Location & Risk', fields: [field('locationSchedule', 'Location Schedule', true), field('constructionType', 'Construction Type'), field('yearBuilt', 'Year Built'), field('squareFootage', 'Square Footage'), field('occupancy', 'Occupancy'), field('protectionClass', 'Protection Class'), field('sprinklered', 'Sprinklered'), field('alarm', 'Alarm'), field('mortgageeLossPayee', 'Mortgagee / Loss Payee')] },
    ],
  },
  bop: {
    key: 'bop',
    title: 'Commercial Property / BOP Coverage',
    groups: [],
  },
  umbrella: {
    key: 'umbrella',
    title: 'Umbrella / Excess Liability Coverage',
    groups: [
      { title: 'Umbrella Limits', fields: [field('umbrellaLimit', 'Umbrella Limit', true), field('retainedLimit', 'Retained Limit', true), field('followForm', 'Follow Form Yes/No')] },
      { title: 'Underlying Policies', fields: [field('underlyingAutoLimit', 'Underlying Auto Limit'), field('underlyingHomeownersLimit', 'Underlying Homeowners Limit'), field('underlyingGlLimit', 'Underlying GL Limit'), field('underlyingEmployersLiabilityLimit', 'Underlying Employers Liability Limit'), field('scheduleOfUnderlyingPolicies', 'Schedule of Underlying Policies', true)] },
      { title: 'Exclusions', fields: [field('exclusions', 'Exclusions')] },
    ],
  },
  other: {
    key: 'other',
    title: 'Policy Coverage Details',
    groups: [
      { title: 'Coverage Summary', fields: [field('primaryLimit', 'Primary Limit', true), field('deductible', 'Deductible'), field('coverageNotes', 'Coverage Notes')] },
    ],
  },
}
COVERAGE_SCHEMAS.bop.groups = COVERAGE_SCHEMAS.commercial_property.groups

const getCoverageSchema = (policy: Pick<Policy, 'policyType' | 'lineOfBusiness'>): CoverageSchema => {
  const type = policy.policyType.toLowerCase()
  const line = (policy.lineOfBusiness ?? '').toLowerCase()
  if (type.includes('flood')) return COVERAGE_SCHEMAS.flood
  if (type.includes('workers')) return COVERAGE_SCHEMAS.workers_comp
  if (type.includes('commercial auto') || type.includes('fleet') || (line.includes('commercial') && type.includes('auto'))) return COVERAGE_SCHEMAS.commercial_auto
  if (type.includes('personal auto') || (!line.includes('commercial') && type.includes('auto'))) return COVERAGE_SCHEMAS.personal_auto
  if (type.includes('home') || type.includes('ho-') || type.includes('dwelling') || type.includes('dp-')) return COVERAGE_SCHEMAS.homeowners
  if (type.includes('general liability') || type.includes('liquor liability')) return COVERAGE_SCHEMAS.general_liability
  if (type.includes('bop') || type.includes('business owners')) return COVERAGE_SCHEMAS.bop
  if (type.includes('commercial property') || type.includes('property') || type.includes('cpp')) return COVERAGE_SCHEMAS.commercial_property
  if (type.includes('umbrella') || type.includes('excess')) return COVERAGE_SCHEMAS.umbrella
  return COVERAGE_SCHEMAS.other
}

const parseLegacyCoverageDetails = (policy: Pick<Policy, 'limits'>): PolicyCoverageDetails => {
  if (!policy.limits?.trim()) return {}
  return { primaryLimit: policy.limits.trim() }
}

const getPolicyCoverageDetails = (policy: Policy): PolicyCoverageDetails => ({
  ...parseLegacyCoverageDetails(policy),
  ...(policy.coverageDetails ?? {}),
})

const getCoverageReviewFlags = (policy: Policy) => {
  const schema = getCoverageSchema(policy)
  const details = getPolicyCoverageDetails(policy)
  return schema.groups
    .flatMap((group) => group.fields)
    .filter((fieldDef) => fieldDef.required && !details[fieldDef.id]?.trim())
    .map((fieldDef) => `Missing ${fieldDef.label}`)
}

const countRequiredCoverageFields = (policy: Policy) =>
  getCoverageSchema(policy).groups.flatMap((group) => group.fields).filter((fieldDef) => fieldDef.required).length

const countCompletedRequiredCoverageFields = (policy: Policy) => {
  const details = getPolicyCoverageDetails(policy)
  return getCoverageSchema(policy).groups
    .flatMap((group) => group.fields)
    .filter((fieldDef) => fieldDef.required && details[fieldDef.id]?.trim())
    .length
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
  | 'system'
type ColorMode = 'light' | 'dark'

type ThemeOption = {
  id: PaletteId
  label: string
  colors: string[]
  isSystem?: boolean
}

const defaultPalette: PaletteId = 'agencyiq'

const themeOptions: ThemeOption[] = [
  {
    id: 'system',
    label: 'Match Desktop',
    colors: [],
    isSystem: true,
  },
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

// ── System / Match Desktop theme helpers ────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function rgbStringToHex(rgb: string): string | null {
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

function readOsAccentColor(): string | null {
  try {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;width:1px;height:1px;background:AccentColor;visibility:hidden;'
    document.body.appendChild(probe)
    const raw = getComputedStyle(probe).backgroundColor
    document.body.removeChild(probe)
    return rgbStringToHex(raw)
  } catch { return null }
}

function osAccentToPalette(hex: string): PaletteId {
  const [h, s, l] = hexToHsl(hex)
  if (s < 15) return l < 40 ? 'graphite' : 'classic'
  if (h >= 165 && h <= 210) return 'agencyiq'
  if (h >= 130 && h < 165)  return 'evergreen'
  if (h >= 210 && h < 260)  return 'sapphire'
  if (h >= 260 && h < 310)  return 'plum'
  if (h >= 310 || h < 20)   return 'classic'
  if (h >= 20  && h < 60)   return 'graphite'
  if (h >= 60  && h < 130)  return 'coastal'
  return 'agencyiq'
}

function applySystemThemeVars(hex: string, isDark: boolean) {
  const [h, s] = hexToHsl(hex)
  const root = document.documentElement
  root.style.setProperty('--sys-accent', hex)
  root.style.setProperty('--sys-accent-h', String(h))
  root.style.setProperty('--sys-accent-s', `${s}%`)
  root.style.setProperty('--sys-accent-light', `hsl(${h},${s}%,${isDark ? 75 : 45}%)`)
  root.style.setProperty('--sys-accent-glow',  `hsl(${h},${s}%,${isDark ? 65 : 55}%)`)
  root.style.setProperty('--sys-accent-muted',  `hsl(${h},${Math.round(s * 0.4)}%,${isDark ? 22 : 92}%)`)
  root.style.setProperty('--sys-bg',      isDark ? `hsl(${h},12%,8%)`   : `hsl(${h},8%,97%)`)
  root.style.setProperty('--sys-surface', isDark ? `hsl(${h},10%,13%)`  : `hsl(${h},6%,100%)`)
  root.style.setProperty('--sys-border',  isDark ? `hsl(${h},14%,22%)`  : `hsl(${h},10%,88%)`)
  root.style.setProperty('--sys-text',    isDark ? `hsl(${h},8%,94%)`   : `hsl(${h},10%,10%)`)
  root.style.setProperty('--sys-text-muted', isDark ? `hsl(${h},6%,60%)` : `hsl(${h},6%,45%)`)
}

function clearSystemThemeVars() {
  ;['--sys-accent','--sys-accent-h','--sys-accent-s','--sys-accent-light','--sys-accent-glow',
    '--sys-accent-muted','--sys-bg','--sys-surface','--sys-border','--sys-text','--sys-text-muted']
    .forEach(v => document.documentElement.style.removeProperty(v))
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

const currencyEntry = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const coverageCurrencyEntry = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const parseMoneyInput = (value: string) => {
  const normalized = value.replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatMoneyInput = (value: string, decimals = true) => {
  if (!value.trim()) return ''
  const amount = parseMoneyInput(value)
  return decimals ? currencyEntry.format(amount) : coverageCurrencyEntry.format(amount)
}

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const parseDisplayDate = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return trimmed
  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const formatDateInput = (value: string) => {
  const iso = parseDisplayDate(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

const getBinderLogYear = (dateValue?: string) => {
  const parsed = parseDisplayDate(dateValue ?? '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return parsed.slice(0, 4)
  return new Date().getFullYear().toString()
}

const parseBinderSequence = (binderNumber: string | undefined, year: string) => {
  const match = binderNumber?.match(/^(\d{4})-(\d{3,})$/)
  if (!match || match[1] !== year) return 0
  const sequence = Number(match[2])
  return Number.isFinite(sequence) ? sequence : 0
}

const formatBinderNumber = (year: string, sequence: number) => `${year}-${String(sequence).padStart(3, '0')}`

const getNextBinderNumberForYear = (year: string, transactions: PolicyTransaction[]) => {
  const yearTransactions = transactions.filter((transaction) => transaction.type === 'Binder' && getBinderLogYear(transaction.completedDate ?? transaction.effectiveDate ?? transaction.requestedDate) === year)
  const maxSequence = yearTransactions.reduce((max, transaction) => Math.max(max, parseBinderSequence(transaction.binderNumber, year)), 0)
  return formatBinderNumber(year, Math.max(maxSequence, yearTransactions.length) + 1)
}

const getCoverageFieldFormat = (fieldDef: CoverageField): 'money' | 'percentOrMoney' | 'date' | 'number' | 'text' => {
  const label = `${fieldDef.id} ${fieldDef.label}`.toLowerCase()
  if (label.includes('date')) return 'date'
  if (label.includes('year') || label.includes('square footage') || label.includes('radius') || label.includes('class code') || label.includes('dot') || label.includes('mc number')) return 'number'
  if (label.includes('deductible') || label.includes('wind') || label.includes('hurricane')) return 'percentOrMoney'
  if (label.includes('limit') || label.includes('coverage') || label.includes('aggregate') || label.includes('occurrence') || label.includes('premium') || label.includes('sales') || label.includes('payroll') || label.includes('expense') || label.includes('income')) return 'money'
  return 'text'
}

const formatCoverageValue = (value: string, fieldDef: CoverageField) => {
  if (!value.trim()) return ''
  const format = getCoverageFieldFormat(fieldDef)
  if (format === 'date') return formatDateInput(value)
  if (format === 'money') return formatMoneyInput(value, false)
  if (format === 'percentOrMoney') {
    const trimmed = value.trim()
    if (trimmed.endsWith('%')) return trimmed
    const numeric = parseMoneyInput(trimmed)
    if (numeric > 0 && numeric <= 10 && !trimmed.includes('$') && !trimmed.includes(',')) return `${numeric}%`
    return formatMoneyInput(trimmed, false)
  }
  return value
}

const coveragePlaceholder = (fieldDef: CoverageField) => {
  const format = getCoverageFieldFormat(fieldDef)
  if (format === 'money') return '$300,000'
  if (format === 'percentOrMoney') return '2%, 5%, $500, or $1,000'
  if (format === 'date') return '04/01/2026'
  if (format === 'number') return 'Enter number'
  return 'Not entered'
}

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
  'Documents',
  'Claims',
  'Tasks',
  'Notes & History',
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

const getPolicyLineCategory = (policy: Policy): 'auto' | 'home' | 'commercial' | 'other' => {
  const normalized = `${policy.policyType} ${policy.lineOfBusiness ?? ''}`.toLowerCase()
  if (normalized.includes('auto') || normalized.includes('vehicle')) return 'auto'
  if (normalized.includes('home') || normalized.includes('property') || normalized.includes('dwelling')) return 'home'
  if (policy.lineOfBusiness === 'Commercial' || normalized.includes('commercial') || normalized.includes('business') || normalized.includes('general liability')) return 'commercial'
  return 'other'
}

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

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AI'

const getPremiumTier = (premium: number) => {
  if (premium >= 250000) return 'elite'
  if (premium >= 100000) return 'high'
  if (premium >= 50000) return 'medium'
  return 'standard'
}

const getRenewalUrgency = (nextRenewal: string | undefined, activePolicyCount: number, todayIso: string) => {
  if (activePolicyCount === 0 || !nextRenewal) {
    return { className: 'none', label: 'No active policies' }
  }

  const daysUntil = Math.ceil(
    (new Date(`${nextRenewal}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime()) / 86_400_000,
  )

  if (daysUntil <= 30) return { className: 'urgent', label: daysUntil < 0 ? 'Past renewal' : '0-30 days' }
  if (daysUntil <= 60) return { className: 'warning', label: '31-60 days' }
  return { className: 'healthy', label: '90+ days' }
}

const addYears = (date: string, years: number) => {
  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setFullYear(nextDate.getFullYear() + years)
  return nextDate.toISOString().slice(0, 10)
}

const activePolicyStatuses = ['Active', 'Renewal review', 'Bound'] as const
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

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

const getXDateMarketingStatus = (expirationDate: string) => {
  const today = new Date()
  const expiration = new Date(`${expirationDate}T12:00:00`)
  const nextRenewal = new Date(expiration)
  while (nextRenewal < today) {
    nextRenewal.setFullYear(nextRenewal.getFullYear() + 1)
  }
  const daysUntilRenewal = Math.ceil((nextRenewal.getTime() - today.getTime()) / 86_400_000)

  if (daysUntilRenewal > 75) return { label: 'Too Early', className: 'xdate-window--early' }
  if (daysUntilRenewal > 60) return { label: 'Start Soon', className: 'xdate-window--soon' }
  if (daysUntilRenewal >= 0) return { label: 'Due Now', className: 'xdate-window--due' }
  return { label: 'Past Due', className: 'xdate-window--past' }
}

const buildClientDocuments = (clientId: string, policies: Policy[]): ClientDocument[] => {
  const docs = policies.flatMap((policy, index) => {
    const baseDate = policy.effectiveDate ?? policy.expirationDate
    return [
      {
        id: `doc-dec-${policy.id}`,
        clientId,
        policyId: policy.id,
        name: `${policy.policyType} declarations - ${policy.carrier}`,
        type: 'Declarations' as const,
        status: isActivePolicy(policy.status) ? 'Current' as const : 'Archived' as const,
        addedAt: baseDate,
        source: policy.policyNumber?.includes('R') ? 'IVANS' as const : 'Carrier' as const,
      },
      {
        id: `doc-inv-${policy.id}`,
        clientId,
        policyId: policy.id,
        name: `${policy.carrier} invoice / billing notice`,
        type: 'Invoice' as const,
        status: policy.paymentStatus === 'Past due' ? 'Needs review' as const : 'Current' as const,
        addedAt: policy.expirationDate,
        source: 'Carrier' as const,
      },
      ...(index === 0
        ? [{
            id: `doc-app-${policy.id}`,
            clientId,
            policyId: policy.id,
            name: `${policy.policyType} signed application`,
            type: 'Application' as const,
            status: policy.status === 'Pending' ? 'Missing signature' as const : 'Current' as const,
            addedAt: baseDate,
            source: 'Agency' as const,
          }]
        : []),
    ]
  })

  return docs.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

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

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Clients', icon: UsersRound },
  { label: 'ACORD Forms', icon: FileText },
  { label: 'Binder Log', icon: ClipboardCheck },
  { label: 'Renewals', icon: RefreshCcw },
  { label: 'Leads', icon: Handshake },
  { label: 'Data Center', icon: Database },
  { label: 'Administration', icon: Settings },
]

const relatedPartyTypes: RelatedPartyType[] = [
  'Additional Contact',
  'Certificate Holder',
  'Mortgagee',
  'Lienholder',
  'Additional Insured',
  'Loss Payee',
  'Finance Company',
  'Property Manager',
  'Bookkeeper',
  'Emergency Contact',
]

const policyTransactionTypes: PolicyTransactionType[] = [
  'New Business',
  'Renewal',
  'Endorsement',
  'Cancellation',
  'Reinstatement',
  'Rewrite',
  'Non-Renewal',
  'Binder',
  'Broker of Record',
]

const policyTransactionStatuses: PolicyTransactionStatus[] = [
  'Requested',
  'Sent to Carrier',
  'Received',
  'Invoiced',
  'Delivered to Client',
  'Completed',
  'Cancelled',
]

const claimStatuses: ClaimStatus[] = ['Open', 'Pending', 'Closed', 'Denied', 'Reopened']
const riskAssetTypes: RiskAssetType[] = ['Commercial Location', 'Vehicle', 'Driver', 'Property']

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('dashboard')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientFilter>('All')
  const [clientTab, setClientTab] = useState<ClientTab>('Overview')
  const [policyFilter, setPolicyFilter] = useState<PolicyFilter>('All')
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)
  const [dragOverLeadStage, setDragOverLeadStage] = useState<OpportunityStage | null>(null)
  const [selectedClientId, setSelectedClientId] = useState(() => dataset.clients[0]?.id ?? '')
  const [acordInitialClientId, setAcordInitialClientId] = useState('')
  const [modal, setModal] = useState<ModalType>(null)
  const [profileReturnView, setProfileReturnView] = useState<AppView | null>(null)
  const [editingBinderEntryId, setEditingBinderEntryId] = useState<string | null>(null)
  const [clientMoreActionsOpen, setClientMoreActionsOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(() => buildNotifications())
  const [customPolicyTypes, setCustomPolicyTypes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-policy-types') ?? '[]') } catch { return [] }
  })
  const [customCarriers, setCustomCarriers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-carriers') ?? '[]') } catch { return [] }
  })
  const [carrierPortals, setCarrierPortals] = useState<CarrierPortalEntry[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('agencyiq-carrier-portals') ?? '[]') as CarrierPortalEntry[]
      return stored.map((entry) => ({
        ...entry,
        portalUrl: entry.portalUrl ?? entry.url ?? '',
        policyLookupUrl: entry.policyLookupUrl ?? '',
        billingUrl: entry.billingUrl ?? '',
        claimsUrl: entry.claimsUrl ?? '',
        producerCode: entry.producerCode ?? '',
        agencyCode: entry.agencyCode ?? '',
        aliases: entry.aliases ?? [],
      }))
    } catch { return [] }
  })
  const [aiQuery, setAiQuery] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [coveragePolicyId, setCoveragePolicyId] = useState<string | null>(null)
  const [billingPolicyId, setBillingPolicyId] = useState<string | null>(null)
  const [transactionPolicyId, setTransactionPolicyId] = useState<string | null>(null)
  const [clientPage, setClientPage] = useState(0)
  const [clientPageSize, setClientPageSize] = useState(24)
  const [clientSort, setClientSort] = useState<ClientSort>('name-asc')
  const ivansFeatureEnabled = false
  // Renewal center state
  const todayDate = new Date()
  const [renewalMonth, setRenewalMonth] = useState(() => `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`)
  const [renewalDateFrom, setRenewalDateFrom] = useState('')
  const [renewalDateTo, setRenewalDateTo] = useState('')
  const [hideEscrow, setHideEscrow] = useState(false)
  const [hideAutopay, setHideAutopay] = useState(false)
  const [selectedRenewalIds, setSelectedRenewalIds] = useState<Set<string>>(new Set())
  const [renewalOutreachModal, setRenewalOutreachModal] = useState<'email' | null>(null)
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
    const supabaseClient = supabase
    if (!supabaseClient) return

    const load = async () => {
      try {
        const { data } = await supabaseClient
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
      } catch {
        // Supabase not configured — IVANS sync indicators stay hidden
      }
    }
    load()
  }, [dataset.agency.id])

  useEffect(() => {
    localStorage.setItem('agencyiq-palette', palette)
  }, [palette])

  const carrierAccessRequest = useCallback(async <T,>(path: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> => {
    const supabaseClient = supabase
    if (!supabaseClient || !supabaseFunctionsUrl || !supabasePublicAnonKey) {
      throw new Error('Carrier credential vault is not configured. Please set the encryption key.')
    }

    const { data } = await supabaseClient.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      throw new Error('Sign in to AgencyIQ before using the carrier credential vault.')
    }

    const response = await fetch(`${supabaseFunctionsUrl}/carrier-access${path}`, {
      method: options.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Apikey: supabasePublicAnonKey,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(String(payload.error ?? 'Carrier credential vault request failed.'))
    }
    return payload as T
  }, [])

  useEffect(() => {
    if (!supabase || !supabaseFunctionsUrl) return

    const loadCarrierAccess = async () => {
      try {
        const data = await carrierAccessRequest<{ carriers?: CarrierAccess[] }>(`?account_id=${encodeURIComponent(dataset.agency.id)}`, {
          method: 'GET',
        })
        const rows = data.carriers ?? []
        if (rows.length > 0) {
          setCarrierPortals(rows.map(toCarrierPortalEntry))
        }
      } catch {
        // The local non-password carrier list remains available if the vault function is not deployed.
      }
    }

    loadCarrierAccess()
  }, [carrierAccessRequest, dataset.agency.id])

  useEffect(() => {
    localStorage.setItem('agencyiq-mode', mode)
  }, [mode])

  const [systemAccentPalette, setSystemAccentPalette] = useState<PaletteId>('agencyiq')
  useEffect(() => {
    if (palette !== 'system') { clearSystemThemeVars(); return }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = (isDark: boolean) => {
      setMode(isDark ? 'dark' : 'light')
      const hex = readOsAccentColor()
      if (hex) {
        setSystemAccentPalette(osAccentToPalette(hex))
        applySystemThemeVars(hex, isDark)
      } else {
        setSystemAccentPalette('agencyiq')
      }
    }
    const timer = window.setTimeout(() => syncSystemTheme(mq.matches), 0)
    const onMqChange = (e: MediaQueryListEvent) => {
      syncSystemTheme(e.matches)
    }
    mq.addEventListener('change', onMqChange)
    return () => { window.clearTimeout(timer); mq.removeEventListener('change', onMqChange); clearSystemThemeVars() }
  }, [palette])

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
    localStorage.setItem('agencyiq-carrier-portals', JSON.stringify(carrierPortals))
  }, [carrierPortals])

  useEffect(() => {
    localStorage.setItem('agencyiq-email-templates', JSON.stringify(emailTemplates))
  }, [emailTemplates])

  const canSeeOwnerAnalytics = canViewOwnerAnalytics(dataset.currentUser)
  const visibleNavItems = navItems.filter((item) => {
    if (item.label === 'Administration') return canSeeOwnerAnalytics
    if (item.label === 'Data Center') return false
    return true
  })
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
      id: 'tasksToday',
      label: 'Tasks Due Today',
      value: String(tasksDueToday.length),
      detail: 'Client work scheduled for today',
      trend: `${followUpsDueToday.length} follow-ups due`,
    },
    {
      id: 'overdueTasks',
      label: 'Overdue Tasks',
      value: String(overdueTasks.length),
      detail: 'Items needing immediate recovery',
      trend: 'Escalate before end of day',
    },
    {
      id: 'renewals',
      label: 'Renewals Needing Attention',
      value: String(dataset.renewals.length),
      detail: 'Open renewal queue',
      trend: `${policiesExpiringSoon.length} policies expiring soon`,
    },
    {
      id: 'leads',
      label: 'New Prospects / Leads',
      value: String(activeProspects.length),
      detail: 'Open opportunities before conversion',
      trend: `${dataset.quoteRequests.filter((quote) => quote.status === 'Quoted').length} quoted`,
    },
  ]
  const xDatePolicies = Array.from(dataset.policies
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
    .reduce((latestByClientAndCoverage, policy) => {
      const key = `${policy.clientId}:${getPolicyCoverageBucket(policy.policyType)}`
      const existing = latestByClientAndCoverage.get(key)
      if (!existing || new Date(policy.expirationDate).getTime() > new Date(existing.expirationDate).getTime()) {
        latestByClientAndCoverage.set(key, policy)
      }
      return latestByClientAndCoverage
    }, new Map<string, Policy>())
    .values())
    .sort((left, right) => new Date(left.expirationDate).getTime() - new Date(right.expirationDate).getTime())
  const billingIssuePolicies = dataset.policies
    .filter((policy) => {
      const paymentStatus = policy.billing?.paymentStatus ?? policy.paymentStatus
      return paymentStatus === 'Past due' || paymentStatus === 'NSF / Returned'
    })
    .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
  const actionableQuoteRequests = dataset.quoteRequests.filter((quote) => quote.status === 'Submitted' || quote.status === 'Quoted')
  const serviceTasks = [
    ...overdueTasks,
    ...tasksDueToday.filter((task) => !overdueTasks.some((item) => item.id === task.id)),
    ...followUpsDueToday.filter((task) =>
      !overdueTasks.some((item) => item.id === task.id) &&
      !tasksDueToday.some((item) => item.id === task.id),
    ),
  ]
  const recentClientActivity: WorkbenchItem[] = [
    ...dataset.notes.slice(0, 3).map((note): WorkbenchItem => {
      const client = dataset.clients.find((item) => item.id === note.clientId)
      return {
        id: `note-${note.id}`,
        title: `${note.type ?? 'General'} note`,
        detail: client?.name ?? 'Client file',
        meta: formatDateTime(note.createdAt),
        tone: 'normal',
        actionLabel: 'Open file',
        action: { type: 'client-tab', clientId: note.clientId, tab: 'Notes & History' },
      }
    }),
    ...dataset.policies.slice(0, 3).map((policy): WorkbenchItem => {
      const client = dataset.clients.find((item) => item.id === policy.clientId)
      return {
        id: `policy-activity-${policy.id}`,
        title: `${policy.policyType} updated`,
        detail: `${client?.name ?? 'Client'} - ${policy.carrier}`,
        meta: policy.status,
        tone: isActivePolicy(policy.status) ? 'success' : 'normal',
        actionLabel: 'Open policy',
        action: { type: 'client-tab', clientId: policy.clientId, tab: 'Policies' },
      }
    }),
  ].slice(0, 4)
  const agentWorkbenchQueues: WorkbenchQueue[] = [
    {
      id: 'tasks-followups',
      title: 'Tasks & Follow-Ups',
      subtitle: 'Overdue, due today, and client callbacks.',
      count: serviceTasks.length + billingIssuePolicies.length,
      items: [
        ...serviceTasks.slice(0, 4).map((task): WorkbenchItem => {
          const client = dataset.clients.find((item) => item.id === task.clientId)
          return {
            id: `task-${task.id}`,
            title: task.title,
            detail: client?.name ?? 'Unassigned task',
            meta: task.dueDate ? `Due ${formatDate(task.dueDate)}` : task.dueLabel,
            tone: overdueTasks.some((item) => item.id === task.id) || task.priority === 'High' ? 'urgent' : 'normal',
            actionLabel: 'Open task',
            action: task.clientId ? { type: 'client-tab', clientId: task.clientId, tab: 'Tasks' } : { type: 'client-tab', clientId: selectedClientId, tab: 'Tasks' },
          }
        }),
        ...billingIssuePolicies.slice(0, 2).map((policy): WorkbenchItem => {
          const client = dataset.clients.find((item) => item.id === policy.clientId)
          return {
            id: `billing-${policy.id}`,
            title: `${policy.policyType} billing issue`,
            detail: `${client?.name ?? 'Client'} - ${policy.carrier}`,
            meta: policy.billing?.paymentStatus ?? policy.paymentStatus ?? 'Review billing',
            tone: 'urgent',
            actionLabel: 'Open billing',
            action: { type: 'client-tab', clientId: policy.clientId, tab: 'Billing' },
          }
        }),
      ].slice(0, 4),
      viewAllLabel: 'Open task list',
      viewAllAction: { type: 'client-tab', clientId: selectedClientId, tab: 'Tasks' },
    },
    {
      id: 'renewals',
      title: 'Renewals',
      subtitle: 'Upcoming or past-due policies needing attention.',
      count: dataset.renewals.length + policiesExpiringSoon.length,
      items: [
        ...dataset.renewals.slice(0, 4).map((renewal): WorkbenchItem => {
          const client = dataset.clients.find((item) => item.id === renewal.clientId)
          const policy = dataset.policies.find((item) => item.id === renewal.policyId)
          return {
            id: `renewal-${renewal.id}`,
            title: policy?.policyType ?? 'Renewal review',
            detail: `${client?.name ?? 'Client'} - ${policy?.carrier ?? 'Carrier pending'}`,
            meta: `${renewal.status} - ${formatDate(renewal.dueDate)}`,
            tone: 'warning',
            actionLabel: 'Open renewal',
            action: { type: 'client-tab', clientId: renewal.clientId, tab: 'Policies' },
          }
        }),
        ...policiesExpiringSoon.slice(0, 2).map((policy): WorkbenchItem => {
          const client = dataset.clients.find((item) => item.id === policy.clientId)
          return {
            id: `expiring-${policy.id}`,
            title: `${policy.policyType} expires soon`,
            detail: `${client?.name ?? 'Client'} - ${policy.carrier}`,
            meta: formatDate(policy.expirationDate),
            tone: 'warning',
            actionLabel: 'Review policy',
            action: { type: 'client-tab', clientId: policy.clientId, tab: 'Policies' },
          }
        }),
      ].slice(0, 4),
      viewAllLabel: 'View renewals',
      viewAllAction: { type: 'renewals' },
    },
    {
      id: 'prospects',
      title: 'Leads & Prospects',
      subtitle: 'New opportunities, quotes, and x-dates.',
      count: xDatePolicies.length + activeProspects.length + actionableQuoteRequests.length,
      items: [
        ...activeProspects.slice(0, 4).map((lead): WorkbenchItem => ({
          id: `lead-${lead.id}`,
          title: lead.clientName,
          detail: `${lead.stage} opportunity`,
          meta: currency.format(lead.estimatedPremium),
          tone: lead.stage === 'Lost' ? 'normal' : 'success',
          actionLabel: 'Open leads',
          action: { type: 'leads' },
        })),
        ...actionableQuoteRequests.slice(0, 2).map((quote): WorkbenchItem => {
          const client = dataset.clients.find((item) => item.id === quote.clientId)
          return {
            id: `quote-${quote.id}`,
            title: `${quote.line} quote request`,
            detail: client?.name ?? 'Prospect',
            meta: quote.status,
            tone: 'normal',
            actionLabel: 'Open leads',
            action: { type: 'leads' },
          }
        }),
        ...xDatePolicies.slice(0, 2).map((policy): WorkbenchItem => {
          const client = dataset.clients.find((item) => item.id === policy.clientId)
          return {
            id: `xdate-${policy.id}`,
            title: `${policy.policyType} x-date`,
            detail: `${client?.name ?? 'Client'} - prior ${policy.carrier}`,
            meta: `Ended ${formatDate(policy.expirationDate)}`,
            tone: 'normal',
            actionLabel: 'Work x-date',
            action: { type: 'edit-policy', policyId: policy.id },
          }
        }),
      ].slice(0, 4),
      viewAllLabel: 'View pipeline',
      viewAllAction: { type: 'leads' },
    },
    {
      id: 'recent-activity',
      title: 'Recent Client Activity',
      subtitle: 'Latest notes and policy file movement.',
      count: dataset.notes.length + dataset.policies.length,
      items: recentClientActivity,
      viewAllLabel: 'View clients',
      viewAllAction: { type: 'client-tab', clientId: selectedClientId, tab: 'Activity' },
    },
  ]
  const structuredReports = [
    {
      title: 'Claims / Loss History',
      value: String((dataset.claims ?? []).length),
      detail: `${(dataset.claims ?? []).filter((claim) => claim.status !== 'Closed' && claim.status !== 'Denied').length} open or pending`,
    },
    {
      title: 'Certificate Holder Report',
      value: String((dataset.relatedParties ?? []).filter((party) => party.type === 'Certificate Holder').length),
      detail: 'Reusable holders tied to client files and policies',
    },
    {
      title: 'Commission Reconciliation',
      value: currency.format((dataset.commissionStatements ?? []).reduce((sum, item) => sum + item.commissionAmount, 0)),
      detail: `${(dataset.commissionStatements ?? []).filter((item) => item.status !== 'Reconciled').length} not reconciled`,
    },
    {
      title: 'Payment Ledger',
      value: currency.format((dataset.paymentLedger ?? []).filter((item) => item.status === 'Posted').reduce((sum, item) => sum + item.amount, 0)),
      detail: `${(dataset.paymentLedger ?? []).filter((item) => item.status === 'Pending').length} pending entries`,
    },
    {
      title: 'Exposure Schedule',
      value: String((dataset.riskAssets ?? []).length),
      detail: 'Locations, vehicles, drivers, and properties tracked',
    },
    {
      title: 'Cross-Sell / Missing Info',
      value: String(dataset.clients.filter((client) => (dataset.policies ?? []).filter((policy) => policy.clientId === client.id && isActivePolicy(policy.status)).length < 2).length),
      detail: 'Accounts with fewer than two active policies',
    },
  ]
  const currentYear = todayIso.slice(0, 4)
  const currentMonth = todayIso.slice(0, 7)
  const writtenPolicyReports = dataset.policies.filter((policy) => isActivePolicy(policy.status))
  const newBusinessThisMonth = writtenPolicyReports.filter((policy) => policy.effectiveDate?.startsWith(currentMonth))
  const newBusinessThisYear = writtenPolicyReports.filter((policy) => policy.effectiveDate?.startsWith(currentYear))
  const renewedPolicies = dataset.policies.filter((policy) => policy.status === 'Renewed/Replaced' || policy.renewalStatus === 'Renewed')
  const renewalRetentionBase = dataset.renewals.length + renewedPolicies.length
  const renewalRetentionRate = renewalRetentionBase > 0 ? Math.round((renewedPolicies.length / renewalRetentionBase) * 100) : 0
  const missingInfoClients = dataset.clients.filter((client) => !client.email || !client.phone || !client.mailingAddress)
  const incompleteTasksByCsr = Object.entries(groupByUser(
    dataset.tasks
      .filter((task) => !task.completed)
      .map((task) => ({ ...task, userId: task.assignedToUserId })),
  )).sort(([, left], [, right]) => right.length - left.length)
  const ownerReportLibrary = [
    {
      title: 'New business premium - month',
      value: currency.format(newBusinessThisMonth.reduce((sum, policy) => sum + policy.premium, 0)),
      detail: `${newBusinessThisMonth.length} active/bound polic${newBusinessThisMonth.length === 1 ? 'y' : 'ies'} effective in ${currentMonth}`,
      action: 'Export monthly premium',
    },
    {
      title: 'New business premium - year',
      value: currency.format(newBusinessThisYear.reduce((sum, policy) => sum + policy.premium, 0)),
      detail: `${newBusinessThisYear.length} active/bound polic${newBusinessThisYear.length === 1 ? 'y' : 'ies'} effective in ${currentYear}`,
      action: 'Export yearly premium',
    },
    {
      title: 'Renewal retention',
      value: `${renewalRetentionRate}%`,
      detail: `${renewedPolicies.length} renewed / ${renewalRetentionBase || 0} renewal records tracked`,
      action: 'Open renewals',
    },
    {
      title: 'Missing client info',
      value: String(missingInfoClients.length),
      detail: 'Client folders missing email, phone, or mailing address',
      action: 'Review missing info',
    },
    {
      title: 'Incomplete CSR tasks',
      value: String(dataset.tasks.filter((task) => !task.completed).length),
      detail: incompleteTasksByCsr.slice(0, 3).map(([userId, tasks]) => `${getUserName(dataset, userId)}: ${tasks.length}`).join(' | ') || 'No open CSR tasks',
      action: 'Open task report',
    },
  ]
  const agencyBillRemittanceQueue = (dataset.paymentLedger ?? [])
    .filter((payment) => {
      const policy = dataset.policies.find((item) => item.id === payment.policyId)
      const isAgencyCollected = payment.method === 'Merchant / Card Processor' || payment.method === 'Credit Card' || payment.method === 'ACH / Bank Draft' || policy?.billingType === 'Agency Bill'
      return isAgencyCollected && payment.status !== 'Voided' && payment.status !== 'Returned'
    })
    .map((payment) => {
      const policy = dataset.policies.find((item) => item.id === payment.policyId)
      const client = dataset.clients.find((item) => item.id === payment.clientId)
      const payableAmount = payment.carrierPayableAmount ?? Math.max(payment.amount - (policy ? (policy.premium * (policy.commissionRate ?? 0)) / 100 : 0), 0)
      const remitTo = payment.remitTo ?? policy?.carrier ?? 'Carrier / MGA'
      const dueDate = payment.remittanceDueDate ?? payment.paymentDate
      const status = payment.remittanceStatus ?? (payment.status === 'Posted' ? 'Needs Remittance' : 'On Hold')
      return { payment, policy, client, payableAmount, remitTo, dueDate, status }
    })
    .sort((left, right) => {
      if (left.status === 'Needs Remittance' && right.status !== 'Needs Remittance') return -1
      if (right.status === 'Needs Remittance' && left.status !== 'Needs Remittance') return 1
      return left.dueDate.localeCompare(right.dueDate)
    })
  const leadPipelineStages: Array<{ id: OpportunityStage; label: string; accent: string; description: string }> = [
    { id: 'New lead', label: 'New Leads', accent: 'sky', description: 'Fresh quote requests and referrals' },
    { id: 'Discovery', label: 'Contacted', accent: 'amber', description: 'Needs intake, documents, or follow-up' },
    { id: 'Quoting', label: 'Quoted', accent: 'violet', description: 'Markets, quotes, and proposals in motion' },
    { id: 'Bound', label: 'Won', accent: 'emerald', description: 'Ready to convert or already bound' },
    { id: 'Lost', label: 'Lost', accent: 'slate', description: 'Closed-lost leads and future reactivation opportunities' },
  ]
  const activeLeadCount = dataset.opportunities.length
  const binderTransactions = (dataset.policyTransactions ?? []).filter((transaction) => transaction.type === 'Binder')
  const binderTransactionPolicyIds = new Set(binderTransactions.map((transaction) => transaction.policyId))
  const nextBinderNumber = getNextBinderNumberForYear(new Date().getFullYear().toString(), dataset.policyTransactions ?? [])
  const binderLog = [
    ...binderTransactions
      .map((transaction) => {
        const policy = dataset.policies.find((item) => item.id === transaction.policyId)
        const client = dataset.clients.find((item) => item.id === transaction.clientId)
        return {
          id: transaction.id,
          binderNumber: transaction.binderNumber ?? 'Unnumbered',
          client,
          policy,
          binderDate: transaction.completedDate ?? transaction.effectiveDate ?? transaction.requestedDate ?? '',
          expirationDate: policy?.expirationDate ?? '',
          status: transaction.status,
          premium: transaction.premiumChange ?? policy?.premium ?? 0,
          boundBy: transaction.requestedBy ?? 'Unassigned',
          notes: transaction.notes ?? transaction.description,
        }
      }),
    ...dataset.policies
      .filter((policy) => policy.status === 'Bound' && !binderTransactionPolicyIds.has(policy.id))
      .map((policy) => {
        const client = dataset.clients.find((item) => item.id === policy.clientId)
        return {
          id: `bound-${policy.id}`,
          binderNumber: 'Unnumbered',
          client,
          policy,
          binderDate: policy.effectiveDate ?? '',
          expirationDate: policy.expirationDate,
          status: 'Completed',
          premium: policy.premium,
          boundBy: getUserName(dataset, policy.producerUserId ?? ''),
          notes: policy.notes ?? 'Bound policy awaiting final documents.',
        }
      }),
  ].sort((left, right) => right.binderDate.localeCompare(left.binderDate))
  const editingBinderEntry = binderLog.find((entry) => entry.id === editingBinderEntryId) ?? null
  const editingBinderPayment = editingBinderEntry
    ? (dataset.paymentLedger ?? []).find((payment) => payment.policyId === editingBinderEntry.policy?.id && payment.notes?.toLowerCase().includes('binder log'))
    : undefined
  const editingBinderInitialValues: BinderEntryFormData | undefined = editingBinderEntry ? {
    clientMode: 'existing',
    clientId: editingBinderEntry.client?.id ?? editingBinderEntry.policy?.clientId ?? dataset.clients[0]?.id ?? '',
    clientName: editingBinderEntry.client?.name ?? '',
    primaryContact: editingBinderEntry.client?.primaryContact ?? editingBinderEntry.client?.name ?? '',
    email: editingBinderEntry.client?.email ?? '',
    phone: editingBinderEntry.client?.phone ?? '',
    lineOfBusiness: editingBinderEntry.policy?.lineOfBusiness ?? editingBinderEntry.client?.lineOfBusiness ?? 'Personal lines',
    policyType: editingBinderEntry.policy?.policyType ?? '',
    carrier: editingBinderEntry.policy?.carrier ?? '',
    policyNumber: editingBinderEntry.policy?.policyNumber ?? '',
    effectiveDate: formatDateInput(editingBinderEntry.policy?.effectiveDate ?? editingBinderEntry.binderDate),
    expirationDate: formatDateInput(editingBinderEntry.policy?.expirationDate ?? editingBinderEntry.expirationDate),
    premium: formatMoneyInput(String(editingBinderEntry.premium)),
    paymentTaken: editingBinderPayment ? formatMoneyInput(String(editingBinderPayment.amount)) : '',
    paymentMethod: editingBinderPayment?.method ?? 'Merchant / Card Processor',
    remitTo: editingBinderPayment?.remitTo ?? editingBinderEntry.policy?.carrier ?? '',
    remittanceDueDate: editingBinderPayment?.remittanceDueDate ? formatDateInput(editingBinderPayment.remittanceDueDate) : '',
    binderNotes: editingBinderEntry.notes ?? '',
  } : undefined
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
  const clientRelatedParties = selectedClient
    ? (dataset.relatedParties ?? [])
        .filter((party) => party.clientId === selectedClient.id)
        .sort((left, right) => Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary)) || left.type.localeCompare(right.type))
    : []
  const clientPolicyTransactions = selectedClient
    ? (dataset.policyTransactions ?? [])
        .filter((transaction) => transaction.clientId === selectedClient.id)
        .sort((left, right) => new Date(right.completedDate ?? right.effectiveDate ?? right.requestedDate ?? '').getTime() - new Date(left.completedDate ?? left.effectiveDate ?? left.requestedDate ?? '').getTime())
    : []
  const getPolicyTransactions = (policyId: string) =>
    clientPolicyTransactions.filter((transaction) => transaction.policyId === policyId)
  const clientClaims = selectedClient
    ? (dataset.claims ?? [])
        .filter((claim) => claim.clientId === selectedClient.id)
        .sort((left, right) => new Date(right.dateOfLoss).getTime() - new Date(left.dateOfLoss).getTime())
    : []
  const openClientClaims = clientClaims.filter((claim) => claim.status !== 'Closed' && claim.status !== 'Denied')
  const clientRiskAssets = selectedClient
    ? (dataset.riskAssets ?? [])
        .filter((asset) => asset.clientId === selectedClient.id)
        .sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name))
    : []
  const clientPayments = selectedClient
    ? (dataset.paymentLedger ?? [])
        .filter((payment) => payment.clientId === selectedClient.id)
        .sort((left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime())
    : []
  const clientCommissions = selectedClient
    ? (dataset.commissionStatements ?? [])
        .filter((statement) => statement.clientId === selectedClient.id)
        .sort((left, right) => new Date(right.statementDate).getTime() - new Date(left.statementDate).getTime())
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
  const clientDocuments = selectedClient ? buildClientDocuments(selectedClient.id, clientPolicies) : []
  const selectedClientCloudFolder = selectedClient
    ? (dataset.clientCloudFolders ?? [])
        .filter((folder) => folder.accountId === dataset.agency.id && folder.clientId === selectedClient.id && folder.active)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
    : null
  const canManageCloudFolders = isCredentialManagerRole(dataset.currentUser.role)
  const clientOverdueTasks = clientTasks.filter((task) => !task.completed && task.dueDate && task.dueDate < todayIso)
  const folderActions: FolderAction[] = selectedClient ? [
    ...(clientOverdueTasks.length > 0 ? [{
      id: 'overdue-task',
      title: `${clientOverdueTasks.length} overdue task${clientOverdueTasks.length === 1 ? '' : 's'}`,
      detail: 'Clear overdue service work before adding new follow-ups.',
      priority: 'urgent' as const,
      action: 'Open Tasks',
    }] : []),
    ...(clientPolicies.some((policy) => policy.status === 'Renewal review') ? [{
      id: 'renewal-review',
      title: 'Renewal review active',
      detail: 'Review updated exposures, current carrier premium, and market options.',
      priority: 'warning' as const,
      action: 'Review Policies',
    }] : []),
    ...(clientDocuments.some((doc) => doc.status === 'Missing signature' || doc.status === 'Needs review') ? [{
      id: 'document-review',
      title: 'Document follow-up needed',
      detail: 'A file item needs a signature or staff review before closing the loop.',
      priority: 'warning' as const,
      action: 'Open Documents',
    }] : []),
    ...(openClientClaims.length > 0 ? [{
      id: 'open-claims',
      title: `${openClientClaims.length} open claim${openClientClaims.length === 1 ? '' : 's'}`,
      detail: 'Review adjuster status, reserves, documents, and follow-up dates.',
      priority: 'warning' as const,
      action: 'Open Claims',
    }] : []),
    ...(!selectedClient.email || !selectedClient.phone ? [{
      id: 'contact-gap',
      title: 'Contact profile incomplete',
      detail: 'Add email and phone so renewal and payment workflows can reach the insured.',
      priority: 'normal' as const,
      action: 'Edit Client',
    }] : []),
  ].slice(0, 4) : []
  const auditEvents: AuditEvent[] = selectedClient ? [
    ...clientPolicies.slice(0, 4).map((policy) => ({
      id: `audit-policy-${policy.id}`,
      title: `${policy.policyType} policy updated`,
      detail: `${policy.carrier} ${policy.policyNumber ?? 'policy number pending'} - ${policy.status}`,
      actor: getUserName(dataset, policy.csrUserId ?? selectedClient.assignedCsrId ?? ''),
      at: policy.effectiveDate ?? policy.expirationDate,
      type: 'policy' as const,
    })),
    ...clientDocuments.slice(0, 3).map((doc) => ({
      id: `audit-doc-${doc.id}`,
      title: `${doc.type} filed`,
      detail: `${doc.name} from ${doc.source}`,
      actor: doc.source === 'IVANS' ? 'IVANS download' : getUserName(dataset, selectedClient.assignedCsrId ?? ''),
      at: doc.addedAt,
      type: 'document' as const,
    })),
    ...clientNotes.slice(0, 5).map((note) => ({
      id: `audit-note-${note.id}`,
      title: `${note.type ?? 'General'} note added`,
      detail: note.body,
      actor: getUserName(dataset, note.createdByUserId),
      at: note.createdAt,
      type: 'note' as const,
    })),
    ...clientTasks.slice(0, 3).map((task) => ({
      id: `audit-task-${task.id}`,
      title: task.completed ? 'Task completed' : 'Task opened',
      detail: task.title,
      actor: getUserName(dataset, task.assignedToUserId),
      at: task.dueDate ?? todayIso,
      type: 'task' as const,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12) : []
  const getClientFilterCount = (filter: ClientFilter) => dataset.clients.filter((client) => {
    const isRenewalDue = dataset.renewals.some((renewal) => renewal.clientId === client.id)
    return (
      filter === 'All' ||
      (filter === 'Personal Lines' && client.lineOfBusiness === 'Personal lines') ||
      (filter === 'Commercial Lines' && client.lineOfBusiness === 'Commercial') ||
      (filter === 'Active' && client.accountStatus === 'Active') ||
      (filter === 'Prospect' && client.accountStatus === 'Prospect') ||
      (filter === 'Inactive' && client.accountStatus === 'Inactive') ||
      (filter === 'Renewal Due' && isRenewalDue)
    )
  }).length

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
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / clientPageSize))
  const normalizedClientPage = Math.min(clientPage, totalPages - 1)
  const pagedClients = sortedClients.slice(normalizedClientPage * clientPageSize, (normalizedClientPage + 1) * clientPageSize)
  const paginationPages = Array.from({ length: totalPages }, (_, index) => index)
    .filter((page) => page === 0 || page === totalPages - 1 || Math.abs(page - normalizedClientPage) <= 1)

  const updateRole = (role: UserRole) => {
    setDataset((current) => ({
      ...current,
      currentUser: {
        ...current.currentUser,
        role,
      },
    }))
  }

  const renewPolicy = (policy: Policy) => {
    const renewalEffectiveDate = policy.expirationDate
    const renewalExpirationDate = addYears(policy.expirationDate, 1)
    const renewalYear = new Date(`${renewalExpirationDate}T12:00:00`).getFullYear()
    const renewalPremium = (policy as Policy & { renewalPremium?: number }).renewalPremium
    const renewedPolicy: Policy = {
      ...policy,
      id: createRecordId('policy'),
      policyNumber: `${policy.policyNumber ?? 'POL'}-R${renewalYear}`,
      effectiveDate: renewalEffectiveDate,
      expirationDate: renewalExpirationDate,
      premium: renewalPremium ?? Math.round(policy.premium * 1.05),
      status: 'Renewal review',
      renewalStatus: 'Review needed',
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
    setClientTab('Policies')
    setPolicyFilter('All')
    setEditingPolicyId(renewedPolicy.id)
    setModal('editPolicy')
    showToast('Renewal policy created. Review and update the renewal details.')
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))

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

  const saveCarrierPortal = async (entry: CarrierPortalEntry) => {
    const canManageVault = isCredentialManagerRole(dataset.currentUser.role)
    try {
      if (supabase && supabaseFunctionsUrl && canManageVault) {
        const isLocalId = entry.id.startsWith('portal-')
        const payload = toCarrierAccessPayload(entry, dataset.agency.id)
        const response = await carrierAccessRequest<{ carrier: CarrierAccess }>(
          isLocalId ? '' : `/${entry.id}`,
          { method: isLocalId ? 'POST' : 'PATCH', body: payload },
        )
        const saved = toCarrierPortalEntry(response.carrier)
        setCarrierPortals((prev) => {
          const existing = prev.findIndex((p) => p.id === entry.id || p.id === saved.id)
          if (existing >= 0) {
            const next = [...prev]
            next[existing] = saved
            return next
          }
          return [...prev, saved]
        })
      } else {
        setCarrierPortals((prev) => {
          const existing = prev.findIndex((p) => p.id === entry.id)
          if (existing >= 0) {
            const next = [...prev]
            next[existing] = entry
            return next
          }
          return [...prev, entry]
        })
      }
      setModal(null)
      showToast(`Carrier portal saved: ${entry.name}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Carrier portal could not be saved')
    }
  }

  const copyToClipboard = async (text: string, successMessage: string) => {
    if (!text) {
      showToast('Nothing to copy yet')
      return
    }
    await navigator.clipboard.writeText(text)
    showToast(successMessage)
    window.setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => undefined)
    }, 60000)
  }

  const openEmailClient = (email?: string, subject?: string, body?: string) => {
    if (!email) {
      showToast('No email address on file')
      return
    }
    const query = new URLSearchParams()
    if (subject) query.set('subject', subject)
    if (body) query.set('body', body)
    window.location.assign(`mailto:${email}${query.toString() ? `?${query.toString()}` : ''}`)
  }

  const openPhoneDialer = (phone?: string) => {
    const dialable = phone?.replace(/[^\d+]/g, '')
    if (!dialable) {
      showToast('No phone number on file')
      return
    }
    window.location.assign(`tel:${dialable}`)
  }

  const saveCarrierPassword = async (entry: CarrierPortalEntry, username: string, password: string, acceptedRisk: boolean) => {
    if (!isCredentialManagerRole(dataset.currentUser.role)) {
      showToast('Only owner/admin users can manage carrier credentials')
      return false
    }
    if (!acceptedRisk) {
      showToast('You must accept the risk before storing carrier credentials')
      return false
    }
    if (!password.trim()) {
      showToast('Enter a password before saving credentials')
      return false
    }
    try {
      const isLocalId = entry.id.startsWith('portal-')
      let savedEntry = entry
      if (isLocalId) {
        const response = await carrierAccessRequest<{ carrier: CarrierAccess }>('', {
          method: 'POST',
          body: toCarrierAccessPayload({ ...entry, username }, dataset.agency.id),
        })
        savedEntry = toCarrierPortalEntry(response.carrier)
      }
      const response = await carrierAccessRequest<{ carrier: CarrierAccess }>(`/${savedEntry.id}/credentials`, {
        method: 'POST',
        body: {
          account_id: dataset.agency.id,
          username,
          password,
          accepted_risk: acceptedRisk,
        },
      })
      const next = toCarrierPortalEntry(response.carrier)
      setCarrierPortals((prev) => {
        const existing = prev.findIndex((p) => p.id === entry.id || p.id === next.id)
        if (existing >= 0) {
          const copy = [...prev]
          copy[existing] = next
          return copy
        }
        return [...prev, next]
      })
      showToast('Carrier credentials saved encrypted at rest')
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Carrier credential vault is not configured. Please set the encryption key.')
      return false
    }
  }

  const requestCarrierSecret = async (entry: CarrierPortalEntry, action: CarrierSecretAction) => {
    const confirmed = window.confirm('Confirm your AgencyIQ password to reveal this saved carrier credential.\n\nPassword verification is not available in this demo yet, so this action will be audit logged after your confirmation.')
    if (!confirmed) return null
    try {
      const response = await carrierAccessRequest<{ username: string | null; password: string }>(`/${entry.id}/${action}`, {
        method: 'POST',
        body: { account_id: dataset.agency.id, confirmed_reauth: true },
      })
      return response
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Carrier password could not be accessed')
      return null
    }
  }

  const copyCarrierPassword = async (entry: CarrierPortalEntry) => {
    const secret = await requestCarrierSecret(entry, 'copy-access')
    if (!secret?.password) return
    await copyToClipboard(secret.password, 'Password copied. Do not share this credential.')
  }

  const revealCarrierPassword = async (entry: CarrierPortalEntry) => {
    const secret = await requestCarrierSecret(entry, 'reveal-password')
    if (!secret?.password) return null
    showToast('Password revealed. Do not share this credential.')
    return secret.password
  }

  const openCarrierPortal = async (entry: CarrierPortalEntry, policy?: Policy, urlOverride?: string) => {
    const url = normalizeUrl(urlOverride ?? entry.portalUrl ?? entry.url)
    if (!url) {
      showToast('No carrier URL saved yet')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    if (policy?.policyNumber) {
      await navigator.clipboard.writeText(policy.policyNumber)
      showToast('Carrier portal opened. Policy number copied.')
    } else {
      showToast('Carrier portal opened')
    }
    if (supabase && supabaseFunctionsUrl && !entry.id.startsWith('portal-')) {
      carrierAccessRequest(`/${entry.id}/opened-portal`, {
        method: 'POST',
        body: { account_id: dataset.agency.id },
      }).catch(() => undefined)
    }
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

  const handleSignOut = async () => {
    setUserMenuOpen(false)

    if (!supabase) {
      showToast('Signed out of demo mode')
      setTimeout(() => window.location.reload(), 1500)
      return
    }

    const { data } = await supabase.auth.getUser()
    if (data.user?.id) {
      await clearSession(data.user.id)
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      showToast(error.message)
      return
    }

    showToast('Signed out')
  }

  const showToast = (message: string) => {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const saveAcordDraft = (draft: AcordDraft) => {
    setDataset((current) => ({
      ...current,
      acordDrafts: [
        draft,
        ...(current.acordDrafts ?? []).filter((item) => item.id !== draft.id),
      ],
    }))
    showToast('ACORD draft saved')
  }

  const markAcordGenerated = (draft: AcordDraft, fileName: string) => {
    setDataset((current) => ({
      ...current,
      acordDrafts: [
        draft,
        ...(current.acordDrafts ?? []).filter((item) => item.id !== draft.id),
      ],
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: draft.clientId,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'Underwriting',
          pinned: false,
          body: `${draft.formTitle} generated by ${current.currentUser.name} on ${new Date().toLocaleDateString()}${fileName ? ` (${fileName})` : ''}.`,
        },
        ...current.notes,
      ],
    }))
    showToast(`${draft.formTitle} generated`)
  }

  const openAcordForClient = (clientId: string) => {
    setAcordInitialClientId(clientId)
    setActiveView('acord')
  }

  const openClientFolder = (clientId: string, tab: ClientTab = 'Overview', returnView: AppView | null = null) => {
    setSelectedClientId(clientId)
    setClientTab(tab)
    setProfileReturnView(returnView)
    setActiveView('profile')
  }

  const openPolicyForEdit = (policy: Policy) => {
    setSelectedClientId(policy.clientId)
    setClientTab('Policies')
    setEditingPolicyId(policy.id)
    setActiveView('profile')
    setModal('editPolicy')
  }

  const addClientActivityEntry = (clientId: string, body: string) => {
    setDataset((current) => ({
      ...current,
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'General',
          pinned: false,
          body,
        },
        ...current.notes,
      ],
    }))
  }

  const openCloudFolder = (folder: ClientCloudFolder) => {
    window.open(folder.folderUrl, '_blank', 'noopener,noreferrer')
    addClientActivityEntry(folder.clientId, `Client document folder opened by ${dataset.currentUser.name}.`)
    showToast(`${cloudFolderProviderLabels[folder.provider]} folder opened`)
  }

  const copyCloudFolderLink = async (folder: ClientCloudFolder) => {
    await navigator.clipboard.writeText(folder.folderUrl)
    showToast('Cloud folder link copied')
  }

  const saveCloudFolder = (data: CloudFolderFormData) => {
    if (!selectedClient) return
    if (!canManageCloudFolders) {
      showToast('Only owner/admin users can manage cloud folders')
      return
    }
    if (!data.provider || !data.folderName.trim() || !data.folderUrl.trim() || !isValidCloudFolderUrl(data.folderUrl)) {
      showToast('Please enter a valid cloud folder URL.')
      return
    }
    const now = new Date().toISOString()
    const existingFolder = selectedClientCloudFolder
    const nextFolder: ClientCloudFolder = {
      id: existingFolder?.id ?? createRecordId('cloud-folder'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      provider: data.provider,
      folderName: data.folderName.trim(),
      folderUrl: data.folderUrl.trim(),
      folderId: data.folderId.trim() || undefined,
      notes: data.notes.trim() || undefined,
      connectedBy: existingFolder?.connectedBy ?? dataset.currentUser.name,
      createdAt: existingFolder?.createdAt ?? now,
      updatedAt: now,
      active: true,
    }
    setDataset((current) => ({
      ...current,
      clientCloudFolders: [
        nextFolder,
        ...(current.clientCloudFolders ?? [])
          .map((folder) => folder.id === nextFolder.id ? { ...folder, active: false } : folder)
          .filter((folder) => folder.id !== nextFolder.id),
      ],
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          createdByUserId: current.currentUser.id,
          createdAt: now,
          type: 'General',
          pinned: false,
          body: existingFolder
            ? 'Client document folder link updated.'
            : `${cloudFolderProviderLabels[data.provider]} folder connected by ${current.currentUser.name}.`,
        },
        ...current.notes,
      ],
    }))
    setModal(null)
    setClientTab('Documents')
    showToast(existingFolder ? 'Cloud folder link updated' : 'Cloud folder connected')
  }

  const removeCloudFolder = () => {
    if (!selectedClient || !selectedClientCloudFolder) return
    if (!canManageCloudFolders) {
      showToast('Only owner/admin users can remove cloud folders')
      return
    }
    const now = new Date().toISOString()
    setDataset((current) => ({
      ...current,
      clientCloudFolders: (current.clientCloudFolders ?? []).map((folder) =>
        folder.id === selectedClientCloudFolder.id ? { ...folder, active: false, updatedAt: now } : folder
      ),
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          createdByUserId: current.currentUser.id,
          createdAt: now,
          type: 'General',
          pinned: false,
          body: 'Client document folder removed.',
        },
        ...current.notes,
      ],
    }))
    showToast('Cloud folder link removed')
  }

  const createXDateFollowUp = (policy: Policy) => {
    setSelectedClientId(policy.clientId)
    setClientTab('Tasks')
    setActiveView('profile')
    setModal('addTask')
    showToast(`Follow-up ready for ${policy.policyType} x-date`)
  }

  const handleDashboardMetricClick = (metricId: Metric['id']) => {
    if (metricId === 'renewals') {
      setActiveView('renewals')
      return
    }
    if (metricId === 'leads') {
      setActiveView('leads')
      return
    }
    if (metricId === 'overdueTasks') {
      const task = overdueTasks[0]
      if (task?.clientId) {
        openClientFolder(task.clientId, 'Tasks')
      } else {
        setActiveView('clients')
      }
      return
    }
    const task = tasksDueToday[0]
    if (task?.clientId) {
      openClientFolder(task.clientId, 'Tasks')
    } else {
      setActiveView('clients')
    }
  }

  const handleWorkbenchAction = (action: WorkbenchAction) => {
    if (action.type === 'renewals') {
      setActiveView('renewals')
      return
    }
    if (action.type === 'leads') {
      setActiveView('leads')
      return
    }
    if (action.type === 'edit-policy') {
      const policy = dataset.policies.find((item) => item.id === action.policyId)
      if (policy) openPolicyForEdit(policy)
      return
    }
    openClientFolder(action.clientId, action.tab)
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
    coverageDetails: PolicyCoverageDetails
  }) => {
    if (!selectedClient) return
    const newPolicy: Policy = {
      id: createRecordId('policy'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      policyType: data.policyType,
      carrier: data.carrier,
      policyNumber: data.policyNumber || undefined,
      premium: parseMoneyInput(data.premium),
      commissionRate: parseFloat(data.commissionRate) || 0,
      effectiveDate: parseDisplayDate(data.effectiveDate) || undefined,
      expirationDate: parseDisplayDate(data.expirationDate),
      billingType: data.billingType as 'Direct Bill' | 'Agency Bill' | 'Financed' | undefined,
      lineOfBusiness: data.lineOfBusiness as 'Commercial' | 'Personal lines' | 'Life & health' | undefined,
      coverageDetails: data.coverageDetails,
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

  const addRelatedParty = (data: Omit<RelatedParty, 'id' | 'accountId' | 'clientId'>) => {
    if (!selectedClient) return
    const newParty: RelatedParty = {
      id: createRecordId('party'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      ...data,
      policyId: data.policyId || undefined,
      contactName: data.contactName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      referenceNumber: data.referenceNumber || undefined,
      preference: data.preference || undefined,
      notes: data.notes || undefined,
    }
    setDataset((current) => ({
      ...current,
      relatedParties: [newParty, ...(current.relatedParties ?? [])],
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'General',
          pinned: false,
          body: `Related party added: ${newParty.name} (${newParty.type}).`,
        },
        ...current.notes,
      ],
    }))
    setModal(null)
    setClientTab('Contact & Account')
    showToast(`Related party added: ${newParty.name}`)
  }

  const addPolicyTransaction = (policyId: string, data: Omit<PolicyTransaction, 'id' | 'accountId' | 'clientId' | 'policyId'>) => {
    const policy = dataset.policies.find((item) => item.id === policyId)
    if (!selectedClient || !policy) return
    const newTransaction: PolicyTransaction = {
      id: createRecordId('txn'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      policyId,
      ...data,
      effectiveDate: parseDisplayDate(data.effectiveDate ?? '') || undefined,
      requestedDate: parseDisplayDate(data.requestedDate ?? '') || undefined,
      completedDate: parseDisplayDate(data.completedDate ?? '') || undefined,
      carrierContact: data.carrierContact || undefined,
      requestedBy: data.requestedBy || undefined,
      notes: data.notes || undefined,
    }
    setDataset((current) => ({
      ...current,
      policyTransactions: [newTransaction, ...(current.policyTransactions ?? [])],
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'General',
          pinned: false,
          body: `${newTransaction.type} transaction added for ${policy.policyType}: ${newTransaction.description}.`,
        },
        ...current.notes,
      ],
    }))
    setModal(null)
    setTransactionPolicyId(null)
    setClientTab('Policies')
    showToast(`${newTransaction.type} transaction added`)
  }

  const addClaim = (data: Omit<ClaimRecord, 'id' | 'accountId' | 'clientId'> & { createFollowUpTask?: boolean }) => {
    if (!selectedClient) return
    const newClaim: ClaimRecord = {
      id: createRecordId('claim'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      policyId: data.policyId || undefined,
      claimNumber: data.claimNumber || undefined,
      carrierClaimNumber: data.carrierClaimNumber || undefined,
      dateOfLoss: parseDisplayDate(data.dateOfLoss),
      reportedDate: parseDisplayDate(data.reportedDate ?? '') || undefined,
      status: data.status,
      adjusterName: data.adjusterName || undefined,
      adjusterPhone: data.adjusterPhone || undefined,
      adjusterEmail: data.adjusterEmail || undefined,
      paidAmount: data.paidAmount,
      reserveAmount: data.reserveAmount,
      description: data.description,
      documentsStatus: data.documentsStatus,
      includeInLossRuns: data.includeInLossRuns,
      followUpDate: parseDisplayDate(data.followUpDate ?? '') || undefined,
      notes: data.notes || undefined,
    }
    setDataset((current) => ({
      ...current,
      claims: [newClaim, ...(current.claims ?? [])],
      tasks: data.createFollowUpTask && newClaim.followUpDate ? [
        {
          id: createRecordId('task'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          relatedPolicyId: newClaim.policyId,
          assignedToUserId: current.currentUser.id,
          createdByUserId: current.currentUser.id,
          title: `Claim follow-up: ${newClaim.claimNumber ?? newClaim.carrierClaimNumber ?? 'New claim'}`,
          description: newClaim.description,
          dueLabel: formatDate(newClaim.followUpDate),
          dueDate: newClaim.followUpDate,
          priority: 'High',
          completed: false,
          status: 'Open',
        },
        ...current.tasks,
      ] : current.tasks,
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId: selectedClient.id,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'Claim',
          pinned: newClaim.status !== 'Closed',
          body: `Claim added: ${newClaim.description}. Loss date ${formatDate(newClaim.dateOfLoss)}.`,
        },
        ...current.notes,
      ],
    }))
    setModal(null)
    setClientTab('Claims')
    showToast('Claim added to client file')
  }

  const addRiskAsset = (data: Omit<RiskAsset, 'id' | 'accountId' | 'clientId'>) => {
    if (!selectedClient) return
    const newAsset: RiskAsset = {
      id: createRecordId('asset'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      ...data,
      policyId: data.policyId || undefined,
      address: data.address || undefined,
      annualMileage: data.annualMileage || undefined,
      payroll: data.payroll || undefined,
      annualSales: data.annualSales || undefined,
      squareFootage: data.squareFootage || undefined,
      notes: data.notes || undefined,
    }
    setDataset((current) => ({
      ...current,
      riskAssets: [newAsset, ...(current.riskAssets ?? [])],
    }))
    setModal(null)
    setClientTab('Overview')
    showToast(`${newAsset.type} added`)
  }

  const addPayment = (data: Omit<PaymentLedgerEntry, 'id' | 'accountId' | 'clientId'>) => {
    if (!selectedClient) return
    const newPayment: PaymentLedgerEntry = {
      id: createRecordId('pay'),
      accountId: dataset.agency.id,
      clientId: selectedClient.id,
      ...data,
      policyId: data.policyId || undefined,
      paymentDate: parseDisplayDate(data.paymentDate),
      amount: data.amount,
      referenceNumber: data.referenceNumber || undefined,
      receiptNumber: data.receiptNumber || undefined,
      remitTo: data.remitTo || undefined,
      remittanceDueDate: parseDisplayDate(data.remittanceDueDate ?? '') || undefined,
      carrierPayableAmount: data.carrierPayableAmount,
      remittanceStatus: data.remittanceStatus,
      notes: data.notes || undefined,
    }
    setDataset((current) => ({
      ...current,
      paymentLedger: [newPayment, ...(current.paymentLedger ?? [])],
    }))
    setModal(null)
    setClientTab('Billing')
    showToast('Payment ledger entry added')
  }

  const addBinderEntry = (data: BinderEntryFormData) => {
    const existingClient = data.clientMode === 'existing'
      ? dataset.clients.find((client) => client.id === data.clientId)
      : null
    const clientId = existingClient?.id ?? createRecordId('client')
    const premium = parseMoneyInput(data.premium)
    const paymentTaken = parseMoneyInput(data.paymentTaken)
    const effectiveDate = parseDisplayDate(data.effectiveDate)
    const expirationDate = parseDisplayDate(data.expirationDate)
    const binderYear = getBinderLogYear(effectiveDate)
    const binderNumber = getNextBinderNumberForYear(binderYear, dataset.policyTransactions ?? [])
    const newClient: Client | null = existingClient ? null : {
      id: clientId,
      accountId: dataset.agency.id,
      ownerUserId: dataset.currentUser.id,
      name: data.clientName,
      primaryContact: data.primaryContact || data.clientName,
      status: 'Client',
      accountStatus: 'Active',
      lineOfBusiness: data.lineOfBusiness as Client['lineOfBusiness'],
      email: data.email || undefined,
      phone: data.phone || undefined,
      policyCount: 0,
      annualRevenue: 0,
      health: 'Strong',
      clientSince: new Date().toISOString().slice(0, 10),
    }
    const newPolicy: Policy = {
      id: createRecordId('policy'),
      accountId: dataset.agency.id,
      clientId,
      carrier: data.carrier,
      policyType: data.policyType,
      policyNumber: data.policyNumber || undefined,
      lineOfBusiness: data.lineOfBusiness as Policy['lineOfBusiness'],
      effectiveDate,
      expirationDate,
      premium,
      billingType: paymentTaken > 0 ? 'Agency Bill' : 'Direct Bill',
      paymentStatus: paymentTaken > 0 ? 'Current' : 'Due soon',
      status: 'Bound',
      producerUserId: dataset.currentUser.id,
      notes: data.binderNotes || undefined,
    }
    const binderTransaction: PolicyTransaction = {
      id: createRecordId('txn'),
      accountId: dataset.agency.id,
      clientId,
      policyId: newPolicy.id,
      type: 'Binder',
      status: 'Completed',
      effectiveDate,
      requestedDate: new Date().toISOString().slice(0, 10),
      completedDate: new Date().toISOString().slice(0, 10),
      premiumChange: premium,
      binderNumber,
      description: `Binder Log #${binderNumber} entered for ${data.policyType} with ${data.carrier}.`,
      requestedBy: dataset.currentUser.name,
      notes: data.binderNotes || undefined,
    }
    const paymentEntry: PaymentLedgerEntry | null = paymentTaken > 0 ? {
      id: createRecordId('pay'),
      accountId: dataset.agency.id,
      clientId,
      policyId: newPolicy.id,
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: paymentTaken,
      method: data.paymentMethod,
      postedBy: dataset.currentUser.name,
      status: 'Posted',
      remitTo: data.remitTo || data.carrier,
      remittanceDueDate: parseDisplayDate(data.remittanceDueDate) || undefined,
      carrierPayableAmount: paymentTaken,
      remittanceStatus: 'Needs Remittance',
      notes: `Payment captured from Binder Log #${binderNumber}.`,
    } : null
    setDataset((current) => ({
      ...current,
      clients: newClient ? [newClient, ...current.clients] : current.clients,
      policies: [newPolicy, ...current.policies],
      policyTransactions: [binderTransaction, ...(current.policyTransactions ?? [])],
      paymentLedger: paymentEntry ? [paymentEntry, ...(current.paymentLedger ?? [])] : current.paymentLedger,
      notes: [
        {
          id: createRecordId('note'),
          accountId: current.agency.id,
          clientId,
          createdByUserId: current.currentUser.id,
          createdAt: new Date().toISOString(),
          type: 'General',
          pinned: true,
          body: `Binder Log #${binderNumber}: ${newPolicy.policyType} with ${newPolicy.carrier}, premium ${currency.format(newPolicy.premium)}.`,
        },
        ...current.notes,
      ],
    }))
    setSelectedClientId(clientId)
    setModal(null)
    setActiveView('binder')
    showToast('Binder logged and client folder updated')
  }

  const editBinderEntry = (binderEntryId: string, data: BinderEntryFormData) => {
    const premium = parseMoneyInput(data.premium)
    const paymentTaken = parseMoneyInput(data.paymentTaken)
    const effectiveDate = parseDisplayDate(data.effectiveDate)
    const expirationDate = parseDisplayDate(data.expirationDate)
    const today = new Date().toISOString().slice(0, 10)

    setDataset((current) => {
      const existingTransaction = (current.policyTransactions ?? []).find((transaction) => transaction.id === binderEntryId)
      const policyId = existingTransaction?.policyId ?? binderEntryId.replace(/^bound-/, '')
      const existingPolicy = current.policies.find((policy) => policy.id === policyId)
      if (!existingPolicy) return current

      const clientId = data.clientId || existingPolicy.clientId
      const binderYear = getBinderLogYear(effectiveDate)
      const binderNumber = existingTransaction?.binderNumber && existingTransaction.binderNumber !== 'Unnumbered'
        ? existingTransaction.binderNumber
        : getNextBinderNumberForYear(binderYear, current.policyTransactions ?? [])
      const binderDescription = `Binder Log #${binderNumber} updated for ${data.policyType} with ${data.carrier}.`
      const existingBinderPayment = (current.paymentLedger ?? []).find((payment) => payment.policyId === policyId && payment.notes?.toLowerCase().includes('binder log'))
      const updatedPolicies = current.policies.map((policy) =>
        policy.id === policyId
          ? {
              ...policy,
              clientId,
              carrier: data.carrier,
              policyType: data.policyType,
              policyNumber: data.policyNumber || undefined,
              lineOfBusiness: data.lineOfBusiness as Policy['lineOfBusiness'],
              effectiveDate,
              expirationDate,
              premium,
              billingType: paymentTaken > 0 ? 'Agency Bill' : policy.billingType,
              paymentStatus: paymentTaken > 0 ? 'Current' : policy.paymentStatus,
              status: 'Bound' as Policy['status'],
              notes: data.binderNotes || policy.notes,
            }
          : policy
      )
      const updatedTransaction: PolicyTransaction = {
        ...(existingTransaction ?? {
          id: createRecordId('txn'),
          accountId: current.agency.id,
          policyId,
          type: 'Binder',
          requestedDate: today,
          requestedBy: current.currentUser.name,
        }),
        clientId,
        policyId,
        type: 'Binder',
        status: 'Completed',
        effectiveDate,
        completedDate: today,
        premiumChange: premium,
        binderNumber,
        description: binderDescription,
        requestedBy: existingTransaction?.requestedBy ?? current.currentUser.name,
        notes: data.binderNotes || undefined,
      }
      const policyTransactions = existingTransaction
        ? (current.policyTransactions ?? []).map((transaction) => transaction.id === binderEntryId ? updatedTransaction : transaction)
        : [updatedTransaction, ...(current.policyTransactions ?? [])]

      let paymentLedger = current.paymentLedger ?? []
      if (existingBinderPayment) {
        paymentLedger = paymentLedger.map((payment) =>
          payment.id === existingBinderPayment.id
            ? {
                ...payment,
                clientId,
                policyId,
                amount: paymentTaken,
                method: data.paymentMethod,
                remitTo: data.remitTo || data.carrier,
                remittanceDueDate: parseDisplayDate(data.remittanceDueDate) || undefined,
                carrierPayableAmount: paymentTaken,
                remittanceStatus: paymentTaken > 0 ? payment.remittanceStatus ?? 'Needs Remittance' : 'Not Due',
                notes: `Payment captured from Binder Log #${binderNumber}.`,
              }
            : payment
        )
      } else if (paymentTaken > 0) {
        paymentLedger = [
          {
            id: createRecordId('pay'),
            accountId: current.agency.id,
            clientId,
            policyId,
            paymentDate: today,
            amount: paymentTaken,
            method: data.paymentMethod,
            postedBy: current.currentUser.name,
            status: 'Posted',
            remitTo: data.remitTo || data.carrier,
            remittanceDueDate: parseDisplayDate(data.remittanceDueDate) || undefined,
            carrierPayableAmount: paymentTaken,
            remittanceStatus: 'Needs Remittance',
            notes: `Payment captured from Binder Log #${binderNumber}.`,
          },
          ...paymentLedger,
        ]
      }

      return {
        ...current,
        policies: updatedPolicies,
        policyTransactions,
        paymentLedger,
      }
    })
    setModal(null)
    setEditingBinderEntryId(null)
    setActiveView('binder')
    showToast('Binder Log entry updated')
  }

  const updateRemittanceStatus = (paymentId: string, status: NonNullable<PaymentLedgerEntry['remittanceStatus']>) => {
    setDataset((current) => ({
      ...current,
      paymentLedger: (current.paymentLedger ?? []).map((payment) =>
        payment.id === paymentId ? { ...payment, remittanceStatus: status } : payment
      ),
    }))
    showToast(`Remittance marked ${status.toLowerCase()}`)
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
      stage: data.stage as OpportunityStage,
      estimatedPremium: parseMoneyInput(data.estimatedPremium),
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
              preferredContactMethod: (data.preferredContactMethod || undefined) as 'Phone' | 'Email' | 'Portal' | undefined,
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
    lineOfBusiness: string
    paymentPlan: string
    paymentStatus: string
    renewalStatus: string
    mortgageeOrLienholder: string
    status: string
    coverageDetails: PolicyCoverageDetails
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
              premium: parseMoneyInput(data.premium) || p.premium,
              commissionRate: parseFloat(data.commissionRate) || p.commissionRate,
              effectiveDate: parseDisplayDate(data.effectiveDate) || p.effectiveDate,
              expirationDate: parseDisplayDate(data.expirationDate) || p.expirationDate,
              billingType: (data.billingType || undefined) as 'Direct Bill' | 'Agency Bill' | 'Financed' | undefined,
              lineOfBusiness: (data.lineOfBusiness || undefined) as Policy['lineOfBusiness'],
              paymentPlan: data.paymentPlan || undefined,
              paymentStatus: (data.paymentStatus || undefined) as Policy['paymentStatus'],
              renewalStatus: (data.renewalStatus || undefined) as Policy['renewalStatus'],
              mortgageeOrLienholder: data.mortgageeOrLienholder || undefined,
              status: data.status as Policy['status'],
              coverageDetails: data.coverageDetails,
              notes: data.notes || undefined,
            }
          : p
      ),
    }))
    setModal(null)
    setEditingPolicyId(null)
    showToast('Policy updated')
  }

  const updatePolicyCoverageDetails = (policyId: string, coverageDetails: PolicyCoverageDetails) => {
    setDataset((current) => ({
      ...current,
      policies: current.policies.map((p) =>
        p.id === policyId ? { ...p, coverageDetails } : p
      ),
    }))
    setModal(null)
    setCoveragePolicyId(null)
    showToast('Coverage details updated')
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
    const val = parseMoneyInput(premiumStr)
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
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ─── Renewal center computed ─────────────────────────────────
  const renewalPolicies = dataset.policies
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
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-mode={mode} data-palette={palette === 'system' ? systemAccentPalette : palette} data-system={palette === 'system' ? 'true' : undefined}>
      <aside className="sidebar">
        <div className="logo-wrap sidebar-logo">
          <div className="logo-button">
            <img src={agencyIqLogo} alt="AgencyIQ Insurance CRM" />
          </div>
        </div>
        <button
          className="sidebar-collapse-button"
          type="button"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={18} aria-hidden="true" />
          <span>{sidebarCollapsed ? 'Expand' : 'Collapse'}</span>
        </button>

        <nav className="nav-list" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={[
                  'nav-item',
                  (item.label === 'Dashboard' && activeView === 'dashboard') ||
                  (item.label === 'Clients' && ['clients', 'profile', 'ivans'].includes(activeView)) ||
                  (item.label === 'ACORD Forms' && activeView === 'acord') ||
                  (item.label === 'Binder Log' && activeView === 'binder') ||
                  (item.label === 'Leads' && activeView === 'leads') ||
                  (item.label === 'Renewals' && activeView === 'renewals') ||
                  (item.label === 'Data Center' && activeView === 'data') ||
                  (item.label === 'Administration' && ['admin', 'data'].includes(activeView))
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
                  if (item.label === 'ACORD Forms') {
                    setAcordInitialClientId('')
                    setActiveView('acord')
                  }
                  if (item.label === 'Binder Log') {
                    setActiveView('binder')
                  }
                  if (item.label === 'Renewals') {
                    setActiveView('renewals')
                  }
                  if (item.label === 'Data Center') {
                    setActiveView('data')
                  }
                  if (item.label === 'Administration' && canSeeOwnerAnalytics) {
                    setActiveView('admin')
                  }
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <BriefcaseBusiness size={16} aria-hidden="true" />
            <strong>{dataset.agency.name}</strong>
          </div>
          <span>{dataset.currentUser.name}</span>
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
          <div className="topbar-brand">
            <img src={agencyIqLogo} alt="" aria-hidden="true" />
            <div>
              <strong>AgencyIQ</strong>
              <span>{dataset.currentUser.name}</span>
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
                        className={`scheme-option${palette === theme.id ? ' active' : ''}${theme.isSystem ? ' scheme-option--system' : ''}`}
                        type="button"
                        key={theme.id}
                        aria-pressed={palette === theme.id}
                        onClick={() => setPalette(theme.id)}
                      >
                        {theme.isSystem ? (
                          <span className="scheme-system-icon" aria-hidden="true">
                            <Monitor size={14} />
                          </span>
                        ) : (
                          <span className="scheme-swatches" aria-hidden="true">
                            {theme.colors.map((color) => (
                              <span key={color} style={{ background: color }} />
                            ))}
                          </span>
                        )}
                        <span>{theme.label}</span>
                        {theme.isSystem && palette === 'system' && (
                          <span className="scheme-system-matched">
                            {themeOptions.find(t => t.id === systemAccentPalette)?.label}
                          </span>
                        )}
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
              <span>{dataset.currentUser.initials}</span>
              <b>{dataset.currentUser.name}</b>
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
                  onClick={handleSignOut}
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
            onOpenIvans={() => {
              if (ivansFeatureEnabled) setActiveView('ivans')
            }}
            ivansLastGlobalSync={ivansLastGlobalSync}
            ivansFeatureEnabled={ivansFeatureEnabled}
            showToast={showToast}
            currency={currency}
            formatDate={formatDate}
            formatFullDate={formatFullDate}
            getUserName={(id) => getUserName(dataset, id)}
          />
        ) : activeView === 'data' && canSeeOwnerAnalytics ? (
          <DataCenter
            dataset={dataset}
            supabaseConfigured={Boolean(supabase)}
            onDownloadLocalExport={() => {
              downloadJsonExport(dataset)
              showToast('Full AgencyIQ JSON export downloaded')
            }}
            onImportPortableJson={async (file) => {
              try {
                const imported = parsePortableDataset(await file.text())
                setDataset(imported)
                setSelectedClientId(imported.clients[0]?.id ?? '')
                setClientTab('Overview')
                setActiveView('data')
                showToast(`Imported ${imported.clients.length} clients and ${imported.policies.length} policies from ${file.name}`)
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Could not import that JSON file')
              }
            }}
            onClearLocalData={() => {
              const emptyDataset: CrmDataset = {
                ...dataset,
                clients: [],
                policies: [],
                renewals: [],
                tasks: [],
                opportunities: [],
                quoteRequests: [],
                carrierResources: [],
                notes: [],
                relatedParties: [],
                policyTransactions: [],
                claims: [],
                riskAssets: [],
                paymentLedger: [],
                commissionStatements: [],
                acordDrafts: [],
                clientCloudFolders: [],
              }
              setDataset(emptyDataset)
              setSelectedClientId('')
              setClientTab('Overview')
              setActiveView('data')
              showToast('Local CRM client data cleared')
            }}
            onCreateSupabaseExport={async () => {
              if (!supabase) {
                showToast('Supabase is not configured for export jobs yet')
                return
              }
              if (!isUuid(dataset.agency.id)) {
                showToast('Demo agency id is local only. Create a production agency account before queueing Supabase exports.')
                return
              }
              try {
                await createExportJob(supabase, dataset.agency.id)
                showToast('Supabase export job queued')
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Could not queue export job')
              }
            }}
            onCreateImportBatch={async (file, preview, mapping) => {
              if (!supabase) {
                showToast('CSV mapped locally. Connect Supabase to stage imports.')
                return
              }
              if (!isUuid(dataset.agency.id)) {
                showToast('CSV mapped locally. Production import staging needs a Supabase agency UUID.')
                return
              }
              try {
                await createImportBatch(supabase, dataset.agency.id, file, preview, mapping)
                showToast('Import batch staged in Supabase')
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Could not stage import batch')
              }
            }}
          />
        ) : activeView === 'acord' ? (
          <AcordFormsPanel
            key={acordInitialClientId || selectedClientId || 'acord'}
            clients={dataset.clients}
            policies={dataset.policies}
            agencyName={dataset.agency.name}
            currentUser={dataset.currentUser}
            users={dataset.users}
            drafts={dataset.acordDrafts ?? []}
            initialClientId={acordInitialClientId || selectedClientId}
            onSaveDraft={saveAcordDraft}
            onGenerated={markAcordGenerated}
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
                    <h2>Pipeline queue</h2>
                    <p>Prospects and quote opportunities grouped by working stage.</p>
                  </div>
                  <span className="status-pill">{activeLeadCount} active</span>
                </div>
                <div className={draggingLeadId ? 'lead-kanban-board lead-kanban-board--dragging' : 'lead-kanban-board'} aria-label="Lead pipeline stages">
                  {leadPipelineStages.map((stage) => {
                    const stageLeads = dataset.opportunities.filter((lead) => lead.stage === stage.id)
                    const stageValue = stageLeads.reduce((sum, lead) => sum + lead.estimatedPremium, 0)
                    return (
                      <section className="lead-kanban-column" key={stage.id}>
                        <div className="lead-kanban-column-header">
                          <div className="lead-kanban-title">
                            <span className={`lead-stage-dot lead-stage-dot--${stage.accent}`} />
                            <h3>{stage.label}</h3>
                            <span>({stageLeads.length})</span>
                          </div>
                          <strong>{currency.format(stageValue)}</strong>
                        </div>
                        <div
                          className={[
                            'lead-kanban-dropzone',
                            dragOverLeadStage === stage.id ? 'lead-kanban-dropzone--over' : '',
                          ].filter(Boolean).join(' ')}
                          onDragOver={(event) => {
                            event.preventDefault()
                            setDragOverLeadStage(stage.id)
                          }}
                          onDragLeave={(event) => {
                            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                            setDragOverLeadStage(null)
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            setDraggingLeadId(null)
                            setDragOverLeadStage(null)
                            const nextStage = stage.id
                            const leadId = event.dataTransfer.getData('text/plain')
                            const lead = dataset.opportunities.find((item) => item.id === leadId)
                            if (!lead || lead.stage === nextStage) return
                            setDataset((current) => ({
                              ...current,
                              opportunities: current.opportunities.map((item) =>
                                item.id === leadId ? { ...item, stage: nextStage } : item,
                              ),
                            }))
                            showToast(`${lead.clientName} moved to ${stage.label}`)
                          }}
                        >
                          {stageLeads.map((opportunity) => {
                            const matchedClient = dataset.clients.find((client) => client.name === opportunity.clientName)
                            return (
                              <article
                                className={draggingLeadId === opportunity.id ? 'lead-kanban-card lead-kanban-card--dragging' : 'lead-kanban-card'}
                                draggable
                                key={opportunity.id}
                                onDragStart={(event) => {
                                  setDraggingLeadId(opportunity.id)
                                  event.dataTransfer.setData('text/plain', opportunity.id)
                                  event.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragEnd={() => {
                                  setDraggingLeadId(null)
                                  setDragOverLeadStage(null)
                                }}
                              >
                                <div className="lead-card-topline">
                                  <strong>{opportunity.clientName}</strong>
                                  <span>{currency.format(opportunity.estimatedPremium)}</span>
                                </div>
                                <p>{stage.description}</p>
                                <div className="lead-card-meta">
                                  <span>Producer referral</span>
                                  <span>{getUserName(dataset, opportunity.ownerUserId)}</span>
                                </div>
                                <div className="lead-action-row">
                                  <button className="utility-action" type="button" onClick={() => showToast(`${opportunity.clientName} lead opened`)}>Open</button>
                                  <button className="utility-action" type="button" onClick={() => openPhoneDialer(matchedClient?.phone)}>Call</button>
                                  <button className="utility-action" type="button" onClick={() => openEmailClient(matchedClient?.email, `Quote follow-up for ${opportunity.clientName}`)}>Email</button>
                                  {opportunity.stage === 'Bound'
                                    ? <button className="primary-action" type="button" onClick={() => setModal('addClient')}>Convert</button>
                                    : <button className="secondary-action" type="button" onClick={() => showToast(`Follow-up created for ${opportunity.clientName}`)}>Follow-Up</button>}
                                </div>
                              </article>
                            )
                          })}
                          {stageLeads.length === 0 && (
                            <div className="lead-kanban-empty">
                              {stage.id === 'Lost' ? 'No lost leads yet.' : `No leads in ${stage.label}.`}
                            </div>
                          )}
                        </div>
                      </section>
                    )
                  })}
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
                <div className="table-wrap xdate-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Policy</th>
                        <th>Prior Carrier</th>
                        <th>Last Renewal Ended</th>
                        <th>Premium</th>
                        <th>Marketing Window</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {xDatePolicies.map((policy) => {
                        const client = dataset.clients.find((item) => item.id === policy.clientId)
                        const marketingStatus = getXDateMarketingStatus(policy.expirationDate)
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
                            <td><span className={`xdate-window-badge ${marketingStatus.className}`}>{marketingStatus.label}</span></td>
                            <td>
                              <div className="xdate-action-row">
                                <button
                                  className="utility-action"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openClientFolder(policy.clientId, 'Policies')
                                  }}
                                >
                                  Open
                                </button>
                                <button
                                  className="utility-action"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openPolicyForEdit(policy)
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="secondary-action"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    createXDateFollowUp(policy)
                                  }}
                                >
                                  Follow-Up
                                </button>
                                <button
                                  className="primary-action"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    createXDateFollowUp(policy)
                                  }}
                                >
                                  Start Outreach
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
                  {ivansFeatureEnabled && ivansLastGlobalSync && <span className="ivans-global-sync-note"> · IVANS synced {formatDate(ivansLastGlobalSync)}</span>}
                </p>
              </div>
              <div className="clients-page-actions">
                {ivansFeatureEnabled && (
                  <button className="utility-action ivans-launch-btn" type="button" onClick={() => setActiveView('ivans')}>
                    <Zap size={15} /> IVANS Sync
                  </button>
                )}
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
                      <span>{filter}</span>
                      <strong>{getClientFilterCount(filter)}</strong>
                    </button>
                  ))}
                  {(clientFilter !== 'All' || clientSearch.trim() || clientSort !== 'name-asc') && (
                    <button
                      className="filter-clear"
                      type="button"
                      onClick={() => {
                        setClientFilter('All')
                        setClientSearch('')
                        setClientSort('name-asc')
                        setClientPage(0)
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
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
                  const clientTasksForCard = dataset.tasks.filter((task) => task.clientId === client.id && !task.completed)
                  const clientNotesForCard = dataset.notes.filter((note) => note.clientId === client.id)
                  const clientDocumentsForCard = buildClientDocuments(client.id, policies)
                  const nextRenewal = activePolicies
                    .map((policy) => policy.expirationDate)
                    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]
                  const totalPremium = policies.reduce((total, policy) => total + policy.premium, 0)
                  const hasRenewalDue = dataset.renewals.some((r) => r.clientId === client.id)
                  const status = client.accountStatus ?? client.status
                  const renewalUrgency = getRenewalUrgency(nextRenewal, activePolicies.length, todayIso)
                  const TypeIcon = client.lineOfBusiness === 'Commercial' ? BriefcaseBusiness : Home
                  const assignedUserId = client.assignedProducerId ?? client.assignedCsrId ?? client.ownerUserId
                  const assignedUser = dataset.users.find((user) => user.id === assignedUserId)
                  const assignedName = assignedUser?.name ?? getUserName(dataset, assignedUserId ?? '')
                  const lastContact = client.lastContactedAt
                    ? formatDate(client.lastContactedAt.slice(0, 10))
                    : clientNotesForCard[0]?.createdAt
                      ? formatDate(clientNotesForCard[0].createdAt.slice(0, 10))
                      : 'No contact'
                  const premiumTier = getPremiumTier(totalPremium)
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
                        <span className="folder-card-type">
                          <TypeIcon size={13} aria-hidden="true" />
                          {getClientTypeLabel(client.lineOfBusiness)}
                        </span>
                        <div className="folder-card-tab-right">
                          {ivansFeatureEnabled && latestSync && (
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
                          <span className="folder-card-secondary">{client.email ?? client.mailingAddress ?? 'No email on file'}</span>
                          <span className="folder-agent-chip">
                            <b>{assignedUser?.initials ?? getInitials(assignedName)}</b>
                            {assignedName}
                          </span>
                        </div>
                        <div className="folder-card-stats">
                          <div className="folder-stat">
                            <span><ShieldCheck size={13} aria-hidden="true" /> Policies</span>
                            <strong>{activePolicies.length} active</strong>
                          </div>
                          <div className={`folder-stat folder-stat-premium folder-stat-premium--${premiumTier}`}>
                            <span><CircleDollarSign size={13} aria-hidden="true" /> Premium</span>
                            <strong>{compactCurrency.format(totalPremium)}</strong>
                          </div>
                          <div className="folder-stat">
                            <span><CalendarClock size={13} aria-hidden="true" /> Next renewal</span>
                            <strong className={`folder-renewal-date folder-renewal-date--${renewalUrgency.className}${hasRenewalDue ? ' folder-stat-alert' : ''}`}>
                              {nextRenewal ? formatDate(nextRenewal) : 'None'}
                              <em>{renewalUrgency.label}</em>
                            </strong>
                          </div>
                        </div>
                        <div className="folder-card-footer">
                          <span className="folder-card-phone"><PhoneCall size={13} aria-hidden="true" />{client.phone ?? client.email ?? 'No contact on file'}</span>
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
                        <div className="folder-card-details" aria-hidden="true">
                          <div><span><ShieldCheck size={12} aria-hidden="true" /> Policies</span><strong>{policies.slice(0, 3).map((policy) => policy.policyType).join(', ') || 'No policies'}</strong></div>
                          <div><span><CalendarClock size={12} aria-hidden="true" /> Last contact</span><strong>{lastContact}</strong></div>
                          <div><span><ClipboardCheck size={12} aria-hidden="true" /> Open tasks</span><strong>{clientTasksForCard.length}</strong></div>
                          <div><span><FileText size={12} aria-hidden="true" /> Documents</span><strong>{clientDocumentsForCard.filter((doc) => doc.status === 'Current').length}/{clientDocumentsForCard.length || 1} current</strong></div>
                          <p>{clientNotesForCard[0]?.body ?? client.notes ?? 'No recent note on this folder.'}</p>
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
              {filteredClients.length > 0 && (
                <div className="folder-pagination">
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={normalizedClientPage === 0}
                    onClick={() => setClientPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <div className="pagination-pages" aria-label="Client pages">
                    {paginationPages.map((page, index) => (
                      <React.Fragment key={page}>
                        {index > 0 && page - paginationPages[index - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                        <button
                          className={normalizedClientPage === page ? 'pagination-page active' : 'pagination-page'}
                          type="button"
                          aria-current={normalizedClientPage === page ? 'page' : undefined}
                          onClick={() => setClientPage(page)}
                        >
                          {page + 1}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="pagination-info">
                    Page {normalizedClientPage + 1} of {totalPages} - {filteredClients.length} folders
                  </span>
                  <label className="pagination-control">
                    <span>Jump</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={normalizedClientPage + 1}
                      onChange={(event) => {
                        const nextPage = Math.min(Math.max(Number(event.target.value || 1), 1), totalPages)
                        setClientPage(nextPage - 1)
                      }}
                    />
                  </label>
                  <label className="pagination-control">
                    <span>Rows</span>
                    <select
                      value={clientPageSize}
                      onChange={(event) => {
                        setClientPageSize(Number(event.target.value))
                        setClientPage(0)
                      }}
                    >
                      {[12, 24, 48, 96].map((size) => <option value={size} key={size}>{size}</option>)}
                    </select>
                  </label>
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={normalizedClientPage >= totalPages - 1}
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
                  onClick={() => {
                    setActiveView(profileReturnView ?? 'clients')
                    setProfileReturnView(null)
                  }}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  {profileReturnView === 'binder' ? 'Back to Binder Log' : 'All folders'}
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
                  if (!ivansFeatureEnabled || !latest) return null
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
                {folderActions.length > 0 && (
                  <div className="folder-next-actions">
                    <span className="folder-next-actions-label"><Sparkles size={13} /> Next best actions</span>
                    {folderActions.map((item) => (
                      <button
                        className={`folder-next-action folder-next-action--${item.priority}`}
                        type="button"
                        key={item.id}
                        onClick={() => {
                          if (item.action === 'Open Tasks') setClientTab('Tasks')
                          if (item.action === 'Review Policies') setClientTab('Policies')
                          if (item.action === 'Open Documents') setClientTab('Documents')
                          if (item.action === 'Open Claims') setClientTab('Claims')
                          if (item.action === 'Edit Client') setModal('editClient')
                        }}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="action-group primary-action-group">
                  <button className="primary-action" type="button" onClick={() => setModal('addPolicy')}>Add Policy</button>
                  <button className="primary-action" type="button" onClick={() => openAcordForClient(selectedClient.id)}>Create ACORD</button>
                  <button className="secondary-action" type="button" onClick={() => {
                    if (selectedClientCloudFolder) {
                      openCloudFolder(selectedClientCloudFolder)
                    } else {
                      setClientTab('Documents')
                      showToast('No cloud folder connected yet.')
                    }
                  }}>
                    <FolderOpen size={15} /> Open Documents
                  </button>
                  <div className="more-actions-wrap">
                    <button className="utility-action" type="button" aria-expanded={clientMoreActionsOpen} onClick={() => setClientMoreActionsOpen((open) => !open)}>
                      More Actions <ChevronDown size={14} />
                    </button>
                    {clientMoreActionsOpen && (
                      <div className="more-actions-menu">
                        <button type="button" onClick={() => { setModal('editClient'); setClientMoreActionsOpen(false) }}>Edit Client</button>
                        <button type="button" onClick={() => { setModal('addTask'); setClientMoreActionsOpen(false) }}>Add Task</button>
                        <button type="button" onClick={() => { setModal('addTask'); setClientMoreActionsOpen(false) }}>Create Follow-Up</button>
                        <button type="button" onClick={() => { setModal('addNote'); setClientMoreActionsOpen(false) }}>Add Note</button>
                        <button type="button" onClick={() => { openEmailClient(selectedClient?.email, `AgencyIQ follow-up for ${selectedClient?.name ?? 'client'}`); setClientMoreActionsOpen(false) }}>Email</button>
                        <button type="button" onClick={() => { openPhoneDialer(selectedClient?.phone); setClientMoreActionsOpen(false) }}>Call</button>
                        <button type="button" onClick={() => { setModal('addTask'); setClientMoreActionsOpen(false) }}>Add Payment Reminder</button>
                      </div>
                    )}
                  </div>
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
                <div className="client-overview-snapshot">
                  <div className="overview-stat-grid">
                    <div className="overview-stat-card">
                      <span>Active policies</span>
                      <strong>{activeClientPolicies.length}</strong>
                      <p>{clientPolicies.length} total on file</p>
                    </div>
                    <div className="overview-stat-card overview-stat-card--accent">
                      <span>Annual premium</span>
                      <strong>{currency.format(selectedClientPremium)}</strong>
                      <p>{currency.format(selectedClientCommission)} estimated commission</p>
                    </div>
                    <div className="overview-stat-card">
                      <span>Next renewal</span>
                      <strong>{selectedClientNextRenewal ? formatDate(selectedClientNextRenewal) : 'None'}</strong>
                      <p>{clientRenewals[0]?.status ?? 'No active renewal item'}</p>
                    </div>
                  </div>

                  <div className="overview-main-grid">
                    <div className="overview-panel overview-contact-panel">
                      <div className="overview-panel-header">
                        <span className="section-kicker">Contact</span>
                        <button className="utility-action" type="button" onClick={() => setModal('editClient')}>Edit</button>
                      </div>
                      <strong>{selectedClient.primaryContact}</strong>
                      <span>{selectedClient.email ?? 'No email on file'}</span>
                      <span>{selectedClient.phone ?? 'No phone on file'}</span>
                      <p>{selectedClient.mailingAddress ?? 'No mailing address on file'}</p>
                    </div>

                    <div className="overview-panel overview-action-panel">
                      <div className="overview-panel-header">
                        <span className="section-kicker">Next action</span>
                        <span className={`status-pill ${folderActions[0]?.priority === 'urgent' ? 'status-pill--danger' : ''}`}>{folderActions[0]?.priority ?? 'clear'}</span>
                      </div>
                      <strong>{folderActions[0]?.title ?? 'Folder is current'}</strong>
                      <p>{folderActions[0]?.detail ?? 'No urgent follow-up, missing contact info, or document review items found.'}</p>
                      <div className="overview-action-row">
                        <button className="secondary-action" type="button" onClick={() => setClientTab('Tasks')}>Tasks</button>
                        <button className="secondary-action" type="button" onClick={() => setClientTab('Policies')}>Policies</button>
                        <button className="secondary-action" type="button" onClick={() => setClientTab('Documents')}>Documents</button>
                      </div>
                    </div>
                  </div>

                  <div className="overview-panel overview-recent-panel">
                    <div className="overview-panel-header">
                      <span className="section-kicker">Recent activity</span>
                      <button className="text-button" type="button" onClick={() => setClientTab('Activity')}>
                        View all
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="overview-activity-list">
                      {clientNotes.slice(0, 2).map((note) => (
                        <button className="overview-activity-item" type="button" key={note.id} onClick={() => setClientTab('Notes & History')}>
                          <strong>{note.pinned ? 'Pinned note' : note.type ?? 'General note'}</strong>
                          <span>{formatDateTime(note.createdAt)} - {getUserName(dataset, note.createdByUserId)}</span>
                          <p>{note.body}</p>
                        </button>
                      ))}
                      {clientTasks.filter((task) => !task.completed).slice(0, 2).map((task) => (
                        <button className="overview-activity-item" type="button" key={task.id} onClick={() => setClientTab('Tasks')}>
                          <strong>{task.title}</strong>
                          <span>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : task.dueLabel} - {task.priority}</span>
                          <p>{task.description ?? 'Open client task'}</p>
                        </button>
                      ))}
                      {clientNotes.length === 0 && clientTasks.filter((task) => !task.completed).length === 0 && (
                        <div className="empty-state">No recent notes or open tasks for this client.</div>
                      )}
                    </div>
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

              {clientTab === 'Related Parties' && (
                <div className="related-party-tab">
                  <div className="related-party-header">
                    <div>
                      <span className="section-kicker">Reusable contacts and interests</span>
                      <h2>{clientRelatedParties.length} related parties on file</h2>
                      <p>Track certificate holders, mortgagees, lienholders, billing contacts, decision makers, and claim/emergency contacts without crowding the main client record.</p>
                    </div>
                    <button className="primary-action inline-action" type="button" onClick={() => setModal('addRelatedParty')}>
                      Add Related Party
                    </button>
                  </div>

                  <div className="related-party-summary-grid">
                    {relatedPartyTypes.slice(0, 6).map((type) => {
                      const count = clientRelatedParties.filter((party) => party.type === type).length
                      return (
                        <div className="related-party-summary" key={type}>
                          <span>{type}</span>
                          <strong>{count}</strong>
                        </div>
                      )
                    })}
                  </div>

                  <div className="related-party-grid">
                    {clientRelatedParties.map((party) => {
                      const linkedPolicy = clientPolicies.find((policy) => policy.id === party.policyId)
                      return (
                        <div className="related-party-card" key={party.id}>
                          <div className="related-party-card-head">
                            <div>
                              <span className="related-party-type">{party.type}</span>
                              <h3>{party.name}</h3>
                              {party.contactName && <p>{party.contactName}</p>}
                            </div>
                            {party.isPrimary && <span className="status-pill">Primary</span>}
                          </div>
                          <div className="related-party-details">
                            {party.email && <div><span>Email</span><strong>{party.email}</strong></div>}
                            {party.phone && <div><span>Phone</span><strong>{party.phone}</strong></div>}
                            {party.preference && <div><span>Preference</span><strong>{party.preference}</strong></div>}
                            {party.referenceNumber && <div><span>Reference</span><strong>{party.referenceNumber}</strong></div>}
                            {linkedPolicy && <div><span>Linked policy</span><strong>{linkedPolicy.policyType} - {linkedPolicy.carrier}</strong></div>}
                            {party.address && <div className="related-party-wide"><span>Address</span><strong>{party.address}</strong></div>}
                          </div>
                          {(party.doNotCall || party.doNotEmail) && (
                            <div className="related-party-flags">
                              {party.doNotCall && <span>Do not call</span>}
                              {party.doNotEmail && <span>Do not email</span>}
                            </div>
                          )}
                          {party.notes && <p className="related-party-note">{party.notes}</p>}
                          <div className="related-party-actions">
                            {party.email && !party.doNotEmail && (
                              <button className="secondary-action inline-action" type="button" onClick={() => openEmailClient(party.email, `AgencyIQ follow-up for ${selectedClient.name}`)}>
                                Email
                              </button>
                            )}
                            {party.phone && !party.doNotCall && (
                              <button className="utility-action" type="button" onClick={() => openPhoneDialer(party.phone)}>
                                Call
                              </button>
                            )}
                            {party.email && (
                              <button className="utility-action" type="button" onClick={() => copyToClipboard(party.email ?? '', 'Email copied')}>
                                Copy Email
                              </button>
                            )}
                            {linkedPolicy && (
                              <button className="utility-action" type="button" onClick={() => openPolicyForEdit(linkedPolicy)}>
                                Open Policy
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {clientRelatedParties.length === 0 && (
                      <div className="empty-state related-party-empty">
                        No related parties yet. Add certificate holders, mortgagees, additional insureds, billing contacts, or emergency contacts for this client.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {clientTab === 'Assets & Exposures' && (
                <div className="asset-tab">
                  <div className="asset-header">
                    <div>
                      <span className="section-kicker">Locations, vehicles, drivers, and properties</span>
                      <h2>{clientRiskAssets.length} exposure item{clientRiskAssets.length === 1 ? '' : 's'}</h2>
                      <p>Keep the risk schedule tied to the client file so quoting, renewals, and coverage reviews are easier to follow.</p>
                    </div>
                    <button className="primary-action inline-action" type="button" onClick={() => setModal('addRiskAsset')}>Add Exposure</button>
                  </div>
                  <div className="asset-summary-grid">
                    {riskAssetTypes.map((type) => (
                      <div key={type}><span>{type}</span><strong>{clientRiskAssets.filter((asset) => asset.type === type).length}</strong></div>
                    ))}
                  </div>
                  <div className="asset-grid">
                    {clientRiskAssets.map((asset) => {
                      const linkedPolicy = clientPolicies.find((policy) => policy.id === asset.policyId)
                      return (
                        <div className="asset-card" key={asset.id}>
                          <div className="asset-card-header">
                            <div>
                              <span className="asset-type">{asset.type}</span>
                              <h3>{asset.name}</h3>
                              {asset.status && <p>{asset.status}</p>}
                            </div>
                            {linkedPolicy && <span className="status-pill">{linkedPolicy.policyType}</span>}
                          </div>
                          <div className="asset-detail-grid">
                            {asset.address && <div><span>Address</span><strong>{asset.address}</strong></div>}
                            {(asset.year || asset.make || asset.model) && <div><span>Year / Make / Model</span><strong>{[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</strong></div>}
                            {asset.vin && <div><span>VIN</span><strong>{asset.vin}</strong></div>}
                            {asset.driverLicenseNumber && <div><span>Driver license</span><strong>{asset.driverLicenseState ? `${asset.driverLicenseState} - ` : ''}{asset.driverLicenseNumber}</strong></div>}
                            {asset.annualMileage && <div><span>Annual mileage</span><strong>{asset.annualMileage.toLocaleString()}</strong></div>}
                            {asset.annualSales && <div><span>Annual sales</span><strong>{currency.format(asset.annualSales)}</strong></div>}
                            {asset.payroll && <div><span>Payroll</span><strong>{currency.format(asset.payroll)}</strong></div>}
                            {asset.squareFootage && <div><span>Square footage</span><strong>{asset.squareFootage.toLocaleString()}</strong></div>}
                            {asset.constructionType && <div><span>Construction</span><strong>{asset.constructionType}</strong></div>}
                            {asset.roofYear && <div><span>Roof year</span><strong>{asset.roofYear}</strong></div>}
                            {asset.occupancy && <div><span>Occupancy / Usage</span><strong>{asset.occupancy || asset.usage}</strong></div>}
                          </div>
                          {asset.notes && <p className="asset-note">{asset.notes}</p>}
                        </div>
                      )
                    })}
                    {clientRiskAssets.length === 0 && <div className="empty-state asset-empty">No locations, vehicles, drivers, or properties are tied to this client yet.</div>}
                  </div>
                </div>
              )}

              {clientTab === 'Policies' && (
                <div className="policy-card-grid">
                  <div className="policy-portfolio-header">
                    <div>
                      <span className="section-kicker">Policy portfolio and history</span>
                      <h2>{filteredClientPolicies.length} of {clientPolicies.length} policies on file</h2>
                    </div>
                    <div className="policy-line-widget-row" aria-label="Policy type summary">
                      {([
                        { key: 'auto', label: 'Auto', icon: Car },
                        { key: 'home', label: 'Home', icon: Home },
                        { key: 'commercial', label: 'Commercial', icon: BriefcaseBusiness },
                        { key: 'other', label: 'Other', icon: ShieldCheck },
                      ] as const).map((item) => {
                        const Icon = item.icon
                        const matchingPolicies = clientPolicies.filter((policy) => getPolicyLineCategory(policy) === item.key)
                        const premium = matchingPolicies.reduce((sum, policy) => sum + policy.premium, 0)
                        return (
                          <div className={`policy-line-widget policy-line-widget--${item.key}`} key={item.key}>
                            <span><Icon size={15} aria-hidden="true" /> {item.label}</span>
                            <strong>{matchingPolicies.length}</strong>
                            <em>{currency.format(premium)}</em>
                          </div>
                        )
                      })}
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
                    const policyTransactions = getPolicyTransactions(policy.id)
                    const coverageFlags = getCoverageReviewFlags(policy)
                    const openTransactions = policyTransactions.filter((transaction) => !['Completed', 'Cancelled', 'Delivered to Client'].includes(transaction.status)).length
                    const billingReady = Boolean(policy.billingType || policy.billing?.paymentMethod || policy.paymentPlan)
                    const hasActiveReplacement = clientPolicies.some((candidate) => {
                      return (
                        candidate.id !== policy.id &&
                        isActivePolicy(candidate.status) &&
                        getPolicyCoverageBucket(candidate.policyType) === getPolicyCoverageBucket(policy.policyType)
                      )
                    })
                    const shouldShowXDate = ['Expired', 'Non-Renewed'].includes(policy.status) && !hasActiveReplacement
                    const ivansEntry = policy.policyNumber ? ivansSyncMap[policy.policyNumber] : null
                    const matchedCarrierPortal = findCarrierPortalForPolicy(carrierPortals, policy)
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
                              {ivansFeatureEnabled && ivansEntry && (
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
                          <div className="policy-workflow-strip" aria-label="Policy workflow status">
                            <div className={coverageFlags.length === 0 ? 'policy-workflow-step policy-workflow-step--complete' : 'policy-workflow-step policy-workflow-step--warning'}>
                              <span>1</span>
                              <div>
                                <strong>Coverage</strong>
                                <em>{coverageFlags.length === 0 ? 'Complete' : `${coverageFlags.length} item${coverageFlags.length === 1 ? '' : 's'} missing`}</em>
                              </div>
                            </div>
                            <div className={openTransactions === 0 ? 'policy-workflow-step policy-workflow-step--complete' : 'policy-workflow-step policy-workflow-step--warning'}>
                              <span>2</span>
                              <div>
                                <strong>Service Timeline</strong>
                                <em>{openTransactions === 0 ? `${policyTransactions.length} recorded` : `${openTransactions} open`}</em>
                              </div>
                            </div>
                            <div className={billingReady ? 'policy-workflow-step policy-workflow-step--complete' : 'policy-workflow-step policy-workflow-step--warning'}>
                              <span>3</span>
                              <div>
                                <strong>Billing</strong>
                                <em>{billingReady ? policy.billingType ?? policy.billing?.paymentMethod ?? policy.paymentPlan : 'Needs setup'}</em>
                              </div>
                            </div>
                            <div className="policy-workflow-step policy-workflow-step--neutral">
                              <span>4</span>
                              <div>
                                <strong>Actions</strong>
                                <em>{isActivePolicy(policy.status) ? 'Renew or edit' : 'Review history'}</em>
                              </div>
                            </div>
                          </div>
                          <PolicyCoverageSection
                            policy={policy}
                            onEdit={() => {
                              setCoveragePolicyId(policy.id)
                              setModal('editCoverage')
                            }}
                          />
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
                            {ivansFeatureEnabled && ivansEntry && (
                              <div className="policy-ivans-detail-row">
                                <span><Zap size={11} /> IVANS Last Sync</span>
                                <strong>{formatDate(ivansEntry.syncedAt)} · {ivansEntry.carrierName || 'Carrier'}{ivansEntry.renewalStatus === 'renewal_pending' ? ' — Renewal pending' : ''}</strong>
                              </div>
                            )}
                          </div>
                          {matchedCarrierPortal && (
                            <div className="carrier-quick-access">
                              <div className="carrier-quick-access-header">
                                <ShieldCheck size={15} />
                                <div>
                                  <strong>{matchedCarrierPortal.name} Quick Access</strong>
                                  <span>No auto-login. Use portal links and copy only what you are authorized to use.</span>
                                </div>
                              </div>
                              <div className="carrier-quick-access-actions">
                                <button className="secondary-action inline-action" type="button" onClick={(event) => { event.preventDefault(); openCarrierPortal(matchedCarrierPortal, policy) }}>
                                  Open Carrier Portal
                                </button>
                                {matchedCarrierPortal.username && (
                                  <button className="utility-action" type="button" onClick={(event) => { event.preventDefault(); copyToClipboard(matchedCarrierPortal.username, 'Username copied') }}>
                                    Copy Username
                                  </button>
                                )}
                                {matchedCarrierPortal.hasPassword && (
                                  <button className="utility-action" type="button" onClick={(event) => { event.preventDefault(); copyCarrierPassword(matchedCarrierPortal) }}>
                                    Copy Password
                                  </button>
                                )}
                                {policy.policyNumber && (
                                  <button className="utility-action" type="button" onClick={(event) => { event.preventDefault(); copyToClipboard(policy.policyNumber ?? '', 'Policy number copied') }}>
                                    Copy Policy #
                                  </button>
                                )}
                                {matchedCarrierPortal.billingUrl && (
                                  <button className="utility-action" type="button" onClick={(event) => { event.preventDefault(); openCarrierPortal(matchedCarrierPortal, policy, matchedCarrierPortal.billingUrl) }}>
                                    Open Billing
                                  </button>
                                )}
                                {matchedCarrierPortal.claimsUrl && (
                                  <button className="utility-action" type="button" onClick={(event) => { event.preventDefault(); openCarrierPortal(matchedCarrierPortal, policy, matchedCarrierPortal.claimsUrl) }}>
                                    Open Claims
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="policy-transaction-panel">
                            <div className="policy-transaction-header">
                              <div>
                                <span className="section-kicker">Policy service timeline</span>
                                <h2>{policyTransactions.length} transaction{policyTransactions.length === 1 ? '' : 's'}</h2>
                              </div>
                              <button
                                className="secondary-action inline-action"
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  setTransactionPolicyId(policy.id)
                                  setModal('addPolicyTransaction')
                                }}
                              >
                                Add Transaction
                              </button>
                            </div>
                            <div className="policy-transaction-list">
                              {policyTransactions.map((transaction) => (
                                <div className="policy-transaction-row" key={transaction.id}>
                                  <div className="policy-transaction-marker" aria-hidden="true" />
                                  <div className="policy-transaction-body">
                                    <div className="policy-transaction-title">
                                      <strong>{transaction.type}</strong>
                                      <span className={`transaction-status transaction-status--${transaction.status.toLowerCase().replace(/\s+/g, '-')}`}>{transaction.status}</span>
                                    </div>
                                    <p>{transaction.description}</p>
                                    <div className="policy-transaction-meta">
                                      <span>Requested {transaction.requestedDate ? formatDate(transaction.requestedDate) : 'Not set'}</span>
                                      <span>Effective {transaction.effectiveDate ? formatDate(transaction.effectiveDate) : 'Not set'}</span>
                                      <span>Completed {transaction.completedDate ? formatDate(transaction.completedDate) : 'Open'}</span>
                                      {typeof transaction.premiumChange === 'number' && <span>Premium change {currency.format(transaction.premiumChange)}</span>}
                                      {transaction.carrierContact && <span>Carrier {transaction.carrierContact}</span>}
                                      {transaction.requestedBy && <span>By {transaction.requestedBy}</span>}
                                    </div>
                                    {transaction.notes && <em>{transaction.notes}</em>}
                                  </div>
                                </div>
                              ))}
                              {policyTransactions.length === 0 && (
                                <div className="policy-transaction-empty">
                                  <strong>No transactions recorded yet</strong>
                                  <span>Add endorsements, cancellations, reinstatements, renewals, binders, or rewrite activity as service work happens.</span>
                                </div>
                              )}
                            </div>
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

              {clientTab === 'Documents' && (
                <div className="document-drawer cloud-folder-drawer">
                  <div className="document-drawer-header">
                    <div>
                      <span className="section-kicker">Client cloud folder</span>
                      <h2>Documents</h2>
                      <p>AgencyIQ stores the folder link only. Documents stay in your agency cloud storage.</p>
                    </div>
                    {canManageCloudFolders && (
                      <button className="primary-action inline-action" type="button" onClick={() => setModal('cloudFolder')}>
                        <Cloud size={15} /> {selectedClientCloudFolder ? 'Edit Folder Link' : 'Connect Cloud Folder'}
                      </button>
                    )}
                  </div>
                  <div className="cloud-folder-security-note">
                    <ShieldCheck size={16} />
                    <span>AgencyIQ opens your connected cloud folder. Access permissions are controlled by your cloud storage provider. Make sure the folder is shared only with authorized agency staff.</span>
                  </div>
                  {selectedClientCloudFolder ? (
                    <div className="cloud-folder-card">
                      <div className="cloud-folder-card-main">
                        <div className="cloud-folder-icon"><FolderOpen size={22} /></div>
                        <div>
                          <span className="section-kicker">Client Cloud Folder</span>
                          <h3>{selectedClientCloudFolder.folderName}</h3>
                          <p>{cloudFolderProviderLabels[selectedClientCloudFolder.provider]} folder connected for {selectedClient.name}</p>
                        </div>
                      </div>
                      <div className="cloud-folder-detail-grid">
                        <div><span>Provider</span><strong>{cloudFolderProviderLabels[selectedClientCloudFolder.provider]}</strong></div>
                        <div><span>Folder Name</span><strong>{selectedClientCloudFolder.folderName}</strong></div>
                        <div><span>Connected By</span><strong>{selectedClientCloudFolder.connectedBy}</strong></div>
                        <div><span>Last Updated</span><strong>{formatDateTime(selectedClientCloudFolder.updatedAt)}</strong></div>
                        <div className="cloud-folder-url"><span>Folder URL</span><strong>{selectedClientCloudFolder.folderUrl}</strong></div>
                        {selectedClientCloudFolder.folderId && <div><span>Folder ID</span><strong>{selectedClientCloudFolder.folderId}</strong></div>}
                        {selectedClientCloudFolder.notes && <div className="cloud-folder-notes"><span>Notes</span><strong>{selectedClientCloudFolder.notes}</strong></div>}
                      </div>
                      {looksLikePublicCloudShare(selectedClientCloudFolder.folderUrl) && (
                        <div className="cloud-folder-warning">
                          <ShieldCheck size={16} />
                          <span>Make sure this folder link is not publicly accessible unless intended.</span>
                        </div>
                      )}
                      <div className="cloud-folder-actions">
                        <button className="primary-action" type="button" onClick={() => openCloudFolder(selectedClientCloudFolder)}>
                          <ExternalLink size={15} /> Open Client Folder
                        </button>
                        <button className="secondary-action" type="button" onClick={() => copyCloudFolderLink(selectedClientCloudFolder)}>
                          <Copy size={15} /> Copy Folder Link
                        </button>
                        {canManageCloudFolders && (
                          <>
                            <button className="secondary-action" type="button" onClick={() => setModal('cloudFolder')}>
                              <Pencil size={15} /> Edit Folder Link
                            </button>
                            <button className="utility-action" type="button" onClick={removeCloudFolder}>
                              <Trash2 size={15} /> Remove Folder Link
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="cloud-folder-empty">
                      <div className="cloud-folder-icon"><Cloud size={24} /></div>
                      <div>
                        <h3>No cloud document folder connected for this client.</h3>
                        <p>Connect a Google Drive, OneDrive, Dropbox, Box, or other secure cloud folder link.</p>
                      </div>
                      {canManageCloudFolders ? (
                        <button className="primary-action" type="button" onClick={() => setModal('cloudFolder')}>Connect Cloud Folder</button>
                      ) : (
                        <span className="status-pill">Owner/Admin required to connect</span>
                      )}
                    </div>
                  )}
                  <div className="cloud-provider-roadmap">
                    <div><LinkIcon size={16} /><strong>Manual folder link active</strong><span>Paste an existing cloud folder URL and open it from AgencyIQ.</span></div>
                    <div><Cloud size={16} /><strong>API sync coming later</strong><span>Google Drive, OneDrive, Dropbox, and Box OAuth/file sync are intentionally not enabled in this first version.</span></div>
                  </div>
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
                  <div className="billing-command-grid">
                    <div className="billing-command-card billing-command-card--premium">
                      <span>Active premium</span>
                      <strong>{currency.format(activeClientPolicies.reduce((sum, policy) => sum + policy.premium, 0))}</strong>
                      <p>{activeClientPolicies.length} active polic{activeClientPolicies.length === 1 ? 'y' : 'ies'}</p>
                    </div>
                    <div className="billing-command-card">
                      <span>Payments posted</span>
                      <strong>{currency.format(clientPayments.filter((payment) => payment.status === 'Posted').reduce((sum, payment) => sum + payment.amount, 0))}</strong>
                      <p>{clientPayments.filter((payment) => payment.status === 'Pending').length} pending payment{clientPayments.filter((payment) => payment.status === 'Pending').length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="billing-command-card">
                      <span>Needs attention</span>
                      <strong>{activeClientPolicies.filter((policy) => {
                        const status = policy.billing?.paymentStatus ?? policy.paymentStatus
                        return status === 'Past due' || status === 'NSF / Returned' || status === 'Due soon'
                      }).length}</strong>
                      <p>Past due, returned, or due soon</p>
                    </div>
                    <div className="billing-command-card">
                      <span>Next payment</span>
                      <strong>{(() => {
                        const next = activeClientPolicies
                          .map((policy) => policy.billing?.nextPaymentDate)
                          .filter(Boolean)
                          .sort()[0]
                        return next ? formatDate(next) : 'None'
                      })()}</strong>
                      <p>Earliest scheduled payment</p>
                    </div>
                  </div>
                  <div className="ledger-panel">
                    <div className="ledger-header">
                      <div>
                        <span className="section-kicker">Payment ledger</span>
                        <h2>{clientPayments.length} payment entr{clientPayments.length === 1 ? 'y' : 'ies'}</h2>
                      </div>
                      <button className="primary-action inline-action" type="button" onClick={() => setModal('addPayment')}>Add Payment</button>
                    </div>
                    <div className="ledger-summary-grid">
                      <div><span>Posted</span><strong>{currency.format(clientPayments.filter((p) => p.status === 'Posted').reduce((sum, p) => sum + p.amount, 0))}</strong></div>
                      <div><span>Pending</span><strong>{currency.format(clientPayments.filter((p) => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0))}</strong></div>
                      <div><span>Returned</span><strong>{clientPayments.filter((p) => p.status === 'Returned').length}</strong></div>
                    </div>
                    <div className="ledger-list">
                      {clientPayments.map((payment) => {
                        const linkedPolicy = clientPolicies.find((policy) => policy.id === payment.policyId)
                        return (
                          <div className="ledger-row" key={payment.id}>
                            <div>
                              <strong>{currency.format(payment.amount)}</strong>
                              <span>{payment.method} - {formatDate(payment.paymentDate)} - {payment.status}</span>
                              {linkedPolicy && <em>{linkedPolicy.policyType} / {linkedPolicy.carrier}</em>}
                            </div>
                            <div>
                              {payment.referenceNumber && <small>Ref {payment.referenceNumber}</small>}
                              {payment.receiptNumber && <small>Receipt {payment.receiptNumber}</small>}
                              <small>Posted by {payment.postedBy}</small>
                            </div>
                          </div>
                        )
                      })}
                      {clientPayments.length === 0 && <div className="empty-state">No payment ledger entries yet.</div>}
                    </div>
                  </div>
                  <div className="commission-panel">
                    <div className="ledger-header">
                      <div>
                        <span className="section-kicker">Commission reconciliation</span>
                        <h2>{currency.format(clientCommissions.reduce((sum, item) => sum + item.commissionAmount, 0))} tracked</h2>
                      </div>
                    </div>
                    <div className="commission-list">
                      {clientCommissions.map((statement) => {
                        const linkedPolicy = clientPolicies.find((policy) => policy.id === statement.policyId)
                        return (
                          <div className="commission-row" key={statement.id}>
                            <div><strong>{statement.carrier}</strong><span>{linkedPolicy?.policyType ?? 'Client level'} - {formatDate(statement.statementDate)}</span></div>
                            <div><span>{currency.format(statement.premium)} premium</span><strong>{currency.format(statement.commissionAmount)}</strong></div>
                            <span className={`transaction-status transaction-status--${statement.status.toLowerCase()}`}>{statement.status}</span>
                          </div>
                        )
                      })}
                      {clientCommissions.length === 0 && <div className="empty-state">No commission statements are tied to this client yet.</div>}
                    </div>
                  </div>
                  {activeClientPolicies.map((policy) => {
                    const b = policy.billing ?? {}
                    const commission = (policy.premium * (policy.commissionRate ?? 0)) / 100
                    const billingStatus = b.paymentStatus ?? policy.paymentStatus ?? 'Current'
                    const billingMethod = b.paymentMethod ?? policy.billingType ?? 'Not set'
                    const paymentPlan = b.paymentPlanType ?? policy.paymentPlan ?? 'Not set'
                    const responsibility = b.billingResponsibility ?? policy.billingType ?? 'Not set'
                    const scheduleItems = [
                      { label: 'Down payment', value: b.downPaymentAmount ? currency.format(b.downPaymentAmount) : (policy.downPayment ? currency.format(policy.downPayment) : 'Not recorded'), date: b.downPaymentDate ? formatFullDate(b.downPaymentDate) : undefined },
                      { label: 'Next payment', value: b.nextPaymentAmount ? currency.format(b.nextPaymentAmount) : 'Not scheduled', date: b.nextPaymentDate ? formatFullDate(b.nextPaymentDate) : undefined },
                      { label: 'Last payment', value: b.lastPaymentAmount ? currency.format(b.lastPaymentAmount) : 'None recorded', date: b.lastPaymentDate ? formatFullDate(b.lastPaymentDate) : undefined },
                    ]
                    return (
                      <div className="billing-policy-card" key={policy.id}>
                        <div className="billing-policy-header">
                          <div className="billing-policy-identity">
                            <span className="billing-policy-type">{policy.policyType}</span>
                            <span className="billing-policy-carrier">{policy.carrier}</span>
                            <span className={`billing-status-chip billing-status-chip--${billingStatus.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{billingStatus}</span>
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
                        <div className="billing-profile-row">
                          <div>
                            <span>Payment method</span>
                            <strong>{billingMethod}</strong>
                          </div>
                          <div>
                            <span>Payment plan</span>
                            <strong>{paymentPlan}</strong>
                          </div>
                          <div>
                            <span>Responsibility</span>
                            <strong>{responsibility}</strong>
                          </div>
                          <div>
                            <span>Policy term</span>
                            <strong>{policy.effectiveDate ? `${formatDate(policy.effectiveDate)} - ${formatDate(policy.expirationDate)}` : `Renews ${formatDate(policy.expirationDate)}`}</strong>
                          </div>
                        </div>
                        <div className="billing-detail-grid">
                          <div className="billing-detail-section">
                            <h3>Payment Setup</h3>
                            <div className="billing-fact-list">
                              <div><span>Status</span><strong className={billingStatus === 'Past due' || billingStatus === 'NSF / Returned' ? 'billing-status-alert' : ''}>{billingStatus}</strong></div>
                              <div><span>Installments</span><strong>{b.installmentCount ? `${b.installmentCount}-pay plan` : 'Not set'}</strong></div>
                              <div><span>Installment amount</span><strong>{b.installmentAmount ? currency.format(b.installmentAmount) : 'Not set'}</strong></div>
                            </div>
                          </div>

                          <div className="billing-detail-section">
                            <h3>Payment Schedule</h3>
                            <div className="billing-schedule-list">
                              {scheduleItems.map((item) => (
                                <div className="billing-schedule-item" key={item.label}>
                                  <span>{item.label}</span>
                                  <strong>{item.value}</strong>
                                  <em>{item.date ?? 'No date'}</em>
                                </div>
                              ))}
                            </div>
                          </div>

                          {(b.paymentMethod === 'Premium Finance' || b.paymentPlanType === 'Financed' || b.financeCompany || policy.financeCompany) && (
                            <div className="billing-detail-section billing-detail-section--special">
                              <h3>Premium Finance</h3>
                              <div className="billing-fact-list">
                                <div><span>Finance company</span><strong>{b.financeCompany ?? policy.financeCompany ?? 'Not set'}</strong></div>
                                {b.financeContractNumber && <div><span>Contract #</span><strong>{b.financeContractNumber}</strong></div>}
                                {b.financeAmount && <div><span>Amount financed</span><strong>{currency.format(b.financeAmount)}</strong></div>}
                                {b.financeMonthlyPayment && <div><span>Monthly payment</span><strong>{currency.format(b.financeMonthlyPayment)}</strong></div>}
                                {b.financePayoffDate && <div><span>Payoff date</span><strong>{formatFullDate(b.financePayoffDate)}</strong></div>}
                              </div>
                            </div>
                          )}

                          {(b.paymentMethod === 'Escrow / Mortgagee' || b.paymentPlanType === 'Escrow / Mortgage' || b.mortgageeOrLienholder || policy.mortgageeOrLienholder) && (
                            <div className="billing-detail-section billing-detail-section--special">
                              <h3>Mortgagee / Escrow</h3>
                              <div className="billing-fact-list">
                                <div><span>Mortgagee / lienholder</span><strong>{b.mortgageeOrLienholder ?? policy.mortgageeOrLienholder ?? 'Not set'}</strong></div>
                                {b.mortgageeClause && <div><span>Mortgagee clause</span><strong>{b.mortgageeClause}</strong></div>}
                                {b.escrowAccount && <div><span>Escrow account #</span><strong>{b.escrowAccount}</strong></div>}
                              </div>
                            </div>
                          )}

                          {(b.paymentMethod === 'Credit Card' || b.creditCardLast4) && (
                            <div className="billing-detail-section billing-detail-section--special">
                              <h3>Credit Card on File</h3>
                              <div className="billing-fact-list">
                                {b.creditCardLast4 && <div><span>Card ending in</span><strong>•••• {b.creditCardLast4}</strong></div>}
                                {b.creditCardExpiry && <div><span>Expiry</span><strong>{b.creditCardExpiry}</strong></div>}
                              </div>
                            </div>
                          )}

                          {(b.paymentMethod === 'ACH / Bank Draft' || b.achBankName) && (
                            <div className="billing-detail-section billing-detail-section--special">
                              <h3>ACH / Bank Draft</h3>
                              <div className="billing-fact-list">
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

              {clientTab === 'Claims' && (
                <div className="claims-tab">
                  <div className="claims-header">
                    <div>
                      <span className="section-kicker">Claims and loss history</span>
                      <h2>{clientClaims.length} claim{clientClaims.length === 1 ? '' : 's'} on file</h2>
                      <p>Track claim numbers, adjusters, reserves, paid amounts, loss-run inclusion, and follow-up work tied to this client.</p>
                    </div>
                    <button className="primary-action inline-action" type="button" onClick={() => setModal('addClaim')}>
                      Add Claim
                    </button>
                  </div>
                  <div className="claims-summary-grid">
                    <div><span>Open / pending</span><strong>{openClientClaims.length}</strong></div>
                    <div><span>Paid total</span><strong>{currency.format(clientClaims.reduce((sum, claim) => sum + (claim.paidAmount ?? 0), 0))}</strong></div>
                    <div><span>Reserve total</span><strong>{currency.format(clientClaims.reduce((sum, claim) => sum + (claim.reserveAmount ?? 0), 0))}</strong></div>
                    <div><span>Loss-run items</span><strong>{clientClaims.filter((claim) => claim.includeInLossRuns).length}</strong></div>
                  </div>
                  <div className="claims-grid">
                    {clientClaims.map((claim) => {
                      const linkedPolicy = clientPolicies.find((policy) => policy.id === claim.policyId)
                      return (
                        <div className="claim-card" key={claim.id}>
                          <div className="claim-card-header">
                            <div>
                              <span className={`claim-status claim-status--${claim.status.toLowerCase()}`}>{claim.status}</span>
                              <h3>{claim.claimNumber ?? claim.carrierClaimNumber ?? 'Claim pending number'}</h3>
                              <p>{claim.description}</p>
                            </div>
                            {claim.includeInLossRuns && <span className="status-pill">Loss run</span>}
                          </div>
                          <div className="claim-detail-grid">
                            <div><span>Date of loss</span><strong>{formatDate(claim.dateOfLoss)}</strong></div>
                            <div><span>Reported</span><strong>{claim.reportedDate ? formatDate(claim.reportedDate) : 'Not set'}</strong></div>
                            <div><span>Policy</span><strong>{linkedPolicy ? `${linkedPolicy.policyType} - ${linkedPolicy.carrier}` : 'Client level'}</strong></div>
                            <div><span>Carrier claim #</span><strong>{claim.carrierClaimNumber ?? 'Not set'}</strong></div>
                            <div><span>Paid</span><strong>{currency.format(claim.paidAmount ?? 0)}</strong></div>
                            <div><span>Reserve</span><strong>{currency.format(claim.reserveAmount ?? 0)}</strong></div>
                            <div><span>Documents</span><strong>{claim.documentsStatus ?? 'Not set'}</strong></div>
                            <div><span>Follow-up</span><strong>{claim.followUpDate ? formatDate(claim.followUpDate) : 'None scheduled'}</strong></div>
                          </div>
                          {(claim.adjusterName || claim.adjusterPhone || claim.adjusterEmail) && (
                            <div className="claim-adjuster-box">
                              <strong>{claim.adjusterName ?? 'Adjuster'}</strong>
                              {claim.adjusterPhone && <span>{claim.adjusterPhone}</span>}
                              {claim.adjusterEmail && <span>{claim.adjusterEmail}</span>}
                            </div>
                          )}
                          {claim.notes && <p className="claim-note">{claim.notes}</p>}
                          <div className="claim-actions">
                            {claim.adjusterPhone && <button className="utility-action" type="button" onClick={() => openPhoneDialer(claim.adjusterPhone)}>Call Adjuster</button>}
                            {claim.adjusterEmail && <button className="utility-action" type="button" onClick={() => openEmailClient(claim.adjusterEmail, `Claim follow-up for ${selectedClient.name}`)}>Email Adjuster</button>}
                            {linkedPolicy && <button className="secondary-action inline-action" type="button" onClick={() => openPolicyForEdit(linkedPolicy)}>Open Policy</button>}
                            {claim.followUpDate && <button className="utility-action" type="button" onClick={() => setClientTab('Tasks')}>Open Tasks</button>}
                          </div>
                        </div>
                      )
                    })}
                    {clientClaims.length === 0 && (
                      <div className="empty-state claims-empty">No claims are tied to this client yet.</div>
                    )}
                  </div>
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

              {clientTab === 'Activity' && (
                <div className="audit-ledger">
                  <div className="audit-ledger-header">
                    <div>
                      <span className="section-kicker">E&O trail</span>
                      <h2>Folder Activity Ledger</h2>
                    </div>
                    <span className="status-pill">{auditEvents.length} events</span>
                  </div>
                  <div className="timeline-list audit-timeline">
                    <div><strong>Client folder opened</strong><span>{selectedClient.name} active in AgencyIQ - system</span></div>
                    {auditEvents.map((event) => (
                      <div className={`audit-event audit-event--${event.type}`} key={event.id}>
                        <strong>{event.title}</strong>
                        <span>{event.detail}</span>
                        <em>{event.actor} - {formatDateTime(event.at.includes('T') ? event.at : `${event.at}T12:00:00`)}</em>
                      </div>
                    ))}
                    {clientRenewals.map((renewal) => <div className="audit-event audit-event--renewal" key={renewal.id}><strong>Policy renewal update</strong><span>{renewal.status} - {formatDate(renewal.dueDate)}</span><em>Renewal desk</em></div>)}
                  </div>
                </div>
              )}
            </section>
          </section>
        ) : activeView === 'binder' ? (
          <section className="binder-page">
            <section className="page-heading">
              <div>
                <p className="eyebrow">Team binder log</p>
                <h1>Binder Log</h1>
                <p className="account-context">Enter a bound policy once. AgencyIQ updates the client folder, policy, payment ledger, and binder log together.</p>
              </div>
              <button className="primary-action" type="button" onClick={() => setModal('addBinderEntry')}>Add Binder Log Entry</button>
            </section>
            <section className="admin-kpi-grid" aria-label="Binder summary">
              <div><span>Total binders</span><strong>{binderLog.length}</strong><p>All team-entered bound policy records</p></div>
              <div><span>Bound premium</span><strong>{currency.format(binderLog.reduce((sum, item) => sum + item.premium, 0))}</strong><p>Premium captured in binder log</p></div>
              <div><span>Next binder #</span><strong>{nextBinderNumber}</strong><p>Auto-resets by calendar year</p></div>
              <div><span>Payments captured</span><strong>{currency.format((dataset.paymentLedger ?? []).filter((payment) => payment.notes?.toLowerCase().includes('binder log')).reduce((sum, payment) => sum + payment.amount, 0))}</strong><p>From binder entries</p></div>
            </section>
            <section className="binder-workflow panel" aria-label="Binder workflow">
              {['Bind Policy', 'Capture Payment', 'Create Policy', 'Update Client Folder', 'Track Remittance'].map((step, index) => (
                <div className="binder-workflow-step" key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </section>
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <span className="section-kicker">Binder control log</span>
                  <h2>Every bound policy in one place</h2>
                  <p>Use this instead of a separate spreadsheet. Entries stay tied to the client folder and policy record.</p>
                </div>
              </div>
              <div className="binder-sheet" role="table" aria-label="Binder Log">
                <div className="binder-sheet-row binder-sheet-row--head" role="row">
                  <span>Binder #</span>
                  <span>Client</span>
                  <span>Bind Date</span>
                  <span>Type of Business</span>
                  <span>Policy Type</span>
                  <span>Carrier</span>
                  <span>Premium</span>
                  <span>Payment Taken</span>
                  <span>Bound By</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {binderLog.map((binder) => {
                  const binderPayments = (dataset.paymentLedger ?? []).filter((payment) => payment.policyId === binder.policy?.id && payment.notes?.toLowerCase().includes('binder log'))
                  const paymentCaptured = binderPayments.reduce((sum, payment) => sum + payment.amount, 0)
                  const commissionLogged = (dataset.commissionStatements ?? []).some((statement) => statement.policyId === binder.policy?.id)
                  const remittanceNeeded = binderPayments.some((payment) => (payment.remittanceStatus ?? 'Needs Remittance') === 'Needs Remittance')
                  const docsPending = binder.policy ? buildClientDocuments(binder.policy.clientId, [binder.policy]).some((doc) => doc.status !== 'Current') : true
                  return (
                    <div className="binder-sheet-row" role="row" key={binder.id}>
                      <strong>{binder.binderNumber}</strong>
                      <span>{binder.client?.name ?? 'Unknown client'}</span>
                      <span>{binder.binderDate ? formatDate(binder.binderDate) : 'Date not set'}</span>
                      <span>{binder.policy?.lineOfBusiness ?? binder.client?.lineOfBusiness ?? 'Not set'}</span>
                      <span>{binder.policy?.policyType ?? 'Policy'}</span>
                      <span>{binder.policy?.carrier ?? 'Carrier pending'}</span>
                      <strong>{currency.format(binder.premium)}</strong>
                      <span>{currency.format(paymentCaptured)}</span>
                      <span>{binder.boundBy}</span>
                      <div className="binder-status-stack">
                        <span className={`workflow-chip ${binder.policy ? 'workflow-chip--done' : 'workflow-chip--open'}`}>Policy Created</span>
                        <span className={`workflow-chip ${paymentCaptured > 0 ? 'workflow-chip--done' : 'workflow-chip--open'}`}>Payment Captured</span>
                        <span className={`workflow-chip ${commissionLogged ? 'workflow-chip--done' : 'workflow-chip--open'}`}>Commission Logged</span>
                        <span className={`workflow-chip ${remittanceNeeded ? 'workflow-chip--warning' : 'workflow-chip--done'}`}>Remittance Needed</span>
                        <span className={`workflow-chip ${docsPending ? 'workflow-chip--warning' : 'workflow-chip--done'}`}>Docs Pending</span>
                      </div>
                      <div className="binder-sheet-actions">
                        <button className="utility-action" type="button" onClick={() => {
                          setEditingBinderEntryId(binder.id)
                          setModal('editBinderEntry')
                        }}>Edit</button>
                        <button className="utility-action" type="button" onClick={() => binder.policy && openClientFolder(binder.policy.clientId, 'Policies', 'binder')}>Open</button>
                      </div>
                    </div>
                  )
                })}
                {binderLog.length === 0 && <div className="empty-state">No binders have been logged yet.</div>}
              </div>
            </section>
          </section>
        ) : activeView === 'admin' && canSeeOwnerAnalytics ? (
          <section className="admin-command-center">
            <section className="page-heading">
              <div>
                <p className="eyebrow">Owner / administration</p>
                <h1>Agency Payables & Binder Control</h1>
                <p className="account-context">Owner-only queue for agency-bill remittance and merchant collections. Team binder entry lives in Binder Log.</p>
              </div>
              <button className="secondary-action" type="button" onClick={() => setActiveView('data')}>
                <Database size={16} /> Import & Backup Tools
              </button>
            </section>

            <section className="admin-kpi-grid" aria-label="Administration summary">
              <div><span>Needs remittance</span><strong>{agencyBillRemittanceQueue.filter((item) => item.status === 'Needs Remittance').length}</strong><p>{currency.format(agencyBillRemittanceQueue.filter((item) => item.status === 'Needs Remittance').reduce((sum, item) => sum + item.payableAmount, 0))} payable</p></div>
              <div><span>Scheduled / hold</span><strong>{agencyBillRemittanceQueue.filter((item) => item.status === 'Scheduled' || item.status === 'On Hold').length}</strong><p>Pending owner review</p></div>
              <div><span>Binder log</span><strong>{binderLog.length}</strong><p>{binderLog.filter((item) => item.status !== 'Completed').length} open binder item{binderLog.filter((item) => item.status !== 'Completed').length === 1 ? '' : 's'}</p></div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <span className="section-kicker">Owner reports</span>
                  <h2>Agency report library</h2>
                  <p>Written premium, renewal retention, missing info, and CSR workload reporting live inside Administration.</p>
                </div>
                <button className="secondary-action" type="button" onClick={() => downloadJsonExport(dataset)}>
                  <Download size={16} /> Export Full Data
                </button>
              </div>

              <section className="structured-report-grid owner-report-library">
                {ownerReportLibrary.map((report) => (
                  <button
                    className="structured-report-card"
                    type="button"
                    key={report.title}
                    onClick={() => {
                      if (report.title.includes('Renewal')) setActiveView('renewals')
                      else if (report.title.includes('Missing')) setActiveView('clients')
                      else showToast(`${report.title} report ready`)
                    }}
                  >
                    <span>{report.title}</span>
                    <strong>{report.value}</strong>
                    <p>{report.detail}</p>
                    <em>{report.action}</em>
                  </button>
                ))}
              </section>
            </section>

            <section className="admin-panel admin-help-desk">
              <div className="admin-panel-header">
                <div>
                  <span className="section-kicker">Admin help desk</span>
                  <h2>AgencyIQ workflow guide</h2>
                  <p>Use this as the internal playbook for imports, backups, client folders, policies, billing, binder log, renewals, and ACORD forms.</p>
                </div>
                <span className="owner-only-pill"><ShieldCheck size={13} /> Admin guide</span>
              </div>
              <div className="admin-help-grid">
                <article>
                  <strong>1. Import, export, and backup</strong>
                  <p>Open Import & Backup Tools, download a full JSON backup before major imports, then stage CSV imports for mapping review. Use QuickFile JSON only after converting the MDB export into AgencyIQ JSON.</p>
                </article>
                <article>
                  <strong>2. Add or update a client</strong>
                  <p>Go to Clients, add a new folder, complete contact details, assign the owner/CSR, then add notes, tasks, documents, cloud folder links, and missing-info cleanup items.</p>
                </article>
                <article>
                  <strong>3. Add policy and coverage data</strong>
                  <p>Inside the client folder, open Policies, add the carrier, policy number, dates, premium, commission, billing type, limits, deductibles, mortgagee/lienholder, and coverage-specific fields.</p>
                </article>
                <article>
                  <strong>4. Billing and agency-bill payments</strong>
                  <p>Use the Billing tab to post payments. For agency-bill or merchant-collected money, enter remit-to, carrier payable, due date, reference number, and status so Administration can track what must be paid out.</p>
                </article>
                <article>
                  <strong>5. Binder Log</strong>
                  <p>Use Binder Log whenever a policy is bound. The binder number advances by year, creates or updates the client folder, creates the policy, records payment taken, and feeds owner/admin oversight.</p>
                </article>
                <article>
                  <strong>6. ACORD forms</strong>
                  <p>Open ACORD Forms, search/select the client, choose the form, review mapped fields, and generate the PDF. Licensed ACORD templates must stay installed in the backend template folder.</p>
                </article>
                <article>
                  <strong>7. Renewals and X-dates</strong>
                  <p>Use Renewals for upcoming expirations, renewal premium updates, retention review, and email/call follow-up. X-date leads should become opportunities or renewal tasks instead of sitting idle.</p>
                </article>
                <article>
                  <strong>8. Reports and owner review</strong>
                  <p>Use the report library in Administration to watch new business premium, yearly written premium, retention, missing client data, and incomplete CSR work.</p>
                </article>
              </div>
            </section>

            <section className="admin-grid">
              <article className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <span className="section-kicker">CSR task report</span>
                    <h2>Incomplete tasks by CSR</h2>
                    <p>Use this to see what service work is still open across the team.</p>
                  </div>
                </div>
                <div className="admin-remittance-list">
                  {incompleteTasksByCsr.map(([userId, tasks]) => (
                    <div className="admin-remittance-row" key={userId}>
                      <div className="admin-remittance-fields">
                        <div><span>CSR / Owner</span><strong>{getUserName(dataset, userId)}</strong></div>
                        <div><span>Open Tasks</span><strong>{tasks.length}</strong></div>
                        <div><span>High Priority</span><strong>{tasks.filter((task) => task.priority === 'High' || task.priority === 'Urgent').length}</strong></div>
                      </div>
                    </div>
                  ))}
                  {incompleteTasksByCsr.length === 0 && <div className="empty-state">No incomplete CSR tasks.</div>}
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <span className="section-kicker">Missing info report</span>
                    <h2>Folders missing required contact data</h2>
                    <p>These folders need cleanup before renewal, ACORD, and payment workflows are fully reliable.</p>
                  </div>
                </div>
                <div className="admin-remittance-list">
                  {missingInfoClients.slice(0, 10).map((client) => (
                    <div className="admin-remittance-row" key={client.id}>
                      <div className="admin-remittance-fields">
                        <div><span>Client</span><strong>{client.name}</strong></div>
                        <div><span>Missing</span><strong>{[
                          !client.email ? 'Email' : '',
                          !client.phone ? 'Phone' : '',
                          !client.mailingAddress ? 'Address' : '',
                        ].filter(Boolean).join(', ')}</strong></div>
                        <div><span>Assigned</span><strong>{getUserName(dataset, client.assignedCsrId ?? client.ownerUserId)}</strong></div>
                      </div>
                      <div className="admin-remittance-actions">
                        <button className="utility-action" type="button" onClick={() => openClientFolder(client.id, 'Contact & Account')}>Open Folder</button>
                      </div>
                    </div>
                  ))}
                  {missingInfoClients.length === 0 && <div className="empty-state">No missing client info found.</div>}
                </div>
              </article>
            </section>

            <section className="admin-grid">
              <article className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <span className="section-kicker">Payment tracking</span>
                    <h2>Agency-bill remittance queue</h2>
                    <p>When a client payment is posted in the folder, owner/admin can see where the agency needs to send money next.</p>
                  </div>
                  <span className="owner-only-pill"><Lock size={13} /> Owner only</span>
                </div>
                <div className="admin-remittance-list">
                  {agencyBillRemittanceQueue.map(({ payment, policy, client, payableAmount, remitTo, dueDate, status }) => (
                    <div className="admin-remittance-row" key={payment.id}>
                      <div className="admin-remittance-fields">
                        <div><span>Client</span><strong>{client?.name ?? 'Unknown client'}</strong></div>
                        <div><span>Policy</span><strong>{policy?.policyType ?? 'Client payment'}</strong></div>
                        <div><span>Carrier</span><strong>{remitTo}</strong></div>
                        <div><span>Amount Collected</span><strong>{currency.format(payment.amount)}</strong></div>
                        <div><span>Amount Due Carrier</span><strong>{currency.format(payableAmount)}</strong></div>
                        <div><span>Due Date</span><strong>{formatDate(dueDate)}</strong></div>
                      </div>
                      <div className="admin-remittance-meta">
                        <span className={`transaction-status transaction-status--${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
                        {payment.referenceNumber && <small>Ref {payment.referenceNumber}</small>}
                        {payment.receiptNumber && <small>Receipt {payment.receiptNumber}</small>}
                      </div>
                      <div className="admin-remittance-actions">
                        <button className="utility-action" type="button" onClick={() => openClientFolder(payment.clientId, 'Billing')}>Open Folder</button>
                        {status !== 'Scheduled' && <button className="secondary-action inline-action" type="button" onClick={() => updateRemittanceStatus(payment.id, 'Scheduled')}>Schedule</button>}
                        {status !== 'Paid' && <button className="primary-action inline-action" type="button" onClick={() => updateRemittanceStatus(payment.id, 'Paid')}>Mark Paid</button>}
                      </div>
                    </div>
                  ))}
                  {agencyBillRemittanceQueue.length === 0 && <div className="empty-state">No agency-bill remittances are currently queued.</div>}
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <span className="section-kicker">Binder log</span>
                    <h2>Bound business control log</h2>
                    <p>Team binder entries appear here for owner oversight after they are logged in Binder Log.</p>
                  </div>
                </div>
                <div className="binder-log-list">
                  {binderLog.map((binder) => (
                    <div className="binder-log-row" key={binder.id}>
                      <div>
                        <strong>{binder.client?.name ?? 'Unknown client'}</strong>
                        <span>{binder.policy?.policyType ?? 'Policy'} - {binder.policy?.carrier ?? 'Carrier pending'}</span>
                        <em>Bound {binder.binderDate ? formatDate(binder.binderDate) : 'Date not set'} - expires {binder.expirationDate ? formatDate(binder.expirationDate) : 'Not set'}</em>
                      </div>
                      <div>
                        <span className={`transaction-status transaction-status--${String(binder.status).toLowerCase().replace(/\s+/g, '-')}`}>{binder.status}</span>
                        <strong>{currency.format(binder.premium)}</strong>
                        <small>{binder.boundBy}</small>
                      </div>
                      <button className="utility-action" type="button" onClick={() => binder.policy && openClientFolder(binder.policy.clientId, 'Policies', 'binder')}>Open Policy</button>
                    </div>
                  ))}
                  {binderLog.length === 0 && <div className="empty-state">No binders have been logged yet.</div>}
                </div>
              </article>
            </section>
          </section>
        ) : (
          <>
        <section className="page-heading">
          <div>
            <p className="eyebrow">CSR dashboard</p>
            <h1>Daily Service Desk</h1>
            <p className="account-context">
              {dataset.currentUser.role} - {dataset.agency.plan} account -{' '}
              tasks, renewals, prospects, and recent client activity
            </p>
          </div>
        </section>

        <section className="metric-grid command-metric-grid" aria-label="Daily command metrics">
          {dashboardFocusMetrics.map((metric) => (
            <button className="metric-card metric-card--clickable" type="button" key={metric.label} onClick={() => handleDashboardMetricClick(metric.id)}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
              <small>{metric.trend} <ChevronRight size={13} aria-hidden="true" /></small>
            </button>
          ))}
        </section>

        <section className="agent-workbench panel" aria-label="Agent workbench">
          <div className="panel-header agent-workbench-header">
            <div>
              <span className="section-kicker">Work queue</span>
              <h2>What needs attention right now</h2>
              <p>Click any item to jump straight into the client file, renewal desk, or lead pipeline.</p>
            </div>
            <div className="workbench-summary">
              <strong>{agentWorkbenchQueues.reduce((sum, queue) => sum + queue.count, 0)}</strong>
              <span>open signals</span>
            </div>
          </div>
          <div className="workbench-grid">
            {agentWorkbenchQueues.map((queue) => (
              <div className="workbench-lane" key={queue.id}>
                <div className="workbench-lane-header">
                  <div>
                    <strong>{queue.title}</strong>
                    <span>{queue.subtitle}</span>
                  </div>
                  <em>{queue.count}</em>
                </div>
                <div className="workbench-list">
                  {queue.items.length > 0 ? queue.items.map((item) => (
                    <button
                      className={`workbench-item workbench-item--${item.tone}`}
                      type="button"
                      key={item.id}
                      onClick={() => handleWorkbenchAction(item.action)}
                    >
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <div className="workbench-item-side">
                        <small>{item.meta}</small>
                        <b>{item.actionLabel}<ChevronRight size={13} aria-hidden="true" /></b>
                      </div>
                    </button>
                  )) : (
                    <div className="workbench-empty">
                      <strong>Clear</strong>
                      <span>No open items in this queue.</span>
                    </div>
                  )}
                </div>
                {queue.count > queue.items.length && (
                  <button className="workbench-view-all" type="button" onClick={() => handleWorkbenchAction(queue.viewAllAction)}>
                    {queue.viewAllLabel}
                    <span>{queue.count - queue.items.length} more</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {canSeeOwnerAnalytics && (
        <section className="structured-reports panel" aria-label="Structured reports">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Reports from structured records</span>
              <h2>Book health and reconciliation</h2>
              <p>Claims, certificates, payments, commissions, exposure schedules, and cross-sell gaps from the client book.</p>
            </div>
          </div>
          <div className="structured-report-grid">
            {structuredReports.map((report) => (
              <button
                className="structured-report-card"
                type="button"
                key={report.title}
                onClick={() => showToast(`${report.title} report opened`)}
              >
                <span>{report.title}</span>
                <strong>{report.value}</strong>
                <p>{report.detail}</p>
              </button>
            ))}
          </div>
        </section>
        )}


          </>
        )}
      </main>

      {aiHelpOpen && (
        <aside className="ai-help-panel" aria-label="AgencyIQ AI help">
          <div className="ai-help-header">
            <div className="ai-help-mascot-row">
              <div className="ai-panel-mascot-wrap">
                <img src={mascotImg} alt="AgencyIQ assistant" className="ai-panel-mascot" />
              </div>
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
              <div className="ai-mascot-wrap"><img src={mascotImg} alt="" className="ai-loading-mascot" aria-hidden="true" /></div>
              <span className="ai-loading-dot" /><span className="ai-loading-dot" /><span className="ai-loading-dot" />
              <span>Thinking…</span>
            </div>
          )}

          {aiAnswer && !aiLoading && (
            <div className="ai-answer-panel">
              <div className="ai-answer-header">
                <div className="ai-mascot-wrap"><img src={mascotImg} alt="" className="ai-answer-mascot" aria-hidden="true" /></div>
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

      {modal === 'cloudFolder' && selectedClient && (
        <CloudFolderModal
          clientName={selectedClient.name}
          folder={selectedClientCloudFolder}
          onClose={() => setModal(null)}
          onSave={saveCloudFolder}
        />
      )}

      {/* ─── Edit Policy Modal ───────────────────────────────── */}
      {modal === 'editPolicy' && editingPolicyId && (() => {
        const pol = dataset.policies.find((p) => p.id === editingPolicyId)
        if (!pol) return null
        return (
          <EditPolicyModal
            key={pol.id}
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

      {/* ─── Edit Coverage Details Modal ─────────────────────────── */}
      {modal === 'editCoverage' && coveragePolicyId && (() => {
        const pol = dataset.policies.find((p) => p.id === coveragePolicyId)
        if (!pol) return null
        return (
          <CoverageDetailsModal
            key={pol.id}
            policy={pol}
            onClose={() => { setModal(null); setCoveragePolicyId(null) }}
            onSave={(coverageDetails) => updatePolicyCoverageDetails(coveragePolicyId, coverageDetails)}
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

      {/* Related Party Modal */}
      {modal === 'addRelatedParty' && selectedClient && (
        <AddRelatedPartyModal
          clientName={selectedClient.name}
          policies={clientPolicies}
          onClose={() => setModal(null)}
          onSave={addRelatedParty}
        />
      )}

      {/* Policy Transaction Modal */}
      {modal === 'addPolicyTransaction' && transactionPolicyId && (() => {
        const policy = dataset.policies.find((item) => item.id === transactionPolicyId)
        if (!policy) return null
        return (
          <AddPolicyTransactionModal
            policy={policy}
            currentUserName={dataset.currentUser.name}
            onClose={() => { setModal(null); setTransactionPolicyId(null) }}
            onSave={(data) => addPolicyTransaction(policy.id, data)}
          />
        )
      })()}

      {/* Claim Modal */}
      {modal === 'addClaim' && selectedClient && (
        <AddClaimModal
          clientName={selectedClient.name}
          policies={clientPolicies}
          onClose={() => setModal(null)}
          onSave={addClaim}
        />
      )}

      {modal === 'addRiskAsset' && selectedClient && (
        <AddRiskAssetModal
          clientName={selectedClient.name}
          policies={clientPolicies}
          onClose={() => setModal(null)}
          onSave={addRiskAsset}
        />
      )}

      {modal === 'addPayment' && selectedClient && (
        <AddPaymentModal
          clientName={selectedClient.name}
          policies={clientPolicies}
          currentUserName={dataset.currentUser.name}
          onClose={() => setModal(null)}
          onSave={addPayment}
        />
      )}

      {modal === 'addBinderEntry' && (
        <AddBinderEntryModal
          clients={dataset.clients}
          nextBinderNumber={nextBinderNumber}
          mode="add"
          onClose={() => setModal(null)}
          onSave={addBinderEntry}
        />
      )}

      {modal === 'editBinderEntry' && editingBinderEntry && editingBinderInitialValues && (
        <AddBinderEntryModal
          clients={dataset.clients}
          nextBinderNumber={editingBinderEntry.binderNumber}
          mode="edit"
          initialValues={editingBinderInitialValues}
          onClose={() => {
            setModal(null)
            setEditingBinderEntryId(null)
          }}
          onBackToBinderLog={() => {
            setModal(null)
            setEditingBinderEntryId(null)
            setActiveView('binder')
          }}
          onSave={(data) => editBinderEntry(editingBinderEntry.id, data)}
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
          canManageCredentials={isCredentialManagerRole(dataset.currentUser.role)}
          vaultConfigured={!!supabase && !!supabaseFunctionsUrl}
          onClose={() => setModal(null)}
          onSave={saveCarrierPortal}
          onSavePassword={saveCarrierPassword}
          onCopyUsername={(entry) => copyToClipboard(entry.username, 'Username copied')}
          onCopyPassword={copyCarrierPassword}
          onRevealPassword={revealCarrierPassword}
          onCopyCode={(value, label) => copyToClipboard(value, `${label} copied`)}
          onOpenPortal={(entry) => openCarrierPortal(entry)}
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

      {/* ─── IQ Buddy draggable mascot ───────────────────────── */}
      <IqBuddy
        onOpen={() => setAiHelpOpen(true)}
        activeView={activeView}
        clientTab={clientTab}
      />

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

    </div>
  )
}

/* ─── Renewal Center ────────────────────────────────────────────── */

function DataCenter({
  dataset,
  supabaseConfigured,
  onDownloadLocalExport,
  onImportPortableJson,
  onClearLocalData,
  onCreateSupabaseExport,
  onCreateImportBatch,
}: {
  dataset: CrmDataset
  supabaseConfigured: boolean
  onDownloadLocalExport: () => void
  onImportPortableJson: (file: File) => Promise<void>
  onClearLocalData: () => void
  onCreateSupabaseExport: () => Promise<void>
  onCreateImportBatch: (file: File, preview: ImportPreview, mapping: ImportMapping) => Promise<void>
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<ImportMapping>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const text = await file.text()
      const parsed = parseCsvText(text)
      setSelectedFile(file)
      setPreview(parsed)
      setMapping(guessImportMapping(parsed.headers))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that CSV file')
    } finally {
      setBusy(false)
    }
  }

  const stageImport = async () => {
    if (!selectedFile || !preview) return
    setBusy(true)
    setError('')
    try {
      await onCreateImportBatch(selectedFile, preview, mapping)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stage import')
    } finally {
      setBusy(false)
    }
  }

  const importPortableJson = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await onImportPortableJson(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import JSON export')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="clients-page data-center-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Data safety</p>
          <h1>Import, Export & Backup Center</h1>
          <p className="account-context">
            Prepare production imports and data portability without changing the demo CRM data currently stored in this browser.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onDownloadLocalExport}>
          <Download size={16} /> Download Full JSON
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() => setClearConfirmOpen(true)}
        >
          <Trash2 size={16} /> Clear Local Data
        </button>
        <label className="secondary-action file-picker-action">
          <Upload size={16} />
          Import QuickFile JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => { void importPortableJson(event.target.files?.[0]) }}
          />
        </label>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <UsersRound size={21} aria-hidden="true" />
          <span>Current local clients</span>
          <strong>{dataset.clients.length}</strong>
          <p>{dataset.policies.length} policies and {dataset.notes.length} notes currently loaded in this browser.</p>
        </article>
        <article className="metric-card">
          <ShieldCheck size={21} aria-hidden="true" />
          <span>Tenant isolation</span>
          <strong>RLS ready</strong>
          <p>Production tables are scoped by agency membership and account id.</p>
        </article>
        <article className="metric-card">
          <Upload size={21} aria-hidden="true" />
          <span>Import staging</span>
          <strong>CSV mapping</strong>
          <p>Uploads land in staging tables first so messy source data can be reviewed.</p>
        </article>
        <article className="metric-card">
          <Download size={21} aria-hidden="true" />
          <span>Portability</span>
          <strong>Export jobs</strong>
          <p>Agencies can receive full client, policy, note, and document exports.</p>
        </article>
        <article className="metric-card">
          <Database size={21} aria-hidden="true" />
          <span>Backup posture</span>
          <strong>Offsite-ready</strong>
          <p>Backup run tracking is ready for scheduled database and storage archives.</p>
        </article>
      </section>

      {clearConfirmOpen && (
        <section className="data-danger-zone" aria-label="Clear local data confirmation">
          <div>
            <span className="section-kicker">Safety confirmation</span>
            <h2>Clear local browser data?</h2>
            <p>
              This removes local clients, policies, notes, tasks, binder entries, payments, and imported QuickFile test data from this browser.
              Download a full JSON backup first if you may need to restore this exact local workspace.
            </p>
          </div>
          <label className="modal-field">
            <span>Type CLEAR LOCAL DATA to confirm</span>
            <input
              value={clearConfirmText}
              onChange={(event) => setClearConfirmText(event.target.value)}
              placeholder="CLEAR LOCAL DATA"
            />
          </label>
          <div className="data-danger-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                setClearConfirmOpen(false)
                setClearConfirmText('')
              }}
            >
              Cancel
            </button>
            <button
              className="primary-action danger-action"
              type="button"
              disabled={clearConfirmText !== 'CLEAR LOCAL DATA'}
              onClick={() => {
                onClearLocalData()
                setClearConfirmOpen(false)
                setClearConfirmText('')
              }}
            >
              <Trash2 size={16} /> Clear Local Data
            </button>
          </div>
        </section>
      )}

      <section className="content-grid">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <h2>CRM Import Wizard</h2>
              <p>Upload a CSV from another CRM, map its columns, then stage it for validation.</p>
            </div>
            <span className={supabaseConfigured ? 'status-pill' : 'status-pill muted'}>{supabaseConfigured ? 'Supabase connected' : 'Demo mode'}</span>
          </div>

          <div className="data-upload-row">
            <label className="secondary-action file-picker-action">
              <Upload size={16} />
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => { void handleFile(event.target.files?.[0]) }}
              />
            </label>
            <span>{selectedFile ? selectedFile.name : 'No file selected'}</span>
          </div>

          {error && <div className="empty-state data-error">{error}</div>}

          {preview && (
            <>
              <div className="data-import-summary">
                <div><span>Rows detected</span><strong>{preview.rowCount}</strong></div>
                <div><span>Columns detected</span><strong>{preview.headers.length}</strong></div>
                <div><span>Required mapping</span><strong>{mapping.client_name ? 'Ready' : 'Needs client name'}</strong></div>
              </div>

              <div className="data-mapping-grid">
                {IMPORT_FIELDS.map((field) => (
                  <label className="modal-field" key={field.key}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      <option value="">Do not import</option>
                      {preview.headers.map((header) => (
                        <option value={header} key={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {preview.headers.slice(0, 8).map((header) => <th key={header}>{header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 5).map((row, index) => (
                      <tr key={`preview-${index}`}>
                        {preview.headers.slice(0, 8).map((header) => <td key={header}>{row[header]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel-actions">
                <button
                  className="primary-action"
                  type="button"
                  disabled={busy || !mapping.client_name}
                  onClick={() => { void stageImport() }}
                >
                  Stage Import Batch
                </button>
              </div>
            </>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Current Demo Data</h2>
              <p>This remains local so your test flow stays intact.</p>
            </div>
          </div>
          <div className="placeholder-grid">
            <div><strong>{dataset.clients.length}</strong><span>Clients in demo storage</span></div>
            <div><strong>{dataset.policies.length}</strong><span>Policies in demo storage</span></div>
            <div><strong>{dataset.notes.length}</strong><span>Notes in demo storage</span></div>
            <div><strong>{dataset.tasks.length}</strong><span>Tasks in demo storage</span></div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Production Export Queue</h2>
              <p>Create a Supabase export job for a full account archive.</p>
            </div>
          </div>
          <div className="placeholder-grid">
            <div><strong>JSON</strong><span>Full account export for portability.</span></div>
            <div><strong>CSV</strong><span>Client and policy spreadsheets for handoff.</span></div>
            <div><strong>ZIP</strong><span>Documents plus structured data for disaster recovery.</span></div>
          </div>
          <div className="panel-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={busy || !supabaseConfigured}
              onClick={() => { void onCreateSupabaseExport() }}
            >
              Queue Supabase Export
            </button>
          </div>
        </article>
      </section>
    </section>
  )
}

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
  renewalPolicies, allRenewalPolicies,
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
  onOpenClient, onOpenIvans, ivansLastGlobalSync, ivansFeatureEnabled,
  showToast,
  currency, formatDate,
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
  renewalOutreachModal: 'email' | null
  setRenewalOutreachModal: (v: 'email' | null) => void
  renewalSort: 'date' | 'name' | 'carrier' | 'billing'
  setRenewalSort: (v: 'date' | 'name' | 'carrier' | 'billing') => void
  renewalPremiumEdits: Record<string, string>
  setRenewalPremiumEdits: (v: Record<string, string>) => void
  saveRenewalPremium: (policyId: string, val: string) => void
  exportRenewalsCsv: (items: RenewalPolicyItem[]) => void
  onOpenClient: (clientId: string) => void
  onOpenIvans: () => void
  ivansLastGlobalSync: string | null
  ivansFeatureEnabled: boolean
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

  const openRenewalEmail = () => {
    const selectedItems = renewalPolicies.filter((item) => selectedIds.has(item.policy.id))
    const recipients = selectedItems
      .map((item) => item.client?.email)
      .filter((email): email is string => Boolean(email))

    if (recipients.length === 0) {
      showToast('No selected renewal clients have email addresses')
      return
    }

    const template = emailTemplates.find((item) => item.id === selectedTemplate)
    const subject = template?.subject ?? 'Renewal reminder'
    const body = template?.body ?? 'Hello, I am reaching out about your upcoming renewal.'
    const query = new URLSearchParams({ subject, body })
    window.location.assign(`mailto:${recipients.join(',')}?${query.toString()}`)
    showToast(`Opening email draft for ${recipients.length} client${recipients.length === 1 ? '' : 's'}`)
    setRenewalOutreachModal(null)
  }

  const openRenewalCall = (phone?: string) => {
    const dialable = phone?.replace(/[^\d+]/g, '')
    if (!dialable) {
      showToast('No phone number on file')
      return
    }
    window.location.assign(`tel:${dialable}`)
  }

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
          {ivansFeatureEnabled && (
            <button className="utility-action ivans-launch-btn" type="button" onClick={onOpenIvans} title="Go to IVANS Sync in Clients">
              <Zap size={15} />
              IVANS Sync
              {ivansLastGlobalSync && <span className="ivans-btn-sync-time">{ivansLastGlobalSync.slice(0, 10)}</span>}
            </button>
          )}
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
            const billingDisplay = item.billingMethod || item.paymentPlan || policy.billingType || '-'
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
                          type="text"
                          inputMode="decimal"
                          value={editVal}
                          autoFocus
                          onChange={(e) => setRenewalPremiumEdits({ ...renewalPremiumEdits, [policy.id]: e.target.value })}
                          onBlur={(e) => setRenewalPremiumEdits({ ...renewalPremiumEdits, [policy.id]: formatMoneyInput(e.target.value) })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenewalPremium(policy.id, editVal)
                            if (e.key === 'Escape') setRenewalPremiumEdits(Object.fromEntries(Object.entries(renewalPremiumEdits).filter(([k]) => k !== policy.id)))
                          }}
                        />
                        <button className="renewal-premium-save" type="button" onClick={() => saveRenewalPremium(policy.id, editVal)}>Save</button>
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
                  <details className="ai-tip-details">
                    <summary>Details</summary>
                    <span>{ai.tip}</span>
                  </details>
                </div>

                {/* Col 6: Actions */}
                <div className="rc-col rc-col-actions">
                  <button className="utility-action renewal-quick-action" type="button" title="Send email reminder"
                    onClick={() => { if (!selectedIds.has(policy.id)) toggleSelection(policy.id); setRenewalOutreachModal('email') }}>
                    <Mail size={14} />
                  </button>
                  <button className="utility-action renewal-quick-action" type="button" title="Call client"
                    onClick={() => openRenewalCall(client?.phone)}>
                    <PhoneCall size={14} />
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
              <h2>Email Reminder - {selectedIds.size} client{selectedIds.size === 1 ? '' : 's'}</h2>
              <button className="icon-button modal-close" type="button" onClick={() => setRenewalOutreachModal(null)}><X size={18} /></button>
            </div>
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
                    <option value="">Select a template</option>
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
              </div>
            <div className="modal-footer">
              <button className="secondary-action" type="button" onClick={() => setRenewalOutreachModal(null)}>Cancel</button>
              <button
                className="primary-action"
                type="button"
                onClick={openRenewalEmail}
              >
                <Send size={15} /> Open Email Draft
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

function PolicyCoverageSection({ policy, onEdit }: { policy: Policy; onEdit: () => void }) {
  const schema = getCoverageSchema(policy)
  const details = getPolicyCoverageDetails(policy)
  const flags = getCoverageReviewFlags(policy)
  const hasAnyCoverage = schema.groups.some((group) =>
    group.fields.some((fieldDef) => details[fieldDef.id]?.trim())
  )

  return (
    <div className="coverage-snapshot coverage-snapshot--typed">
      <div className="coverage-snapshot-header">
        <ClipboardCheck size={17} />
        <div>
          <h3>{schema.title}</h3>
          <p>{countCompletedRequiredCoverageFields(policy)} of {countRequiredCoverageFields(policy)} required fields completed.</p>
        </div>
        <button className="secondary-action inline-action coverage-edit-button" type="button" onClick={(event) => { event.preventDefault(); onEdit() }}>
          {hasAnyCoverage ? 'Edit Coverage Details' : 'Add Coverage Details'}
        </button>
      </div>

      {!hasAnyCoverage ? (
        <div className="coverage-empty-state">
          <strong>No coverage details entered yet for this policy.</strong>
          <button className="primary-action inline-action" type="button" onClick={(event) => { event.preventDefault(); onEdit() }}>
            Add Coverage Details
          </button>
        </div>
      ) : (
        <div className="coverage-schema-groups">
          {schema.groups.map((group) => (
            <div className="coverage-schema-group" key={group.title}>
              <h4>{group.title}</h4>
              <div className="coverage-snapshot-grid">
                {group.fields.map((fieldDef) => {
                  const value = details[fieldDef.id]?.trim()
                  return (
                    <div className={value ? 'coverage-snapshot-item' : 'coverage-snapshot-item coverage-snapshot-item--warning'} key={fieldDef.id}>
                      <span>{fieldDef.label}{fieldDef.required ? ' *' : ''}</span>
                      <strong>{value || 'Not entered'}</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={flags.length > 0 ? 'coverage-review-flags coverage-review-flags--warning' : 'coverage-review-flags'}>
        <span>Review flags</span>
        <strong>{flags.length > 0 ? flags.join(', ') : 'Required coverage fields are complete for this policy type.'}</strong>
      </div>
    </div>
  )
}

function CoverageEditorFields({ policy, details, onChange }: {
  policy: Pick<Policy, 'policyType' | 'lineOfBusiness'>
  details: PolicyCoverageDetails
  onChange: (details: PolicyCoverageDetails) => void
}) {
  const schema = getCoverageSchema(policy)
  const setField = (id: string, value: string) => onChange({ ...details, [id]: value })

  return (
    <div className="modal-field modal-field--full coverage-edit-section">
      <span>{schema.title}</span>
      <div className="coverage-editor-groups">
        {schema.groups.map((group) => (
          <div className="coverage-editor-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="coverage-edit-grid">
              {group.fields.map((fieldDef) => (
                <label key={fieldDef.id}>
                  <span>{fieldDef.label}{fieldDef.required ? ' *' : ''}</span>
                  <input
                    value={details[fieldDef.id] ?? ''}
                    onChange={(e) => setField(fieldDef.id, e.target.value)}
                    onBlur={(e) => setField(fieldDef.id, formatCoverageValue(e.target.value, fieldDef))}
                    placeholder={coveragePlaceholder(fieldDef)}
                    inputMode={getCoverageFieldFormat(fieldDef) === 'text' ? 'text' : 'decimal'}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CoverageDetailsModal({ policy, onClose, onSave }: {
  policy: Policy
  onClose: () => void
  onSave: (details: PolicyCoverageDetails) => void
}) {
  const [details, setDetails] = useState<PolicyCoverageDetails>(() => getPolicyCoverageDetails(policy))
  const schema = getCoverageSchema(policy)

  return (
    <ModalShell title={`Edit ${schema.title} - ${policy.policyType}`} onClose={onClose}>
      <div className="modal-form">
        <CoverageEditorFields policy={policy} details={details} onChange={setDetails} />
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => onSave(details)}>Save Coverage Details</button>
      </div>
    </ModalShell>
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
  onSave: (data: { policyType: string; carrier: string; policyNumber: string; premium: string; commissionRate: string; effectiveDate: string; expirationDate: string; billingType: string; lineOfBusiness: string; coverageDetails: PolicyCoverageDetails }) => void
  allPolicyTypes: string[]
  allCarriers: string[]
  onAddPolicyType: (t: string) => void
  onAddCarrier: (c: string) => void
}) {
  const [form, setForm] = useState({ policyType: '', carrier: '', policyNumber: '', premium: '', commissionRate: '', effectiveDate: '', expirationDate: '', billingType: 'Direct Bill', lineOfBusiness: 'Personal lines' })
  const [coverageDetails, setCoverageDetails] = useState<PolicyCoverageDetails>({})
  const [focusedField, setFocusedField] = useState('default')
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  const tips = POLICY_IQ_TIPS[focusedField] ?? POLICY_IQ_TIPS.default
  const previewPolicy = { policyType: form.policyType || 'Other', lineOfBusiness: form.lineOfBusiness as Policy['lineOfBusiness'] }
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
              <input type="text" inputMode="decimal" value={form.premium} onChange={(e) => set('premium', e.target.value)} onBlur={(e) => set('premium', formatMoneyInput(e.target.value))} placeholder="$1,000.00" />
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
              <input type="text" inputMode="numeric" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} onBlur={(e) => set('effectiveDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
            </label>
            <label className="modal-field" data-field="expirationDate">
              <span>Expiration Date *</span>
              <input type="text" inputMode="numeric" value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} onBlur={(e) => set('expirationDate', formatDateInput(e.target.value))} placeholder="04/01/2027" />
            </label>
            <label className="modal-field modal-field--full" data-field="billingType">
              <span>Billing Type</span>
              <select value={form.billingType} onChange={(e) => set('billingType', e.target.value)}>
                <option value="Direct Bill">Direct Bill</option>
                <option value="Agency Bill">Agency Bill</option>
                <option value="Financed">Financed</option>
              </select>
            </label>
            <CoverageEditorFields
              policy={previewPolicy}
              details={coverageDetails}
              onChange={setCoverageDetails}
            />
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
          onClick={() => onSave({ ...form, coverageDetails })}
        >
          Add Policy
        </button>
      </div>
    </ModalShell>
  )
}

function AddRelatedPartyModal({ clientName, policies, onClose, onSave }: {
  clientName: string
  policies: Policy[]
  onClose: () => void
  onSave: (data: Omit<RelatedParty, 'id' | 'accountId' | 'clientId'>) => void
}) {
  const [form, setForm] = useState({
    type: 'Additional Contact' as RelatedPartyType,
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    referenceNumber: '',
    preference: '' as '' | NonNullable<RelatedParty['preference']>,
    policyId: '',
    isPrimary: false,
    doNotEmail: false,
    doNotCall: false,
    notes: '',
  })
  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <ModalShell title={`Add Related Party - ${clientName}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Party Type *</span>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {relatedPartyTypes.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Linked Policy</span>
          <select value={form.policyId} onChange={(e) => set('policyId', e.target.value)}>
            <option value="">Client-level party</option>
            {policies.map((policy) => (
              <option value={policy.id} key={policy.id}>
                {policy.policyType} - {policy.carrier}{policy.policyNumber ? ` (${policy.policyNumber})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Name / Organization *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Company, person, mortgagee, certificate holder..." autoFocus />
        </label>
        <label className="modal-field">
          <span>Contact Name</span>
          <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Person or department" />
        </label>
        <label className="modal-field">
          <span>Preferred Contact</span>
          <select value={form.preference} onChange={(e) => set('preference', e.target.value)}>
            <option value="">Not set</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
            <option value="Mail">Mail</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Phone</span>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', formatPhoneInput(e.target.value))} placeholder="(555) 123-4567" />
        </label>
        <label className="modal-field modal-field--full">
          <span>Address / Clause</span>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Mailing address, mortgagee clause, certificate holder address..." />
        </label>
        <label className="modal-field">
          <span>Reference / Loan / Contract #</span>
          <input value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
        </label>
        <div className="modal-check-grid">
          <label><input type="checkbox" checked={form.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} /> Primary for this role</label>
          <label><input type="checkbox" checked={form.doNotEmail} onChange={(e) => set('doNotEmail', e.target.checked)} /> Do not email</label>
          <label><input type="checkbox" checked={form.doNotCall} onChange={(e) => set('doNotCall', e.target.checked)} /> Do not call</label>
        </div>
        <label className="modal-field modal-field--full">
          <span>Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Certificate wording, billing instructions, relationship notes, best time to call..." />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.name.trim()}
          onClick={() => onSave({
            ...form,
            policyId: form.policyId || undefined,
            preference: form.preference || undefined,
          })}
        >
          Save Related Party
        </button>
      </div>
    </ModalShell>
  )
}

function AddPolicyTransactionModal({ policy, currentUserName, onClose, onSave }: {
  policy: Policy
  currentUserName: string
  onClose: () => void
  onSave: (data: Omit<PolicyTransaction, 'id' | 'accountId' | 'clientId' | 'policyId'>) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    type: 'Endorsement' as PolicyTransactionType,
    status: 'Requested' as PolicyTransactionStatus,
    requestedDate: formatDateInput(today),
    effectiveDate: '',
    completedDate: '',
    premiumChange: '',
    description: '',
    carrierContact: '',
    requestedBy: currentUserName,
    notes: '',
  })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <ModalShell title={`Add Transaction - ${policy.policyType}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Transaction Type *</span>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {policyTransactionTypes.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Status *</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {policyTransactionStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Requested Date</span>
          <input type="text" inputMode="numeric" value={form.requestedDate} onChange={(e) => set('requestedDate', e.target.value)} onBlur={(e) => set('requestedDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Effective Date</span>
          <input type="text" inputMode="numeric" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} onBlur={(e) => set('effectiveDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Completed Date</span>
          <input type="text" inputMode="numeric" value={form.completedDate} onChange={(e) => set('completedDate', e.target.value)} onBlur={(e) => set('completedDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Premium Change ($)</span>
          <input type="text" inputMode="decimal" value={form.premiumChange} onChange={(e) => set('premiumChange', e.target.value)} onBlur={(e) => set('premiumChange', formatMoneyInput(e.target.value))} placeholder="$1,000.00 or -$500.00" />
        </label>
        <label className="modal-field">
          <span>Carrier / Underwriter Contact</span>
          <input value={form.carrierContact} onChange={(e) => set('carrierContact', e.target.value)} placeholder="Carrier contact, underwriter, service desk..." />
        </label>
        <label className="modal-field">
          <span>Requested By</span>
          <input value={form.requestedBy} onChange={(e) => set('requestedBy', e.target.value)} />
        </label>
        <label className="modal-field modal-field--full">
          <span>Description *</span>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Example: Add vehicle, issue binder, cancellation notice, renewal quote received..." autoFocus />
        </label>
        <label className="modal-field modal-field--full">
          <span>Internal Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Open items, delivery notes, invoice instructions, follow-up reminders..." />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.description.trim()}
          onClick={() => onSave({
            type: form.type,
            status: form.status,
            requestedDate: form.requestedDate || undefined,
            effectiveDate: form.effectiveDate || undefined,
            completedDate: form.completedDate || undefined,
            premiumChange: form.premiumChange ? parseMoneyInput(form.premiumChange) : undefined,
            description: form.description,
            carrierContact: form.carrierContact || undefined,
            requestedBy: form.requestedBy || undefined,
            notes: form.notes || undefined,
          })}
        >
          Save Transaction
        </button>
      </div>
    </ModalShell>
  )
}

function AddClaimModal({ clientName, policies, onClose, onSave }: {
  clientName: string
  policies: Policy[]
  onClose: () => void
  onSave: (data: Omit<ClaimRecord, 'id' | 'accountId' | 'clientId'> & { createFollowUpTask?: boolean }) => void
}) {
  const today = formatDateInput(new Date().toISOString().slice(0, 10))
  const [form, setForm] = useState({
    policyId: '',
    claimNumber: '',
    carrierClaimNumber: '',
    dateOfLoss: '',
    reportedDate: today,
    status: 'Open' as ClaimStatus,
    adjusterName: '',
    adjusterPhone: '',
    adjusterEmail: '',
    paidAmount: '',
    reserveAmount: '',
    description: '',
    documentsStatus: 'Needed' as NonNullable<ClaimRecord['documentsStatus']>,
    includeInLossRuns: true,
    followUpDate: '',
    createFollowUpTask: true,
    notes: '',
  })
  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <ModalShell title={`Add Claim - ${clientName}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Linked Policy</span>
          <select value={form.policyId} onChange={(e) => set('policyId', e.target.value)}>
            <option value="">Client-level claim</option>
            {policies.map((policy) => (
              <option value={policy.id} key={policy.id}>
                {policy.policyType} - {policy.carrier}{policy.policyNumber ? ` (${policy.policyNumber})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="modal-field">
          <span>Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {claimStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Agency Claim #</span>
          <input value={form.claimNumber} onChange={(e) => set('claimNumber', e.target.value)} placeholder="CLM-001" />
        </label>
        <label className="modal-field">
          <span>Carrier Claim #</span>
          <input value={form.carrierClaimNumber} onChange={(e) => set('carrierClaimNumber', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Date of Loss *</span>
          <input type="text" inputMode="numeric" value={form.dateOfLoss} onChange={(e) => set('dateOfLoss', e.target.value)} onBlur={(e) => set('dateOfLoss', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Reported Date</span>
          <input type="text" inputMode="numeric" value={form.reportedDate} onChange={(e) => set('reportedDate', e.target.value)} onBlur={(e) => set('reportedDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Paid Amount</span>
          <input type="text" inputMode="decimal" value={form.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} onBlur={(e) => set('paidAmount', formatMoneyInput(e.target.value))} placeholder="$1,000.00" />
        </label>
        <label className="modal-field">
          <span>Reserve Amount</span>
          <input type="text" inputMode="decimal" value={form.reserveAmount} onChange={(e) => set('reserveAmount', e.target.value)} onBlur={(e) => set('reserveAmount', formatMoneyInput(e.target.value))} placeholder="$1,000.00" />
        </label>
        <label className="modal-field">
          <span>Adjuster Name</span>
          <input value={form.adjusterName} onChange={(e) => set('adjusterName', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Adjuster Phone</span>
          <input type="tel" value={form.adjusterPhone} onChange={(e) => set('adjusterPhone', formatPhoneInput(e.target.value))} placeholder="(555) 123-4567" />
        </label>
        <label className="modal-field">
          <span>Adjuster Email</span>
          <input type="email" value={form.adjusterEmail} onChange={(e) => set('adjusterEmail', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Documents</span>
          <select value={form.documentsStatus} onChange={(e) => set('documentsStatus', e.target.value)}>
            <option value="Needed">Needed</option>
            <option value="Requested">Requested</option>
            <option value="Received">Received</option>
            <option value="Reviewed">Reviewed</option>
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Description *</span>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What happened?" autoFocus />
        </label>
        <label className="modal-field">
          <span>Follow-Up Date</span>
          <input type="text" inputMode="numeric" value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} onBlur={(e) => set('followUpDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <div className="modal-check-grid">
          <label><input type="checkbox" checked={form.includeInLossRuns} onChange={(e) => set('includeInLossRuns', e.target.checked)} /> Include in loss runs</label>
          <label><input type="checkbox" checked={form.createFollowUpTask} onChange={(e) => set('createFollowUpTask', e.target.checked)} /> Create follow-up task</label>
        </div>
        <label className="modal-field modal-field--full">
          <span>Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Adjuster notes, missing documents, next steps..." />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          disabled={!form.dateOfLoss.trim() || !form.description.trim()}
          onClick={() => onSave({
            policyId: form.policyId || undefined,
            claimNumber: form.claimNumber || undefined,
            carrierClaimNumber: form.carrierClaimNumber || undefined,
            dateOfLoss: form.dateOfLoss,
            reportedDate: form.reportedDate || undefined,
            status: form.status,
            adjusterName: form.adjusterName || undefined,
            adjusterPhone: form.adjusterPhone || undefined,
            adjusterEmail: form.adjusterEmail || undefined,
            paidAmount: form.paidAmount ? parseMoneyInput(form.paidAmount) : undefined,
            reserveAmount: form.reserveAmount ? parseMoneyInput(form.reserveAmount) : undefined,
            description: form.description,
            documentsStatus: form.documentsStatus,
            includeInLossRuns: form.includeInLossRuns,
            followUpDate: form.followUpDate || undefined,
            createFollowUpTask: form.createFollowUpTask,
            notes: form.notes || undefined,
          })}
        >
          Save Claim
        </button>
      </div>
    </ModalShell>
  )
}

function AddRiskAssetModal({ clientName, policies, onClose, onSave }: {
  clientName: string
  policies: Policy[]
  onClose: () => void
  onSave: (data: Omit<RiskAsset, 'id' | 'accountId' | 'clientId'>) => void
}) {
  const [form, setForm] = useState({
    type: 'Commercial Location' as RiskAssetType,
    name: '',
    policyId: '',
    status: 'Active' as NonNullable<RiskAsset['status']>,
    address: '',
    year: '',
    make: '',
    model: '',
    vin: '',
    driverLicenseNumber: '',
    driverLicenseState: '',
    dateOfBirth: '',
    annualMileage: '',
    usage: '',
    payroll: '',
    annualSales: '',
    squareFootage: '',
    constructionType: '',
    occupancy: '',
    roofYear: '',
    protectionClass: '',
    notes: '',
  })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  const isVehicle = form.type === 'Vehicle'
  const isDriver = form.type === 'Driver'
  const isPropertyLike = form.type === 'Property' || form.type === 'Commercial Location'

  return (
    <ModalShell title={`Add Exposure - ${clientName}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Exposure Type *</span>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {riskAssetTypes.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Linked Policy</span>
          <select value={form.policyId} onChange={(e) => set('policyId', e.target.value)}>
            <option value="">Client-level exposure</option>
            {policies.map((policy) => <option value={policy.id} key={policy.id}>{policy.policyType} - {policy.carrier}</option>)}
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Primary residence, Unit 14, Main warehouse..." autoFocus />
        </label>
        <label className="modal-field">
          <span>Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Needs review">Needs review</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        {isPropertyLike && <label className="modal-field modal-field--full"><span>Address</span><input value={form.address} onChange={(e) => set('address', e.target.value)} /></label>}
        {(isVehicle || isPropertyLike) && <label className="modal-field"><span>Year</span><input value={form.year} onChange={(e) => set('year', e.target.value)} /></label>}
        {isVehicle && <label className="modal-field"><span>Make</span><input value={form.make} onChange={(e) => set('make', e.target.value)} /></label>}
        {isVehicle && <label className="modal-field"><span>Model</span><input value={form.model} onChange={(e) => set('model', e.target.value)} /></label>}
        {isVehicle && <label className="modal-field"><span>VIN</span><input value={form.vin} onChange={(e) => set('vin', e.target.value)} /></label>}
        {isVehicle && <label className="modal-field"><span>Annual Mileage</span><input inputMode="numeric" value={form.annualMileage} onChange={(e) => set('annualMileage', e.target.value)} /></label>}
        {isDriver && <label className="modal-field"><span>Driver License #</span><input value={form.driverLicenseNumber} onChange={(e) => set('driverLicenseNumber', e.target.value)} /></label>}
        {isDriver && <label className="modal-field"><span>License State</span><input maxLength={2} value={form.driverLicenseState} onChange={(e) => set('driverLicenseState', e.target.value.toUpperCase())} /></label>}
        {isDriver && <label className="modal-field"><span>Date of Birth</span><input value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} onBlur={(e) => set('dateOfBirth', formatDateInput(e.target.value))} placeholder="04/01/1985" /></label>}
        {isPropertyLike && <label className="modal-field"><span>Annual Sales</span><input value={form.annualSales} onChange={(e) => set('annualSales', e.target.value)} onBlur={(e) => set('annualSales', formatMoneyInput(e.target.value))} placeholder="$300,000.00" /></label>}
        {isPropertyLike && <label className="modal-field"><span>Payroll</span><input value={form.payroll} onChange={(e) => set('payroll', e.target.value)} onBlur={(e) => set('payroll', formatMoneyInput(e.target.value))} placeholder="$300,000.00" /></label>}
        {isPropertyLike && <label className="modal-field"><span>Square Footage</span><input inputMode="numeric" value={form.squareFootage} onChange={(e) => set('squareFootage', e.target.value)} /></label>}
        {isPropertyLike && <label className="modal-field"><span>Construction</span><input value={form.constructionType} onChange={(e) => set('constructionType', e.target.value)} /></label>}
        {isPropertyLike && <label className="modal-field"><span>Occupancy / Usage</span><input value={form.occupancy} onChange={(e) => set('occupancy', e.target.value)} /></label>}
        {form.type === 'Property' && <label className="modal-field"><span>Roof Year</span><input value={form.roofYear} onChange={(e) => set('roofYear', e.target.value)} /></label>}
        <label className="modal-field modal-field--full"><span>Notes</span><textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.name.trim()} onClick={() => onSave({
          ...form,
          policyId: form.policyId || undefined,
          annualMileage: form.annualMileage ? Number(form.annualMileage.replace(/[^0-9]/g, '')) : undefined,
          payroll: form.payroll ? parseMoneyInput(form.payroll) : undefined,
          annualSales: form.annualSales ? parseMoneyInput(form.annualSales) : undefined,
          squareFootage: form.squareFootage ? Number(form.squareFootage.replace(/[^0-9]/g, '')) : undefined,
          dateOfBirth: parseDisplayDate(form.dateOfBirth) || undefined,
        })}>Save Exposure</button>
      </div>
    </ModalShell>
  )
}

function AddPaymentModal({ clientName, policies, currentUserName, onClose, onSave }: {
  clientName: string
  policies: Policy[]
  currentUserName: string
  onClose: () => void
  onSave: (data: Omit<PaymentLedgerEntry, 'id' | 'accountId' | 'clientId'>) => void
}) {
  const [form, setForm] = useState({
    policyId: '',
    paymentDate: formatDateInput(new Date().toISOString().slice(0, 10)),
    amount: '',
    method: 'Check' as PaymentLedgerEntry['method'],
    referenceNumber: '',
    receiptNumber: '',
    remitTo: '',
    remittanceDueDate: '',
    carrierPayableAmount: '',
    remittanceStatus: 'Needs Remittance' as NonNullable<PaymentLedgerEntry['remittanceStatus']>,
    postedBy: currentUserName,
    status: 'Posted' as PaymentLedgerEntry['status'],
    notes: '',
  })
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  return (
    <ModalShell title={`Add Payment - ${clientName}`} onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field"><span>Linked Policy</span><select value={form.policyId} onChange={(e) => set('policyId', e.target.value)}><option value="">Client-level payment</option>{policies.map((policy) => <option value={policy.id} key={policy.id}>{policy.policyType} - {policy.carrier}</option>)}</select></label>
        <label className="modal-field"><span>Payment Date</span><input value={form.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} onBlur={(e) => set('paymentDate', formatDateInput(e.target.value))} placeholder="04/01/2026" /></label>
        <label className="modal-field"><span>Amount *</span><input value={form.amount} onChange={(e) => set('amount', e.target.value)} onBlur={(e) => set('amount', formatMoneyInput(e.target.value))} placeholder="$1,000.00" /></label>
        <label className="modal-field"><span>Method</span><select value={form.method} onChange={(e) => set('method', e.target.value)}><option>Credit Card</option><option>ACH / Bank Draft</option><option>Check</option><option>Cash</option><option>Money Order</option><option>Escrow / Mortgagee</option><option>Premium Finance</option><option>Online Portal</option><option>Other</option></select></label>
        <label className="modal-field"><span>Status</span><select value={form.status} onChange={(e) => set('status', e.target.value)}><option>Posted</option><option>Pending</option><option>Returned</option><option>Voided</option></select></label>
        <label className="modal-field"><span>Reference #</span><input value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} /></label>
        <label className="modal-field"><span>Receipt #</span><input value={form.receiptNumber} onChange={(e) => set('receiptNumber', e.target.value)} /></label>
        <label className="modal-field"><span>Remit To</span><input value={form.remitTo} onChange={(e) => set('remitTo', e.target.value)} placeholder="Carrier, MGA, finance company" /></label>
        <label className="modal-field"><span>Remittance Due</span><input value={form.remittanceDueDate} onChange={(e) => set('remittanceDueDate', e.target.value)} onBlur={(e) => set('remittanceDueDate', formatDateInput(e.target.value))} placeholder="04/01/2026" /></label>
        <label className="modal-field"><span>Carrier Payable</span><input value={form.carrierPayableAmount} onChange={(e) => set('carrierPayableAmount', e.target.value)} onBlur={(e) => set('carrierPayableAmount', formatMoneyInput(e.target.value))} placeholder="$1,000.00" /></label>
        <label className="modal-field"><span>Remittance Status</span><select value={form.remittanceStatus} onChange={(e) => set('remittanceStatus', e.target.value)}><option>Needs Remittance</option><option>Scheduled</option><option>Paid</option><option>On Hold</option><option>Not Due</option></select></label>
        <label className="modal-field"><span>Posted By</span><input value={form.postedBy} onChange={(e) => set('postedBy', e.target.value)} /></label>
        <label className="modal-field modal-field--full"><span>Notes</span><textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.amount.trim()} onClick={() => onSave({
          policyId: form.policyId || undefined,
          paymentDate: form.paymentDate,
          amount: parseMoneyInput(form.amount),
          method: form.method,
          referenceNumber: form.referenceNumber || undefined,
          receiptNumber: form.receiptNumber || undefined,
          remitTo: form.remitTo || undefined,
          remittanceDueDate: form.remittanceDueDate || undefined,
          carrierPayableAmount: form.carrierPayableAmount ? parseMoneyInput(form.carrierPayableAmount) : undefined,
          remittanceStatus: form.remittanceStatus,
          postedBy: form.postedBy,
          status: form.status,
          notes: form.notes || undefined,
        })}>Save Payment</button>
      </div>
    </ModalShell>
  )
}

function AddBinderEntryModal({ clients, nextBinderNumber, mode = 'add', initialValues, onClose, onBackToBinderLog, onSave }: {
  clients: Client[]
  nextBinderNumber: string
  mode?: 'add' | 'edit'
  initialValues?: BinderEntryFormData
  onClose: () => void
  onBackToBinderLog?: () => void
  onSave: (data: BinderEntryFormData) => void
}) {
  const [form, setForm] = useState<BinderEntryFormData>(initialValues ?? {
    clientMode: 'existing' as 'existing' | 'new',
    clientId: clients[0]?.id ?? '',
    clientName: '',
    primaryContact: '',
    email: '',
    phone: '',
    lineOfBusiness: 'Personal lines',
    policyType: '',
    carrier: '',
    policyNumber: '',
    effectiveDate: formatDateInput(new Date().toISOString().slice(0, 10)),
    expirationDate: '',
    premium: '',
    paymentTaken: '',
    paymentMethod: 'Merchant / Card Processor' as PaymentLedgerEntry['method'],
    remitTo: '',
    remittanceDueDate: '',
    binderNotes: '',
  })
  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }))
  const selectedClient = clients.find((client) => client.id === form.clientId)
  const clientName = form.clientMode === 'existing' ? selectedClient?.name ?? '' : form.clientName

  return (
    <ModalShell title={mode === 'edit' ? 'Edit Binder Log' : 'Binder Log'} onClose={onClose}>
      <div className="modal-form binder-entry-form">
        <label className="modal-field">
          <span>Binder Log #</span>
          <input value={nextBinderNumber} readOnly />
        </label>
        {mode === 'add' && (
          <div className="modal-check-grid">
            <label><input type="radio" checked={form.clientMode === 'existing'} onChange={() => set('clientMode', 'existing')} /> Existing client</label>
            <label><input type="radio" checked={form.clientMode === 'new'} onChange={() => set('clientMode', 'new')} /> New client</label>
          </div>
        )}
        {form.clientMode === 'existing' ? (
          <label className="modal-field modal-field--full">
            <span>Client *</span>
            <select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
              {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="modal-field">
              <span>Client / Business Name *</span>
              <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} autoFocus />
            </label>
            <label className="modal-field">
              <span>Primary Contact</span>
              <input value={form.primaryContact} onChange={(e) => set('primaryContact', e.target.value)} />
            </label>
            <label className="modal-field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label className="modal-field">
              <span>Phone</span>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', formatPhoneInput(e.target.value))} placeholder="(555) 123-4567" />
            </label>
          </>
        )}
        <label className="modal-field">
          <span>Type of Business</span>
          <select value={form.lineOfBusiness} onChange={(e) => set('lineOfBusiness', e.target.value)}>
            <option value="Personal lines">Personal Lines</option>
            <option value="Commercial">Commercial</option>
            <option value="Life & health">Life & Health</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Policy Type *</span>
          <input value={form.policyType} onChange={(e) => set('policyType', e.target.value)} placeholder="Homeowners, GL, Commercial Auto..." />
        </label>
        <label className="modal-field">
          <span>Carrier *</span>
          <input value={form.carrier} onChange={(e) => set('carrier', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Policy #</span>
          <input value={form.policyNumber} onChange={(e) => set('policyNumber', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Binder / Effective Date *</span>
          <input value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} onBlur={(e) => set('effectiveDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Expiration Date *</span>
          <input value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} onBlur={(e) => set('expirationDate', formatDateInput(e.target.value))} placeholder="04/01/2027" />
        </label>
        <label className="modal-field">
          <span>Premium *</span>
          <input value={form.premium} onChange={(e) => set('premium', e.target.value)} onBlur={(e) => set('premium', formatMoneyInput(e.target.value))} placeholder="$1,000.00" />
        </label>
        <label className="modal-field">
          <span>Payment Taken</span>
          <input value={form.paymentTaken} onChange={(e) => set('paymentTaken', e.target.value)} onBlur={(e) => set('paymentTaken', formatMoneyInput(e.target.value))} placeholder="$500.00" />
        </label>
        <label className="modal-field">
          <span>Payment Method</span>
          <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
            <option>Merchant / Card Processor</option><option>ACH / Bank Draft</option><option>Check</option><option>Cash</option><option>Online Portal</option><option>Other</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Remit To</span>
          <input value={form.remitTo} onChange={(e) => set('remitTo', e.target.value)} placeholder={form.carrier || 'Carrier / MGA'} />
        </label>
        <label className="modal-field">
          <span>Remittance Due</span>
          <input value={form.remittanceDueDate} onChange={(e) => set('remittanceDueDate', e.target.value)} onBlur={(e) => set('remittanceDueDate', formatDateInput(e.target.value))} placeholder="04/10/2026" />
        </label>
        <label className="modal-field modal-field--full">
          <span>Binder Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.binderNotes} onChange={(e) => set('binderNotes', e.target.value)} placeholder="Binding instructions, subjectivities, documents needed..." />
        </label>
      </div>
      <div className="modal-footer">
        {mode === 'edit' && onBackToBinderLog && <button className="secondary-action" type="button" onClick={onBackToBinderLog}>Back to Binder Log</button>}
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!clientName.trim() || !form.policyType.trim() || !form.carrier.trim() || !form.effectiveDate.trim() || !form.expirationDate.trim() || !form.premium.trim()} onClick={() => onSave(form)}>{mode === 'edit' ? 'Update Binder Log' : 'Save Binder Log'}</button>
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

function CloudFolderModal({ clientName, folder, onClose, onSave }: {
  clientName: string
  folder: ClientCloudFolder | null
  onClose: () => void
  onSave: (data: CloudFolderFormData) => void
}) {
  const [form, setForm] = useState<CloudFolderFormData>({
    provider: folder?.provider ?? 'google_drive',
    folderName: folder?.folderName ?? `${clientName} Documents`,
    folderUrl: folder?.folderUrl ?? '',
    folderId: folder?.folderId ?? '',
    notes: folder?.notes ?? '',
  })
  const [touchedUrl, setTouchedUrl] = useState(false)
  const set = (key: keyof CloudFolderFormData, val: string) => setForm((prev) => ({ ...prev, [key]: val }))
  const urlIsValid = !form.folderUrl.trim() || isValidCloudFolderUrl(form.folderUrl)
  const publicWarning = form.folderUrl.trim() && looksLikePublicCloudShare(form.folderUrl)
  return (
    <ModalShell title={folder ? 'Edit Cloud Folder Link' : 'Connect Cloud Folder'} onClose={onClose}>
      <div className="modal-form cloud-folder-form">
        <div className="cloud-folder-modal-note modal-field--full">
          <ShieldCheck size={17} />
          <p>AgencyIQ only stores the folder link and metadata. Do not enter cloud passwords. Access is controlled by your cloud storage provider.</p>
        </div>
        <label className="modal-field">
          <span>Cloud Provider *</span>
          <select value={form.provider} onChange={(e) => set('provider', e.target.value as CloudDocumentFolderProvider)}>
            {cloudFolderProviders.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Folder Name *</span>
          <input value={form.folderName} onChange={(e) => set('folderName', e.target.value)} placeholder={`${clientName} Documents`} />
        </label>
        <label className="modal-field modal-field--full">
          <span>Folder URL *</span>
          <input value={form.folderUrl} onChange={(e) => set('folderUrl', e.target.value)} onBlur={() => setTouchedUrl(true)} placeholder="https://drive.google.com/drive/folders/..." />
          {touchedUrl && !urlIsValid && <em className="field-error">Please enter a valid cloud folder URL.</em>}
        </label>
        <label className="modal-field">
          <span>Folder ID</span>
          <input value={form.folderId} onChange={(e) => set('folderId', e.target.value)} placeholder="Optional provider folder ID" />
        </label>
        <label className="modal-field modal-field--full">
          <span>Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Sharing notes, internal instructions, or folder owner." />
        </label>
        {publicWarning && (
          <div className="cloud-folder-warning modal-field--full">
            <ShieldCheck size={16} />
            <span>Make sure this folder link is not publicly accessible unless intended.</span>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.provider || !form.folderName.trim() || !form.folderUrl.trim() || !isValidCloudFolderUrl(form.folderUrl)} onClick={() => onSave(form)}>
          {folder ? 'Save Folder Link' : 'Connect Cloud Folder'}
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
          <input type="text" inputMode="decimal" value={form.estimatedPremium} onChange={(e) => set('estimatedPremium', e.target.value)} onBlur={(e) => set('estimatedPremium', formatMoneyInput(e.target.value))} placeholder="$1,000.00" />
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
          <input type="tel" value={form.phone} onChange={(e) => set('phone', formatPhoneInput(e.target.value))} placeholder="(555) 123-4567" />
        </label>
        <label className="modal-field">
          <span>Alternate Phone</span>
          <input type="tel" value={form.alternatePhone} onChange={(e) => set('alternatePhone', formatPhoneInput(e.target.value))} placeholder="(555) 123-4567" />
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
    billingType: string; lineOfBusiness: string; paymentPlan: string;
    paymentStatus: string; renewalStatus: string; mortgageeOrLienholder: string;
    status: string; coverageDetails: PolicyCoverageDetails; notes: string;
  }) => void
}) {
  const [form, setForm] = useState({
    policyType: policy.policyType,
    carrier: policy.carrier,
    policyNumber: policy.policyNumber ?? '',
    premium: formatMoneyInput(String(policy.premium)),
    commissionRate: String(policy.commissionRate ?? ''),
    effectiveDate: policy.effectiveDate ? formatDateInput(policy.effectiveDate) : '',
    expirationDate: formatDateInput(policy.expirationDate),
    billingType: policy.billingType ?? '',
    lineOfBusiness: policy.lineOfBusiness ?? '',
    paymentPlan: policy.paymentPlan ?? '',
    paymentStatus: policy.paymentStatus ?? '',
    renewalStatus: policy.renewalStatus ?? '',
    mortgageeOrLienholder: policy.mortgageeOrLienholder ?? '',
    status: policy.status,
    notes: policy.notes ?? '',
  })
  const [coverageDetails, setCoverageDetails] = useState<PolicyCoverageDetails>(() => getPolicyCoverageDetails(policy))
  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))
  const previewPolicy = { policyType: form.policyType, lineOfBusiness: (form.lineOfBusiness || undefined) as Policy['lineOfBusiness'] }
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
          <span>Renewal Status</span>
          <select value={form.renewalStatus} onChange={(e) => set('renewalStatus', e.target.value)}>
            <option value="">Not started</option>
            <option value="Not started">Not started</option>
            <option value="Review needed">Review needed</option>
            <option value="Marketing">Marketing</option>
            <option value="Quoted">Quoted</option>
            <option value="Ready to bind">Ready to bind</option>
            <option value="Renewed">Renewed</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Annual Premium ($)</span>
          <input type="text" inputMode="decimal" value={form.premium} onChange={(e) => set('premium', e.target.value)} onBlur={(e) => set('premium', formatMoneyInput(e.target.value))} placeholder="$1,000.00" />
        </label>
        <label className="modal-field">
          <span>Commission Rate (%)</span>
          <input type="number" min="0" max="100" value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Effective Date</span>
          <input type="text" inputMode="numeric" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} onBlur={(e) => set('effectiveDate', formatDateInput(e.target.value))} placeholder="04/01/2026" />
        </label>
        <label className="modal-field">
          <span>Expiration Date *</span>
          <input type="text" inputMode="numeric" value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} onBlur={(e) => set('expirationDate', formatDateInput(e.target.value))} placeholder="04/01/2027" />
        </label>
        <label className="modal-field">
          <span>Line of Business</span>
          <select value={form.lineOfBusiness} onChange={(e) => set('lineOfBusiness', e.target.value)}>
            <option value="">Not set</option>
            <option value="Personal lines">Personal Lines</option>
            <option value="Commercial">Commercial</option>
            <option value="Life & health">Life & Health</option>
          </select>
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
          <span>Payment Plan</span>
          <input value={form.paymentPlan} onChange={(e) => set('paymentPlan', e.target.value)} placeholder="e.g. Monthly, Annual" />
        </label>
        <label className="modal-field">
          <span>Payment Status</span>
          <select value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
            <option value="">Not set</option>
            <option value="Current">Current</option>
            <option value="Due soon">Due soon</option>
            <option value="Past due">Past due</option>
            <option value="Paid in full">Paid in full</option>
          </select>
        </label>
        <CoverageEditorFields
          policy={previewPolicy}
          details={coverageDetails}
          onChange={setCoverageDetails}
        />
        <label className="modal-field">
          <span>Mortgagee / Lienholder</span>
          <input value={form.mortgageeOrLienholder} onChange={(e) => set('mortgageeOrLienholder', e.target.value)} />
        </label>
        <label className="modal-field modal-field--full">
          <span>Policy Notes</span>
          <textarea className="modal-textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" disabled={!form.policyType.trim() || !form.carrier.trim() || !form.expirationDate} onClick={() => onSave({ ...form, coverageDetails })}>Save Changes</button>
      </div>
    </ModalShell>
  )
}

function CarrierPortalModal({
  portals,
  canManageCredentials,
  vaultConfigured,
  onClose,
  onSave,
  onSavePassword,
  onCopyUsername,
  onCopyPassword,
  onRevealPassword,
  onCopyCode,
  onOpenPortal,
  onDelete,
}: {
  portals: CarrierPortalEntry[]
  canManageCredentials: boolean
  vaultConfigured: boolean
  onClose: () => void
  onSave: (entry: CarrierPortalEntry) => void | Promise<void>
  onSavePassword: (entry: CarrierPortalEntry, username: string, password: string, acceptedRisk: boolean) => Promise<boolean>
  onCopyUsername: (entry: CarrierPortalEntry) => void
  onCopyPassword: (entry: CarrierPortalEntry) => void
  onRevealPassword: (entry: CarrierPortalEntry) => Promise<string | null>
  onCopyCode: (value: string, label: string) => void
  onOpenPortal: (entry: CarrierPortalEntry) => void
  onDelete: (id: string) => void
}) {
  const blank = (): CarrierPortalEntry => ({
    id: `portal-${Date.now()}`,
    name: '',
    aliases: [],
    url: '',
    portalUrl: '',
    policyLookupUrl: '',
    billingUrl: '',
    claimsUrl: '',
    username: '',
    producerCode: '',
    agencyCode: '',
    notes: '',
    active: true,
  })
  const [editing, setEditing] = useState<CarrierPortalEntry | null>(null)
  const [passwordDraft, setPasswordDraft] = useState('')
  const [acceptedRisk, setAcceptedRisk] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const setField = (key: keyof CarrierPortalEntry, val: string) =>
    setEditing((prev) => prev ? { ...prev, [key]: val } : prev)
  const saveMetadata = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await onSave({ ...editing, url: editing.portalUrl ?? editing.url })
    } finally {
      setSaving(false)
    }
  }
  const savePassword = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const saved = await onSavePassword(editing, editing.username, passwordDraft, acceptedRisk)
      if (saved) {
        setPasswordDraft('')
        setAcceptedRisk(false)
      }
    } finally {
      setSaving(false)
    }
  }
  const revealPassword = async (entry: CarrierPortalEntry) => {
    const password = await onRevealPassword(entry)
    if (!password) return
    setRevealedPasswords((prev) => ({ ...prev, [entry.id]: password }))
    window.setTimeout(() => {
      setRevealedPasswords((prev) => {
        const next = { ...prev }
        delete next[entry.id]
        return next
      })
    }, 30000)
  }
  return (
    <ModalShell title="Carrier Credential Vault" onClose={onClose}>
      {!editing ? (
        <>
          <div className="vault-warning">
            <ShieldCheck size={17} />
            <p>Carrier credentials are encrypted at rest. Only authorized users in your agency should access them. Your agency is responsible for maintaining permission to store and use carrier credentials.</p>
          </div>
          {!vaultConfigured && (
            <div className="vault-config-warning">
              <Lock size={16} />
              <span>Carrier credential vault is not configured. Please set the encryption key.</span>
            </div>
          )}
          <div className="carrier-portal-list">
            {portals.length === 0 && (
              <div className="empty-state" style={{ margin: '16px 20px' }}>No carrier portals saved yet. Add your carriers below.</div>
            )}
            {portals.map((p) => (
              <div className="carrier-portal-row" key={p.id}>
                <div className="carrier-portal-info">
                  <strong>{p.name}</strong>
                  {p.username && <span>User: {p.username}</span>}
                  {p.producerCode && <span>Producer: {p.producerCode}</span>}
                  {p.agencyCode && <span>Agency: {p.agencyCode}</span>}
                  {p.hasPassword && <span>Encrypted password saved{p.passwordUpdatedAt ? ` · Updated ${p.passwordUpdatedAt.slice(0, 10)}` : ''}</span>}
                  {revealedPasswords[p.id] && <code className="revealed-password">{revealedPasswords[p.id]}</code>}
                  {p.notes && <em>{p.notes}</em>}
                </div>
                <div className="carrier-portal-actions">
                  {(p.portalUrl || p.url) && (
                    <button className="secondary-action carrier-portal-link" type="button" onClick={() => onOpenPortal(p)}>
                      Open Portal
                    </button>
                  )}
                  {p.username && <button className="utility-action" type="button" onClick={() => onCopyUsername(p)}>Copy Username</button>}
                  {p.hasPassword && <button className="utility-action" type="button" onClick={() => onCopyPassword(p)}>Copy Password</button>}
                  {p.hasPassword && <button className="utility-action" type="button" onClick={() => revealPassword(p)}>Reveal Password</button>}
                  {p.producerCode && <button className="utility-action" type="button" onClick={() => onCopyCode(p.producerCode ?? '', 'Producer code')}>Copy Producer Code</button>}
                  {p.agencyCode && <button className="utility-action" type="button" onClick={() => onCopyCode(p.agencyCode ?? '', 'Agency code')}>Copy Agency Code</button>}
                  <button className="utility-action" type="button" onClick={() => setEditing({ ...p })}>Edit</button>
                  {canManageCredentials && <button className="utility-action" type="button" onClick={() => onDelete(p.id)}>Remove</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="secondary-action" type="button" onClick={onClose}>Close</button>
            <button className="primary-action" type="button" onClick={() => setEditing(blank())}>+ Add Carrier Access</button>
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
              <input value={editing.portalUrl ?? editing.url} onChange={(e) => { setField('portalUrl', e.target.value); setField('url', e.target.value) }} placeholder="https://agent.travelers.com" />
            </label>
            <label className="modal-field">
              <span>Policy Lookup URL</span>
              <input value={editing.policyLookupUrl ?? ''} onChange={(e) => setField('policyLookupUrl', e.target.value)} placeholder="Optional" />
            </label>
            <label className="modal-field">
              <span>Billing URL</span>
              <input value={editing.billingUrl ?? ''} onChange={(e) => setField('billingUrl', e.target.value)} placeholder="Optional" />
            </label>
            <label className="modal-field">
              <span>Claims URL</span>
              <input value={editing.claimsUrl ?? ''} onChange={(e) => setField('claimsUrl', e.target.value)} placeholder="Optional" />
            </label>
            <label className="modal-field modal-field--full">
              <span>Username</span>
              <input value={editing.username} onChange={(e) => setField('username', e.target.value)} placeholder="Your login username" />
            </label>
            <label className="modal-field">
              <span>Producer Code</span>
              <input value={editing.producerCode ?? ''} onChange={(e) => setField('producerCode', e.target.value)} placeholder="Optional" />
            </label>
            <label className="modal-field">
              <span>Agency Code</span>
              <input value={editing.agencyCode ?? ''} onChange={(e) => setField('agencyCode', e.target.value)} placeholder="Optional" />
            </label>
            <label className="modal-field modal-field--full">
              <span>Login Notes</span>
              <input value={editing.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="MFA, appointment notes, carrier contact, restrictions" />
            </label>
            <div className="modal-field modal-field--full vault-password-box">
              <span>Password Storage</span>
              <p>You are choosing to store carrier login credentials inside AgencyIQ. Credentials will be encrypted at rest, but you are responsible for maintaining permission to store and use these credentials.</p>
              {!vaultConfigured && <strong>Carrier credential vault is not configured. Please set the encryption key.</strong>}
              <input type="password" value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} placeholder={editing.hasPassword ? 'Enter a new password to replace saved credential' : 'Password'} disabled={!vaultConfigured || !canManageCredentials} />
              <label className="vault-checkbox">
                <input type="checkbox" checked={acceptedRisk} onChange={(e) => setAcceptedRisk(e.target.checked)} disabled={!vaultConfigured || !canManageCredentials} />
                <span>I understand and accept the risk of storing carrier credentials.</span>
              </label>
              <button className="secondary-action" type="button" disabled={!vaultConfigured || !canManageCredentials || !passwordDraft || !acceptedRisk || saving} onClick={savePassword}>
                Save Encrypted Password
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="secondary-action" type="button" onClick={() => setEditing(null)}>Back</button>
            <button className="primary-action" type="button" disabled={!editing.name.trim() || saving} onClick={saveMetadata}>Save Carrier Access</button>
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
  const [zapping, setZapping] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 160 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const didDrag = useRef(false)
  const contextTips = getContextTips(activeView, clientTab)
  const currentTip = contextTips[tipIndex % contextTips.length]

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTipIndex(0)
      if (showBubble) {
        setAnim('bounce')
        window.setTimeout(() => setAnim('idle'), 600)
      }
    }, 0)
    return () => window.clearTimeout(timer)
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

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      didDrag.current = true
      const nx = e.clientX - dragOffset.current.x
      const ny = e.clientY - dragOffset.current.y
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 90, nx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, ny)),
      })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const handleZap = () => {
    setZapping(true)
    setShowBubble(false)
    setTimeout(() => setDismissed(true), 1600)
  }

  if (dismissed) return null

  const bubbleLeft = pos.x < window.innerWidth / 2

  return (
    <>
      {/* Full-screen lightning overlay — bolts radiate from mascot */}
      {zapping && (() => {
        const cx = pos.x + 45;
        const cy = pos.y + 45;
        const W = window.innerWidth;
        const H = window.innerHeight;
        // Each bolt: from mascot center → corner/edge target, with jagged midpoints
        const bolts: { pts: string; delay: number; branch?: string }[] = [
          // top-left corner
          {
            pts: `${cx},${cy} ${cx * 0.6},${cy * 0.5} ${cx * 0.3},${cy * 0.2} 0,0`,
            delay: 0,
            branch: `${cx * 0.6},${cy * 0.5} ${cx * 0.45},${cy * 0.35} ${cx * 0.25},${cy * 0.45}`,
          },
          // top center
          {
            pts: `${cx},${cy} ${cx + 20},${cy * 0.4} ${cx - 15},${cy * 0.1} ${cx + 10},0`,
            delay: 0.05,
            branch: `${cx + 20},${cy * 0.4} ${cx + 60},${cy * 0.25} ${cx + 80},${cy * 0.35}`,
          },
          // top-right corner
          {
            pts: `${cx},${cy} ${cx + (W - cx) * 0.4},${cy * 0.55} ${cx + (W - cx) * 0.7},${cy * 0.25} ${W},0`,
            delay: 0.02,
            branch: `${cx + (W - cx) * 0.4},${cy * 0.55} ${cx + (W - cx) * 0.55},${cy * 0.45} ${cx + (W - cx) * 0.65},${cy * 0.6}`,
          },
          // right edge mid
          {
            pts: `${cx},${cy} ${cx + (W - cx) * 0.45},${cy + 30} ${cx + (W - cx) * 0.75},${cy - 20} ${W},${cy + 10}`,
            delay: 0.08,
            branch: `${cx + (W - cx) * 0.45},${cy + 30} ${cx + (W - cx) * 0.5},${cy + 80} ${cx + (W - cx) * 0.7},${cy + 60}`,
          },
          // bottom-right corner
          {
            pts: `${cx},${cy} ${cx + (W - cx) * 0.35},${cy + (H - cy) * 0.4} ${cx + (W - cx) * 0.6},${cy + (H - cy) * 0.7} ${W},${H}`,
            delay: 0.03,
            branch: `${cx + (W - cx) * 0.35},${cy + (H - cy) * 0.4} ${cx + (W - cx) * 0.4},${cy + (H - cy) * 0.55} ${cx + (W - cx) * 0.25},${cy + (H - cy) * 0.6}`,
          },
          // bottom center
          {
            pts: `${cx},${cy} ${cx - 25},${cy + (H - cy) * 0.45} ${cx + 20},${cy + (H - cy) * 0.75} ${cx - 10},${H}`,
            delay: 0.06,
            branch: `${cx - 25},${cy + (H - cy) * 0.45} ${cx - 70},${cy + (H - cy) * 0.5} ${cx - 90},${cy + (H - cy) * 0.65}`,
          },
          // bottom-left corner
          {
            pts: `${cx},${cy} ${cx * 0.65},${cy + (H - cy) * 0.35} ${cx * 0.35},${cy + (H - cy) * 0.65} 0,${H}`,
            delay: 0.04,
            branch: `${cx * 0.65},${cy + (H - cy) * 0.35} ${cx * 0.55},${cy + (H - cy) * 0.5} ${cx * 0.35},${cy + (H - cy) * 0.45}`,
          },
          // left edge mid
          {
            pts: `${cx},${cy} ${cx * 0.55},${cy - 20} ${cx * 0.25},${cy + 30} 0,${cy + 15}`,
            delay: 0.07,
            branch: `${cx * 0.55},${cy - 20} ${cx * 0.45},${cy - 60} ${cx * 0.3},${cy - 50}`,
          },
        ];
        return (
          <div className="iq-zap-overlay" aria-hidden="true">
            <svg className="iq-radial-bolts" viewBox={`0 0 ${W} ${H}`}>
              <defs>
                <filter id="bolt-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur1" />
                  <feGaussianBlur stdDeviation="8" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur2" />
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="bolt-glow-wide" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="14" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {bolts.map((b, i) => (
                <g key={i} style={{ animationDelay: `${b.delay}s` }}>
                  {/* Wide glow layer */}
                  <polyline
                    className="iq-radial-bolt-glow"
                    points={b.pts}
                    style={{ animationDelay: `${b.delay}s` }}
                  />
                  {/* Core bolt */}
                  <polyline
                    className="iq-radial-bolt-core"
                    points={b.pts}
                    style={{ animationDelay: `${b.delay}s` }}
                  />
                  {b.branch && (
                    <polyline
                      className="iq-radial-bolt-branch"
                      points={b.branch}
                      style={{ animationDelay: `${b.delay + 0.04}s` }}
                    />
                  )}
                </g>
              ))}
              {/* Origin burst */}
              <circle className="iq-zap-origin" cx={cx} cy={cy} r="8" />
            </svg>
            <div className="iq-zap-flash" />
          </div>
        );
      })()}

    <div
      className={`iq-buddy iq-buddy--${anim}${zapping ? ' iq-buddy--zapping' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Dismiss X — visible on hover */}
      {hovered && !zapping && (
        <button
          className="iq-buddy-close"
          type="button"
          aria-label="Remove IQ Buddy"
          onClick={handleZap}
        >
          ×
        </button>
      )}

      {/* Speech bubble — left or right of mascot based on screen position */}
      {showBubble && (
        <div className={`iq-buddy-bubble iq-buddy-bubble--${bubbleLeft ? 'right' : 'left'}`}>
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

      {/* Mascot avatar — drag handle */}
      <button
        className="iq-buddy-avatar"
        type="button"
        aria-label="Open IQ AI assistant"
        onPointerDown={(e) => {
          dragging.current = true
          didDrag.current = false
          dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onClick={() => {
          if (didDrag.current) return
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
        <img src={mascotImg} alt="IQ assistant" className="iq-buddy-img" />
      </button>
    </div>
    </>
  )
}

export default App



