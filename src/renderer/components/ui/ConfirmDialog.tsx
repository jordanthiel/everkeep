import { useEffect, useRef } from 'react'
import { Button } from './Button'
export function ConfirmDialog({ open, title, description, onCancel, onConfirm }: { open: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  return <dialog ref={dialog} onCancel={onCancel} aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="max-w-md rounded-xl border border-warm-200 bg-ivory-50 p-6 text-charcoal-900 backdrop:bg-charcoal-900/40">
    <h2 id="confirm-dialog-title" className="font-display text-2xl">{title}</h2>
    <p id="confirm-dialog-description" className="my-4 text-sm text-warm-500">{description}</p>
    <div className="flex gap-3"><Button autoFocus variant="secondary" onClick={onCancel}>Keep current draft</Button><Button onClick={onConfirm}>Replace</Button></div>
  </dialog>
}
