import type { Client, Policy } from './crmTypes'

export type AcordFieldType = 'text' | 'email' | 'phone' | 'date' | 'number' | 'select' | 'textarea' | 'boolean'

export type AcordQuestion = {
  id: string
  label: string
  type: AcordFieldType
  required?: boolean
  placeholder?: string
  options?: string[]
}

export type AcordSection = {
  id: string
  title: string
  description: string
  questions: AcordQuestion[]
}

export type AcordFormConfig = {
  id: string
  name: string
  title: string
  category: 'Commercial' | 'Personal'
  templateFile: string
  sections: AcordSection[]
}

export type AcordAnswerMap = Record<string, string>

export const acordForms: AcordFormConfig[] = [
  {
    id: 'acord_125',
    name: 'ACORD 125',
    title: 'Commercial Insurance Application',
    category: 'Commercial',
    templateFile: 'acord-125.pdf',
    sections: [
      {
        id: 'applicant',
        title: 'Applicant Information',
        description: 'The named insured and business identity used on the application.',
        questions: [
          { id: 'applicantName', label: 'Named insured', type: 'text', required: true },
          { id: 'dba', label: 'DBA', type: 'text' },
          { id: 'entityType', label: 'Entity type', type: 'select', required: true, options: ['LLC', 'Corporation', 'S-Corp', 'Partnership', 'Sole Proprietor', 'Non-Profit', 'Other'] },
          { id: 'fein', label: 'FEIN', type: 'text' },
        ],
      },
      {
        id: 'contact',
        title: 'Contact Information',
        description: 'How the carrier and agency should reach the applicant.',
        questions: [
          { id: 'contactName', label: 'Contact name', type: 'text', required: true },
          { id: 'phone', label: 'Phone', type: 'phone', required: true },
          { id: 'email', label: 'Email', type: 'email', required: true },
          { id: 'website', label: 'Website', type: 'text' },
        ],
      },
      {
        id: 'business',
        title: 'Business Information',
        description: 'Plain-language business details used by underwriting.',
        questions: [
          { id: 'businessDescription', label: 'Business description', type: 'textarea', required: true, placeholder: 'Describe operations, products, services, and customers.' },
          { id: 'yearsInBusiness', label: 'Years in business', type: 'number' },
          { id: 'annualRevenue', label: 'Annual revenue', type: 'number' },
          { id: 'employees', label: 'Number of employees', type: 'number' },
        ],
      },
      {
        id: 'policy',
        title: 'Policy Information',
        description: 'Requested dates, line of business, carrier, and agency details.',
        questions: [
          { id: 'effectiveDate', label: 'Effective date', type: 'date', required: true },
          { id: 'expirationDate', label: 'Expiration date', type: 'date', required: true },
          { id: 'lineOfBusiness', label: 'Line of business', type: 'text', required: true },
          { id: 'carrier', label: 'Current or target carrier', type: 'text' },
          { id: 'producer', label: 'Producer', type: 'text' },
          { id: 'agencyName', label: 'Agency name', type: 'text' },
          { id: 'agencyPhone', label: 'Agency phone', type: 'phone' },
          { id: 'agencyEmail', label: 'Agency email', type: 'email' },
        ],
      },
      {
        id: 'locations',
        title: 'Locations',
        description: 'Mailing and physical addresses for the applicant.',
        questions: [
          { id: 'mailingAddress', label: 'Mailing address', type: 'textarea', required: true },
          { id: 'physicalAddress', label: 'Physical address', type: 'textarea', required: true },
        ],
      },
      {
        id: 'owners',
        title: 'Owners / Officers',
        description: 'Key owners, officers, or contacts to list with the application.',
        questions: [
          { id: 'ownersOfficers', label: 'Owners / officers', type: 'textarea', placeholder: 'Name, title, ownership percentage, and contact details.' },
        ],
      },
      {
        id: 'prior',
        title: 'Prior Carrier',
        description: 'Prior policy details if they are known.',
        questions: [
          { id: 'priorCarrier', label: 'Prior carrier', type: 'text' },
          { id: 'priorPolicyNumber', label: 'Prior policy number', type: 'text' },
        ],
      },
      {
        id: 'loss',
        title: 'Loss History',
        description: 'High-level loss history for underwriting review.',
        questions: [
          { id: 'lossesPastFiveYears', label: 'Losses in past 5 years', type: 'select', required: true, options: ['No', 'Yes', 'Unknown'] },
          { id: 'lossDetails', label: 'Loss details', type: 'textarea', placeholder: 'Date, amount, description, status.' },
        ],
      },
      {
        id: 'remarks',
        title: 'Remarks',
        description: 'Any extra underwriting notes before review.',
        questions: [
          { id: 'remarks', label: 'Additional remarks', type: 'textarea' },
        ],
      },
    ],
  },
  { id: 'acord_126', name: 'ACORD 126', title: 'Commercial General Liability Section', category: 'Commercial', templateFile: 'acord-126.pdf', sections: [] },
  { id: 'acord_127', name: 'ACORD 127', title: 'Business Auto Section', category: 'Commercial', templateFile: 'acord-127.pdf', sections: [] },
  { id: 'acord_130', name: 'ACORD 130', title: 'Workers Compensation Application', category: 'Commercial', templateFile: 'acord-130.pdf', sections: [] },
  { id: 'acord_140', name: 'ACORD 140', title: 'Property Section', category: 'Commercial', templateFile: 'acord-140.pdf', sections: [] },
  { id: 'acord_80', name: 'ACORD 80', title: 'Homeowner Application', category: 'Personal', templateFile: 'acord-80.pdf', sections: [] },
  { id: 'acord_90', name: 'ACORD 90', title: 'Personal Auto Application', category: 'Personal', templateFile: 'acord-90.pdf', sections: [] },
]

export const fieldMappings: Record<string, Record<string, string>> = {
  acord_125: {
    applicantName: 'Applicant_Name_Field',
    dba: 'DBA_Field',
    entityType: 'Entity_Type_Field',
    fein: 'FEIN_Field',
    contactName: 'Contact_Name_Field',
    phone: 'Phone_Field',
    email: 'Email_Field',
    website: 'Website_Field',
    businessDescription: 'Business_Description_Field',
    yearsInBusiness: 'Years_In_Business_Field',
    annualRevenue: 'Annual_Revenue_Field',
    employees: 'Employees_Field',
    effectiveDate: 'Effective_Date_Field',
    expirationDate: 'Expiration_Date_Field',
    lineOfBusiness: 'Line_Of_Business_Field',
    carrier: 'Carrier_Field',
    producer: 'Producer_Field',
    agencyName: 'Agency_Name_Field',
    agencyPhone: 'Agency_Phone_Field',
    agencyEmail: 'Agency_Email_Field',
    mailingAddress: 'Mailing_Address_Field',
    physicalAddress: 'Physical_Address_Field',
    ownersOfficers: 'Owners_Officers_Field',
    priorCarrier: 'Prior_Carrier_Field',
    priorPolicyNumber: 'Prior_Policy_Number_Field',
    lossesPastFiveYears: 'Losses_Past_Five_Years_Field',
    lossDetails: 'Loss_Details_Field',
    remarks: 'Remarks_Field',
  },
}

export const getAcordForm = (formId: string) => acordForms.find((form) => form.id === formId) ?? acordForms[0]

export function buildAcordPrefill(
  client: Client | null,
  policies: Policy[],
  agencyName: string,
  producerName: string,
): AcordAnswerMap {
  const activePolicy = policies.find((policy) => ['Active', 'Renewal review', 'Bound'].includes(policy.status)) ?? policies[0]
  const priorPolicy = policies.find((policy) => ['Expired', 'Non-Renewed', 'Renewed/Replaced'].includes(policy.status))

  if (!client) {
    return { agencyName }
  }

  return {
    applicantName: client.name ?? '',
    dba: client.dbaName ?? '',
    entityType: client.businessType ?? '',
    fein: client.taxId ?? '',
    contactName: client.primaryContact ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    website: client.website ?? '',
    yearsInBusiness: client.yearsInBusiness ? String(client.yearsInBusiness) : '',
    annualRevenue: client.annualRevenue ? String(client.annualRevenue) : '',
    employees: client.numberOfEmployees ? String(client.numberOfEmployees) : '',
    effectiveDate: activePolicy?.effectiveDate ?? '',
    expirationDate: activePolicy?.expirationDate ?? '',
    lineOfBusiness: activePolicy?.policyType ?? client.lineOfBusiness ?? '',
    carrier: activePolicy?.carrier ?? '',
    producer: producerName,
    agencyName,
    mailingAddress: client.mailingAddress ?? '',
    physicalAddress: client.physicalAddress ?? client.mailingAddress ?? '',
    priorCarrier: priorPolicy?.carrier ?? '',
    priorPolicyNumber: priorPolicy?.policyNumber ?? '',
    remarks: client.notes ?? '',
  }
}

