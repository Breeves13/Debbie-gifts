import { useState, type FormEvent } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import { client } from './lib/data'
import { errorMessage } from './GiftForm'

export function Auth() {
  const [mode, setMode] = useState<'password' | 'email' | 'code' | 'reset'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    setMessage('')
    setNotice('')
    setBusy(true)
    try {
      const address = email.trim()
      const redirect = window.location.origin + '/'
      if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(address, { redirectTo: redirect })
        if (error) throw error
        setNotice('Check your email for a password reset link.')
      } else if (mode === 'password') {
        const { error } = await client.auth.signInWithPassword({ email: address, password })
        if (error) throw error
      } else if (mode === 'email') {
        const { error } = await client.auth.signInWithOtp({
          email: address, options: { shouldCreateUser: false, emailRedirectTo: redirect },
        })
        if (error) throw error
        setMode('code')
      } else {
        const { error } = await client.auth.verifyOtp({ email: address, token: code, type: 'email' })
        if (error) throw error
      }
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setBusy(false) }
  }
  function changeMode(next: 'password' | 'email' | 'reset') {
    setMode(next)
    setMessage('')
    setNotice('')
  }
  return <main className="sign-in">
    <form className="panel form-stack" onSubmit={submit}>
      <span className="icon-tile rose"><KeyRound size={21} /></span>
      <h1>{mode === 'reset' ? 'Reset password' : 'Sign in'}</h1>
      <p>{mode === 'code' ? 'Enter the six-digit code sent to your email.' : mode === 'reset' ? 'Enter your email to receive a password reset link.' : 'Sign in to open your gift tracker.'}</p>
      <label>Email<input type="email" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email}
        onChange={e => { setEmail(e.target.value); if (mode === 'code') setMode('email') }} /></label>
      {mode === 'password' && <label>Password<input type="password" name="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>}
      {mode === 'code' && <label>Email code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>}
      {message && <p className="error" role="alert">{message}</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'email' ? 'Send email code' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => changeMode(mode === 'password' ? 'email' : 'password')}><Mail size={17} />{mode === 'password' ? 'Use a six-digit email code' : 'Use password instead'}</button>
      {mode === 'password' && <button type="button" className="text-button" disabled={busy} onClick={() => changeMode('reset')}>Forgot password</button>}
      <p className="auth-note">On iPhone, use the email code directly in the Home Screen app. If you open a sign-in link in Safari, it opens in a separate tab and may leave you signed out in the Home Screen app.</p>
    </form>
  </main>
}

export function SetNewPassword({ onSaved }: { onSaved: () => void }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    setMessage('')
    setBusy(true)
    try {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw error
      onSaved()
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <main className="sign-in">
    <form className="panel form-stack" onSubmit={submit}>
      <span className="icon-tile rose"><KeyRound size={21} /></span>
      <h1>Set new password</h1>
      <label>New password<input type="password" name="new-password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {message && <p className="error" role="alert">{message}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      <p className="auth-note">If you opened the reset link in Safari, use your new password to sign in separately in the Home Screen app.</p>
    </form>
  </main>
}
