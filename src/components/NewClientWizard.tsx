import React, { useEffect, useRef, useState } from 'react'
import { CircleCheck as CheckCircle2, ChevronRight, Cloud, FilePlus, FolderOpen, X } from 'lucide-react'
import mascot from '../assets/AGENCYIQ_MASCOT_CLEAR.png'
import type { Client, LineOfBusiness, UserProfile } from '../data/crmTypes'

// ─── Types ────────────────────────────────────────────────────────────────────
type ClientType = 'Personal' | 'Business'
type PostSaveAction = 'add-policy' | 'sync-carrier' | 'later'

type WizardData = {
  clientType: ClientType
  // Personal identity
  firstName: string; middleName: string; lastName: string; suffix: string
  gender: string; maritalStatus: string; dob: string; ssnRef: string
  driverLicenseNumber: string; driverLicenseState: string
  // Business identity
  businessName: string; dbaName: string; businessType: string; taxId: string
  yearsInBusiness: string; numberOfEmployees: string; annualRevenue: string
  // Contact
  primaryContact: string; email: string; phone: string; alternatePhone: string
  preferredContactMethod: string
  // Address
  mailingAddress: string; city: string; state: string; zip: string
  county: string; physicalAddress: string; website: string
  // Assignment
  lineOfBusiness: LineOfBusiness; accountStatus: string
  assignedProducerId: string; assignedCsrId: string; billingMethod: string; notes: string
}

const emptyData = (): WizardData => ({
  clientType: 'Personal',
  firstName: '', middleName: '', lastName: '', suffix: '',
  gender: '', maritalStatus: '', dob: '', ssnRef: '',
  driverLicenseNumber: '', driverLicenseState: '',
  businessName: '', dbaName: '', businessType: '', taxId: '',
  yearsInBusiness: '', numberOfEmployees: '', annualRevenue: '',
  primaryContact: '', email: '', phone: '', alternatePhone: '',
  preferredContactMethod: 'Phone',
  mailingAddress: '', city: '', state: '', zip: '', county: '',
  physicalAddress: '', website: '',
  lineOfBusiness: 'Personal lines', accountStatus: 'Active',
  assignedProducerId: '', assignedCsrId: '', billingMethod: '', notes: '',
})

// ─── Step definitions — mascot tips are pure agent coaching, no tech jargon ──
type Step = { id: string; label: string; mascotTip: string; fields: string[] }

const PERSONAL_STEPS: Step[] = [
  {
    id: 'identity',
    label: 'Personal Identity',
    mascotTip: "Start with the client's full legal name exactly as it appears on their ID. First, middle, and last name are all needed for policy applications. Date of birth is required for most personal lines quotes.",
    fields: ['firstName', 'middleName', 'lastName', 'suffix', 'dob', 'gender', 'maritalStatus'],
  },
  {
    id: 'sensitive',
    label: 'ID & License',
    mascotTip: "Only store the last 4 digits of the SSN here — never the full number. The driver's license number and state are needed for auto quotes and MVR checks. If the client doesn't have it handy, you can skip and add it later.",
    fields: ['ssnRef', 'driverLicenseNumber', 'driverLicenseState'],
  },
  {
    id: 'contact',
    label: 'Contact Info',
    mascotTip: "Add the best way to reach this client. A cell phone and email are ideal. If they prefer texts or calls at a specific number, note that here so the whole team knows how to reach them.",
    fields: ['email', 'phone', 'alternatePhone', 'preferredContactMethod'],
  },
  {
    id: 'address',
    label: 'Address',
    mascotTip: "The mailing address is where policy documents and bills get sent. If the client's property address is different — like a rental home or second property — add that as the physical address too.",
    fields: ['mailingAddress', 'city', 'state', 'zip', 'county', 'physicalAddress'],
  },
  {
    id: 'assignment',
    label: 'Assignment & Billing',
    mascotTip: "Assign this client to the right producer and CSR on your team. The line of business helps filter them in your dashboard. You can set a default billing preference or leave it blank until the first policy is added.",
    fields: ['lineOfBusiness', 'accountStatus', 'assignedProducerId', 'assignedCsrId', 'billingMethod', 'notes'],
  },
]

const BUSINESS_STEPS: Step[] = [
  {
    id: 'identity',
    label: 'Business Identity',
    mascotTip: "Use the full legal business name as registered — this goes on all policies. The EIN is needed for most commercial applications. If they operate under a trade name, add that as the DBA.",
    fields: ['businessName', 'dbaName', 'businessType', 'taxId', 'yearsInBusiness', 'numberOfEmployees', 'annualRevenue', 'website'],
  },
  {
    id: 'contact',
    label: 'Primary Contact',
    mascotTip: "Who is your main point of contact at this business? This is the person who signs applications, receives policy documents, and answers underwriting questions. Get their direct email and phone if possible.",
    fields: ['primaryContact', 'email', 'phone', 'alternatePhone', 'preferredContactMethod'],
  },
  {
    id: 'address',
    label: 'Business Address',
    mascotTip: "The mailing address is for bills and correspondence. The physical location is where the business actually operates — underwriters need this for commercial policies. If there are multiple locations, add the main one here and note the rest.",
    fields: ['mailingAddress', 'city', 'state', 'zip', 'county', 'physicalAddress'],
  },
  {
    id: 'assignment',
    label: 'Assignment & Billing',
    mascotTip: "Assign this account to your producer and service team. For commercial accounts, choose 'Commercial' as the line of business. You can add billing preferences now or once the first policy is written.",
    fields: ['lineOfBusiness', 'accountStatus', 'assignedProducerId', 'assignedCsrId', 'billingMethod', 'notes'],
  },
]

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export function NewClientWizard({
  users, onClose, onSave,
}: {
  users: UserProfile[]
  onClose: () => void
  onSave: (data: Partial<Client>, nextAction: PostSaveAction) => void
}) {
  const [data, setData] = useState<WizardData>(emptyData)
  // -1 = type selector, steps.length = "what next?" completion screen
  const [stepIndex, setStepIndex] = useState(-1)
  const [mascotState, setMascotState] = useState<'wave' | 'talk' | 'idle'>('wave')
  const [tipVisible, setTipVisible] = useState(true)
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  const steps = data.clientType === 'Personal' ? PERSONAL_STEPS : BUSINESS_STEPS
  const isTypeSelect = stepIndex === -1
  const isCompletion = stepIndex === steps.length
  const currentStep = (!isTypeSelect && !isCompletion) ? steps[stepIndex] : null
  const isLastFormStep = stepIndex === steps.length - 1

  const set = (key: keyof WizardData, val: string) =>
    setData((d) => ({ ...d, [key]: val }))

  useEffect(() => {
    setMascotState('talk')
    setTipVisible(false)
    const t1 = setTimeout(() => setTipVisible(true), 120)
    const t2 = setTimeout(() => setMascotState('idle'), 1400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [stepIndex])

  useEffect(() => {
    if (stepIndex >= 0 && !isCompletion) {
      const timer = setTimeout(() => firstFieldRef.current?.focus(), 200)
      return () => clearTimeout(timer)
    }
  }, [stepIndex, isCompletion])

  const selectType = (type: ClientType) => {
    setData((d) => ({
      ...d, clientType: type,
      lineOfBusiness: type === 'Business' ? 'Commercial' : 'Personal lines',
    }))
    setStepIndex(0)
    setMascotState('wave')
  }

  const canAdvance = (): boolean => {
    if (isTypeSelect || isCompletion) return false
    const step = currentStep!
    if (step.id === 'identity') {
      return data.clientType === 'Personal'
        ? !!data.firstName.trim() && !!data.lastName.trim()
        : !!data.businessName.trim()
    }
    return true
  }

  const buildClientPayload = (): Partial<Client> => {
    const isPersonal = data.clientType === 'Personal'
    const displayName = isPersonal
      ? [data.firstName, data.middleName, data.lastName, data.suffix].filter(Boolean).join(' ').trim()
      : data.businessName.trim()

    return {
      clientType: data.clientType,
      name: displayName,
      primaryContact: isPersonal ? displayName : data.primaryContact,
      email: data.email || undefined,
      phone: data.phone || undefined,
      alternatePhone: data.alternatePhone || undefined,
      preferredContactMethod: (data.preferredContactMethod as Client['preferredContactMethod']) || undefined,
      lineOfBusiness: data.lineOfBusiness,
      accountStatus: data.accountStatus as Client['accountStatus'],
      status: 'Client',
      dob: isPersonal ? data.dob || undefined : undefined,
      ssnRef: isPersonal ? data.ssnRef || undefined : undefined,
      firstName: isPersonal ? data.firstName || undefined : undefined,
      middleName: isPersonal ? data.middleName || undefined : undefined,
      lastName: isPersonal ? data.lastName || undefined : undefined,
      suffix: isPersonal ? data.suffix || undefined : undefined,
      gender: isPersonal ? (data.gender as Client['gender']) || undefined : undefined,
      maritalStatus: isPersonal ? (data.maritalStatus as Client['maritalStatus']) || undefined : undefined,
      driverLicenseNumber: isPersonal ? data.driverLicenseNumber || undefined : undefined,
      driverLicenseState: isPersonal ? data.driverLicenseState || undefined : undefined,
      dbaName: data.dbaName || undefined,
      businessType: !isPersonal ? (data.businessType as Client['businessType']) || undefined : undefined,
      taxId: data.taxId || undefined,
      yearsInBusiness: data.yearsInBusiness ? Number(data.yearsInBusiness) : undefined,
      numberOfEmployees: data.numberOfEmployees ? Number(data.numberOfEmployees) : undefined,
      annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : 0,
      mailingAddress: [data.mailingAddress, data.city && data.state ? `${data.city}, ${data.state} ${data.zip}` : ''].filter(Boolean).join(', ') || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      zip: data.zip || undefined,
      county: data.county || undefined,
      physicalAddress: data.physicalAddress || undefined,
      website: data.website || undefined,
      assignedProducerId: data.assignedProducerId || undefined,
      assignedCsrId: data.assignedCsrId || undefined,
      billingMethod: (data.billingMethod as Client['billingMethod']) || undefined,
      notes: data.notes || undefined,
      policyCount: 0,
      health: 'Strong',
      clientSince: new Date().toISOString().slice(0, 10),
    }
  }

  // Advance to completion screen (saves the client)
  const handleAdvanceToCompletion = () => {
    setStepIndex(steps.length) // completion screen
    setMascotState('wave')
  }

  const handleChoose = (action: PostSaveAction) => {
    onSave(buildClientPayload(), action)
  }

  const clientDisplayName = data.clientType === 'Personal'
    ? [data.firstName, data.lastName].filter(Boolean).join(' ') || 'New Client'
    : data.businessName || 'New Business'

  const progress = stepIndex <= 0 ? 0 : Math.round((stepIndex / steps.length) * 100)

  const tipText = isTypeSelect
    ? "Hi! I'm your AgencyIQ assistant. Let's create a new client folder. First — is this a personal or business client?"
    : isCompletion
    ? `${clientDisplayName}'s folder is ready! What would you like to do next?`
    : currentStep?.mascotTip ?? ''

  return (
    <div className="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wizard-shell" role="dialog" aria-modal="true" aria-label="New Client Wizard">

        {/* ── Left: mascot column ─────────────────────────────────── */}
        <div className="wizard-mascot-col">
          <div className={`wizard-mascot-wrap wizard-mascot--${mascotState}`}>
            <div className="wizard-mascot-glow" />
            <img src={mascot} alt="AgencyIQ assistant" className="wizard-mascot-img" />
          </div>

          <div className={`wizard-tip-bubble ${tipVisible ? 'wizard-tip-bubble--visible' : ''} ${isTypeSelect ? 'wizard-tip-bubble--intro' : ''} ${isCompletion ? 'wizard-tip-bubble--success' : ''}`}>
            <div className="wizard-tip-arrow" />
            <p>{tipText}</p>
          </div>

          {!isTypeSelect && !isCompletion && (
            <div className="wizard-progress">
              <div className="wizard-progress-bar">
                <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="wizard-progress-label">Step {stepIndex + 1} of {steps.length}</span>
              <div className="wizard-steps-list">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`wizard-step-dot ${i === stepIndex ? 'wizard-step-dot--active' : i < stepIndex ? 'wizard-step-dot--done' : ''}`}
                    onClick={() => i < stepIndex ? setStepIndex(i) : undefined}
                    title={s.label}
                  >
                    {i < stepIndex ? '✓' : i + 1}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCompletion && (
            <div className="wizard-completion-check">
              <CheckCircle2 size={32} />
              <span>Folder created</span>
            </div>
          )}
        </div>

        {/* ── Right: form column ──────────────────────────────────── */}
        <div className="wizard-form-col">
          <div className="wizard-form-header">
            <div>
              <p className="wizard-eyebrow">
                {isTypeSelect ? 'New Client Folder'
                  : isCompletion ? `${clientDisplayName} · Folder Ready`
                  : `${data.clientType} Client · ${currentStep?.label}`}
              </p>
              <h2 className="wizard-title">
                {isTypeSelect ? 'Choose client type'
                  : isCompletion ? "What would you like to do next?"
                  : currentStep?.label}
              </h2>
            </div>
            <button className="icon-button wizard-close" type="button" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="wizard-form-body">

            {/* ── Type selector ─────────────────────────────────── */}
            {isTypeSelect && (
              <div className="wizard-type-selector">
                <button className="wizard-type-card" type="button" onClick={() => selectType('Personal')}>
                  <div className="wizard-type-icon">👤</div>
                  <div className="wizard-type-text">
                    <strong>Personal Lines</strong>
                    <span>Individual or household — auto, home, life, umbrella</span>
                  </div>
                  <div className="wizard-type-arrow"><ChevronRight size={18} /></div>
                </button>
                <button className="wizard-type-card" type="button" onClick={() => selectType('Business')}>
                  <div className="wizard-type-icon">🏢</div>
                  <div className="wizard-type-text">
                    <strong>Business / Commercial</strong>
                    <span>Company, LLC, partnership, non-profit — BOP, GL, WC, commercial auto</span>
                  </div>
                  <div className="wizard-type-arrow"><ChevronRight size={18} /></div>
                </button>
              </div>
            )}

            {/* ── Completion / "What next?" screen ──────────────── */}
            {isCompletion && (
              <div className="wizard-next-actions">
                <p className="wizard-next-intro">
                  The client folder for <strong>{clientDisplayName}</strong> has been created. Choose what to do next:
                </p>
                <button className="wizard-next-card wizard-next-card--primary" type="button" onClick={() => handleChoose('add-policy')}>
                  <div className="wizard-next-icon"><FilePlus size={24} /></div>
                  <div className="wizard-next-text">
                    <strong>Add a Policy Now</strong>
                    <span>Enter a new policy manually — carrier, type, premium, dates, and coverage</span>
                  </div>
                  <ChevronRight size={18} className="wizard-next-chevron" />
                </button>
                <button className="wizard-next-card" type="button" onClick={() => handleChoose('sync-carrier')}>
                  <div className="wizard-next-icon"><Cloud size={24} /></div>
                  <div className="wizard-next-text">
                    <strong>Sync from Carrier</strong>
                    <span>Pull existing policy data in from the IVANS download center</span>
                  </div>
                  <ChevronRight size={18} className="wizard-next-chevron" />
                </button>
                <button className="wizard-next-card wizard-next-card--muted" type="button" onClick={() => handleChoose('later')}>
                  <div className="wizard-next-icon"><FolderOpen size={24} /></div>
                  <div className="wizard-next-text">
                    <strong>Open the Folder</strong>
                    <span>Go to the client folder now and add policies later</span>
                  </div>
                  <ChevronRight size={18} className="wizard-next-chevron" />
                </button>
              </div>
            )}

            {/* ── Personal: Identity ────────────────────────────── */}
            {currentStep?.id === 'identity' && data.clientType === 'Personal' && (
              <div className="wizard-fields">
                <WField label="First Name *" full={false}>
                  <input ref={firstFieldRef as React.RefObject<HTMLInputElement>} value={data.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Legal first name" autoComplete="given-name" />
                </WField>
                <WField label="Middle Name" full={false}>
                  <input value={data.middleName} onChange={(e) => set('middleName', e.target.value)} placeholder="Optional" />
                </WField>
                <WField label="Last Name *" full={false}>
                  <input value={data.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Legal last name" autoComplete="family-name" />
                </WField>
                <WField label="Suffix" full={false}>
                  <select value={data.suffix} onChange={(e) => set('suffix', e.target.value)}>
                    <option value="">None</option>
                    <option>Jr.</option><option>Sr.</option><option>II</option>
                    <option>III</option><option>IV</option><option>Esq.</option><option>PhD</option>
                  </select>
                </WField>
                <WField label="Date of Birth" full={false}>
                  <input type="date" value={data.dob} onChange={(e) => set('dob', e.target.value)} />
                </WField>
                <WField label="Gender" full={false}>
                  <select value={data.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option>Male</option><option>Female</option>
                    <option>Non-binary</option><option>Prefer not to say</option>
                  </select>
                </WField>
                <WField label="Marital Status" full={false}>
                  <select value={data.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                    <option value="">Unknown</option>
                    <option>Single</option><option>Married</option>
                    <option>Divorced</option><option>Widowed</option>
                    <option>Domestic Partner</option>
                  </select>
                </WField>
                <WField label="Household / DBA Name" full={false}>
                  <input value={data.dbaName} onChange={(e) => set('dbaName', e.target.value)} placeholder="Optional" />
                </WField>
              </div>
            )}

            {/* ── Personal: SSN & License ───────────────────────── */}
            {currentStep?.id === 'sensitive' && data.clientType === 'Personal' && (
              <div className="wizard-fields">
                <div className="wizard-sensitive-note">
                  <span className="wizard-lock-icon">🔒</span>
                  <p>Only store the last 4 digits of the client's SSN here — never the full number. For full SSN collection, use your carrier's secure application portal.</p>
                </div>
                <WField label="SSN — Last 4 Digits Only" full={false}>
                  <input
                    ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                    value={data.ssnRef}
                    onChange={(e) => set('ssnRef', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="e.g. 1234"
                    maxLength={4}
                    inputMode="numeric"
                  />
                </WField>
                <WField label="Driver's License #" full={false}>
                  <input value={data.driverLicenseNumber} onChange={(e) => set('driverLicenseNumber', e.target.value)} placeholder="License number" />
                </WField>
                <WField label="License State" full={false}>
                  <select value={data.driverLicenseState} onChange={(e) => set('driverLicenseState', e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </WField>
              </div>
            )}

            {/* ── Personal: Contact ─────────────────────────────── */}
            {currentStep?.id === 'contact' && data.clientType === 'Personal' && (
              <ContactFields data={data} set={set} firstFieldRef={firstFieldRef as React.RefObject<HTMLInputElement>} showPrimaryContact={false} />
            )}

            {/* ── Address (both types) ──────────────────────────── */}
            {currentStep?.id === 'address' && (
              <AddressFields data={data} set={set} firstFieldRef={firstFieldRef as React.RefObject<HTMLInputElement>} />
            )}

            {/* ── Assignment (both types) ───────────────────────── */}
            {currentStep?.id === 'assignment' && (
              <AssignmentFields data={data} set={set} users={users} firstFieldRef={firstFieldRef as React.RefObject<HTMLSelectElement>} />
            )}

            {/* ── Business: Identity ────────────────────────────── */}
            {currentStep?.id === 'identity' && data.clientType === 'Business' && (
              <div className="wizard-fields">
                <WField label="Legal Business Name *" full>
                  <input ref={firstFieldRef as React.RefObject<HTMLInputElement>} value={data.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. Sunrise Bakery LLC" />
                </WField>
                <WField label="DBA (Doing Business As)" full={false}>
                  <input value={data.dbaName} onChange={(e) => set('dbaName', e.target.value)} placeholder="If different from legal name" />
                </WField>
                <WField label="Business Type" full={false}>
                  <select value={data.businessType} onChange={(e) => set('businessType', e.target.value)}>
                    <option value="">Select…</option>
                    <option>LLC</option><option>Corporation</option>
                    <option>S-Corp</option><option>Partnership</option>
                    <option>Sole Proprietor</option><option>Non-Profit</option><option>Other</option>
                  </select>
                </WField>
                <WField label="EIN / Tax ID" full={false}>
                  <input value={data.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="XX-XXXXXXX" />
                </WField>
                <WField label="Years in Business" full={false}>
                  <input type="number" min="0" value={data.yearsInBusiness} onChange={(e) => set('yearsInBusiness', e.target.value)} placeholder="e.g. 12" />
                </WField>
                <WField label="Number of Employees" full={false}>
                  <input type="number" min="0" value={data.numberOfEmployees} onChange={(e) => set('numberOfEmployees', e.target.value)} placeholder="e.g. 25" />
                </WField>
                <WField label="Annual Revenue ($)" full={false}>
                  <input type="number" min="0" value={data.annualRevenue} onChange={(e) => set('annualRevenue', e.target.value)} placeholder="e.g. 850000" />
                </WField>
                <WField label="Website" full={false}>
                  <input type="url" value={data.website} onChange={(e) => set('website', e.target.value)} placeholder="https://example.com" />
                </WField>
              </div>
            )}

            {/* ── Business: Contact ─────────────────────────────── */}
            {currentStep?.id === 'contact' && data.clientType === 'Business' && (
              <ContactFields data={data} set={set} firstFieldRef={firstFieldRef as React.RefObject<HTMLInputElement>} showPrimaryContact={true} />
            )}
          </div>

          {/* ── Footer ────────────────────────────────────────────── */}
          {!isTypeSelect && !isCompletion && (
            <div className="wizard-footer">
              <button
                className="secondary-action"
                type="button"
                onClick={() => stepIndex === 0 ? setStepIndex(-1) : setStepIndex((i) => i - 1)}
              >
                Back
              </button>
              <div className="wizard-footer-right">
                {!isLastFormStep ? (
                  <button
                    className="primary-action wizard-next-btn"
                    type="button"
                    disabled={!canAdvance()}
                    onClick={() => setStepIndex((i) => i + 1)}
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    className="primary-action wizard-save-btn"
                    type="button"
                    disabled={!canAdvance()}
                    onClick={handleAdvanceToCompletion}
                  >
                    Create Folder <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function WField({ label, full, children }: { label: string; full: boolean; children: React.ReactNode }) {
  return (
    <label className={`wizard-field ${full ? 'wizard-field--full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function ContactFields({ data, set, firstFieldRef, showPrimaryContact }: {
  data: WizardData
  set: (k: keyof WizardData, v: string) => void
  firstFieldRef: React.RefObject<HTMLInputElement>
  showPrimaryContact: boolean
}) {
  return (
    <div className="wizard-fields">
      {showPrimaryContact && (
        <WField label="Primary Contact Name *" full>
          <input ref={firstFieldRef} value={data.primaryContact} onChange={(e) => set('primaryContact', e.target.value)} placeholder="Person to contact at this business" />
        </WField>
      )}
      <WField label="Email" full={false}>
        <input ref={showPrimaryContact ? undefined : firstFieldRef} type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="client@email.com" autoComplete="email" />
      </WField>
      <WField label="Phone" full={false}>
        <input type="tel" value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 000-0000" autoComplete="tel" />
      </WField>
      <WField label="Alternate Phone" full={false}>
        <input type="tel" value={data.alternatePhone} onChange={(e) => set('alternatePhone', e.target.value)} placeholder="Optional" />
      </WField>
      <WField label="Preferred Contact Method" full={false}>
        <select value={data.preferredContactMethod} onChange={(e) => set('preferredContactMethod', e.target.value)}>
          <option>Phone</option><option>Email</option>
          <option>Text</option><option>Portal</option>
        </select>
      </WField>
    </div>
  )
}

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    county?: string
    state?: string
    postcode?: string
  }
}

function AddressFields({ data, set, firstFieldRef }: {
  data: WizardData
  set: (k: keyof WizardData, v: string) => void
  firstFieldRef: React.RefObject<HTMLInputElement>
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const handleStreetChange = (value: string) => {
    set('mailingAddress', value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 5) { setSuggestions([]); setShowSuggestions(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(value)}`
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
        const results: NominatimResult[] = await res.json()
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 420)
  }

  const selectSuggestion = (r: NominatimResult) => {
    const a = r.address
    const streetNum = a.house_number ? `${a.house_number} ` : ''
    const road = a.road ?? ''
    set('mailingAddress', `${streetNum}${road}`.trim())
    set('city', a.city ?? a.town ?? a.village ?? '')
    set('state', a.state ?? '')
    set('zip', a.postcode ?? '')
    set('county', a.county ?? '')
    setSuggestions([])
    setShowSuggestions(false)
  }

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="wizard-fields">
      <WField label="Street Address" full>
        <div className="addr-autocomplete-wrap" ref={wrapRef}>
          <input
            ref={firstFieldRef}
            value={data.mailingAddress}
            onChange={(e) => handleStreetChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
            placeholder="Start typing an address…"
            autoComplete="off"
          />
          {loading && <span className="addr-loading-indicator" aria-label="Searching" />}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="addr-suggestions" role="listbox">
              {suggestions.map((r) => (
                <li
                  key={r.place_id}
                  role="option"
                  className="addr-suggestion-item"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(r) }}
                >
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </WField>
      <WField label="City" full={false}>
        <input value={data.city} onChange={(e) => set('city', e.target.value)} placeholder="City" autoComplete="address-level2" />
      </WField>
      <WField label="State" full={false}>
        <select value={data.state} onChange={(e) => set('state', e.target.value)}>
          <option value="">Select state</option>
          {US_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </WField>
      <WField label="ZIP Code" full={false}>
        <input value={data.zip} onChange={(e) => set('zip', e.target.value)} placeholder="ZIP" maxLength={10} autoComplete="postal-code" />
      </WField>
      <WField label="County" full={false}>
        <input value={data.county} onChange={(e) => set('county', e.target.value)} placeholder="County (optional)" />
      </WField>
      <WField label="Physical Address (if different)" full>
        <input value={data.physicalAddress} onChange={(e) => set('physicalAddress', e.target.value)} placeholder="Only if different from mailing address" />
      </WField>
    </div>
  )
}

function AssignmentFields({ data, set, users, firstFieldRef }: {
  data: WizardData
  set: (k: keyof WizardData, v: string) => void
  users: UserProfile[]
  firstFieldRef: React.RefObject<HTMLSelectElement>
}) {
  return (
    <div className="wizard-fields">
      <WField label="Line of Business" full={false}>
        <select ref={firstFieldRef} value={data.lineOfBusiness} onChange={(e) => set('lineOfBusiness', e.target.value)}>
          <option value="Personal lines">Personal Lines</option>
          <option value="Commercial">Commercial</option>
          <option value="Life & health">Life &amp; Health</option>
        </select>
      </WField>
      <WField label="Account Status" full={false}>
        <select value={data.accountStatus} onChange={(e) => set('accountStatus', e.target.value)}>
          <option value="Active">Active Client</option>
          <option value="Prospect">Prospect</option>
          <option value="Inactive">Inactive</option>
        </select>
      </WField>
      <WField label="Assigned Producer" full={false}>
        <select value={data.assignedProducerId} onChange={(e) => set('assignedProducerId', e.target.value)}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
        </select>
      </WField>
      <WField label="Assigned CSR" full={false}>
        <select value={data.assignedCsrId} onChange={(e) => set('assignedCsrId', e.target.value)}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
        </select>
      </WField>
      <WField label="Default Billing Method" full={false}>
        <select value={data.billingMethod} onChange={(e) => set('billingMethod', e.target.value)}>
          <option value="">Not set</option>
          <option>Direct Bill</option>
          <option>Agency Bill</option>
          <option>Mortgagee/Escrow</option>
          <option>Premium Finance</option>
        </select>
      </WField>
      <WField label="Internal Notes" full>
        <textarea className="wizard-textarea" value={data.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any notes for the agent or CSR about this client…" rows={3} />
      </WField>
    </div>
  )
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]
