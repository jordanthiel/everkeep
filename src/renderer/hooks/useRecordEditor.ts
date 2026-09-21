import { useCallback, useRef, useState } from 'react'

// Keep the loaded form as the baseline so opening an existing record is not a change.
export function useRecordEditor<T>(form: T) {
  const [isOpen, setIsOpen] = useState(false)
  const [baseline, setBaseline] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const returnPosition = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const open = useCallback((initial: T) => {
    returnPosition.current = document.querySelector('main')?.scrollTop ?? 0
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setBaseline(JSON.stringify(initial))
    setSavedId(null)
    setMessage('')
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])
  const saved = useCallback((id: string) => {
    setSavedId(id)
    setMessage('Record saved.')
    setIsOpen(false)
  }, [])
  return { isOpen, dirty: isOpen && JSON.stringify(form) !== baseline, open, close, saved, savedId, message, setMessage, returnPosition, returnFocus }
}
