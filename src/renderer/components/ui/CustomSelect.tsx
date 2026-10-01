import { Input } from './Input'

export function CustomSelect({ id, value, options, onChange }: {
  id: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const custom = value === 'other' || (!!value && !options.some(option => option.value === value))
  const choices = options.some(option => option.value === 'other') ? options : [...options, { value: 'other', label: 'Other' }]
  return <div className="space-y-2">
    <select id={id} value={custom ? 'other' : value} onChange={event => onChange(event.target.value)} className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm">
      {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {custom && <Input id={`${id}-custom`} aria-label="Custom value" placeholder="Enter a custom value" maxLength={100} value={value === 'other' ? '' : value} onChange={event => onChange(event.target.value || 'other')} />}
  </div>
}
