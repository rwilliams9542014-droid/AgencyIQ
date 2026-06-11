import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import type { AcordAnswerMap, AcordFormConfig } from '../data/acordForms'
import { fieldMappings } from '../data/acordForms'

export type PdfFieldInfo = {
  name: string
  type: string
}

type FillablePdfField = {
  setText?: (value: string) => void
  check?: () => void
  select?: (value: string) => void
}

type OverlayField = {
  key: string
  page: number
  x: number
  y: number
  size?: number
  maxWidth?: number
  lineHeight?: number
  value?: (answers: AcordAnswerMap) => string
  checkbox?: boolean
}

export class AcordTemplateError extends Error {
  constructor(message = 'ACORD template could not be loaded. Please make sure the licensed ACORD PDF template is installed correctly.') {
    super(message)
    this.name = 'AcordTemplateError'
  }
}

const templateUrl = (templateFile: string) => `/acord-templates/${templateFile}`

const bytesHeader = (bytes: ArrayBuffer, length = 5) => {
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes).subarray(0, length))
}

const formatPdfDate = (value: string) => {
  if (!value) return ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value
  return `${match[2]}/${match[3]}/${match[1]}`
}

const parseAddress = (value: string) => {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  const stateZip = last.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i)

  return {
    line1: parts[0] ?? value,
    line2: parts.length > 3 ? parts.slice(1, -2).join(', ') : '',
    city: parts.length > 1 ? parts[parts.length - 2] ?? '' : '',
    state: stateZip?.[1]?.toUpperCase() ?? '',
    zip: stateZip?.[2] ?? '',
  }
}

const money = (value: string) => {
  if (!value) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return value
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const includesAny = (value: string, words: string[]) => {
  const normalized = value.toLowerCase()
  return words.some((word) => normalized.includes(word))
}

const acord125OverlayFields: OverlayField[] = [
  // Producer / insurer block, page 1
  { key: 'agencyName', page: 0, x: 24, y: 716, size: 7.2, maxWidth: 276 },
  { key: 'producer', page: 0, x: 56, y: 656, size: 7.2, maxWidth: 244 },
  { key: 'agencyPhone', page: 0, x: 70, y: 644, size: 7.2, maxWidth: 230 },
  { key: 'agencyEmail', page: 0, x: 60, y: 620, size: 7.2, maxWidth: 240 },
  { key: 'carrier', page: 0, x: 312, y: 716, size: 7.2, maxWidth: 226 },

  // Policy information block, page 1
  { key: 'effectiveDate', page: 0, x: 24, y: 320, size: 7.2, maxWidth: 57, value: (a) => formatPdfDate(a.effectiveDate) },
  { key: 'expirationDate', page: 0, x: 92, y: 320, size: 7.2, maxWidth: 61, value: (a) => formatPdfDate(a.expirationDate) },

  // Line of business checkboxes, page 1
  { key: 'lineOfBusiness', page: 0, x: 20, y: 524, checkbox: true, value: (a) => includesAny(a.lineOfBusiness ?? '', ['general liability', 'gl']) ? 'X' : '' },
  { key: 'lineOfBusiness', page: 0, x: 20, y: 548, checkbox: true, value: (a) => includesAny(a.lineOfBusiness ?? '', ['auto', 'business auto']) ? 'X' : '' },
  { key: 'lineOfBusiness', page: 0, x: 20, y: 536, checkbox: true, value: (a) => includesAny(a.lineOfBusiness ?? '', ['bop', 'business owners']) ? 'X' : '' },
  { key: 'lineOfBusiness', page: 0, x: 20, y: 500, checkbox: true, value: (a) => includesAny(a.lineOfBusiness ?? '', ['property']) ? 'X' : '' },
  { key: 'lineOfBusiness', page: 0, x: 214, y: 488, checkbox: true, value: (a) => includesAny(a.lineOfBusiness ?? '', ['umbrella']) ? 'X' : '' },
  { key: 'lineOfBusiness', page: 0, x: 405, y: 548, checkbox: true, value: (a) => includesAny(a.lineOfBusiness ?? '', ['general liability', 'gl', 'auto', 'business auto', 'bop', 'business owners', 'property', 'umbrella']) ? '' : 'X' },
  { key: 'lineOfBusiness', page: 0, x: 423, y: 548, size: 7, maxWidth: 104, value: (a) => includesAny(a.lineOfBusiness ?? '', ['general liability', 'gl', 'auto', 'business auto', 'bop', 'business owners', 'property', 'umbrella']) ? '' : (a.lineOfBusiness ?? '') },

  // Named insured A block, page 1
  { key: 'applicantName', page: 0, x: 24, y: 278, size: 7.2, maxWidth: 276 },
  { key: 'mailingAddress', page: 0, x: 24, y: 266, size: 7.2, maxWidth: 276, value: (a) => parseAddress(a.mailingAddress ?? '').line1 },
  { key: 'mailingAddress', page: 0, x: 24, y: 254, size: 7.2, maxWidth: 276, value: (a) => parseAddress(a.mailingAddress ?? '').line2 },
  { key: 'mailingAddress', page: 0, x: 24, y: 242, size: 7.2, maxWidth: 212, value: (a) => parseAddress(a.mailingAddress ?? '').city },
  { key: 'mailingAddress', page: 0, x: 240, y: 242, size: 7.2, maxWidth: 16, value: (a) => parseAddress(a.mailingAddress ?? '').state },
  { key: 'mailingAddress', page: 0, x: 258, y: 242, size: 7.2, maxWidth: 44, value: (a) => parseAddress(a.mailingAddress ?? '').zip },
  { key: 'fein', page: 0, x: 528, y: 278, size: 7.2, maxWidth: 62 },
  { key: 'phone', page: 0, x: 376, y: 266, size: 7.2, maxWidth: 212 },
  { key: 'website', page: 0, x: 312, y: 242, size: 7.2, maxWidth: 276 },

  // Entity type checkboxes, page 1
  { key: 'entityType', page: 0, x: 20, y: 230, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['corporation']) && !includesAny(a.entityType ?? '', ['s-corp', 's corp']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 20, y: 218, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['sole proprietor', 'individual']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 96, y: 218, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['llc', 'limited liability']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 225, y: 230, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['non-profit', 'non profit']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 225, y: 218, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['partnership']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 322, y: 230, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['s-corp', 's corp']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 463, y: 230, checkbox: true, value: (a) => includesAny(a.entityType ?? '', ['other']) ? 'X' : '' },
  { key: 'entityType', page: 0, x: 481, y: 230, size: 7.2, maxWidth: 108, value: (a) => includesAny(a.entityType ?? '', ['other']) ? (a.entityType ?? '') : '' },

  // Contacts, page 2
  { key: 'contactName', page: 1, x: 78, y: 728, size: 7.2, maxWidth: 222 },
  { key: 'phone', page: 1, x: 24, y: 704, size: 7.2, maxWidth: 132 },
  { key: 'email', page: 1, x: 117, y: 692, size: 7.2, maxWidth: 183 },

  // Premises / business details, page 2
  { key: 'physicalAddress', page: 1, x: 81, y: 656, size: 7.2, maxWidth: 176, value: (a) => parseAddress(a.physicalAddress ?? '').line1 },
  { key: 'physicalAddress', page: 1, x: 74, y: 632, size: 7.2, maxWidth: 118, value: (a) => parseAddress(a.physicalAddress ?? '').city },
  { key: 'physicalAddress', page: 1, x: 232, y: 632, size: 7.2, maxWidth: 27, value: (a) => parseAddress(a.physicalAddress ?? '').state },
  { key: 'physicalAddress', page: 1, x: 214, y: 620, size: 7.2, maxWidth: 45, value: (a) => parseAddress(a.physicalAddress ?? '').zip },
  { key: 'employees', page: 1, x: 384, y: 644, size: 7.2, maxWidth: 55 },
  { key: 'annualRevenue', page: 1, x: 520, y: 656, size: 7.2, maxWidth: 70, value: (a) => money(a.annualRevenue ?? '') },
  { key: 'businessDescription', page: 1, x: 124, y: 608, size: 6.8, maxWidth: 314 },
  { key: 'businessDescription', page: 1, x: 394, y: 404, checkbox: true, value: (a) => a.businessDescription ? 'X' : '' },
  { key: 'businessDescription', page: 1, x: 412, y: 404, size: 6.8, maxWidth: 88 },

  // Remarks and prior coverage, pages 3/4
  { key: 'remarks', page: 2, x: 24, y: 122, size: 6.8, maxWidth: 560, lineHeight: 8 },
  { key: 'priorCarrier', page: 2, x: 121, y: 86, size: 6.8, maxWidth: 107 },
  { key: 'priorPolicyNumber', page: 2, x: 121, y: 74, size: 6.8, maxWidth: 107 },
  { key: 'expirationDate', page: 2, x: 121, y: 38, size: 6.8, maxWidth: 107, value: (a) => formatPdfDate(a.expirationDate) },
  { key: 'lossesPastFiveYears', page: 3, x: 128, y: 608, checkbox: true, value: (a) => (a.lossesPastFiveYears ?? '').toLowerCase() === 'no' ? 'X' : '' },
  { key: 'lossDetails', page: 3, x: 128, y: 554, size: 6.8, maxWidth: 184 },
  { key: 'lineOfBusiness', page: 3, x: 81, y: 554, size: 6.8, maxWidth: 38 },
]

const splitTextToLines = (text: string, maxCharacters: number) => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word
    if (nextLine.length > maxCharacters && line) {
      lines.push(line)
      line = word
    } else {
      line = nextLine
    }
  }

  if (line) lines.push(line)
  return lines
}

async function drawAcord125Overlay(pdfDoc: PDFDocument, answers: AcordAnswerMap) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  const drawnFields: string[] = []

  for (const item of acord125OverlayFields) {
    const value = (item.value ? item.value(answers) : answers[item.key])?.trim()
    const page = pages[item.page] as PDFPage | undefined
    if (!value || !page) continue

    const size = item.size ?? 8
    if (item.checkbox) {
      page.drawText('X', {
        x: item.x + 2,
        y: item.y + 1,
        size: size + 1,
        font,
        color: rgb(0, 0, 0),
      })
      drawnFields.push(item.key)
      continue
    }

    const lineHeight = item.lineHeight ?? size + 2
    const maxCharacters = item.maxWidth ? Math.max(8, Math.floor(item.maxWidth / (size * 0.52))) : 80
    const lines = splitTextToLines(value, maxCharacters).slice(0, item.lineHeight ? 4 : 1)

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: item.x,
        y: item.y - index * lineHeight,
        size,
        font,
        color: rgb(0, 0, 0),
        maxWidth: item.maxWidth,
      })
    })
    drawnFields.push(item.key)
  }

  return drawnFields
}

export async function inspectPdfFields(file: File): Promise<PdfFieldInfo[]> {
  const bytes = await file.arrayBuffer()
  const header = bytesHeader(bytes)
  if (header !== '%PDF-') {
    throw new Error(`Invalid PDF file. Expected %PDF- header but got "${header}".`)
  }

  const pdfDoc = await PDFDocument.load(bytes)
  const form = pdfDoc.getForm()

  return form.getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name,
  }))
}

export async function generateAcordPdf(
  formConfig: AcordFormConfig,
  answers: AcordAnswerMap,
): Promise<{ blob: Blob; fileName: string; missingFields: string[] }> {
  const url = templateUrl(formConfig.templateFile)
  const response = await fetch(url)

  if (!response.ok) {
    console.error('[ACORD template]', {
      formType: formConfig.id,
      templateFile: formConfig.templateFile,
      templateUrl: url,
      status: response.status,
      statusText: response.statusText,
      exists: false,
    })
    throw new AcordTemplateError()
  }

  const contentType = response.headers.get('content-type') || ''
  const templateBytes = await response.arrayBuffer()
  const header = bytesHeader(templateBytes)
  const validPdfHeader = header === '%PDF-'

  console.info('[ACORD template]', {
    formType: formConfig.id,
    templateFile: formConfig.templateFile,
    templateUrl: url,
    contentType,
    exists: true,
    fileSize: templateBytes.byteLength,
    first20Bytes: bytesHeader(templateBytes, 20),
    validPdfHeader,
  })

  if (!validPdfHeader) {
    console.error('[ACORD template invalid]', {
      formType: formConfig.id,
      templateFile: formConfig.templateFile,
      templateUrl: url,
      contentType,
      fileSize: templateBytes.byteLength,
      header,
    })
    throw new AcordTemplateError()
  }

  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(templateBytes)
  } catch (error) {
    console.error('[ACORD template parse failed]', {
      formType: formConfig.id,
      templateFile: formConfig.templateFile,
      templateUrl: url,
      contentType,
      fileSize: templateBytes.byteLength,
      header,
      error,
    })
    throw new AcordTemplateError()
  }

  const pdfForm = pdfDoc.getForm()
  const mappings = fieldMappings[formConfig.id] ?? {}
  const missingFields: string[] = []
  let filledFieldCount = 0

  for (const [answerKey, pdfFieldName] of Object.entries(mappings)) {
    const value = answers[answerKey]
    if (!value) continue

    const field = pdfForm.getFieldMaybe(pdfFieldName)
    if (!field) {
      missingFields.push(pdfFieldName)
      continue
    }

    const fillableField = field as FillablePdfField
    const setText = typeof fillableField.setText === 'function'
    const check = typeof fillableField.check === 'function'
    const select = typeof fillableField.select === 'function'

    try {
      if (setText) {
        fillableField.setText?.(value)
        filledFieldCount++
      } else if (check && ['yes', 'true', 'checked'].includes(value.toLowerCase())) {
        fillableField.check?.()
        filledFieldCount++
      } else if (select) {
        fillableField.select?.(value)
        filledFieldCount++
      }
    } catch {
      missingFields.push(pdfFieldName)
    }
  }

  if (filledFieldCount > 0) {
    pdfForm.flatten()
  } else if (formConfig.id === 'acord_125') {
    const drawnFields = await drawAcord125Overlay(pdfDoc, answers)
    if (drawnFields.length > 0) {
      missingFields.length = 0
    }
    console.info('[ACORD overlay fallback]', {
      formType: formConfig.id,
      templateFile: formConfig.templateFile,
      drawnFields,
    })
  }

  const bytes = await pdfDoc.save()
  const cleanName = (answers.applicantName || 'client').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const fileName = `${formConfig.name.toLowerCase().replace(/\s+/g, '-')}-${cleanName || 'client'}-${new Date().toISOString().slice(0, 10)}.pdf`

  return {
    blob: new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' }),
    fileName,
    missingFields,
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
