import { useCallback, useEffect, useState } from 'react'
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, ChevronDown, ChevronRight, Cloud, CloudOff, FileText, Loader as Loader2, Plus, RefreshCcw, Settings2, Shield, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react'
import { supabase, type IvansConnection, type IvansPolicySync, type IvansSyncLog } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type IvansPanelProps = {
  accountId: string
  onMergePolicy?: (synced: IvansPolicySync, crmPolicyId?: string) => void
  onDismiss?: () => void
  currency: Intl.NumberFormat
  formatDate: (d: string) => string
}

type PanelView = 'dashboard' | 'connections' | 'queue' | 'upload'

const ACORD_TX_LABELS: Record<string, string> = {
  RN: 'Renewal',
  NB: 'New Business',
  EN: 'Endorsement',
  XL: 'Cancellation',
  RI: 'Reinstatement',
  PC: 'Policy Change',
  AU: 'Audit',
}

const RENEWAL_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  renewal_pending: { label: 'Renewal Pending', cls: 'ivans-status--orange' },
  pending:         { label: 'Pending',          cls: 'ivans-status--neutral' },
  renewed:         { label: 'Renewed',           cls: 'ivans-status--green' },
  cancelled:       { label: 'Cancelled',         cls: 'ivans-status--red' },
  non_renewed:     { label: 'Non-Renewed',        cls: 'ivans-status--red' },
  unknown:         { label: 'Unknown',            cls: 'ivans-status--neutral' },
}

// ─── Main IVANS Panel ─────────────────────────────────────────────────────────
export function IvansPanel({ accountId, onMergePolicy, currency, formatDate }: IvansPanelProps) {
  const [view, setView] = useState<PanelView>('dashboard')
  const [connections, setConnections] = useState<IvansConnection[]>([])
  const [syncLog, setSyncLog] = useState<IvansSyncLog[]>([])
  const [syncedPolicies, setSyncedPolicies] = useState<IvansPolicySync[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null) // connectionId being synced
  const [addingConnection, setAddingConnection] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const supabaseClient = supabase

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 3500) }

  const load = useCallback(async () => {
    if (!supabaseClient) {
      setLoading(false)
      return
    }

    setLoading(true)
    const [{ data: conns }, { data: log }, { data: policies }] = await Promise.all([
      supabaseClient.from('ivans_connections').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabaseClient.from('ivans_sync_log').select('*').eq('account_id', accountId).order('started_at', { ascending: false }).limit(20),
      supabaseClient.from('ivans_policy_sync').select('*').eq('account_id', accountId).order('synced_at', { ascending: false }).limit(100),
    ])
    setConnections((conns as IvansConnection[]) ?? [])
    setSyncLog((log as IvansSyncLog[]) ?? [])
    setSyncedPolicies((policies as IvansPolicySync[]) ?? [])
    setLoading(false)
  }, [accountId, supabaseClient])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  // Realtime subscription for sync log updates
  useEffect(() => {
    if (!supabaseClient) return

    const channel = supabaseClient
      .channel(`ivans-sync-log-${accountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ivans_sync_log', filter: `account_id=eq.${accountId}` }, () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ivans_policy_sync', filter: `account_id=eq.${accountId}` }, () => { load() })
      .subscribe()
    return () => { supabaseClient.removeChannel(channel) }
  }, [accountId, load, supabaseClient])

  const triggerSync = async (connectionId: string) => {
    setSyncing(connectionId)
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ivans-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connectionId, accountId, triggeredBy: 'manual' }),
      })
      const result = await resp.json()
      if (result.success) {
        notify(`Sync complete — ${result.filesFetched} file(s), ${result.policiesCreated + result.policiesUpdated} policies updated, ${result.renewalsFlagged} renewals flagged`)
      } else {
        notify(`Sync failed: ${result.error ?? 'Unknown error'}`)
      }
      await load()
    } catch (e) {
      notify(`Sync error: ${String(e)}`)
    }
    setSyncing(null)
  }

  const markMerged = async (policyId: string, mergeStatus: 'merged' | 'skipped') => {
    if (!supabaseClient) return

    await supabaseClient.from('ivans_policy_sync').update({ merge_status: mergeStatus, agent_notified: true }).eq('id', policyId)
    await load()
  }

  const pendingRenewals = syncedPolicies.filter((p) => p.renewal_status === 'renewal_pending' && p.merge_status !== 'merged' && p.merge_status !== 'skipped')
  const unmatched = syncedPolicies.filter((p) => p.merge_status === 'unmatched')
  const lastSync = syncLog.find((l) => l.status === 'completed')

  if (!supabaseClient) {
    return (
      <div className="ivans-panel">
        <div className="ivans-empty">
          <CloudOff size={28} />
          <h3>Supabase is not configured</h3>
          <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable IVANS sync.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ivans-panel">
      {notification && (
        <div className="ivans-toast">{notification}</div>
      )}

      {/* Panel Header */}
      <div className="ivans-panel-header">
        <div className="ivans-panel-title">
          <div className="ivans-logo-mark">
            <Cloud size={20} />
          </div>
          <div>
            <h2>IVANS Download Center</h2>
            <p>ACORD data sync · carrier policy downloads · renewal detection</p>
          </div>
        </div>
        <div className="ivans-panel-nav">
          {(['dashboard', 'connections', 'queue'] as PanelView[]).map((v) => (
            <button key={v} className={view === v ? 'ivans-nav-btn ivans-nav-btn--active' : 'ivans-nav-btn'} type="button" onClick={() => setView(v)}>
              {v === 'dashboard' ? 'Overview' : v === 'connections' ? 'Carriers' : 'Download Queue'}
            </button>
          ))}
          <button className="ivans-nav-btn" type="button" onClick={() => setUploadModal(true)}>
            <Upload size={13} /> Manual Upload
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ivans-loading"><Loader2 size={22} className="spin" /> Loading IVANS data…</div>
      ) : view === 'dashboard' ? (
        <IvansDashboard
          connections={connections}
          syncLog={syncLog}
          syncedPolicies={syncedPolicies}
          pendingRenewals={pendingRenewals}
          unmatched={unmatched}
          lastSync={lastSync ?? null}
          syncing={syncing}
          onSync={triggerSync}
          onMerge={(p) => { markMerged(p.id, 'merged'); onMergePolicy?.(p) }}
          onSkip={(p) => markMerged(p.id, 'skipped')}
          onAddConnection={() => { setView('connections'); setAddingConnection(true) }}
          currency={currency}
          formatDate={formatDate}
        />
      ) : view === 'connections' ? (
        <IvansConnections
          connections={connections}
          syncing={syncing}
          forceAdd={addingConnection}
          onAddDone={() => setAddingConnection(false)}
          accountId={accountId}
          onSync={triggerSync}
          onRefresh={load}
          notify={notify}
          formatDate={formatDate}
        />
      ) : (
        <IvansQueue
          syncedPolicies={syncedPolicies}
          syncLog={syncLog}
          onMerge={(p) => { markMerged(p.id, 'merged'); onMergePolicy?.(p) }}
          onSkip={(p) => markMerged(p.id, 'skipped')}
          currency={currency}
          formatDate={formatDate}
        />
      )}

      {uploadModal && (
        <AcordUploadModal
          accountId={accountId}
          connections={connections}
          onClose={() => setUploadModal(false)}
          onSuccess={(msg) => { notify(msg); load(); setUploadModal(false) }}
        />
      )}
    </div>
  )
}

// ─── Dashboard View ───────────────────────────────────────────────────────────
function IvansDashboard({
  connections, syncedPolicies, pendingRenewals, unmatched, lastSync, syncing,
  onSync, onMerge, onSkip, onAddConnection, currency, formatDate,
}: {
  connections: IvansConnection[]
  syncLog: IvansSyncLog[]
  syncedPolicies: IvansPolicySync[]
  pendingRenewals: IvansPolicySync[]
  unmatched: IvansPolicySync[]
  lastSync: IvansSyncLog | null
  syncing: string | null
  onSync: (id: string) => void
  onMerge: (p: IvansPolicySync) => void
  onSkip: (p: IvansPolicySync) => void
  onAddConnection: () => void
  currency: Intl.NumberFormat
  formatDate: (d: string) => string
}) {
  const activeConns = connections.filter((c) => c.status === 'active')
  const errorConns = connections.filter((c) => c.status === 'error')

  return (
    <div className="ivans-dashboard">
      {/* KPI Row */}
      <div className="ivans-kpi-row">
        <div className="ivans-kpi">
          <Cloud size={18} />
          <div>
            <strong>{activeConns.length}</strong>
            <span>Active Carriers</span>
          </div>
        </div>
        <div className={`ivans-kpi ${pendingRenewals.length > 0 ? 'ivans-kpi--alert' : ''}`}>
          <Zap size={18} />
          <div>
            <strong>{pendingRenewals.length}</strong>
            <span>Renewals Flagged</span>
          </div>
        </div>
        <div className="ivans-kpi">
          <FileText size={18} />
          <div>
            <strong>{syncedPolicies.length}</strong>
            <span>Policies on File</span>
          </div>
        </div>
        <div className={`ivans-kpi ${errorConns.length > 0 ? 'ivans-kpi--error' : ''}`}>
          <Shield size={18} />
          <div>
            <strong>{errorConns.length > 0 ? errorConns.length : 'OK'}</strong>
            <span>{errorConns.length > 0 ? 'Carrier Errors' : 'All Syncs Healthy'}</span>
          </div>
        </div>
        {lastSync && (
          <div className="ivans-kpi">
            <CheckCircle2 size={18} />
            <div>
              <strong>{formatDate(lastSync.completed_at ?? lastSync.started_at)}</strong>
              <span>Last Successful Sync</span>
            </div>
          </div>
        )}
      </div>

      {/* Carrier sync status */}
      <div className="ivans-section">
        <div className="ivans-section-header">
          <h3>Carrier Connections</h3>
          <button className="utility-action" type="button" onClick={onAddConnection}>
            <Plus size={14} /> Add Carrier
          </button>
        </div>
        {connections.length === 0 ? (
          <div className="ivans-empty">
            <CloudOff size={32} />
            <p>No carrier connections configured yet.</p>
            <button className="primary-action" type="button" onClick={onAddConnection}>
              <Plus size={15} /> Connect First Carrier
            </button>
          </div>
        ) : (
          <div className="ivans-carrier-list">
            {connections.map((c) => (
              <IvansCarrierCard
                key={c.id}
                connection={c}
                syncing={syncing === c.id}
                onSync={() => onSync(c.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pending renewal actions */}
      {pendingRenewals.length > 0 && (
        <div className="ivans-section">
          <div className="ivans-section-header">
            <h3>
              <Zap size={15} style={{ color: '#d35400' }} />
              Renewals Flagged by IVANS ({pendingRenewals.length})
            </h3>
            <span className="ivans-section-note">Accept to merge into your renewal queue · Skip to dismiss</span>
          </div>
          <div className="ivans-synced-list">
            {pendingRenewals.map((p) => (
              <IvansSyncedPolicyRow
                key={p.id}
                policy={p}
                onMerge={() => onMerge(p)}
                onSkip={() => onSkip(p)}
                currency={currency}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unmatched / needs review */}
      {unmatched.filter((p) => p.renewal_status !== 'renewal_pending').length > 0 && (
        <div className="ivans-section">
          <div className="ivans-section-header">
            <h3>Other Downloaded Policies ({unmatched.filter((p) => p.renewal_status !== 'renewal_pending').length})</h3>
            <span className="ivans-section-note">Endorsements, new business, and policy changes from carrier downloads</span>
          </div>
          <div className="ivans-synced-list">
            {unmatched.filter((p) => p.renewal_status !== 'renewal_pending').slice(0, 10).map((p) => (
              <IvansSyncedPolicyRow
                key={p.id}
                policy={p}
                onMerge={() => onMerge(p)}
                onSkip={() => onSkip(p)}
                currency={currency}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Carrier Card ─────────────────────────────────────────────────────────────
function IvansCarrierCard({ connection, syncing, onSync, formatDate }: {
  connection: IvansConnection
  syncing: boolean
  onSync: () => void
  formatDate: (d: string) => string
}) {
  const statusIcon = connection.status === 'active' ? <CheckCircle2 size={14} style={{ color: '#2f7d62' }} />
    : connection.status === 'error' ? <AlertTriangle size={14} style={{ color: '#c0392b' }} />
    : connection.status === 'paused' ? <CloudOff size={14} style={{ color: '#d35400' }} />
    : <Settings2 size={14} style={{ color: 'var(--text-muted)' }} />

  return (
    <div className={`ivans-carrier-card ivans-carrier-card--${connection.status}`}>
      <div className="ivans-carrier-main">
        <div className="ivans-carrier-status">{statusIcon}</div>
        <div className="ivans-carrier-info">
          <strong>{connection.carrier_name || 'Unnamed Carrier'}</strong>
          <span>Subscriber: {connection.ivans_subscriber_id || '—'} · Every {connection.sync_frequency_hours}h</span>
          {connection.status === 'error' && connection.error_message && (
            <span className="ivans-carrier-error">{connection.error_message}</span>
          )}
          {connection.last_sync_at && (
            <span className="ivans-carrier-last-sync">Last sync: {formatDate(connection.last_sync_at)}</span>
          )}
        </div>
      </div>
      <button
        className={`utility-action ivans-sync-btn ${syncing ? 'ivans-sync-btn--syncing' : ''}`}
        type="button"
        onClick={onSync}
        disabled={syncing}
        title="Trigger manual sync"
      >
        {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />}
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  )
}

// ─── Synced Policy Row ────────────────────────────────────────────────────────
function IvansSyncedPolicyRow({ policy, onMerge, onSkip, currency, formatDate }: {
  policy: IvansPolicySync
  onMerge: () => void
  onSkip: () => void
  currency: Intl.NumberFormat
  formatDate: (d: string) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const txLabel = ACORD_TX_LABELS[policy.acord_transaction] ?? policy.acord_transaction
  const statusInfo = RENEWAL_STATUS_LABELS[policy.renewal_status] ?? RENEWAL_STATUS_LABELS['unknown']

  return (
    <div className={`ivans-policy-row ${policy.renewal_status === 'renewal_pending' ? 'ivans-policy-row--renewal' : ''}`}>
      <div className="ivans-policy-main">
        <button className="ivans-expand-btn" type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="ivans-policy-identity">
          <strong>{policy.insured_name || 'Unknown Insured'}</strong>
          <span className="ivans-policy-meta">
            {policy.policy_type} · {policy.carrier_name} · #{policy.policy_number}
          </span>
        </div>
        <div className="ivans-policy-badges">
          <span className="ivans-tx-badge">{txLabel}</span>
          <span className={`ivans-status-badge ${statusInfo.cls}`}>{statusInfo.label}</span>
        </div>
        <div className="ivans-policy-dates">
          {policy.expiration_date && (
            <span>Exp: {formatDate(policy.expiration_date)}</span>
          )}
        </div>
        <div className="ivans-policy-premiums">
          {policy.current_premium != null && (
            <span>Current: <strong>{currency.format(policy.current_premium)}</strong></span>
          )}
          {policy.renewal_premium != null && policy.renewal_premium > 0 && (
            <span className={policy.renewal_premium > (policy.current_premium ?? 0) ? 'ivans-premium--up' : 'ivans-premium--same'}>
              Renewal: <strong>{currency.format(policy.renewal_premium)}</strong>
              {policy.current_premium && policy.renewal_premium > policy.current_premium && (
                <em> +{Math.round(((policy.renewal_premium - policy.current_premium) / policy.current_premium) * 100)}%</em>
              )}
            </span>
          )}
        </div>
        <div className="ivans-policy-actions">
          <button className="primary-action ivans-action-btn" type="button" onClick={onMerge} title="Accept and merge into CRM">
            <CheckCircle2 size={13} /> Accept
          </button>
          <button className="utility-action ivans-action-btn" type="button" onClick={onSkip} title="Dismiss">
            <X size={13} /> Skip
          </button>
        </div>
      </div>
      {expanded && (
        <div className="ivans-policy-detail">
          <div className="ivans-detail-grid">
            <div><span>Policy Number</span><strong>{policy.policy_number}</strong></div>
            <div><span>Line of Business</span><strong>{policy.line_of_business || '—'}</strong></div>
            <div><span>ACORD Transaction</span><strong>{txLabel}</strong></div>
            <div><span>Effective Date</span><strong>{policy.effective_date ? formatDate(policy.effective_date) : '—'}</strong></div>
            <div><span>Expiration Date</span><strong>{policy.expiration_date ? formatDate(policy.expiration_date) : '—'}</strong></div>
            <div><span>Billing Type</span><strong>{policy.billing_type || '—'}</strong></div>
            <div><span>Payment Plan</span><strong>{policy.payment_plan || '—'}</strong></div>
            {policy.mortgagee && <div><span>Mortgagee</span><strong>{policy.mortgagee}</strong></div>}
            <div><span>Source</span><strong>IVANS Download · {formatDate(policy.synced_at)}</strong></div>
            <div><span>AI Note</span><strong className="ivans-ai-note"><Sparkles size={11} /> {getAiNote(policy)}</strong></div>
          </div>
        </div>
      )}
    </div>
  )
}

function getAiNote(policy: IvansPolicySync): string {
  if (policy.renewal_status === 'renewal_pending') {
    const isPremiumUp = (policy.renewal_premium ?? 0) > (policy.current_premium ?? 0)
    if (isPremiumUp) return `Renewal premium is up ${Math.round((((policy.renewal_premium ?? 0) - (policy.current_premium ?? 0)) / (policy.current_premium ?? 1)) * 100)}%. Review with client before binding — consider market alternatives.`
    return 'Renewal received from carrier. Verify coverage limits and confirm with client before binding.'
  }
  if (policy.renewal_status === 'cancelled') return 'Policy has been cancelled by carrier. Contact client immediately to arrange replacement coverage.'
  if (policy.renewal_status === 'non_renewed') return 'Carrier non-renewed this policy. Begin replacement market search and notify client promptly.'
  if (policy.acord_transaction === 'EN') return 'Endorsement downloaded. Verify changes match what was requested and update CRM policy record.'
  return 'Policy record downloaded from carrier. Review for accuracy and merge into CRM.'
}

// ─── Connections Manager ──────────────────────────────────────────────────────
function IvansConnections({
  connections, syncing, forceAdd, onAddDone, accountId, onSync, onRefresh, notify, formatDate,
}: {
  connections: IvansConnection[]
  syncing: string | null
  forceAdd: boolean
  onAddDone: () => void
  accountId: string
  onSync: (id: string) => void
  onRefresh: () => void
  notify: (msg: string) => void
  formatDate: (d: string) => string
}) {
  const [showForm, setShowForm] = useState(forceAdd)
  const [form, setForm] = useState({
    carrier_name: '', ivans_subscriber_id: '', ivans_username: '',
    ivans_password_ref: '', api_endpoint: 'https://www.ivansinsurance.com/ivanscloud/api',
    sync_frequency_hours: 24,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!forceAdd) return
    const timer = window.setTimeout(() => setShowForm(true), 0)
    return () => window.clearTimeout(timer)
  }, [forceAdd])

  const save = async () => {
    if (!supabase) {
      notify('Supabase is not configured')
      return
    }

    if (!form.carrier_name.trim() || !form.ivans_subscriber_id.trim()) {
      notify('Carrier name and Subscriber ID are required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('ivans_connections').insert({
      ...form,
      account_id: accountId,
      status: 'pending_setup',
    })
    if (error) {
      notify(`Error saving: ${error.message}`)
    } else {
      notify(`Carrier "${form.carrier_name}" added. Run a sync to fetch your first download.`)
      setShowForm(false)
      setForm({ carrier_name: '', ivans_subscriber_id: '', ivans_username: '', ivans_password_ref: '', api_endpoint: 'https://www.ivansinsurance.com/ivanscloud/api', sync_frequency_hours: 24 })
      onAddDone()
      onRefresh()
    }
    setSaving(false)
  }

  const deleteConnection = async (id: string, name: string) => {
    if (!supabase) {
      notify('Supabase is not configured')
      return
    }

    if (!confirm(`Remove carrier connection for "${name}"? This will not delete downloaded policy data.`)) return
    await supabase.from('ivans_connections').delete().eq('id', id)
    notify(`Removed ${name}`)
    onRefresh()
  }

  const togglePause = async (conn: IvansConnection) => {
    if (!supabase) {
      notify('Supabase is not configured')
      return
    }

    const newStatus = conn.status === 'paused' ? 'active' : 'paused'
    await supabase.from('ivans_connections').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', conn.id)
    notify(`${conn.carrier_name} ${newStatus === 'paused' ? 'paused' : 'resumed'}`)
    onRefresh()
  }

  return (
    <div className="ivans-connections-view">
      <div className="ivans-section-header">
        <h3>Carrier Connections ({connections.length})</h3>
        <button className="primary-action" type="button" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> {showForm ? 'Cancel' : 'Add Carrier'}
        </button>
      </div>

      {showForm && (
        <div className="ivans-add-form panel">
          <h4>New Carrier Connection</h4>
          <p className="ivans-form-note">Enter your IVANS subscriber credentials. The password is stored as an encrypted reference and never exposed in the UI.</p>
          <div className="ivans-form-grid">
            <label className="modal-field">
              <span>Carrier Name *</span>
              <input value={form.carrier_name} onChange={(e) => set('carrier_name', e.target.value)} placeholder="e.g. State Farm" autoFocus />
            </label>
            <label className="modal-field">
              <span>IVANS Subscriber ID *</span>
              <input value={form.ivans_subscriber_id} onChange={(e) => set('ivans_subscriber_id', e.target.value)} placeholder="Your IVANS subscriber ID" />
            </label>
            <label className="modal-field">
              <span>IVANS Username</span>
              <input value={form.ivans_username} onChange={(e) => set('ivans_username', e.target.value)} placeholder="Username" />
            </label>
            <label className="modal-field">
              <span>IVANS Password</span>
              <input type="password" value={form.ivans_password_ref} onChange={(e) => set('ivans_password_ref', e.target.value)} placeholder="Stored encrypted" />
            </label>
            <label className="modal-field">
              <span>IVANS Endpoint</span>
              <input value={form.api_endpoint} onChange={(e) => set('api_endpoint', e.target.value)} />
            </label>
            <label className="modal-field">
              <span>Sync Frequency (hours)</span>
              <select value={form.sync_frequency_hours} onChange={(e) => set('sync_frequency_hours', Number(e.target.value))}>
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Daily (24h)</option>
                <option value={48}>Every 2 days</option>
              </select>
            </label>
          </div>
          <div className="ivans-form-actions">
            <button className="secondary-action" type="button" onClick={() => { setShowForm(false); onAddDone() }}>Cancel</button>
            <button className="primary-action" type="button" disabled={saving} onClick={save}>
              {saving ? <Loader2 size={14} className="spin" /> : <Shield size={14} />}
              {saving ? 'Saving…' : 'Save Connection'}
            </button>
          </div>
        </div>
      )}

      {connections.length === 0 && !showForm ? (
        <div className="ivans-empty">
          <CloudOff size={32} />
          <p>No carrier connections yet. Add your first IVANS carrier connection above.</p>
        </div>
      ) : (
        <div className="ivans-connections-list">
          {connections.map((c) => (
            <div key={c.id} className={`ivans-connection-row ivans-connection-row--${c.status}`}>
              <div className="ivans-connection-status-dot" />
              <div className="ivans-connection-info">
                <strong>{c.carrier_name || 'Unnamed'}</strong>
                <span>Subscriber: {c.ivans_subscriber_id || '—'} · {c.ivans_username || 'No username'}</span>
                <span>Sync every {c.sync_frequency_hours}h · {c.last_sync_at ? `Last: ${formatDate(c.last_sync_at)}` : 'Never synced'}</span>
                {c.status === 'error' && <span className="ivans-carrier-error">{c.error_message}</span>}
              </div>
              <div className="ivans-connection-actions">
                <button className="utility-action" type="button" onClick={() => togglePause(c)}>
                  {c.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button
                  className="utility-action"
                  type="button"
                  disabled={syncing === c.id}
                  onClick={() => onSync(c.id)}
                >
                  {syncing === c.id ? <Loader2 size={13} className="spin" /> : <RefreshCcw size={13} />}
                  Sync
                </button>
                <button className="utility-action ivans-delete-btn" type="button" onClick={() => deleteConnection(c.id, c.carrier_name)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Download Queue View ──────────────────────────────────────────────────────
function IvansQueue({ syncedPolicies, syncLog, onMerge, onSkip, currency, formatDate }: {
  syncedPolicies: IvansPolicySync[]
  syncLog: IvansSyncLog[]
  onMerge: (p: IvansPolicySync) => void
  onSkip: (p: IvansPolicySync) => void
  currency: Intl.NumberFormat
  formatDate: (d: string) => string
}) {
  const [filter, setFilter] = useState<'all' | 'renewal_pending' | 'unmatched' | 'merged'>('all')
  const filtered = syncedPolicies.filter((p) => {
    if (filter === 'renewal_pending') return p.renewal_status === 'renewal_pending'
    if (filter === 'unmatched') return p.merge_status === 'unmatched'
    if (filter === 'merged') return p.merge_status === 'merged'
    return true
  })

  return (
    <div className="ivans-queue-view">
      <div className="ivans-section-header">
        <h3>Downloaded Policies</h3>
        <div className="ivans-queue-filters">
          {(['all', 'renewal_pending', 'unmatched', 'merged'] as const).map((f) => (
            <button key={f} className={filter === f ? 'sort-tab active' : 'sort-tab'} type="button" onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'renewal_pending' ? 'Renewals' : f === 'unmatched' ? 'Pending Review' : 'Accepted'}
            </button>
          ))}
        </div>
      </div>

      {/* Recent sync log */}
      {syncLog.slice(0, 3).map((log) => (
        <div key={log.id} className={`ivans-sync-log-row ivans-sync-log-row--${log.status}`}>
          <span className="ivans-log-icon">
            {log.status === 'completed' ? <CheckCircle2 size={13} /> : log.status === 'failed' ? <AlertTriangle size={13} /> : <Loader2 size={13} className="spin" />}
          </span>
          <span>{formatDate(log.started_at)} — {log.triggered_by === 'manual' ? 'Manual' : 'Scheduled'} sync</span>
          {log.status === 'completed' && <span>{log.files_fetched} files · {log.policies_created + log.policies_updated} policies · {log.renewals_flagged} renewals flagged</span>}
          {log.status === 'failed' && <span className="ivans-log-error">{log.error_detail}</span>}
        </div>
      ))}

      <div className="ivans-synced-list">
        {filtered.length === 0 ? (
          <div className="ivans-empty"><FileText size={24} /><p>No policies in this view.</p></div>
        ) : filtered.map((p) => (
          <IvansSyncedPolicyRow key={p.id} policy={p} onMerge={() => onMerge(p)} onSkip={() => onSkip(p)} currency={currency} formatDate={formatDate} />
        ))}
      </div>
    </div>
  )
}

// ─── Manual ACORD Upload Modal ────────────────────────────────────────────────
function AcordUploadModal({ accountId, connections, onClose, onSuccess }: {
  accountId: string
  connections: IvansConnection[]
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? '')
  const [parsing, setParsing] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pastedContent, setPastedContent] = useState('')

  const runParse = async (content: string, fileName: string) => {
    setParsing(true)
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/acord-parser`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId, connectionId: connectionId || null, rawContent: content, fileName }),
      })
      const result = await resp.json()
      if (result.success) {
        onSuccess(`Parsed ${result.policiesParsed} polic${result.policiesParsed === 1 ? 'y' : 'ies'} from ${fileName}. ${result.renewalsFlagged} renewal${result.renewalsFlagged === 1 ? '' : 's'} flagged.`)
      } else {
        alert(`Parse error: ${result.error ?? 'Unknown'}`)
      }
    } catch (e) {
      alert(`Upload error: ${String(e)}`)
    }
    setParsing(false)
  }

  const handleFile = async () => {
    if (!file) return
    const content = await file.text()
    await runParse(content, file.name)
  }

  const handlePaste = async () => {
    if (!pastedContent.trim()) return
    await runParse(pastedContent, 'manual-upload.xml')
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel ivans-upload-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Upload ACORD File</h2>
          <button className="icon-button modal-close" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-form">
          <p className="ivans-upload-note">Upload an ACORD XML or AL3 file from a carrier or IVANS download. The parser will extract policy data and flag any renewals automatically.</p>

          {connections.length > 0 && (
            <label className="modal-field">
              <span>Assign to Carrier Connection</span>
              <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {connections.map((c) => <option key={c.id} value={c.id}>{c.carrier_name}</option>)}
              </select>
            </label>
          )}

          <div className="ivans-upload-toggle">
            <button className={!pasteMode ? 'sort-tab active' : 'sort-tab'} type="button" onClick={() => setPasteMode(false)}>Upload File</button>
            <button className={pasteMode ? 'sort-tab active' : 'sort-tab'} type="button" onClick={() => setPasteMode(true)}>Paste XML</button>
          </div>

          {pasteMode ? (
            <label className="modal-field modal-field--full">
              <span>Paste ACORD XML or AL3 Content</span>
              <textarea className="modal-textarea ivans-paste-area" rows={12} value={pastedContent} onChange={(e) => setPastedContent(e.target.value)} placeholder="<?xml version=&quot;1.0&quot;?><ACORD>…" />
            </label>
          ) : (
            <label className="modal-field modal-field--full ivans-file-drop">
              <span>Select File (.xml, .al3, .txt)</span>
              <input type="file" accept=".xml,.al3,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <span className="ivans-file-name"><FileText size={14} /> {file.name}</span>}
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
          <button
            className="primary-action"
            type="button"
            disabled={parsing || (pasteMode ? !pastedContent.trim() : !file)}
            onClick={pasteMode ? handlePaste : handleFile}
          >
            {parsing ? <><Loader2 size={14} className="spin" /> Parsing…</> : <><Upload size={14} /> Parse &amp; Import</>}
          </button>
        </div>
      </div>
    </div>
  )
}
