import { Input } from '../ui/Input'
import { PERSON_ROLE_OPTIONS } from '@shared/types/person'

export function CustomRole({ roles, onChange }: { roles: string[]; onChange: (roles: string[]) => void }) {
  const customRoles = roles.filter(role => !PERSON_ROLE_OPTIONS.some(option => option.value === role))
  if (!roles.includes('other') && !customRoles.length) return null
  return <div className="mt-2 space-y-2">{(customRoles.length ? customRoles : ['other']).map((role, index) => <Input key={index} aria-label="Custom assignment" placeholder="Enter a custom assignment" maxLength={100} value={role === 'other' ? '' : role} onChange={event => onChange(roles.map(value => value === role ? event.target.value || 'other' : value))} />)}</div>
}
