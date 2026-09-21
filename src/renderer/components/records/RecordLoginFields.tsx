import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { RecordLoginInput } from '@shared/types/recordLogin'

export function RecordLoginFields({ value, onChange, provider }: { value: RecordLoginInput | null; onChange: (value: RecordLoginInput | null) => void; provider: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const protectedVault = useVaultStore(s => s.session?.metadata.isPasswordProtected)
  const logins = useQuery({ queryKey: ['entries', 'digital'], queryFn: () => unwrap(getEverkeepApi().entries.list('digital')), enabled: value !== null })
  const create = () => { setShowPassword(false); onChange({ provider, username: '', website: '', password: '', instructions: '' }) }
  const change = (patch: Partial<RecordLoginInput>) => value && onChange({ ...value, ...patch })
  return <fieldset className="md:col-span-2 rounded-lg border border-forest-600/20 bg-forest-700/5 p-4">
    <legend className="px-1 text-sm font-medium">Online access{provider ? ` to ${provider}` : ''} · Optional</legend>
    <p className="text-sm text-warm-500">{value ? 'Save this login with your record. It will also appear in Digital Life, linked back here.' : 'Have an online account for this? Add the login here while it’s handy.'}</p>
    {!value ? <Button className="mt-3" variant="secondary" size="sm" onClick={create}>Add a digital login</Button> : <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor="linked-login-choice">Use a saved login or create one</Label>
        <select id="linked-login-choice" className="h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm" value={value.id ?? ''} onChange={event => {
          setShowPassword(false)
          const entry = logins.data?.find(item => item.id === event.target.value)
          if (!event.target.value) create()
          else if (entry) onChange({ id: entry.id, provider: entry.fields.provider || entry.title, username: entry.fields.accountIdentifier || '', website: entry.fields.url || '', password: entry.sensitiveFields.password || '', instructions: entry.fields.instructions || '' })
        }}>
          <option value="">Create a new login</option>
          {value.id && !logins.data?.some(entry => entry.id === value.id) && <option value={value.id}>{value.provider} · Linked login</option>}
          {logins.data?.map(entry => <option key={entry.id} value={entry.id}>{entry.title}{entry.fields.accountIdentifier ? ` · ${entry.fields.accountIdentifier}` : ''}</option>)}
        </select>
        {logins.isPending && <p className="mt-1 text-xs text-warm-500">Loading saved logins…</p>}
        {logins.isError && <p role="alert" className="mt-1 text-sm">Saved logins could not load. <button className="underline" onClick={() => void logins.refetch()}>Try again</button></p>}
        {value.id && <p className="mt-2 text-xs text-warm-500">Changes here update the same login in Digital Life and any other linked records.</p>}
      </div>
      <div><Label htmlFor="linked-login-provider">Provider or service</Label><Input id="linked-login-provider" value={value.provider} placeholder="Allstate" onChange={e => change({ provider: e.target.value })} /></div>
      <div><Label htmlFor="linked-login-website">Sign-in website</Label><Input id="linked-login-website" value={value.website} placeholder="https://…" onChange={e => change({ website: e.target.value })} /></div>
      <div><Label htmlFor="linked-login-username">Username or email</Label><Input id="linked-login-username" value={value.username} autoComplete="off" onChange={e => change({ username: e.target.value })} /></div>
      <div><Label htmlFor="linked-login-password">Password (optional)</Label><div className="flex gap-2"><Input id="linked-login-password" type={showPassword ? 'text' : 'password'} value={value.password} disabled={!protectedVault} autoComplete="new-password" onChange={e => change({ password: e.target.value })} /><Button size="sm" variant="ghost" disabled={!protectedVault} aria-label={showPassword ? 'Hide login password' : 'Show login password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</Button></div>
        {!protectedVault && <p className="mt-2 text-xs text-warm-500">Enable vault password protection in <Link className="underline" to="/settings">Settings</Link> to save a password. You can save the other login details now.</p>}
      </div>
      <div className="md:col-span-2"><Label htmlFor="linked-login-instructions">Access and recovery instructions</Label><textarea id="linked-login-instructions" rows={3} className="w-full rounded-md border border-warm-300 bg-ivory-50 px-3 py-2 text-sm" placeholder="Which phone receives sign-in codes? Where are recovery codes or password-manager details kept?" value={value.instructions} onChange={e => change({ instructions: e.target.value })} /></div>
      <div className="md:col-span-2"><Button size="sm" variant="ghost" onClick={() => { setShowPassword(false); onChange(null) }}>Remove login from this record</Button><p className="mt-1 text-xs text-warm-500">Already saved logins stay in Digital Life. Your changes take effect when you save this record.</p></div>
    </div>}
  </fieldset>
}
