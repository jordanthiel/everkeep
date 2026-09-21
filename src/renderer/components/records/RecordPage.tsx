import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { SectionPage } from '../layout/SectionPage'
import { Button } from '../ui/Button'
import type { useRecordEditor } from '@renderer/hooks/useRecordEditor'

type Editor = Omit<ReturnType<typeof useRecordEditor>, 'open'>
interface RecordPageProps {
  title: string
  description: string
  badge?: string
  collection: string
  noun: string
  empty: string
  count: number
  loading: boolean
  failed: boolean
  retry: () => void
  editor: Editor
  onAdd: () => void
  onCancel: () => void
  saving: boolean
  form: ReactNode
  saveAction: ReactNode
  children: ReactNode
}

export function RecordPage({ title, description, badge, collection, noun, empty, count, loading, failed, retry, editor, onAdd, onCancel, saving, form, saveAction, children }: RecordPageProps) {
  const root = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const wasConfirming = useRef(false)
  const closeTrigger = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (editor.isOpen) {
      root.current?.scrollIntoView({ block: 'start' })
      root.current?.querySelector<HTMLElement>('[data-record-form] input, [data-record-form] select, [data-record-form] textarea')?.focus({ preventScroll: true })
    } else if (wasOpen.current) {
      const record = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-record-id]') ?? []).find(item => item.dataset.recordId === editor.savedId)
      if (record) {
        record.focus({ preventScroll: true })
        record.scrollIntoView({ block: 'center' })
        record.classList.add('ring-2', 'ring-forest-500')
        const timeout = window.setTimeout(() => record.classList.remove('ring-2', 'ring-forest-500'), 2400)
        wasOpen.current = false
        return () => window.clearTimeout(timeout)
      }
      const target = editor.returnFocus.current
      if (target?.isConnected) target.focus({ preventScroll: true })
      else {
        const previousId = target?.closest<HTMLElement>('[data-record-id]')?.dataset.recordId
        const previousRecord = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-record-id]') ?? []).find(item => item.dataset.recordId === previousId)
        const focusTarget = Array.from(previousRecord?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button => button.textContent === target?.textContent) ?? root.current?.querySelector<HTMLElement>('[data-add-record]')
        focusTarget?.focus({ preventScroll: true })
      }
      document.querySelector('main')?.scrollTo(0, editor.returnPosition.current)
    }
    wasOpen.current = editor.isOpen
    return undefined
  }, [editor.isOpen, editor.savedId, editor.returnFocus, editor.returnPosition])

  useEffect(() => {
    if (wasConfirming.current && !confirmDiscard && editor.isOpen) closeTrigger.current?.focus()
    wasConfirming.current = confirmDiscard
  }, [confirmDiscard, editor.isOpen])

  function cancel() {
    if (saving) return
    if (editor.dirty) {
      closeTrigger.current = document.activeElement as HTMLElement
      setConfirmDiscard(true)
    } else onCancel()
  }
  function stay() {
    setConfirmDiscard(false)
  }

  return <SectionPage title={title} headingOverride={title} description={description} badge={badge} sharingEditing={editor.isOpen} showJourneyNavigation={!editor.isOpen} journeyBlocked={editor.dirty || saving}>
    <div ref={root} inert={confirmDiscard}>
      <p role="status" className={editor.message ? 'mb-4 text-sm text-forest-700' : 'sr-only'}>{editor.message}</p>
      {editor.isOpen ? <>
        <Button variant="ghost" className="mb-4" disabled={saving} onClick={cancel}><ArrowLeft className="h-4 w-4" />Back to records</Button>
        <div data-record-form inert={saving || confirmDiscard}>{form}</div>
        <div className="sticky bottom-0 z-10 flex flex-wrap items-start gap-3 border-t border-warm-200 bg-ivory-50 px-5 py-4 shadow-soft">
          {saveAction}
          <Button variant="secondary" disabled={saving} onClick={cancel}>Cancel</Button>
        </div>
      </> : <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{collection}{!loading && !failed && <span className="text-warm-500"> · {count}</span>}</h2>
          <Button data-add-record onClick={onAdd}><Plus className="h-4 w-4" />Add {noun}</Button>
        </div>
        {loading ? <p role="status" className="py-6 text-sm text-warm-500">Loading records…</p> : failed ? <div role="alert" className="space-y-3 py-6"><p>Unable to load records.</p><Button variant="secondary" onClick={retry}>Try again</Button></div> : count === 0 ? <div className="rounded-xl border border-dashed border-warm-300 px-6 py-10 text-center">
          <p className="mb-4 text-sm text-warm-500">{empty}</p>
          <Button variant="secondary" onClick={onAdd}>Add your first {noun}</Button>
        </div> : children}
      </>}
    </div>
    {confirmDiscard && <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-6" role="alertdialog" aria-modal="true" aria-labelledby="discard-record-title" aria-describedby="discard-record-description" onKeyDown={event => {
      if (event.key === 'Escape') stay()
      if (event.key === 'Tab') {
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button')
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      <div className="max-w-md rounded-xl bg-ivory-50 p-6 shadow-soft">
        <h2 id="discard-record-title" className="font-display text-2xl">Discard these changes?</h2>
        <p id="discard-record-description" className="my-4 text-sm text-warm-500">Your unsaved changes will be lost.</p>
        <div className="flex gap-3"><Button autoFocus onClick={stay}>Keep editing</Button><Button variant="secondary" onClick={() => { setConfirmDiscard(false); onCancel() }}>Discard changes</Button></div>
      </div>
    </div>}
  </SectionPage>
}
