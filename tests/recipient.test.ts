import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { findRecipientRecords, letterExcerpt, letterSection, recipientContent } from '../src/shared/recipient'
import { visibleRecords, SharedSnapshotSchema, type SharedRecord } from '../src/shared/sharing'
import { HandoffSchema } from '../src/shared/schemas/handoff'
import { EMPTY_HANDOFF } from '../src/shared/types/handoff'
import { createAccessFile, openRecord } from '../src/shared/accessFile'

const record = (title: string, body = 'A message just for you.'): SharedRecord => ({ id: randomUUID(), kind: 'entries', section: letterSection, title, fields: { body: { label: 'Letter body', value: body, editable: true } }, attachments: [], version: 1 })
const handoff = (featuredLetterId = ''): SharedRecord => ({ id: randomUUID(), kind: 'handoff', section: 'Instructions', title: 'Instructions', version: 1, attachments: [], fields: { featuredLetterId: { label: 'Opening letter', value: featuredLetterId, editable: false }, welcomeMessage: { label: 'Welcome', value: 'Take your time.\n\nWith love.', editable: false } } })

describe('recipient content from authorized records', () => {
  it('uses a permitted featured letter, then title/ID order for empty or missing choices', () => {
    const a = record('A letter'), b = record('B letter'), empty = record('Empty letter', '  ')
    expect(recipientContent([a, b, handoff(b.id)]).featured?.id).toBe(b.id)
    for (const id of [empty.id, randomUUID(), '']) expect(recipientContent([b, a, empty, handoff(id)]).featured?.id).toBe(a.id)
    const duplicate = { ...a, id: randomUUID() }
    expect(recipientContent([duplicate, a]).featured?.id).toBe([a.id, duplicate.id].sort()[0])
    expect(recipientContent([empty]).featured).toBeUndefined()
    expect(recipientContent([]).letters).toEqual([])
  })
  it('never adds a featured letter, contact, or welcome outside the selected access', () => {
    const secret = record('Private letter', 'SECRET BODY'), shared = record('A shared message'), intro = handoff(secret.id)
    const snapshot = { name: 'Family', records: [secret, shared, intro] }
    const records = visibleRecords(snapshot, { type: 'selected', recordIds: [shared.id] })
    expect(recipientContent(records).instructions).toBeUndefined()
    expect(recipientContent(records).featured?.id).toBe(shared.id)
    expect(findRecipientRecords(records, '', 'Private')).toEqual([])
    const withIntro = visibleRecords(snapshot, { type: 'selected', recordIds: [shared.id, intro.id] })
    expect(recipientContent(withIntro).featured?.id).toBe(shared.id)
    expect(JSON.stringify(withIntro)).not.toContain('SECRET BODY')
  })
  it('links supporting contacts by ID only, and keeps old name-only instructions readable', () => {
    const intro = handoff(), person = { ...record('Jamie'), kind: 'people' as const, section: 'Contacts' }
    intro.fields.primaryContactId = { label: 'Supporting contact', value: 'Jamie', editable: false }
    expect(recipientContent([intro, person]).helpers[0]).toMatchObject({ name: 'Jamie', contact: undefined })
    intro.fields.primaryContactRef = { label: 'Reference', value: person.id, editable: false }
    expect(recipientContent([intro, person]).helpers[0].contact?.id).toBe(person.id)
    expect(recipientContent([intro]).helpers[0].contact).toBeUndefined()
  })
  it('searches titles within the chosen section and preserves paragraph breaks in excerpts', () => {
    const a = record('Family memories'), b = { ...record('Family accounts'), section: 'Financial' }
    expect(findRecipientRecords([a, b], letterSection, ' FAMILY ')).toEqual([a])
    expect(letterExcerpt('Dear family,\n\nKeep this memory.\n\nAnd this one.')).toBe('Dear family,\n\nKeep this memory.…')
    expect(letterExcerpt('x'.repeat(1000)).length).toBe(651)
  })
  it('defaults legacy handoff data and validates welcome limits', () => {
    const { welcomeMessage: _message, welcomeSignature: _signature, featuredLetterId: _letter, ...old } = EMPTY_HANDOFF
    expect(HandoffSchema.parse(old)).toMatchObject({ welcomeMessage: '', welcomeSignature: '', featuredLetterId: '' })
    for (const patch of [{ welcomeMessage: 'x'.repeat(20001) }, { welcomeSignature: 'x'.repeat(201) }, { featuredLetterId: 'bad-id' }]) expect(HandoffSchema.safeParse({ ...old, ...patch }).success).toBe(false)
  })
  it('round-trips welcome data inside encrypted records without changing the file format', async () => {
    const letter = record('For you'), intro = handoff(letter.id), owner = { id: randomUUID(), email: 'owner@example.com' }
    const snapshot = SharedSnapshotSchema.parse({ name: 'Family', records: [letter, intro] })
    const keys = Object.fromEntries(snapshot.records.map(record => [record.id, Buffer.alloc(32, record.kind === 'handoff' ? 1 : 2).toString('base64')]))
    const file = await createAccessFile(snapshot, randomUUID(), randomUUID(), owner, keys, async () => new Uint8Array())
    expect(file.version).toBe(1)
    expect(JSON.stringify(file)).not.toContain('Take your time')
    const access = { owner, role: 'viewer' as const, scope: { type: 'selected' as const, recordIds: [intro.id] }, keys: { [intro.id]: keys[intro.id] } }
    expect((await openRecord(file, intro.id, access)).record).toEqual(intro)
    await expect(openRecord(file, letter.id, access)).rejects.toThrow('not available')
  })
})
