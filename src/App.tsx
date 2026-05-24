import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bell, CalendarClock, CircleCheck as CheckCircle2, ChevronRight, CircleDollarSign, LayoutDashboard, Lock, RefreshCcw, Search, Send, SlidersHorizontal, Settings, Sun, Moon, UsersRound, X, Phone, Building2, FileText, Plus, Pencil, Trash2, TriangleAlert as AlertTriangle, Clock, SquareCheck as CheckSquare, Target, ExternalLink } from 'lucide-react'
import agencyIqLogo from './assets/agencyiq-logo.png'
import mascotImg from './assets/AGENCYIQ_MASCOT_CLEAR.png'
import { IvansPanel } from './components/IvansPanel'
import { NewClientWizard } from './components/NewClientWizard'
import { supabase } from './lib/supabase'
import { startHeartbeat } from './lib/sessionGuard'
import type { Client, CrmDataset, Policy, PolicyBilling, UserRole } from './data/crmTypes'
import { createRecordId, loadDataset, saveDataset } from './data/scopedStorage'
import './App.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type AppView = 'dashboard' | 'clients' | 'client-detail' | 'renewals' | 'tasks' | 'leads' | 'settings' | 'carriers' | 'reports'
type ModalType = 'addClient' | 'editClient' | 'addPolicy' | 'editPolicy' | 'addTask' | 'addLead' | 'addNote' | 'editBilling' | 'carrierPortal' | 'userSettings' | 'ivans' | null
type ColorMode = 'light' | 'dark'
type PaletteId = 'default' | 'sapphire' | 'graphite' | 'agencyiq' | 'evergreen' | 'plum' | 'classic' | 'contrast'
type ClientFilter = 'All' | 'Active' | 'Inactive' | 'Prospect'
type ClientTab = 'Overview' | 'Policies' | 'Tasks' | 'Notes' | 'Billing' | 'Activity'
type ClientSort = 'name-asc' | 'name-desc' | 'premium-desc' | 'recent'
interface Toast { id: number; message: string }
interface Notification { id: string; text: string; time: string; read: boolean }
interface EmailTemplate { id: string; name: string; subject: string; body: string; category: string }
interface UserOption { id: string; name: string; role: string }
interface CarrierPortalEntry { id: string; name: string; url: string; lines: string }

// ─── Constants ────────────────────────────────────────────────────────────────
const PALETTES: { id: PaletteId; label: string }[] = [
  { id: 'default', label: 'Teal (Default)' },
  { id: 'agencyiq', label: 'AgencyIQ' },
  { id: 'sapphire', label: 'Sapphire' },
  { id: 'graphite', label: 'Graphite' },
  { id: 'evergreen', label: 'Evergreen' },
  { id: 'plum', label: 'Plum' },
  { id: 'classic', label: 'Classic Blue' },
  { id: 'contrast', label: 'High Contrast' },
]

const defaultPalette: PaletteId = 'default'
const isPaletteId = (v: string | null): v is PaletteId => !!v && PALETTES.some(p => p.id === v)

const POLICY_TYPES = [
  'General Liability','Commercial Auto','Commercial Property','Workers Compensation',
  'Business Owners Policy (BOP)','Professional Liability','Umbrella / Excess',
  'Homeowners','Auto','Life','Health','Renters','Flood','Earthquake','Boat/Marine','Other',
]

const CARRIERS = [
  'Travelers','Hartford','Nationwide','Liberty Mutual','Progressive',
  'State Farm','Allstate','GEICO','Farmers','USAA',
  'Chubb','AIG','Markel','Employers','ICW Group',
  'Applied Underwriters','Zenith','AmTrust','Employers Holdings','Guard Insurance',
]

const defaultEmailTemplates = (): EmailTemplate[] => [
  { id: 'tpl-1', name: 'Renewal Reminder (30 days)', subject: 'Your Policy Renews Soon', body: 'Dear {{client_name}},\n\nYour {{policy_type}} policy with {{carrier}} (Policy #{{policy_number}}) is set to renew on {{expiration_date}}.\n\nPlease contact us to review your coverage.\n\nBest regards,\n{{agent_name}}', category: 'Renewal' },
  { id: 'tpl-2', name: 'Quote Follow-Up', subject: 'Following Up on Your Quote', body: 'Dear {{client_name}},\n\nI wanted to follow up on the quote we prepared for you. We have competitive options ready.\n\nBest regards,\n{{agent_name}}', category: 'Sales' },
  { id: 'tpl-3', name: 'Payment Reminder', subject: 'Payment Due for Your Policy', body: 'Dear {{client_name}},\n\nThis is a reminder that a payment is due for your {{policy_type}} policy.\n\nBest regards,\n{{agent_name}}', category: 'Billing' },
]

// ─── Formatters ───────────────────────────────────────────────────────────────
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const formatDate = (d: string) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`
}
const today = new Date()
const todayIso = today.toISOString().split('T')[0]
const daysUntil = (d: string) => {
  const diff = new Date(d).getTime() - today.getTime()
  return Math.ceil(diff / 86400000)
}

// ─── Notifications helper ─────────────────────────────────────────────────────
const buildNotifications = (): Notification[] => [
  { id: 'n1', text: 'Harbor View Dental renewal in 14 days', time: '2h ago', read: false },
  { id: 'n2', text: 'New task assigned: Blue Peak proposal', time: '4h ago', read: false },
  { id: 'n3', text: 'Northstar Logistics — driver list requested', time: '1d ago', read: true },
]

// ─── Modal shell ──────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel${wide ? ' modal-panel--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Address Autocomplete ─────────────────────────────────────────────────────
interface NominatimHit {
  place_id: number; display_name: string
  address: { house_number?: string; road?: string; city?: string; town?: string; village?: string; county?: string; state?: string; postcode?: string }
}

function AddressInput({ value, onChange, onSelect, placeholder }: {
  value: string; onChange: (v: string) => void
  onSelect: (p: { street: string; city: string; state: string; zip: string; county: string }) => void
  placeholder?: string
}) {
  const [hits, setHits] = useState<NominatimHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const search = (q: string) => {
    onChange(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (q.length < 5) { setHits([]); setOpen(false); setSearched(false); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
        const data: NominatimHit[] = await res.json()
        setHits(data); setOpen(true); setSearched(true)
      } catch { setHits([]); setSearched(true) }
      finally { setLoading(false) }
    }, 420)
  }

  const pick = (r: NominatimHit) => {
    const a = r.address
    const street = `${a.house_number ? a.house_number + ' ' : ''}${a.road ?? ''}`.trim()
    onChange(street)
    onSelect({ street, city: a.city ?? a.town ?? a.village ?? '', state: a.state ?? '', zip: a.postcode ?? '', county: a.county ?? '' })
    setHits([]); setOpen(false); setSearched(false)
  }

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="addr-autocomplete-wrap" ref={wrap}>
      <input value={value} onChange={e => search(e.target.value)} onFocus={() => { if (hits.length > 0) setOpen(true) }} placeholder={placeholder ?? 'Start typing an address…'} autoComplete="off" />
      {loading && <span className="addr-loading-indicator" />}
      {open && (
        <ul className="addr-suggestions" role="listbox">
          {hits.length > 0 ? hits.map(r => (
            <li key={r.place_id} role="option" className="addr-suggestion-item" onMouseDown={e => { e.preventDefault(); pick(r) }}>{r.display_name}</li>
          )) : searched && !loading ? (
            <li className="addr-no-results">No matches — enter address manually below.</li>
          ) : null}
        </ul>
      )}
    </div>
  )
}

// ─── Edit Client Modal ────────────────────────────────────────────────────────
function EditClientModal({ client, users, onClose, onSave }: {
  client: Client; users: UserOption[]; onClose: () => void
  onSave: (data: {
    name: string; dbaName: string; primaryContact: string; phone: string; alternatePhone: string
    email: string; mailingAddress: string; physicalAddress: string; website: string
    lineOfBusiness: string; accountStatus: string; preferredContactMethod: string
    billingMethod: string; paymentPlan: string; notes: string
    assignedProducerId: string; assignedCsrId: string
  }) => void
}) {
  const [form, setForm] = useState({
    name: client.name, dbaName: client.dbaName ?? '', primaryContact: client.primaryContact,
    phone: client.phone ?? '', alternatePhone: client.alternatePhone ?? '', email: client.email ?? '',
    mailingAddress: client.mailingAddress ?? '', physicalAddress: client.physicalAddress ?? '',
    website: client.website ?? '', lineOfBusiness: client.lineOfBusiness,
    accountStatus: client.accountStatus ?? 'Active', preferredContactMethod: client.preferredContactMethod ?? '',
    billingMethod: client.billingMethod ?? '', paymentPlan: client.paymentPlan ?? '', notes: client.notes ?? '',
    assignedProducerId: client.assignedProducerId ?? '', assignedCsrId: client.assignedCsrId ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const producers = users.filter(u => u.role === 'Producer' || u.role === 'Agent/Owner' || u.role === 'Principal Agent')
  const csrs = users.filter(u => u.role === 'CSR' || u.role === 'Admin')

  return (
    <ModalShell title="Edit Client" onClose={onClose} wide>
      <div className="modal-form">
        <label className="modal-field">
          <span>Account Name *</span>
          <input value={form.name} onChange={e => set('name', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>DBA Name</span>
          <input value={form.dbaName} onChange={e => set('dbaName', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Primary Contact</span>
          <input value={form.primaryContact} onChange={e => set('primaryContact', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Phone</span>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Alternate Phone</span>
          <input value={form.alternatePhone} onChange={e => set('alternatePhone', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </label>
        <div className="modal-field modal-field--full">
          <span>Mailing Address</span>
          <AddressInput value={form.mailingAddress} onChange={v => set('mailingAddress', v)}
            onSelect={({ street, city, state, zip }) => set('mailingAddress', [street, city, state, zip].filter(Boolean).join(', '))} />
        </div>
        <div className="modal-field modal-field--full">
          <span>Physical / Location Address</span>
          <AddressInput value={form.physicalAddress} onChange={v => set('physicalAddress', v)}
            onSelect={({ street, city, state, zip }) => set('physicalAddress', [street, city, state, zip].filter(Boolean).join(', '))} />
        </div>
        <label className="modal-field">
          <span>Website</span>
          <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
        </label>
        <label className="modal-field">
          <span>Line of Business</span>
          <select value={form.lineOfBusiness} onChange={e => set('lineOfBusiness', e.target.value)}>
            <option value="Personal lines">Personal Lines</option>
            <option value="Commercial">Commercial</option>
            <option value="Life & health">Life &amp; Health</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Account Status</span>
          <select value={form.accountStatus} onChange={e => set('accountStatus', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Prospect">Prospect</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Preferred Contact</span>
          <select value={form.preferredContactMethod} onChange={e => set('preferredContactMethod', e.target.value)}>
            <option value="">Not set</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
            <option value="Text">Text</option>
            <option value="Portal">Portal</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Billing Method</span>
          <select value={form.billingMethod} onChange={e => set('billingMethod', e.target.value)}>
            <option value="">Not set</option>
            <option value="Direct Bill">Direct Bill</option>
            <option value="Agency Bill">Agency Bill</option>
            <option value="Mortgagee/Escrow">Mortgagee/Escrow</option>
            <option value="Premium Finance">Premium Finance</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Payment Plan</span>
          <input value={form.paymentPlan} onChange={e => set('paymentPlan', e.target.value)} placeholder="e.g. Monthly, Annual…" />
        </label>
        <label className="modal-field">
          <span>Assigned Producer</span>
          <select value={form.assignedProducerId} onChange={e => set('assignedProducerId', e.target.value)}>
            <option value="">— Unassigned —</option>
            {producers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Assigned CSR</span>
          <select value={form.assignedCsrId} onChange={e => set('assignedCsrId', e.target.value)}>
            <option value="">— Unassigned —</option>
            {csrs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Notes</span>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => onSave(form)}>Save Changes</button>
      </div>
    </ModalShell>
  )
}

// ─── Add/Edit Policy Modal ────────────────────────────────────────────────────
function PolicyModal({ policy, clients, users, onClose, onSave, customPolicyTypes, customCarriers }: {
  policy?: Policy; clients: Client[]; users: UserOption[]; onClose: () => void
  onSave: (data: Partial<Policy>) => void
  customPolicyTypes: string[]; customCarriers: string[]
}) {
  const allTypes = [...POLICY_TYPES, ...customPolicyTypes].filter((v, i, a) => a.indexOf(v) === i)
  const allCarriers = [...CARRIERS, ...customCarriers].filter((v, i, a) => a.indexOf(v) === i)
  const [form, setForm] = useState<Partial<Policy>>({
    clientId: policy?.clientId ?? (clients[0]?.id ?? ''),
    carrier: policy?.carrier ?? '', policyType: policy?.policyType ?? '',
    policyNumber: policy?.policyNumber ?? '', effectiveDate: policy?.effectiveDate ?? '',
    expirationDate: policy?.expirationDate ?? '', premium: policy?.premium ?? 0,
    commissionRate: policy?.commissionRate ?? 10, billingType: policy?.billingType ?? 'Direct Bill',
    paymentPlan: policy?.paymentPlan ?? '', status: policy?.status ?? 'Active',
    renewalStatus: policy?.renewalStatus ?? 'Not started', limits: policy?.limits ?? '',
    notes: policy?.notes ?? '', producerUserId: policy?.producerUserId ?? '',
    csrUserId: policy?.csrUserId ?? '',
  })
  const set = (k: keyof Policy, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <ModalShell title={policy ? 'Edit Policy' : 'Add Policy'} onClose={onClose} wide>
      <div className="modal-form">
        {!policy && (
          <label className="modal-field modal-field--full">
            <span>Client *</span>
            <select value={form.clientId} onChange={e => set('clientId', e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="modal-field">
          <span>Carrier *</span>
          <select value={form.carrier} onChange={e => set('carrier', e.target.value)}>
            <option value="">Select carrier…</option>
            {allCarriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Policy Type *</span>
          <select value={form.policyType} onChange={e => set('policyType', e.target.value)}>
            <option value="">Select type…</option>
            {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Policy Number</span>
          <input value={form.policyNumber} onChange={e => set('policyNumber', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Effective Date</span>
          <input type="date" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Expiration Date *</span>
          <input type="date" value={form.expirationDate} onChange={e => set('expirationDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Premium ($)</span>
          <input type="number" min="0" value={form.premium} onChange={e => set('premium', parseFloat(e.target.value) || 0)} />
        </label>
        <label className="modal-field">
          <span>Commission Rate (%)</span>
          <input type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={e => set('commissionRate', parseFloat(e.target.value) || 0)} />
        </label>
        <label className="modal-field">
          <span>Billing Type</span>
          <select value={form.billingType} onChange={e => set('billingType', e.target.value as Policy['billingType'])}>
            <option value="Direct Bill">Direct Bill</option>
            <option value="Agency Bill">Agency Bill</option>
            <option value="Financed">Financed</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Payment Plan</span>
          <input value={form.paymentPlan} onChange={e => set('paymentPlan', e.target.value)} placeholder="e.g. Monthly, Annual" />
        </label>
        <label className="modal-field">
          <span>Status</span>
          <select value={form.status} onChange={e => set('status', e.target.value as Policy['status'])}>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Quoted">Quoted</option>
            <option value="Bound">Bound</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Expired">Expired</option>
            <option value="Non-Renewed">Non-Renewed</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Renewal Status</span>
          <select value={form.renewalStatus} onChange={e => set('renewalStatus', e.target.value as Policy['renewalStatus'])}>
            <option value="Not started">Not started</option>
            <option value="Review needed">Review needed</option>
            <option value="Marketing">Marketing</option>
            <option value="Quoted">Quoted</option>
            <option value="Ready to bind">Ready to bind</option>
            <option value="Renewed">Renewed</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Coverage Limits</span>
          <input value={form.limits} onChange={e => set('limits', e.target.value)} placeholder="e.g. $1M/$2M" />
        </label>
        <label className="modal-field">
          <span>Producer</span>
          <select value={form.producerUserId} onChange={e => set('producerUserId', e.target.value)}>
            <option value="">— Unassigned —</option>
            {users.filter(u => u.role === 'Producer' || u.role === 'Agent/Owner' || u.role === 'Principal Agent').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>CSR</span>
          <select value={form.csrUserId} onChange={e => set('csrUserId', e.target.value)}>
            <option value="">— Unassigned —</option>
            {users.filter(u => u.role === 'CSR' || u.role === 'Admin').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Notes</span>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => onSave(form)}>{policy ? 'Save Changes' : 'Add Policy'}</button>
      </div>
    </ModalShell>
  )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ currentUserId, clients, users, onClose, onSave }: {
  currentUserId: string; clients: Client[]; users: UserOption[]; onClose: () => void
  onSave: (d: { title: string; description: string; dueDate: string; priority: string; assignedToUserId: string; clientId: string }) => void
}) {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'Normal', assignedToUserId: currentUserId, clientId: '' })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <ModalShell title="Add Task" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field modal-field--full">
          <span>Title *</span>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title" />
        </label>
        <label className="modal-field">
          <span>Due Date</span>
          <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Priority</span>
          <select value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Assigned To</span>
          <select value={form.assignedToUserId} onChange={e => set('assignedToUserId', e.target.value)}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="modal-field">
          <span>Related Client</span>
          <select value={form.clientId} onChange={e => set('clientId', e.target.value)}>
            <option value="">— None —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Notes</span>
          <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => { if (form.title) onSave(form) }}>Add Task</button>
      </div>
    </ModalShell>
  )
}

// ─── Lead Modal ───────────────────────────────────────────────────────────────
function LeadModal({ users, onClose, onSave }: {
  users: UserOption[]; onClose: () => void
  onSave: (d: { clientName: string; estimatedPremium: string; stage: string; ownerUserId: string }) => void
}) {
  const [form, setForm] = useState({ clientName: '', estimatedPremium: '', stage: 'New lead', ownerUserId: users[0]?.id ?? '' })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <ModalShell title="Add Lead" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field modal-field--full">
          <span>Client / Company Name *</span>
          <input value={form.clientName} onChange={e => set('clientName', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Estimated Premium ($)</span>
          <input type="number" min="0" value={form.estimatedPremium} onChange={e => set('estimatedPremium', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Stage</span>
          <select value={form.stage} onChange={e => set('stage', e.target.value)}>
            <option value="New lead">New lead</option>
            <option value="Discovery">Discovery</option>
            <option value="Quoting">Quoting</option>
            <option value="Proposal">Proposal</option>
            <option value="Bound">Bound</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Owner</span>
          <select value={form.ownerUserId} onChange={e => set('ownerUserId', e.target.value)}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => { if (form.clientName) onSave(form) }}>Add Lead</button>
      </div>
    </ModalShell>
  )
}

// ─── Billing Modal ────────────────────────────────────────────────────────────
function BillingModal({ billing, onClose, onSave }: { billing?: PolicyBilling; onClose: () => void; onSave: (b: PolicyBilling) => void }) {
  const [form, setForm] = useState<PolicyBilling>(billing ?? {})
  const set = (k: keyof PolicyBilling, v: string) => setForm(f => ({ ...f, [k]: v as never }))
  return (
    <ModalShell title="Edit Billing Details" onClose={onClose} wide>
      <div className="modal-form">
        <label className="modal-field">
          <span>Payment Method</span>
          <select value={form.paymentMethod ?? ''} onChange={e => set('paymentMethod', e.target.value)}>
            <option value="">Not set</option>
            <option value="Credit Card">Credit Card</option>
            <option value="ACH / Bank Draft">ACH / Bank Draft</option>
            <option value="Check">Check</option>
            <option value="Cash">Cash</option>
            <option value="Escrow / Mortgagee">Escrow / Mortgagee</option>
            <option value="Premium Finance">Premium Finance</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Payment Status</span>
          <select value={form.paymentStatus ?? ''} onChange={e => set('paymentStatus', e.target.value)}>
            <option value="">Not set</option>
            <option value="Current">Current</option>
            <option value="Due soon">Due soon</option>
            <option value="Past due">Past due</option>
            <option value="Paid in full">Paid in full</option>
            <option value="NSF / Returned">NSF / Returned</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Next Payment Date</span>
          <input type="date" value={form.nextPaymentDate ?? ''} onChange={e => set('nextPaymentDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Next Payment Amount ($)</span>
          <input type="number" min="0" value={form.nextPaymentAmount ?? ''} onChange={e => set('nextPaymentAmount', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Last Payment Date</span>
          <input type="date" value={form.lastPaymentDate ?? ''} onChange={e => set('lastPaymentDate', e.target.value)} />
        </label>
        <label className="modal-field">
          <span>Last Payment Amount ($)</span>
          <input type="number" min="0" value={form.lastPaymentAmount ?? ''} onChange={e => set('lastPaymentAmount', e.target.value)} />
        </label>
        <label className="modal-field modal-field--full">
          <span>Billing Notes</span>
          <textarea rows={2} value={form.billingNotes ?? ''} onChange={e => set('billingNotes', e.target.value)} />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => onSave(form)}>Save Billing</button>
      </div>
    </ModalShell>
  )
}

// ─── IQ Buddy ─────────────────────────────────────────────────────────────────
function IqBuddy({ onOpen }: { onOpen: () => void }) {
  const [tip, setTip] = useState('')
  const [showTip, setShowTip] = useState(false)
  const [anim, setAnim] = useState('')

  const tips = [
    'Tip: Check renewals expiring in 30 days from the Renewals tab.',
    'Tip: Use Ask IQ to get plain-English explanations of coverage terms.',
    'Tip: Tag clients with health status to prioritize outreach.',
    'Tip: Add tasks to track follow-ups and never miss a client call.',
  ]

  useEffect(() => {
    const t = setTimeout(() => {
      setTip(tips[Math.floor(Math.random() * tips.length)])
      setShowTip(true)
      setAnim('iq-buddy--wave')
      setTimeout(() => { setAnim(''); setTimeout(() => setShowTip(false), 4000) }, 600)
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="iq-buddy-wrap">
      {showTip && (
        <div className="iq-buddy-tip">
          <button className="iq-buddy-dismiss" type="button" onClick={() => setShowTip(false)}>×</button>
          <p>{tip}</p>
        </div>
      )}
      <button type="button" className={`iq-buddy-avatar${anim ? ` ${anim}` : ''}`} onClick={onOpen} title="Open Ask IQ">
        <img src={mascotImg} alt="IQ assistant" className="iq-buddy-img" />
      </button>
    </div>
  )
}

// ─── AI Help Panel ────────────────────────────────────────────────────────────
function AiHelpPanel({ onClose, clientName }: { onClose: () => void; clientName?: string }) {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = [
    'What is ACV vs replacement cost?',
    'Explain commercial general liability',
    'What is an umbrella policy?',
    'How does premium financing work?',
  ]

  const ask = async (q: string) => {
    if (!q.trim()) return
    setQuery(q); setLoading(true); setAnswer('')
    await new Promise(r => setTimeout(r, 1200))
    const responses: Record<string, string> = {
      'acv': 'ACV (Actual Cash Value) pays the depreciated value of a lost or damaged item. Replacement Cost pays what it would cost to replace it new — typically resulting in a higher claim payout. For example, a 5-year-old roof with ACV coverage might receive $8,000 while the same roof with Replacement Cost coverage would receive the full $18,000 replacement cost.',
      'general liability': 'Commercial General Liability (CGL) covers bodily injury and property damage claims arising from your business operations, products, or completed work. It typically includes premises liability, products liability, and personal/advertising injury. Most businesses need at least $1M per occurrence / $2M aggregate.',
      'umbrella': 'An umbrella policy provides excess liability coverage above your underlying policies (auto, home, general liability). It kicks in once those limits are exhausted. A $1M umbrella is often very affordable and provides important protection against catastrophic claims.',
      'premium finance': 'Premium financing allows insureds to spread policy costs over monthly payments instead of paying upfront. A finance company pays the carrier in full, and the insured repays the finance company with interest. If payments are missed, the policy can be cancelled.',
    }
    const key = Object.keys(responses).find(k => q.toLowerCase().includes(k))
    setAnswer(key ? responses[key] : `Great question about "${q}". In insurance, this involves reviewing your specific policy terms, state regulations, and coverage needs. I recommend discussing this directly with your carrier or a licensed specialist for your specific situation.`)
    setLoading(false)
  }

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="ai-help-panel">
      <div className="ai-help-header">
        <div className="ai-help-mascot-row">
          <img src={mascotImg} alt="" aria-hidden="true" className="ai-panel-mascot" />
          <div>
            <h3>Ask IQ</h3>
            <p>{clientName ? `Helping with ${clientName}` : 'Your insurance knowledge assistant'}</p>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="ai-help-body">
        {!answer && !loading && (
          <div className="ai-suggestions">
            <p className="ai-suggest-label">Try asking:</p>
            {suggestions.map(s => (
              <button key={s} type="button" className="ai-suggest-chip" onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
        )}
        {loading && (
          <div className="ai-loading">
            <img src={mascotImg} alt="" className="ai-loading-mascot" />
            <span>IQ is thinking…</span>
          </div>
        )}
        {answer && (
          <div className="ai-answer">
            <img src={mascotImg} alt="" className="ai-answer-mascot" />
            <div className="ai-answer-text">
              <span className="ai-answer-label">Ask IQ</span>
              <p>{answer}</p>
            </div>
          </div>
        )}
      </div>

      <div className="ai-help-footer">
        <input
          ref={inputRef}
          type="text"
          className="ai-query-input"
          placeholder="Ask a coverage or policy question…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(query) }}
        />
        <button type="button" className="primary-action ai-send-btn" onClick={() => ask(query)}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ dataset, onViewClient, onOpenNewClient }: {
  dataset: CrmDataset
  onViewClient: (id: string) => void
  onOpenNewClient: () => void
}) {
  const { clients, policies, tasks, opportunities, renewals } = dataset
  const activePolicies = policies.filter(p => p.status === 'Active')
  const totalPremium = activePolicies.reduce((s, p) => s + p.premium, 0)
  const openTasks = tasks.filter(t => !t.completed)
  const upcomingRenewals = policies
    .filter(p => p.status === 'Active' && p.expirationDate)
    .map(p => ({ ...p, days: daysUntil(p.expirationDate) }))
    .filter(p => p.days >= 0 && p.days <= 90)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)
  const recentClients = [...clients].sort((a, b) => (b.clientSince ?? '').localeCompare(a.clientSince ?? '')).slice(0, 5)
  const activeLeads = opportunities.filter(o => o.stage !== 'Bound')
  const totalLeadValue = activeLeads.reduce((s, o) => s + o.estimatedPremium, 0)

  const metrics = [
    { label: 'Total Premium in Force', value: currency.format(totalPremium), icon: <CircleDollarSign size={20} />, color: 'var(--accent)' },
    { label: 'Active Clients', value: clients.filter(c => c.accountStatus === 'Active').length.toString(), icon: <UsersRound size={20} />, color: 'var(--stage-b)' },
    { label: 'Active Policies', value: activePolicies.length.toString(), icon: <FileText size={20} />, color: 'var(--stage-a)' },
    { label: 'Renewals in 90 Days', value: upcomingRenewals.length.toString(), icon: <CalendarClock size={20} />, color: 'var(--gold)' },
    { label: 'Open Tasks', value: openTasks.length.toString(), icon: <CheckSquare size={20} />, color: 'var(--stage-d)' },
    { label: 'Pipeline Value', value: currency.format(totalLeadValue), icon: <Target size={20} />, color: 'var(--stage-e)' },
  ]

  return (
    <div className="dashboard">
      <div className="dashboard-metrics">
        {metrics.map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-icon" style={{ color: m.color, background: `${m.color}18` }}>{m.icon}</div>
            <div className="metric-body">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* Upcoming Renewals */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <CalendarClock size={16} /><span>Upcoming Renewals</span>
          </div>
          {upcomingRenewals.length === 0 ? (
            <p className="dash-empty">No renewals in the next 90 days.</p>
          ) : (
            <div className="dash-panel-list">
              {upcomingRenewals.map(p => {
                const client = clients.find(c => c.id === p.clientId)
                const urgency = p.days <= 14 ? 'urgent' : p.days <= 30 ? 'warning' : 'normal'
                return (
                  <div key={p.id} className={`renewal-row renewal-row--${urgency}`} onClick={() => client && onViewClient(client.id)}>
                    <div className="renewal-info">
                      <span className="renewal-client">{client?.name ?? '—'}</span>
                      <span className="renewal-type">{p.policyType} · {p.carrier}</span>
                    </div>
                    <div className={`renewal-days renewal-days--${urgency}`}>{p.days === 0 ? 'Today' : `${p.days}d`}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Open Tasks */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <CheckSquare size={16} /><span>Open Tasks</span>
          </div>
          {openTasks.length === 0 ? (
            <p className="dash-empty">All caught up — no open tasks!</p>
          ) : (
            <div className="dash-panel-list">
              {openTasks.slice(0, 6).map(t => {
                const client = clients.find(c => c.id === t.clientId)
                const urgency = t.priority === 'Urgent' || t.priority === 'High' ? 'high' : 'normal'
                return (
                  <div key={t.id} className="task-dash-row">
                    <div className={`task-priority-dot task-priority-dot--${urgency}`} />
                    <div className="task-dash-info">
                      <span className="task-dash-title">{t.title}</span>
                      {client && <span className="task-dash-client">{client.name}</span>}
                    </div>
                    {t.dueDate && <span className="task-dash-due">{formatDate(t.dueDate)}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sales Pipeline */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <Target size={16} /><span>Sales Pipeline</span>
          </div>
          {activeLeads.length === 0 ? (
            <p className="dash-empty">No active leads in pipeline.</p>
          ) : (
            <div className="dash-panel-list">
              {activeLeads.slice(0, 6).map(o => (
                <div key={o.id} className="lead-dash-row">
                  <div className="lead-dash-info">
                    <span className="lead-dash-name">{o.clientName}</span>
                    <span className={`stage-pill stage-pill--${o.stage.toLowerCase().replace(' ', '-')}`}>{o.stage}</span>
                  </div>
                  <span className="lead-dash-value">{currency.format(o.estimatedPremium)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Clients */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <UsersRound size={16} /><span>Recent Clients</span>
            <button type="button" className="dash-panel-action" onClick={onOpenNewClient}><Plus size={14} /> Add</button>
          </div>
          <div className="dash-panel-list">
            {recentClients.map(c => (
              <div key={c.id} className="recent-client-row" onClick={() => onViewClient(c.id)}>
                <div className="client-avatar">{c.name.slice(0, 2).toUpperCase()}</div>
                <div className="recent-client-info">
                  <span className="recent-client-name">{c.name}</span>
                  <span className="recent-client-meta">{c.lineOfBusiness} · {c.policyCount} {c.policyCount === 1 ? 'policy' : 'policies'}</span>
                </div>
                <ChevronRight size={14} className="recent-client-arrow" />
              </div>
            ))}
          </div>
        </div>

        {renewals.length > 0 && (
          <div className="dash-panel">
            <div className="dash-panel-head">
              <AlertTriangle size={16} /><span>Renewal Actions Needed</span>
            </div>
            <div className="dash-panel-list">
              {renewals.slice(0, 5).map(r => {
                const client = clients.find(c => c.id === r.clientId)
                return (
                  <div key={r.id} className="renewal-action-row" onClick={() => client && onViewClient(client.id)}>
                    <span className="renewal-action-client">{client?.name ?? '—'}</span>
                    <span className={`renewal-action-status status-${r.status.toLowerCase().replace(/\s/g, '-')}`}>{r.status}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Client List ──────────────────────────────────────────────────────────────
function ClientList({ clients, policies, filter, search, sort, onViewClient, page, pageSize, onPageChange }: {
  clients: Client[]; policies: Policy[]; filter: ClientFilter; search: string
  sort: ClientSort; onViewClient: (id: string) => void
  page: number; pageSize: number; onPageChange: (p: number) => void
}) {
  const filtered = useMemo(() => {
    let list = clients.filter(c => {
      if (filter === 'Active') return c.accountStatus === 'Active'
      if (filter === 'Inactive') return c.accountStatus === 'Inactive'
      if (filter === 'Prospect') return c.accountStatus === 'Prospect' || c.status === 'Prospect'
      return true
    })
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.primaryContact.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q))
    }
    list = [...list].sort((a, b) => {
      if (sort === 'name-desc') return b.name.localeCompare(a.name)
      if (sort === 'premium-desc') {
        const pa = policies.filter(p => p.clientId === a.id && p.status === 'Active').reduce((s, p) => s + p.premium, 0)
        const pb = policies.filter(p => p.clientId === b.id && p.status === 'Active').reduce((s, p) => s + p.premium, 0)
        return pb - pa
      }
      return a.name.localeCompare(b.name)
    })
    return list
  }, [clients, filter, search, sort, policies])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div className="client-list-wrap">
      <div className="client-grid">
        {paged.map(c => {
          const clientPolicies = policies.filter(p => p.clientId === c.id && p.status === 'Active')
          const totalPremium = clientPolicies.reduce((s, p) => s + p.premium, 0)
          const nearest = clientPolicies.filter(p => p.expirationDate).sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))[0]
          const daysToRenewal = nearest ? daysUntil(nearest.expirationDate) : null
          return (
            <div key={c.id} className="client-card" onClick={() => onViewClient(c.id)}>
              <div className="client-card-header">
                <div className="client-avatar client-avatar--lg">{c.name.slice(0, 2).toUpperCase()}</div>
                <div className="client-card-name-block">
                  <div className="client-card-name">{c.name}</div>
                  <div className="client-card-contact">{c.primaryContact}</div>
                </div>
                <span className={`health-badge health-badge--${c.health?.toLowerCase().replace(' ', '-') ?? 'strong'}`}>{c.health ?? 'Strong'}</span>
              </div>
              <div className="client-card-meta">
                <span>{c.lineOfBusiness}</span>
                <span>·</span>
                <span>{c.policyCount} {c.policyCount === 1 ? 'policy' : 'policies'}</span>
              </div>
              <div className="client-card-stats">
                <div className="client-stat">
                  <span className="client-stat-label">Premium</span>
                  <span className="client-stat-value">{currency.format(totalPremium)}</span>
                </div>
                {daysToRenewal !== null && (
                  <div className="client-stat">
                    <span className="client-stat-label">Next Renewal</span>
                    <span className={`client-stat-value${daysToRenewal <= 30 ? ' client-stat-value--urgent' : ''}`}>
                      {daysToRenewal <= 0 ? 'Expired' : `${daysToRenewal}d`}
                    </span>
                  </div>
                )}
                {c.phone && (
                  <div className="client-stat">
                    <span className="client-stat-label">Phone</span>
                    <span className="client-stat-value">{c.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="page-btn">‹ Prev</button>
          <span className="page-info">{page + 1} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className="page-btn">Next ›</button>
        </div>
      )}
    </div>
  )
}

// ─── Client Detail ────────────────────────────────────────────────────────────
function ClientDetail({ client, policies, tasks, notes, users, tab, onTabChange, onBack, onEditClient, onAddPolicy, onEditPolicy, onEditBilling, onAddTask, onAddNote, onCompleteTask, onDeletePolicy, onDeleteNote, onIvansSync }: {
  client: Client; policies: Policy[]; tasks: import('./data/crmTypes').Task[]
  notes: import('./data/crmTypes').ClientNote[]; users: UserOption[]
  tab: ClientTab; onTabChange: (t: ClientTab) => void
  onBack: () => void; onEditClient: () => void; onAddPolicy: () => void
  onEditPolicy: (id: string) => void; onEditBilling: (id: string) => void
  onAddTask: () => void; onAddNote: () => void
  onCompleteTask: (id: string) => void; onDeletePolicy: (id: string) => void
  onDeleteNote: (id: string) => void; onIvansSync: () => void
}) {
  const clientPolicies = policies.filter(p => p.clientId === client.id)
  const activePolicies = clientPolicies.filter(p => p.status === 'Active')
  const totalPremium = activePolicies.reduce((s, p) => s + p.premium, 0)
  const clientTasks = tasks.filter(t => t.clientId === client.id)
  const openTasks = clientTasks.filter(t => !t.completed)
  const clientNotes = notes.filter(n => n.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const assignedProducer = users.find(u => u.id === client.assignedProducerId)
  const assignedCsr = users.find(u => u.id === client.assignedCsrId)

  const TABS: ClientTab[] = ['Overview', 'Policies', 'Tasks', 'Notes', 'Billing', 'Activity']

  return (
    <div className="client-detail">
      <div className="client-detail-header">
        <button type="button" className="back-btn" onClick={onBack}><ArrowLeft size={16} /> All Clients</button>
        <div className="client-detail-title">
          <div className="client-avatar client-avatar--xl">{client.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h2>{client.name}</h2>
            <div className="client-detail-meta">
              <span className={`account-status-badge status-${(client.accountStatus ?? 'Active').toLowerCase()}`}>{client.accountStatus ?? 'Active'}</span>
              <span>{client.lineOfBusiness}</span>
              {client.primaryContact && <span>{client.primaryContact}</span>}
            </div>
          </div>
        </div>
        <div className="client-detail-actions">
          <button type="button" className="secondary-action" onClick={onIvansSync}><RefreshCcw size={14} /> IVANS Sync</button>
          <button type="button" className="primary-action" onClick={onEditClient}><Pencil size={14} /> Edit Client</button>
        </div>
      </div>

      <div className="client-stat-strip">
        <div className="cstat"><span>Total Premium</span><strong>{currency.format(totalPremium)}</strong></div>
        <div className="cstat"><span>Active Policies</span><strong>{activePolicies.length}</strong></div>
        <div className="cstat"><span>Open Tasks</span><strong>{openTasks.length}</strong></div>
        <div className="cstat"><span>Client Since</span><strong>{client.clientSince ? formatDate(client.clientSince) : '—'}</strong></div>
        <div className="cstat"><span>Health</span><strong className={`health-text health-text--${client.health?.toLowerCase().replace(' ', '-') ?? 'strong'}`}>{client.health ?? 'Strong'}</strong></div>
      </div>

      <div className="client-tabs">
        {TABS.map(t => (
          <button key={t} type="button" className={`client-tab${tab === t ? ' client-tab--active' : ''}`} onClick={() => onTabChange(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="client-overview">
          <div className="overview-section">
            <h3><Phone size={15} /> Contact Information</h3>
            <div className="overview-fields">
              {client.phone && <div className="ov-field"><span>Phone</span><a href={`tel:${client.phone}`}>{client.phone}</a></div>}
              {client.alternatePhone && <div className="ov-field"><span>Alt Phone</span><span>{client.alternatePhone}</span></div>}
              {client.email && <div className="ov-field"><span>Email</span><a href={`mailto:${client.email}`}>{client.email}</a></div>}
              {client.mailingAddress && <div className="ov-field"><span>Mailing Address</span><span>{client.mailingAddress}</span></div>}
              {client.physicalAddress && <div className="ov-field"><span>Physical Address</span><span>{client.physicalAddress}</span></div>}
              {client.website && <div className="ov-field"><span>Website</span><a href={client.website} target="_blank" rel="noopener noreferrer">{client.website}</a></div>}
              {client.preferredContactMethod && <div className="ov-field"><span>Preferred Contact</span><span>{client.preferredContactMethod}</span></div>}
            </div>
          </div>

          <div className="overview-section">
            <h3><Building2 size={15} /> Account Details</h3>
            <div className="overview-fields">
              <div className="ov-field"><span>Line of Business</span><span>{client.lineOfBusiness}</span></div>
              <div className="ov-field"><span>Account Status</span><span>{client.accountStatus ?? 'Active'}</span></div>
              {client.billingMethod && <div className="ov-field"><span>Billing Method</span><span>{client.billingMethod}</span></div>}
              {assignedProducer && <div className="ov-field"><span>Producer</span><span>{assignedProducer.name}</span></div>}
              {assignedCsr && <div className="ov-field"><span>CSR</span><span>{assignedCsr.name}</span></div>}
            </div>
          </div>

          {client.notes && (
            <div className="overview-section overview-section--full">
              <h3><FileText size={15} /> Account Notes</h3>
              <p className="overview-notes">{client.notes}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'Policies' && (
        <div className="client-policies">
          <div className="tab-actions">
            <button type="button" className="primary-action" onClick={onAddPolicy}><Plus size={14} /> Add Policy</button>
          </div>
          {clientPolicies.length === 0 ? (
            <div className="tab-empty">No policies on this account yet.</div>
          ) : (
            <div className="policies-table">
              <div className="policies-thead">
                <span>Policy Type</span><span>Carrier</span><span>Policy #</span>
                <span>Premium</span><span>Expiration</span><span>Status</span><span></span>
              </div>
              {clientPolicies.map(p => {
                const days = p.expirationDate ? daysUntil(p.expirationDate) : null
                return (
                  <div key={p.id} className="policies-row">
                    <span className="policy-type">{p.policyType}</span>
                    <span>{p.carrier}</span>
                    <span className="policy-number">{p.policyNumber ?? '—'}</span>
                    <span className="policy-premium">{currency.format(p.premium)}</span>
                    <span className={days !== null && days <= 30 ? 'text-urgent' : ''}>{p.expirationDate ? formatDate(p.expirationDate) : '—'}</span>
                    <span><span className={`policy-status-badge status-${p.status.toLowerCase().replace(/\s/g, '-')}`}>{p.status}</span></span>
                    <div className="policy-actions">
                      <button type="button" className="icon-btn-sm" onClick={() => onEditPolicy(p.id)} title="Edit"><Pencil size={13} /></button>
                      <button type="button" className="icon-btn-sm" onClick={() => onEditBilling(p.id)} title="Billing"><CircleDollarSign size={13} /></button>
                      <button type="button" className="icon-btn-sm icon-btn-sm--danger" onClick={() => onDeletePolicy(p.id)} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'Tasks' && (
        <div className="client-tasks">
          <div className="tab-actions">
            <button type="button" className="primary-action" onClick={onAddTask}><Plus size={14} /> Add Task</button>
          </div>
          {clientTasks.length === 0 ? (
            <div className="tab-empty">No tasks for this client.</div>
          ) : (
            <div className="tasks-list">
              {clientTasks.map(t => {
                const assignee = users.find(u => u.id === t.assignedToUserId)
                return (
                  <div key={t.id} className={`task-item${t.completed ? ' task-item--done' : ''}`}>
                    <button type="button" className="task-check" onClick={() => onCompleteTask(t.id)}>
                      <CheckCircle2 size={18} />
                    </button>
                    <div className="task-item-body">
                      <div className="task-item-title">{t.title}</div>
                      <div className="task-item-meta">
                        {t.dueDate && <span><Clock size={11} />{formatDate(t.dueDate)}</span>}
                        {assignee && <span>{assignee.name}</span>}
                        <span className={`task-priority task-priority--${t.priority.toLowerCase()}`}>{t.priority}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'Notes' && (
        <div className="client-notes">
          <div className="tab-actions">
            <button type="button" className="primary-action" onClick={onAddNote}><Plus size={14} /> Add Note</button>
          </div>
          {clientNotes.length === 0 ? (
            <div className="tab-empty">No notes yet — add one to track conversations, follow-ups, and underwriting details.</div>
          ) : (
            <div className="notes-list">
              {clientNotes.map(n => {
                const author = users.find(u => u.id === n.createdByUserId)
                return (
                  <div key={n.id} className="note-card">
                    <div className="note-card-header">
                      <span className={`note-type note-type--${(n.type ?? 'general').toLowerCase()}`}>{n.type ?? 'General'}</span>
                      <span className="note-date">{formatDate(n.createdAt.split('T')[0])}</span>
                      {author && <span className="note-author">{author.name}</span>}
                      <button type="button" className="icon-btn-sm icon-btn-sm--danger" onClick={() => onDeleteNote(n.id)}><Trash2 size={12} /></button>
                    </div>
                    <p className="note-body">{n.body}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'Billing' && (
        <div className="client-billing">
          {clientPolicies.length === 0 ? (
            <div className="tab-empty">No policies to show billing for.</div>
          ) : (
            <div className="billing-policies">
              {clientPolicies.map(p => {
                const b = p.billing
                return (
                  <div key={p.id} className="billing-policy-card">
                    <div className="billing-policy-header">
                      <strong>{p.policyType}</strong>
                      <span className="billing-carrier">{p.carrier}</span>
                      <span className="billing-premium">{currency.format(p.premium)}</span>
                      <button type="button" className="secondary-action billing-edit-btn" onClick={() => onEditBilling(p.id)}><Pencil size={12} /> Edit Billing</button>
                    </div>
                    {b ? (
                      <div className="billing-fields">
                        {b.paymentMethod && <div className="billing-field"><span>Payment Method</span><span>{b.paymentMethod}</span></div>}
                        {b.paymentStatus && <div className="billing-field"><span>Status</span><span className={`payment-status-${b.paymentStatus.toLowerCase().replace(/\s/g, '-')}`}>{b.paymentStatus}</span></div>}
                        {b.nextPaymentDate && <div className="billing-field"><span>Next Payment</span><span>{formatDate(b.nextPaymentDate)} {b.nextPaymentAmount ? `· ${currency.format(b.nextPaymentAmount)}` : ''}</span></div>}
                        {b.billingNotes && <div className="billing-field billing-field--full"><span>Notes</span><span>{b.billingNotes}</span></div>}
                      </div>
                    ) : (
                      <p className="billing-empty">No billing details. Click Edit Billing to add.</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'Activity' && (
        <div className="client-activity">
          <div className="activity-list">
            {clientNotes.map(n => (
              <div key={n.id} className="activity-item">
                <div className="activity-dot" />
                <div className="activity-content">
                  <span className="activity-action">Note added</span>
                  <span className="activity-text">{n.body.slice(0, 80)}{n.body.length > 80 ? '…' : ''}</span>
                  <span className="activity-time">{formatDate(n.createdAt.split('T')[0])}</span>
                </div>
              </div>
            ))}
            {clientPolicies.map(p => (
              <div key={p.id} className="activity-item">
                <div className="activity-dot activity-dot--policy" />
                <div className="activity-content">
                  <span className="activity-action">Policy: {p.policyType}</span>
                  <span className="activity-text">{p.carrier} · {currency.format(p.premium)}/yr</span>
                  <span className="activity-time">{p.effectiveDate ? formatDate(p.effectiveDate) : 'Effective date unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Note Modal ───────────────────────────────────────────────────────────
function AddNoteModal({ onClose, onSave }: { onClose: () => void; onSave: (body: string, type: string) => void }) {
  const [body, setBody] = useState('')
  const [type, setType] = useState('General')
  return (
    <ModalShell title="Add Note" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-field">
          <span>Note Type</span>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="General">General</option>
            <option value="Renewal">Renewal</option>
            <option value="Payment">Payment</option>
            <option value="Claim">Claim</option>
            <option value="Underwriting">Underwriting</option>
            <option value="Follow-up">Follow-up</option>
          </select>
        </label>
        <label className="modal-field modal-field--full">
          <span>Note *</span>
          <textarea rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Enter note…" />
        </label>
      </div>
      <div className="modal-footer">
        <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-action" type="button" onClick={() => { if (body.trim()) onSave(body, type) }}>Save Note</button>
      </div>
    </ModalShell>
  )
}

// ─── Tasks View ───────────────────────────────────────────────────────────────
function TasksView({ tasks, clients, users, onComplete, onAdd }: {
  tasks: import('./data/crmTypes').Task[]; clients: Client[]; users: UserOption[]
  onComplete: (id: string) => void; onAdd: () => void
}) {
  const [showCompleted, setShowCompleted] = useState(false)
  const openTasks = tasks.filter(t => !t.completed)
  const doneTasks = tasks.filter(t => t.completed)
  const display = showCompleted ? tasks : openTasks

  return (
    <div className="tasks-view">
      <div className="tasks-view-header">
        <div className="tasks-stats">
          <span><strong>{openTasks.length}</strong> open</span>
          <span><strong>{doneTasks.length}</strong> completed</span>
        </div>
        <div className="tasks-actions">
          <button type="button" className="secondary-action" onClick={() => setShowCompleted(v => !v)}>
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          <button type="button" className="primary-action" onClick={onAdd}><Plus size={14} /> Add Task</button>
        </div>
      </div>
      <div className="tasks-full-list">
        {display.map(t => {
          const client = clients.find(c => c.id === t.clientId)
          const assignee = users.find(u => u.id === t.assignedToUserId)
          return (
            <div key={t.id} className={`task-full-row${t.completed ? ' task-full-row--done' : ''}`}>
              <button type="button" className="task-check" onClick={() => onComplete(t.id)}>
                <CheckCircle2 size={20} />
              </button>
              <div className="task-full-body">
                <div className="task-full-title">{t.title}</div>
                <div className="task-full-meta">
                  {client && <span className="task-client-tag">{client.name}</span>}
                  {assignee && <span>{assignee.name}</span>}
                  {t.dueDate && <span><Clock size={11} />{formatDate(t.dueDate)}</span>}
                </div>
              </div>
              <span className={`task-priority-badge priority-${t.priority.toLowerCase()}`}>{t.priority}</span>
            </div>
          )
        })}
        {display.length === 0 && <div className="tab-empty">No tasks to show.</div>}
      </div>
    </div>
  )
}

// ─── Renewals View ────────────────────────────────────────────────────────────
function RenewalsView({ policies, clients, onViewClient }: { policies: Policy[]; clients: Client[]; onViewClient: (id: string) => void }) {
  const [horizon, setHorizon] = useState<30 | 60 | 90>(90)
  const upcoming = policies
    .filter(p => p.status === 'Active' && p.expirationDate)
    .map(p => ({ ...p, days: daysUntil(p.expirationDate) }))
    .filter(p => p.days >= -7 && p.days <= horizon)
    .sort((a, b) => a.days - b.days)

  return (
    <div className="renewals-view">
      <div className="renewals-toolbar">
        <div className="horizon-tabs">
          {([30, 60, 90] as const).map(h => (
            <button key={h} type="button" className={`sort-tab${horizon === h ? ' active' : ''}`} onClick={() => setHorizon(h)}>Next {h} Days</button>
          ))}
        </div>
        <span className="renewals-count"><strong>{upcoming.length}</strong> renewals</span>
      </div>
      <div className="renewals-table-wrap">
        <div className="renewals-thead">
          <span>Client</span><span>Policy Type</span><span>Carrier</span>
          <span>Premium</span><span>Expiration</span><span>Days</span><span>Status</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="tab-empty">No renewals in this window.</div>
        ) : (
          upcoming.map(p => {
            const client = clients.find(c => c.id === p.clientId)
            const urgency = p.days <= 14 ? 'urgent' : p.days <= 30 ? 'warning' : 'normal'
            return (
              <div key={p.id} className="renewals-row" onClick={() => client && onViewClient(client.id)}>
                <span className="renewal-client-name">{client?.name ?? '—'}</span>
                <span>{p.policyType}</span>
                <span>{p.carrier}</span>
                <span>{currency.format(p.premium)}</span>
                <span>{formatDate(p.expirationDate)}</span>
                <span className={`renewal-days-badge days-${urgency}`}>{p.days <= 0 ? 'Expired' : `${p.days}d`}</span>
                <span>{p.renewalStatus ?? '—'}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Leads View ───────────────────────────────────────────────────────────────
function LeadsView({ opportunities, users, onAdd, onUpdateStage }: {
  opportunities: import('./data/crmTypes').Opportunity[]; users: UserOption[]
  onAdd: () => void; onUpdateStage: (id: string, stage: string) => void
}) {
  const stages = ['New lead', 'Discovery', 'Quoting', 'Proposal', 'Bound']
  const totalValue = opportunities.filter(o => o.stage !== 'Bound').reduce((s, o) => s + o.estimatedPremium, 0)

  return (
    <div className="leads-view">
      <div className="leads-header">
        <div className="leads-stats">
          <span><strong>{opportunities.length}</strong> leads</span>
          <span>Pipeline: <strong>{currency.format(totalValue)}</strong></span>
        </div>
        <button type="button" className="primary-action" onClick={onAdd}><Plus size={14} /> Add Lead</button>
      </div>
      <div className="leads-pipeline">
        {stages.map(stage => {
          const stageLeads = opportunities.filter(o => o.stage === stage)
          return (
            <div key={stage} className="pipeline-col">
              <div className="pipeline-col-header">
                <span className={`stage-label stage-${stage.toLowerCase().replace(' ', '-')}`}>{stage}</span>
                <span className="stage-count">{stageLeads.length}</span>
              </div>
              <div className="pipeline-cards">
                {stageLeads.map(o => {
                  const owner = users.find(u => u.id === o.ownerUserId)
                  return (
                    <div key={o.id} className="pipeline-card">
                      <div className="pipeline-card-name">{o.clientName}</div>
                      <div className="pipeline-card-value">{currency.format(o.estimatedPremium)}</div>
                      {owner && <div className="pipeline-card-owner">{owner.name}</div>}
                      <select
                        className="pipeline-stage-select"
                        value={o.stage}
                        onChange={e => onUpdateStage(o.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                      >
                        {stages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Settings View ────────────────────────────────────────────────────────────
function SettingsView({ dataset, palette, mode, onPaletteChange, onModeToggle, onUpdateAgency, onUpdateUser }: {
  dataset: CrmDataset; palette: PaletteId; mode: ColorMode
  onPaletteChange: (p: PaletteId) => void; onModeToggle: () => void
  onUpdateAgency: (name: string) => void; onUpdateUser: (role: UserRole) => void
}) {
  const [agencyName, setAgencyName] = useState(dataset.agency.name)
  const [tab, setTab] = useState<'general' | 'appearance' | 'team'>('general')

  return (
    <div className="settings-view">
      <div className="settings-tabs">
        <button type="button" className={`settings-tab${tab === 'general' ? ' active' : ''}`} onClick={() => setTab('general')}>General</button>
        <button type="button" className={`settings-tab${tab === 'appearance' ? ' active' : ''}`} onClick={() => setTab('appearance')}>Appearance</button>
        <button type="button" className={`settings-tab${tab === 'team' ? ' active' : ''}`} onClick={() => setTab('team')}>Team</button>
      </div>

      {tab === 'general' && (
        <div className="settings-section">
          <h3>Agency Information</h3>
          <label className="settings-field">
            <span>Agency Name</span>
            <input value={agencyName} onChange={e => setAgencyName(e.target.value)} />
          </label>
          <button type="button" className="primary-action" onClick={() => onUpdateAgency(agencyName)}>Save Changes</button>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="settings-section">
          <h3>Theme</h3>
          <div className="appearance-row">
            <span>Color Mode</span>
            <button type="button" className="mode-toggle" onClick={onModeToggle}>
              {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
          <div className="palette-grid">
            {PALETTES.map(p => (
              <button
                key={p.id}
                type="button"
                className={`palette-chip${palette === p.id ? ' palette-chip--active' : ''}`}
                onClick={() => onPaletteChange(p.id)}
              >
                <span className="palette-dot" data-palette={p.id} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="settings-section">
          <h3>Team Members</h3>
          <div className="team-list">
            {dataset.users.map(u => (
              <div key={u.id} className="team-member-row">
                <div className="team-avatar">{u.initials}</div>
                <div className="team-info">
                  <strong>{u.name}</strong>
                  <span>{u.role}</span>
                </div>
                {u.id === dataset.currentUser.id && (
                  <select
                    value={u.role}
                    className="team-role-select"
                    onChange={e => onUpdateUser(e.target.value as UserRole)}
                  >
                    <option value="Agent/Owner">Agent/Owner</option>
                    <option value="Principal Agent">Principal Agent</option>
                    <option value="Producer">Producer</option>
                    <option value="CSR">CSR</option>
                    <option value="Admin">Admin</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [dataset, setDataset] = useState<CrmDataset>(() => loadDataset())
  const [palette, setPalette] = useState<PaletteId>(() => {
    const s = localStorage.getItem('agencyiq-palette')
    return isPaletteId(s) ? s : defaultPalette
  })
  const [mode, setMode] = useState<ColorMode>(() =>
    localStorage.getItem('agencyiq-mode') === 'dark' ? 'dark' : 'light'
  )
  const [activeView, setActiveView] = useState<AppView>('dashboard')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientFilter>('All')
  const [clientTab, setClientTab] = useState<ClientTab>('Overview')
  const [clientSort, setClientSort] = useState<ClientSort>('name-asc')
  const [selectedClientId, setSelectedClientId] = useState(() => dataset.clients[0]?.id ?? '')
  const [modal, setModal] = useState<ModalType>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(() => buildNotifications())
  const [aiHelpOpen, setAiHelpOpen] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [billingPolicyId, setBillingPolicyId] = useState<string | null>(null)
  const [clientPage, setClientPage] = useState(0)
  const [customPolicyTypes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-policy-types') ?? '[]') } catch { return [] }
  })
  const [customCarriers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-carriers') ?? '[]') } catch { return [] }
  })
  const [carrierPortals] = useState<CarrierPortalEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-carrier-portals') ?? '[]') } catch { return [] }
  })
  const [ivansSyncMap, setIvansSyncMap] = useState<Record<string, { syncedAt: string; carrierName: string; renewalStatus: string; policyNumber: string }>>({})
  const [emailTemplates] = useState<EmailTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('agencyiq-email-templates') ?? 'null') ?? defaultEmailTemplates() } catch { return defaultEmailTemplates() }
  })
  const [sessionKicked, setSessionKicked] = useState(false)

  // Session heartbeat
  const handleKicked = useCallback(() => setSessionKicked(true), [])
  useEffect(() => {
    const uid = dataset.currentUser?.id
    if (!uid || uid.startsWith('u-')) return
    return startHeartbeat(uid, handleKicked)
  }, [dataset.currentUser?.id, handleKicked])

  // Load IVANS sync data
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('ivans_policy_sync')
          .select('policy_number, carrier_name, renewal_status, synced_at')
          .eq('account_id', dataset.agency.id)
          .order('synced_at', { ascending: false })
        if (data) {
          const map: typeof ivansSyncMap = {}
          data.forEach((r: { policy_number: string; carrier_name: string; renewal_status: string; synced_at: string }) => {
            if (!map[r.policy_number]) {
              map[r.policy_number] = { syncedAt: r.synced_at, carrierName: r.carrier_name, renewalStatus: r.renewal_status, policyNumber: r.policy_number }
            }
          })
          setIvansSyncMap(map)
        }
      } catch { /* network may be unavailable */ }
    }
    load()
  }, [dataset.agency.id])

  // Persist changes
  useEffect(() => { saveDataset(dataset) }, [dataset])
  useEffect(() => { localStorage.setItem('agencyiq-palette', palette) }, [palette])
  useEffect(() => { localStorage.setItem('agencyiq-mode', mode) }, [mode])
  useEffect(() => { localStorage.setItem('agencyiq-email-templates', JSON.stringify(emailTemplates)) }, [emailTemplates])

  const toast = (message: string) => {
    const id = ++toastCounter.current
    setToasts(t => [...t, { id, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  const save = (updated: CrmDataset) => setDataset(updated)

  const userOptions: UserOption[] = dataset.users.map(u => ({ id: u.id, name: u.name, role: u.role }))

  // ── Client handlers ──────────────────────────────────────────
  const handleViewClient = (id: string) => {
    setSelectedClientId(id); setClientTab('Overview'); setActiveView('client-detail')
  }
  const selectedClient = dataset.clients.find(c => c.id === selectedClientId)

  const handleSaveClient = (data: Parameters<React.ComponentProps<typeof EditClientModal>['onSave']>[0]) => {
    save({
      ...dataset,
      clients: dataset.clients.map(c => c.id === selectedClientId
        ? { ...c, ...data, lineOfBusiness: data.lineOfBusiness as Client['lineOfBusiness'], accountStatus: data.accountStatus as Client['accountStatus'] }
        : c) as Client[],
    })
    setModal(null); toast('Client updated.')
  }

  // ── Policy handlers ──────────────────────────────────────────
  const handleSavePolicy = (data: Partial<Policy>) => {
    if (editingPolicyId) {
      save({ ...dataset, policies: dataset.policies.map(p => p.id === editingPolicyId ? { ...p, ...data } : p) })
      toast('Policy updated.')
    } else {
      const newPolicy: Policy = {
        id: createRecordId('pol'),
        accountId: dataset.agency.id,
        clientId: data.clientId ?? selectedClientId,
        carrier: data.carrier ?? '', policyType: data.policyType ?? '',
        policyNumber: data.policyNumber, effectiveDate: data.effectiveDate,
        expirationDate: data.expirationDate ?? todayIso,
        premium: data.premium ?? 0, commissionRate: data.commissionRate,
        billingType: data.billingType, paymentPlan: data.paymentPlan,
        status: data.status ?? 'Active', renewalStatus: data.renewalStatus ?? 'Not started',
        limits: data.limits, notes: data.notes,
        producerUserId: data.producerUserId, csrUserId: data.csrUserId,
      }
      const clientId = newPolicy.clientId
      save({
        ...dataset,
        policies: [...dataset.policies, newPolicy],
        clients: dataset.clients.map(c => c.id === clientId ? { ...c, policyCount: c.policyCount + 1 } : c),
      })
      toast('Policy added.')
    }
    setModal(null); setEditingPolicyId(null)
  }

  const handleDeletePolicy = (id: string) => {
    const p = dataset.policies.find(x => x.id === id)
    if (!p) return
    save({
      ...dataset,
      policies: dataset.policies.filter(x => x.id !== id),
      clients: dataset.clients.map(c => c.id === p.clientId ? { ...c, policyCount: Math.max(0, c.policyCount - 1) } : c),
    })
    toast('Policy removed.')
  }

  const handleSaveBilling = (billing: PolicyBilling) => {
    if (!billingPolicyId) return
    save({ ...dataset, policies: dataset.policies.map(p => p.id === billingPolicyId ? { ...p, billing } : p) })
    setModal(null); setBillingPolicyId(null); toast('Billing updated.')
  }

  // ── Task handlers ────────────────────────────────────────────
  const handleSaveTask = (data: { title: string; description: string; dueDate: string; priority: string; assignedToUserId: string; clientId: string }) => {
    save({
      ...dataset,
      tasks: [...dataset.tasks, {
        id: createRecordId('task'), accountId: dataset.agency.id,
        clientId: data.clientId || selectedClientId || undefined,
        assignedToUserId: data.assignedToUserId, createdByUserId: dataset.currentUser.id,
        title: data.title, description: data.description,
        dueLabel: data.dueDate ? formatDate(data.dueDate) : 'No due date',
        dueDate: data.dueDate || undefined,
        priority: data.priority as import('./data/crmTypes').TaskPriority,
        completed: false, status: 'Open',
      }],
    })
    setModal(null); toast('Task added.')
  }

  const handleCompleteTask = (id: string) => {
    save({ ...dataset, tasks: dataset.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) })
  }

  // ── Lead handlers ────────────────────────────────────────────
  const handleSaveLead = (data: { clientName: string; estimatedPremium: string; stage: string; ownerUserId: string }) => {
    save({
      ...dataset,
      opportunities: [...dataset.opportunities, {
        id: createRecordId('opp'), accountId: dataset.agency.id,
        ownerUserId: data.ownerUserId, clientName: data.clientName,
        stage: data.stage as import('./data/crmTypes').OpportunityStage,
        estimatedPremium: parseFloat(data.estimatedPremium) || 0,
      }],
    })
    setModal(null); toast('Lead added.')
  }

  const handleUpdateLeadStage = (id: string, stage: string) => {
    save({ ...dataset, opportunities: dataset.opportunities.map(o => o.id === id ? { ...o, stage: stage as import('./data/crmTypes').OpportunityStage } : o) })
  }

  // ── Note handlers ────────────────────────────────────────────
  const handleSaveNote = (body: string, type: string) => {
    save({
      ...dataset,
      notes: [...dataset.notes, {
        id: createRecordId('note'), accountId: dataset.agency.id,
        clientId: selectedClientId, createdByUserId: dataset.currentUser.id,
        createdAt: new Date().toISOString(),
        type: type as import('./data/crmTypes').ClientNote['type'],
        body, pinned: false,
      }],
    })
    setModal(null); toast('Note added.')
  }

  const handleDeleteNote = (id: string) => {
    save({ ...dataset, notes: dataset.notes.filter(n => n.id !== id) })
    toast('Note deleted.')
  }

  // ── Settings ─────────────────────────────────────────────────
  const handleUpdateAgency = (name: string) => {
    save({ ...dataset, agency: { ...dataset.agency, name } }); toast('Agency name updated.')
  }

  const handleUpdateUser = (role: UserRole) => {
    save({
      ...dataset,
      currentUser: { ...dataset.currentUser, role },
      users: dataset.users.map(u => u.id === dataset.currentUser.id ? { ...u, role } : u),
    })
    toast('Role updated.')
  }

  // ── Notifications ────────────────────────────────────────────
  const unreadCount = notifications.filter(n => !n.read).length
  const markAllRead = () => setNotifications(n => n.map(x => ({ ...x, read: true })))

  // ── Nav items ────────────────────────────────────────────────
  const navItems = [
    { id: 'dashboard' as AppView, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'clients' as AppView, label: 'Clients', icon: <UsersRound size={18} /> },
    { id: 'renewals' as AppView, label: 'Renewals', icon: <CalendarClock size={18} /> },
    { id: 'tasks' as AppView, label: 'Tasks', icon: <CheckCircle2 size={18} /> },
    { id: 'leads' as AppView, label: 'Leads', icon: <Target size={18} /> },
    { id: 'settings' as AppView, label: 'Settings', icon: <Settings size={18} /> },
  ]

  const pageTitle = {
    dashboard: 'Dashboard', clients: 'Clients', 'client-detail': selectedClient?.name ?? 'Client',
    renewals: 'Renewals', tasks: 'Tasks', leads: 'Leads Pipeline',
    settings: 'Settings', carriers: 'Carrier Portals', reports: 'Reports',
  }[activeView] ?? ''

  return (
    <div
      className="app-shell"
      data-palette={palette === 'default' ? undefined : palette}
      data-mode={mode === 'dark' ? 'dark' : undefined}
    >
      {/* ── SIDEBAR ────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <button type="button" className="logo-button" onClick={() => setActiveView('dashboard')}>
            <img src={agencyIqLogo} alt="AgencyIQ" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${activeView === item.id || (item.id === 'clients' && activeView === 'client-detail') ? ' nav-item--active' : ''}`}
              onClick={() => {
                setActiveView(item.id)
                if (item.id === 'clients') setClientPage(0)
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{dataset.currentUser.initials}</div>
            <div className="user-info">
              <strong>{dataset.currentUser.name}</strong>
              <span>{dataset.currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <h1 className="page-heading">{pageTitle}</h1>
          </div>
          <div className="topbar-center">
            {(activeView === 'clients') && (
              <div className="search-wrap">
                <Search size={15} className="search-icon" />
                <input
                  className="search-input"
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientPage(0) }}
                />
              </div>
            )}
          </div>
          <div className="topbar-right">
            <button
              className={`iq-ai-trigger${aiHelpOpen ? ' iq-ai-trigger--active' : ''}`}
              type="button"
              title="Ask IQ"
              onClick={() => setAiHelpOpen(v => !v)}
            >
              <span className="iq-ai-trigger-ring">
                <img src={mascotImg} alt="" className="iq-ai-trigger-mascot" />
              </span>
              <span className="iq-ai-trigger-label">Ask IQ</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className="icon-button topbar-notif-btn"
                type="button"
                title="Notifications"
                onClick={() => { setNotifOpen(v => !v); if (!notifOpen) markAllRead() }}
              >
                <Bell size={19} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header"><span>Notifications</span><button type="button" onClick={() => setNotifOpen(false)}><X size={15} /></button></div>
                  {notifications.map(n => (
                    <div key={n.id} className={`notif-item${n.read ? '' : ' notif-item--unread'}`}>
                      <p>{n.text}</p><span>{n.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="icon-button" type="button" title="Carrier Portals" onClick={() => setModal('carrierPortal')}>
              <SlidersHorizontal size={19} />
            </button>
            <button className="icon-button" type="button" title="IVANS Sync" onClick={() => setModal('ivans')}>
              <RefreshCcw size={19} />
            </button>
          </div>
        </div>

        {/* View toolbar */}
        {activeView === 'clients' && (
          <div className="view-toolbar">
            <div className="filter-tabs">
              {(['All', 'Active', 'Inactive', 'Prospect'] as ClientFilter[]).map(f => (
                <button key={f} type="button" className={`sort-tab${clientFilter === f ? ' active' : ''}`} onClick={() => { setClientFilter(f); setClientPage(0) }}>{f}</button>
              ))}
            </div>
            <div className="toolbar-right">
              <select className="sort-select" value={clientSort} onChange={e => setClientSort(e.target.value as ClientSort)}>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="premium-desc">Premium ↓</option>
              </select>
              <button type="button" className="primary-action" onClick={() => setModal('addClient')}>
                <Plus size={14} /> New Client
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="content-area">
          {activeView === 'dashboard' && (
            <Dashboard dataset={dataset} onViewClient={handleViewClient} onOpenNewClient={() => setModal('addClient')} />
          )}

          {activeView === 'clients' && (
            <ClientList
              clients={dataset.clients}
              policies={dataset.policies}
              filter={clientFilter}
              search={clientSearch}
              sort={clientSort}
              onViewClient={handleViewClient}
              page={clientPage}
              pageSize={24}
              onPageChange={setClientPage}
            />
          )}

          {activeView === 'client-detail' && selectedClient && (
            <ClientDetail
              client={selectedClient}
              policies={dataset.policies}
              tasks={dataset.tasks}
              notes={dataset.notes}
              users={userOptions}
              tab={clientTab}
              onTabChange={setClientTab}
              onBack={() => setActiveView('clients')}
              onEditClient={() => setModal('editClient')}
              onAddPolicy={() => { setEditingPolicyId(null); setModal('addPolicy') }}
              onEditPolicy={id => { setEditingPolicyId(id); setModal('editPolicy') }}
              onEditBilling={id => { setBillingPolicyId(id); setModal('editBilling') }}
              onAddTask={() => setModal('addTask')}
              onAddNote={() => setModal('addNote')}
              onCompleteTask={handleCompleteTask}
              onDeletePolicy={handleDeletePolicy}
              onDeleteNote={handleDeleteNote}
              onIvansSync={() => setModal('ivans')}
            />
          )}

          {activeView === 'renewals' && (
            <RenewalsView policies={dataset.policies} clients={dataset.clients} onViewClient={handleViewClient} />
          )}

          {activeView === 'tasks' && (
            <TasksView
              tasks={dataset.tasks}
              clients={dataset.clients}
              users={userOptions}
              onComplete={handleCompleteTask}
              onAdd={() => setModal('addTask')}
            />
          )}

          {activeView === 'leads' && (
            <LeadsView
              opportunities={dataset.opportunities}
              users={userOptions}
              onAdd={() => setModal('addLead')}
              onUpdateStage={handleUpdateLeadStage}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              dataset={dataset}
              palette={palette}
              mode={mode}
              onPaletteChange={setPalette}
              onModeToggle={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
              onUpdateAgency={handleUpdateAgency}
              onUpdateUser={handleUpdateUser}
            />
          )}
        </div>
      </main>

      {/* ── AI HELP PANEL ──────────────────────────────────────── */}
      {aiHelpOpen && (
        <AiHelpPanel
          onClose={() => setAiHelpOpen(false)}
          clientName={activeView === 'client-detail' ? selectedClient?.name : undefined}
        />
      )}

      {/* ── MODALS ─────────────────────────────────────────────── */}
      {modal === 'addClient' && (
        <NewClientWizard
          users={dataset.users}
          onSave={(partial) => {
            const newClient: Client = {
              id: createRecordId('cl'),
              accountId: dataset.agency.id,
              ownerUserId: dataset.currentUser.id,
              annualRevenue: 0,
              policyCount: 0,
              health: 'Strong',
              status: 'Client',
              name: '',
              primaryContact: '',
              lineOfBusiness: 'Personal lines',
              ...partial,
            } as Client
            save({ ...dataset, clients: [...dataset.clients, newClient] })
            setModal(null); toast('Client added!')
            handleViewClient(newClient.id)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'editClient' && selectedClient && (
        <EditClientModal
          client={selectedClient}
          users={userOptions}
          onClose={() => setModal(null)}
          onSave={handleSaveClient}
        />
      )}

      {(modal === 'addPolicy' || modal === 'editPolicy') && (
        <PolicyModal
          policy={modal === 'editPolicy' && editingPolicyId ? dataset.policies.find(p => p.id === editingPolicyId) : undefined}
          clients={dataset.clients}
          users={userOptions}
          onClose={() => { setModal(null); setEditingPolicyId(null) }}
          onSave={handleSavePolicy}
          customPolicyTypes={customPolicyTypes}
          customCarriers={customCarriers}
        />
      )}

      {modal === 'editBilling' && billingPolicyId && (
        <BillingModal
          billing={dataset.policies.find(p => p.id === billingPolicyId)?.billing}
          onClose={() => { setModal(null); setBillingPolicyId(null) }}
          onSave={handleSaveBilling}
        />
      )}

      {modal === 'addTask' && (
        <TaskModal
          currentUserId={dataset.currentUser.id}
          clients={dataset.clients}
          users={userOptions}
          onClose={() => setModal(null)}
          onSave={handleSaveTask}
        />
      )}

      {modal === 'addLead' && (
        <LeadModal
          users={userOptions}
          onClose={() => setModal(null)}
          onSave={handleSaveLead}
        />
      )}

      {modal === 'addNote' && (
        <AddNoteModal
          onClose={() => setModal(null)}
          onSave={(body, type) => { handleSaveNote(body, type) }}
        />
      )}

      {modal === 'carrierPortal' && (
        <ModalShell title="Carrier Portals" onClose={() => setModal(null)}>
          <div className="modal-body-pad">
            {carrierPortals.length === 0 ? (
              <p className="modal-empty-text">No carrier portals added yet.</p>
            ) : (
              <div className="portal-list">
                {carrierPortals.map(p => (
                  <div key={p.id} className="portal-row">
                    <div>
                      <strong>{p.name}</strong>
                      <span>{p.lines}</span>
                    </div>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="portal-link-btn">
                      <ExternalLink size={14} /> Open
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="secondary-action" type="button" onClick={() => setModal(null)}>Close</button>
          </div>
        </ModalShell>
      )}

      {modal === 'ivans' && (
        <ModalShell title="IVANS Sync" onClose={() => setModal(null)} wide>
          <IvansPanel
            accountId={dataset.agency.id}
            currency={currency}
            formatDate={formatDate}
            onMergePolicy={(synced) => {
              const matched = dataset.policies.find(p => p.policyNumber === synced.policy_number)
              if (matched) {
                save({
                  ...dataset,
                  policies: dataset.policies.map(p =>
                    p.id === matched.id
                      ? { ...p, renewalStatus: synced.renewal_status === 'renewal_pending' ? 'Review needed' : p.renewalStatus }
                      : p
                  ),
                })
                toast('Policy synced from IVANS.')
              }
              setModal(null)
            }}
            onDismiss={() => setModal(null)}
          />
        </ModalShell>
      )}

      {/* ── TOASTS ─────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map(t => (
            <div className="toast" key={t.id}>
              <CheckCircle2 size={16} />{t.message}
            </div>
          ))}
        </div>
      )}

      {/* ── IQ BUDDY ───────────────────────────────────────────── */}
      {!aiHelpOpen && <IqBuddy onOpen={() => setAiHelpOpen(true)} />}

      {/* ── SESSION KICKED ─────────────────────────────────────── */}
      {sessionKicked && (
        <div className="session-kicked-overlay">
          <div className="session-kicked-panel">
            <img src={mascotImg} alt="" aria-hidden="true" className="session-kicked-mascot" />
            <Lock size={26} />
            <h2>Session ended</h2>
            <p>Your account was signed in on another device, so this session was closed. Only one active session is allowed per license.</p>
            <button type="button" className="primary-action" onClick={() => window.location.reload()}>Sign in again</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
