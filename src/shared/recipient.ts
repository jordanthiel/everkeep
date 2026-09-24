import type { SharedRecord } from './sharing'
import { getSectionDefinition } from './sections/definitions'

export const letterSection = getSectionDefinition('letters').title
export const isLetter = (record: SharedRecord) => record.kind === 'entries' && record.section === letterSection
export const recordOrder = (a: SharedRecord, b: SharedRecord) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
export const recordValue = (record: SharedRecord | undefined, key: string) => record?.fields[key]?.value ?? ''
export const presentationFields = new Set(['welcomeMessage', 'welcomeSignature', 'featuredLetterId', 'primaryContactRef', 'alternateContactRef'])

// Only pass records returned by the authorized client (or a scope-filtered preview).
export function recipientContent(records: SharedRecord[]) {
  const instructions = records.find(record => record.kind === 'handoff')
  const letters = records.filter(isLetter).sort(recordOrder)
  const readable = letters.filter(record => recordValue(record, 'body').trim())
  const featured = readable.find(record => record.id === recordValue(instructions, 'featuredLetterId')) ?? readable[0]
  const helpers = [
    { label: 'primaryContactId', reference: 'primaryContactRef' },
    { label: 'alternateContactId', reference: 'alternateContactRef' }
  ].flatMap(({ label, reference }) => {
    const name = recordValue(instructions, label)
    if (!name.trim()) return []
    const contact = records.find(record => record.kind === 'people' && record.id === recordValue(instructions, reference))
    return [{ name, contact, key: label }]
  })
  return { instructions, letters, featured, helpers }
}

export function findRecipientRecords(records: SharedRecord[], section: string, query: string) {
  return records.filter(record => (!section || record.section === section) && record.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort(recordOrder)
}

export function letterExcerpt(body: string) {
  const opening = body.split(/\n\s*\n/).slice(0, 2).join('\n\n')
  if (opening.length <= 650) return opening + (opening.length < body.length ? '…' : '')
  const boundary = opening.lastIndexOf(' ', 650)
  return opening.slice(0, boundary > 450 ? boundary : 650) + '…'
}
