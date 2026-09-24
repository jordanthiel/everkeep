import { useState } from 'react'
export function SensitiveValue({ value }: { value: string }) {
  const [visible, setVisible] = useState(false)
  return <><span>{visible ? value : '••••••••'}</span> <button aria-label={visible ? 'Hide sensitive value' : 'Show sensitive value'} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></>
}
