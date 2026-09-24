import { useEffect, useRef, useState } from 'react'
import type { SharedRecord, SharedVaultView } from '../shared/sharing'
import { findRecipientRecords, isLetter, letterExcerpt, presentationFields, recipientContent, recordValue } from '../shared/recipient'
import { SensitiveValue } from './SensitiveValue'

type Page = { type: 'home' } | { type: 'library' } | { type: 'record'; id: string; field?: string }
export function RecipientVault({ view, busy = false, onEdit, onAttachment, active = true }: {
  view: SharedVaultView; busy?: boolean; active?: boolean; onEdit?: (record: SharedRecord) => void
  onAttachment?: (record: SharedRecord, attachmentId: string) => void
}) {
  const [page, setPage] = useState<Page>({ type: 'home' })
  const [section, setSection] = useState(''), [query, setQuery] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const { instructions, letters, featured, helpers } = recipientContent(view.records)
  const current = page.type === 'record' ? view.records.find(record => record.id === page.id) : undefined
  const welcome = recordValue(instructions, 'welcomeMessage'), signature = recordValue(instructions, 'welcomeSignature')
  const accessKey = JSON.stringify([view.role, view.scope, view.records.map(record => record.id).sort()])
  const sections = [...new Set(view.records.map(record => record.section))].sort((a, b) => a.localeCompare(b))
  useEffect(() => { if (page.type === 'record' && !current) setPage({ type: 'home' }) }, [page, current])
  useEffect(() => { if (active) heading.current?.focus() }, [page, active])
  useEffect(() => { if (section && !view.records.some(record => record.section === section)) setSection('') }, [section, view.records])
  function navigate(next: Page) { setPage(next) }
  const open = (record: SharedRecord, field?: string) => navigate({ type: 'record', id: record.id, field })
  function attachments(record: SharedRecord) {
    return record.attachments.length > 0 && <section className="ek-letter-attachments"><h3>Included with this {isLetter(record) ? 'letter' : 'record'}</h3>{record.attachments.map(file => <p key={file.id}><button disabled={busy || !onAttachment} onClick={() => onAttachment?.(record, file.id)}>Save attachment: {file.name}</button></p>)}{!onAttachment && <p className="ek-muted">Attachments can be downloaded when the recipient opens the shared vault.</p>}</section>
  }
  function fields(record: SharedRecord, only?: string) {
    return <dl>{Object.entries(record.fields).filter(([key, field]) => field.value && key !== '_title' && !presentationFields.has(key) && (!only || key === only)).map(([key, field]) => <div key={key} style={{ display: 'contents' }}><dt>{field.label}</dt><dd>{field.sensitive ? <SensitiveValue key={`${accessKey}:${record.id}:${key}:${field.value}`} value={field.value} /> : field.options?.find(option => option.value === field.value)?.label ?? field.value}</dd></div>)}</dl>
  }
  return <div className="ek-recipient">
    <nav className="ek-recipient-nav" aria-label="Shared vault navigation"><button aria-current={page.type === 'home' ? 'page' : undefined} onClick={() => navigate({ type: 'home' })}>Welcome</button><button aria-current={page.type === 'library' ? 'page' : undefined} onClick={() => { setSection(''); setQuery(''); navigate({ type: 'library' }) }}>All information</button></nav>
    {page.type === 'home' && <>
      <header className="ek-welcome"><p className="ek-eyebrow">Shared with care</p><h1 ref={heading} tabIndex={-1}>{view.name}</h1>{welcome.trim() ? <p className="ek-prose">{welcome}</p> : <p className="ek-welcome-note">A place for the words and information shared with you. Take your time, or go straight to what you need.</p>}{signature.trim() && <p className="ek-signature">{signature}</p>}</header>
      {featured && <section className="ek-featured-letter"><p className="ek-eyebrow">A letter to begin with</p><h2>{featured.title}</h2>{recordValue(featured, 'recipient') && <p className="ek-muted">For {recordValue(featured, 'recipient')}</p>}<p className="ek-prose">{letterExcerpt(recordValue(featured, 'body'))}</p><button className="primary" onClick={() => open(featured)}>Read the letter</button></section>}
      {letters.some(letter => letter.id !== featured?.id) && <section className="ek-home-section"><h2>{featured ? 'More letters & messages' : 'Letters & messages'}</h2><div className="ek-record-grid">{letters.filter(letter => letter.id !== featured?.id).map(letter => <button className="ek-record-link" key={letter.id} onClick={() => open(letter)}><strong>{letter.title}</strong>{recordValue(letter, 'recipient') && <span>For {recordValue(letter, 'recipient')}</span>}</button>)}</div></section>}
      {instructions && ['careInstructions', 'incapacityInstructions', 'deathInstructions'].some(key => recordValue(instructions, key).trim()) && <section className="ek-home-section"><h2>Where to begin</h2>{recordValue(instructions, 'careInstructions').trim() && <p className="ek-prose">{recordValue(instructions, 'careInstructions')}</p>}<div className="ek-row">{['incapacityInstructions', 'deathInstructions'].filter(key => recordValue(instructions, key).trim()).map(key => <button key={key} onClick={() => open(instructions, key)}>{key === 'incapacityInstructions' ? 'If I cannot help' : 'After my death'}</button>)}</div></section>}
      {helpers.length > 0 && <section className="ek-home-section"><h2>People who can help</h2><div className="ek-record-grid">{helpers.map(helper => <div className="ek-helper" key={helper.key}><h3>{helper.name}</h3>{helper.contact && <>{['phone', 'email'].map(key => { const field = helper.contact!.fields[key]; return field?.value && <p key={key}>{field.sensitive ? <SensitiveValue key={`${accessKey}:${helper.contact!.id}:${key}:${field.value}`} value={field.value} /> : field.value}</p> })}<button onClick={() => open(helper.contact!)}>View contact</button></>}</div>)}</div></section>}
      {view.records.length > 0 ? <section className="ek-home-section"><h2>Explore the vault</h2><p className="ek-muted">Find the details when you need them.</p><div className="ek-record-grid">{sections.map(name => <button key={name} className="ek-record-link" onClick={() => { setSection(name); setQuery(''); navigate({ type: 'library' }) }}><strong>{name}</strong><span>{view.records.filter(record => record.section === name).length} {view.records.filter(record => record.section === name).length === 1 ? 'item' : 'items'}</span></button>)}</div></section> : <p className="ek-card">{view.storage === 'file' ? 'Choose the access-controlled file supplied by the owner to open its contents.' : 'No information is currently shared with you. Ask the owner to update your access.'}</p>}
    </>}
    {page.type === 'library' && <section className="ek-home-section"><h1 ref={heading} tabIndex={-1}>All information</h1><p>Browse the information shared with you.</p><div className="ek-library-filters"><label><span>Search by title</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label><span>Section</span><select value={section} onChange={event => setSection(event.target.value)}><option value="">All sections</option>{sections.map(name => <option key={name}>{name}</option>)}</select></label></div><div className="ek-record-grid">{findRecipientRecords(view.records, section, query).map(record => <button className="ek-record-link" key={record.id} onClick={() => open(record)}><strong>{record.title}</strong><span>{record.section}</span></button>)}</div>{findRecipientRecords(view.records, section, query).length === 0 && <p role="status">No information matches this search.</p>}</section>}
    {page.type === 'record' && current && <article className={isLetter(current) ? 'ek-letter-reader' : 'ek-record-detail'} key={current.id}>
      <p className="ek-eyebrow">{current.section}</p><h1 ref={heading} tabIndex={-1}>{page.field ? current.fields[page.field]?.label : current.title}</h1>
      {isLetter(current) ? <>{recordValue(current, 'recipient') && <p className="ek-letter-meta">For {recordValue(current, 'recipient')}</p>}{recordValue(current, 'date') && <p className="ek-muted">{recordValue(current, 'date')}</p>}<div className="ek-prose ek-letter-body">{recordValue(current, 'body') || 'This letter has no written message.'}</div>{attachments(current)}</> : <>{fields(current, page.field)}{page.field && <button onClick={() => open(current)}>View all instructions</button>}{attachments(current)}</>}
      {current.updatedBy && <p className="ek-muted">Updated by {current.updatedBy}{view.storage === 'file' ? ' (file copy; attribution is not independently verified)' : ''}{current.updatedAt ? ` · ${new Date(current.updatedAt).toLocaleString()}` : ''}</p>}
      {onEdit && view.role !== 'viewer' && <button className="ek-edit-record" disabled={busy} onClick={() => onEdit(current)}>Edit record</button>}
    </article>}
  </div>
}
