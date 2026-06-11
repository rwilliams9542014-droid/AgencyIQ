import { useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSearch, FileText, Save } from 'lucide-react'
import { acordForms, buildAcordPrefill, getAcordForm, type AcordAnswerMap, type AcordFormConfig, type AcordQuestion } from '../data/acordForms'
import type { AcordDraft, Client, Policy, UserProfile } from '../data/crmTypes'
import { AcordTemplateError, downloadBlob, generateAcordPdf, inspectPdfFields, type PdfFieldInfo } from '../lib/acordPdf'

type Props = {
  clients: Client[]
  policies: Policy[]
  agencyName: string
  currentUser: UserProfile
  users: UserProfile[]
  drafts: AcordDraft[]
  initialClientId?: string
  onSaveDraft: (draft: AcordDraft) => void
  onGenerated: (draft: AcordDraft, fileName: string) => void
}

type ValidationErrors = Record<string, string>

const reviewStepId = 'review'

const blankDraftId = () => `acord-${crypto.randomUUID()}`

function validateValue(question: AcordQuestion, value: string): string {
  const trimmed = value.trim()
  if (question.required && !trimmed) return `${question.label} is required.`
  if (!trimmed) return ''
  if (question.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email address.'
  if (question.type === 'phone' && trimmed.replace(/\D/g, '').length < 7) return 'Enter a reasonable phone number.'
  if (question.type === 'date' && Number.isNaN(new Date(`${trimmed}T12:00:00`).getTime())) return 'Enter a valid date.'
  if (question.type === 'number' && Number.isNaN(Number(trimmed))) return 'Enter a number.'
  return ''
}

function clientProducerName(client: Client | undefined, users: UserProfile[]) {
  return users.find((user) => user.id === client?.assignedProducerId)?.name ?? ''
}

function getClientPolicies(clientId: string, policies: Policy[]) {
  return policies
    .filter((policy) => policy.clientId === clientId)
    .sort((left, right) => new Date(right.expirationDate).getTime() - new Date(left.expirationDate).getTime())
}

export function AcordFormsPanel({
  clients,
  policies,
  agencyName,
  currentUser,
  users,
  drafts,
  initialClientId,
  onSaveDraft,
  onGenerated,
}: Props) {
  const initialSelectedClientId = initialClientId || clients[0]?.id || ''
  const [clientId, setClientId] = useState(initialSelectedClientId)
  const [formType, setFormType] = useState('acord_125')
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<AcordAnswerMap>(() => {
    const nextClient = clients.find((client) => client.id === initialSelectedClientId)
    const nextPolicies = getClientPolicies(initialSelectedClientId, policies)
    const producer = clientProducerName(nextClient, users)
    return buildAcordPrefill(nextClient ?? null, nextPolicies, agencyName, producer)
  })
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [message, setMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [fieldList, setFieldList] = useState<PdfFieldInfo[]>([])
  const [fieldError, setFieldError] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  const selectedForm = getAcordForm(formType)
  const steps = [...selectedForm.sections, { id: reviewStepId, title: 'Review & Generate', description: 'Confirm the answers before generating the completed PDF.', questions: [] }]
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]
  const clientDrafts = drafts.filter((draft) => draft.clientId === clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const selectedClient = clients.find((client) => client.id === clientId)
  const clientMatches = clients
    .filter((client) => {
      const query = clientSearch.trim().toLowerCase()
      if (!query) return true
      return [
        client.name,
        client.primaryContact,
        client.email,
        client.phone,
        client.mailingAddress,
      ].some((value) => value?.toLowerCase().includes(query))
    })
    .slice(0, 8)

  const prefillForClient = (nextClientId: string) => {
    const nextClient = clients.find((client) => client.id === nextClientId)
    const nextPolicies = getClientPolicies(nextClientId, policies)
    const producer = clientProducerName(nextClient, users)
    return buildAcordPrefill(nextClient ?? null, nextPolicies, agencyName, producer)
  }

  const setAnswer = (key: string, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const validateStep = () => {
    const nextErrors: ValidationErrors = {}
    for (const question of currentStep.questions) {
      const error = validateValue(question, answers[question.id] ?? '')
      if (error) nextErrors[question.id] = error
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const validateAll = () => {
    const nextErrors: ValidationErrors = {}
    for (const section of selectedForm.sections) {
      for (const question of section.questions) {
        const error = validateValue(question, answers[question.id] ?? '')
        if (error) nextErrors[question.id] = error
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const buildDraft = (status: AcordDraft['status'], fileName?: string): AcordDraft => {
    const now = new Date().toISOString()
    const existing = activeDraftId ? drafts.find((draft) => draft.id === activeDraftId) : null
    return {
      id: existing?.id ?? blankDraftId(),
      accountId: currentUser.accountId,
      clientId,
      formType: selectedForm.id,
      formTitle: `${selectedForm.name} - ${selectedForm.title}`,
      answers,
      status,
      generatedFileName: fileName ?? existing?.generatedFileName,
      generatedAt: fileName ? now : existing?.generatedAt,
      createdByUserId: existing?.createdByUserId ?? currentUser.id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
  }

  const saveDraft = () => {
    const draft = buildDraft('draft')
    onSaveDraft(draft)
    setActiveDraftId(draft.id)
    setMessage('Draft saved.')
  }

  const generatePdf = async () => {
    if (!validateAll()) {
      setMessage('Fix the highlighted fields before generating.')
      return
    }

    setIsGenerating(true)
    setMessage('')

    try {
      const result = await generateAcordPdf(selectedForm, answers)
      downloadBlob(result.blob, result.fileName)
      const draft = buildDraft('generated', result.fileName)
      onGenerated(draft, result.fileName)
      setActiveDraftId(draft.id)
      setMessage(result.missingFields.length > 0
        ? `PDF generated. ${result.missingFields.length} mapped fields were not found in the template.`
        : 'PDF generated and downloaded.')
    } catch (error) {
      setMessage(error instanceof AcordTemplateError
        ? error.message
        : 'Could not generate the PDF. Please try again or contact support.')
    } finally {
      setIsGenerating(false)
    }
  }

  const startNew = (nextForm: AcordFormConfig = selectedForm) => {
    setActiveDraftId(null)
    setFormType(nextForm.id)
    setStepIndex(0)
    setErrors({})
    setMessage('')
    setAnswers(prefillForClient(clientId))
  }

  const switchClient = (nextClientId: string) => {
    setClientId(nextClientId)
    setClientSearch('')
    setActiveDraftId(null)
    setStepIndex(0)
    setErrors({})
    setMessage('')
    setAnswers(prefillForClient(nextClientId))
  }

  const resumeDraft = (draft: AcordDraft) => {
    setActiveDraftId(draft.id)
    setClientId(draft.clientId)
    setFormType(draft.formType)
    setAnswers(draft.answers)
    setStepIndex(0)
    setErrors({})
    setMessage(`Resumed ${draft.formTitle}.`)
  }

  const inspectFields = async (file: File | null) => {
    setFieldList([])
    setFieldError('')
    if (!file) return

    try {
      setFieldList(await inspectPdfFields(file))
    } catch {
      setFieldError('Could not read fields from that PDF.')
    }
  }

  const nextStep = () => {
    if (!validateStep()) return
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  return (
    <section className="acord-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Guided form filler</p>
          <h1>ACORD Forms</h1>
          <p>Start with the client, answer normal intake questions, and fill your licensed ACORD template.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => startNew()}>
          <FileText size={16} aria-hidden="true" />
          New ACORD 125
        </button>
      </div>

      <div className="acord-layout">
        <aside className="panel acord-side-panel">
          <div className="panel-header">
            <div>
              <h2>Setup</h2>
              <p>Select a client and form type.</p>
            </div>
          </div>

          <label className="acord-field">
            <span>Client</span>
            <input
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder={selectedClient ? `Selected: ${selectedClient.name}` : 'Search by client, phone, or email'}
            />
          </label>
          <div className="acord-client-search-results">
            {clientMatches.map((client) => (
              <button
                className={client.id === clientId ? 'active' : ''}
                type="button"
                key={client.id}
                onClick={() => switchClient(client.id)}
              >
                <strong>{client.name}</strong>
                <span>{client.email || client.phone || client.primaryContact || 'No contact info'}</span>
              </button>
            ))}
            {clientMatches.length === 0 && <p>No clients match that search.</p>}
          </div>

          <div className="acord-form-options">
            {acordForms.map((form) => (
              <button
                className={form.id === formType ? 'acord-form-option active' : 'acord-form-option'}
                type="button"
                key={form.id}
                onClick={() => {
                  if (form.sections.length === 0) {
                    setMessage(`${form.name} is registered for later expansion. ACORD 125 is active now.`)
                    return
                  }
                  startNew(form)
                }}
              >
                <strong>{form.name}</strong>
                <span>{form.title}</span>
                <small>{form.sections.length > 0 ? 'Available' : 'Coming later'}</small>
              </button>
            ))}
          </div>

          <div className="acord-draft-list">
            <h3>Drafts</h3>
            {clientDrafts.length === 0 ? (
              <p>No saved ACORD drafts for this client.</p>
            ) : (
              clientDrafts.map((draft) => (
                <button type="button" key={draft.id} onClick={() => resumeDraft(draft)}>
                  <strong>{draft.formTitle}</strong>
                  <span>{draft.status} - {new Date(draft.updatedAt).toLocaleDateString()}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="panel acord-wizard-panel">
          <div className="acord-stepper" aria-label="ACORD form progress">
            {steps.map((step, index) => (
              <button
                className={index === stepIndex ? 'active' : index < stepIndex ? 'complete' : ''}
                type="button"
                key={step.id}
                onClick={() => setStepIndex(index)}
              >
                <span>{index < stepIndex ? <CheckCircle2 size={14} aria-hidden="true" /> : index + 1}</span>
                {step.title}
              </button>
            ))}
          </div>

          <div className="acord-section-head">
            <div>
              <p className="eyebrow">{selectedForm.name}</p>
              <h2>{currentStep.title}</h2>
              <p>{currentStep.description}</p>
            </div>
            <span className="status-pill">{selectedForm.category}</span>
          </div>

          {currentStep.id === reviewStepId ? (
            <div className="acord-review-grid">
              {selectedForm.sections.map((section) => (
                <div className="acord-review-section" key={section.id}>
                  <h3>{section.title}</h3>
                  {section.questions.map((question) => (
                    <div key={question.id}>
                      <span>{question.label}</span>
                      <strong>{answers[question.id] || 'Not provided'}</strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="acord-question-grid">
              {currentStep.questions.map((question) => (
                <label className={question.type === 'textarea' ? 'acord-field acord-field--wide' : 'acord-field'} key={question.id}>
                  <span>
                    {question.label}
                    {question.required && <em>Required</em>}
                  </span>
                  {question.type === 'textarea' ? (
                    <textarea rows={4} value={answers[question.id] ?? ''} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder={question.placeholder} />
                  ) : question.type === 'select' ? (
                    <select value={answers[question.id] ?? ''} onChange={(event) => setAnswer(question.id, event.target.value)}>
                      <option value="">Select</option>
                      {question.options?.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={question.type === 'number' ? 'number' : question.type === 'phone' ? 'tel' : question.type}
                      value={answers[question.id] ?? ''}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      placeholder={question.placeholder}
                    />
                  )}
                  {errors[question.id] && <small className="acord-error">{errors[question.id]}</small>}
                </label>
              ))}
            </div>
          )}

          {message && (
            <div className={message.includes('not found') || message.includes('Fix') || message.includes('Could not') ? 'acord-message acord-message--warning' : 'acord-message'}>
              <AlertCircle size={16} aria-hidden="true" />
              <span>{message}</span>
            </div>
          )}

          <div className="acord-wizard-actions">
            <button className="secondary-action" type="button" onClick={() => setStepIndex((index) => Math.max(index - 1, 0))} disabled={stepIndex === 0}>
              Back
            </button>
            <button className="secondary-action" type="button" onClick={saveDraft}>
              <Save size={16} aria-hidden="true" />
              Save Draft
            </button>
            {currentStep.id === reviewStepId ? (
              <button className="primary-action" type="button" onClick={generatePdf} disabled={isGenerating}>
                <Download size={16} aria-hidden="true" />
                {isGenerating ? 'Generating...' : 'Generate PDF'}
              </button>
            ) : (
              <button className="primary-action" type="button" onClick={nextStep}>
                Next
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="panel acord-utility-panel">
        <div className="panel-header">
          <div>
            <h2>PDF Field Inspector</h2>
            <p>Upload your licensed template locally to list the PDF field names, then update the field mapping config.</p>
          </div>
          <FileSearch size={20} aria-hidden="true" />
        </div>
        <input type="file" accept="application/pdf" onChange={(event) => inspectFields(event.target.files?.[0] ?? null)} />
        {fieldError && <p className="acord-error">{fieldError}</p>}
        {fieldList.length > 0 && (
          <div className="acord-field-list">
            {fieldList.map((field) => (
              <code key={field.name}>{field.name} <span>{field.type}</span></code>
            ))}
          </div>
        )}
        <p className="acord-template-note">
          Use <strong>VITE_ACORD_TEMPLATE_BASE_URL</strong> for production templates. Local development can read <strong>public/acord-templates/acord-125.pdf</strong>.
        </p>
      </section>
    </section>
  )
}
