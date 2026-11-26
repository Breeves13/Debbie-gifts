import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, ChartNoAxesColumnIncreasing, ChevronRight, FileDown, Gift as GiftIcon, List, LogOut, MapPin, PackageOpen, Plus, Printer, Search, Sparkles } from 'lucide-react'
import { Auth, SetNewPassword } from './Auth'
import { errorMessage, GiftForm, RecipientOptions } from './GiftForm'
import { checkGiftAccess, client, deleteGift, loadData, mock, reassignGift } from './lib/data'
import { exportChristmasPdf } from './lib/pdf'
import { budgetReport, christmasReport } from './lib/reports'
import { money, occasions, type Data, type Gift, type Occasion } from './lib/types'
import './style.css'

type Tab = 'add' | 'gifts' | 'spend'
type Filter = Occasion | 'All'
const tabs = [
  { id: 'add', label: 'Add Gift', icon: Plus },
  { id: 'gifts', label: 'Gift List', icon: List },
  { id: 'spend', label: 'Spending', icon: ChartNoAxesColumnIncreasing },
] as const

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  useEffect(() => {
    if (!client) return
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true)
      if (event === 'SIGNED_OUT') setRecoveringPassword(false)
      setSession(next)
    })
    return () => subscription.unsubscribe()
  }, [])
  return <>
    <header className="topbar"><div className="frame header-content">
      <div className="brand"><span className="brand-icon"><GiftIcon size={24} /></span><div><strong>Debbie’s Gifts</strong><span>Your personal gift tracker</span></div></div>
      {mock && <span className="mode"><span /> Demo mode</span>}
      {session && <button className="signout" aria-label="Sign out" onClick={() => void client?.auth.signOut().then(({ error }) => setAuthError(error?.message ?? ''))}><LogOut size={18} /> Sign out</button>}
    </div></header>
    {authError && <p className="error frame" role="alert">{authError}</p>}
    {mock ? <Tracker /> : session
      ? recoveringPassword ? <SetNewPassword onSaved={() => setRecoveringPassword(false)} /> : <AuthorizedTracker key={session.user.id} />
      : !client
      ? <main className="sign-in"><section className="panel"><h1>Setup required</h1><p>Configure Supabase or enable demo mode to open your gift tracker.</p></section></main>
      : session === undefined ? <main className="sign-in"><p role="status">Checking sign-in…</p></main> : <Auth />}
  </>
}

function AuthorizedTracker() {
  const [allowed, setAllowed] = useState<boolean>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void checkGiftAccess().then(
      result => { if (active) setAllowed(result) },
      err => { if (active) setError(errorMessage(err)) },
    )
    return () => { active = false }
  }, [attempt])

  if (allowed) return <Tracker />
  return <main className="sign-in">
    {allowed === false ? <section className="panel form-stack" role="alert">
      <h1>Not authorized</h1>
      <p>This account needs to be added to the gift tracker’s allowlist.</p>
    </section> : error ? <section className="panel form-stack">
      <p className="error" role="alert">{error}</p>
      <button className="text-button" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Retry access check</button>
    </section> : <p role="status">Checking tracker access…</p>}
  </main>
}

function Tracker() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<Tab>('add')
  const [editing, setEditing] = useState<Gift | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [changing, setChanging] = useState(false)
  const [query, setQuery] = useState('')
  const [occasion, setOccasion] = useState<Filter>('All')
  const [recipient, setRecipient] = useState('')
  const [spendOccasion, setSpendOccasion] = useState<Filter>('Christmas')
  async function refresh() {
    try { setData(await loadData()); setError('') }
    catch (err) { setError(errorMessage(err)) }
  }
  useEffect(() => { void refresh() }, [])
  function navigate(next: Tab) { setTab(next); setEditing(null); setNotice(''); window.scrollTo(0, 0) }
  function edit(gift: Gift) { navigate('gifts'); setEditing(gift) }
  function saved() {
    setNotice(editing ? 'Gift updated.' : 'Gift added to your list.')
    setEditing(null)
    void refresh()
  }
  async function remove(gift: Gift) {
    if (changing || !window.confirm(`Delete “${gift.item}”?`)) return
    setChanging(true)
    try { await deleteGift(gift.id); setEditing(null); setNotice('Gift deleted.'); await refresh() }
    catch (err) { setError(errorMessage(err)) }
    finally { setChanging(false) }
  }
  async function reassign(gift: Gift, recipient_id: string) {
    if (!recipient_id || changing) return
    setChanging(true)
    try { await reassignGift(gift.id, recipient_id); setNotice('Gift reassigned.'); await refresh() }
    catch (err) { setError(errorMessage(err)) }
    finally { setChanging(false) }
  }
  async function pdf() {
    if (!data || exporting) return
    setExporting(true)
    try { await exportChristmasPdf(data) }
    catch (err) { setError(errorMessage(err)) }
    finally { setExporting(false) }
  }

  const people = data?.recipients ?? []
  const gifts = data?.gifts ?? []
  const byId = new Map(people.map(person => [person.id, person]))
  const matches = gifts.filter(gift =>
    (occasion === 'All' || gift.occasion === occasion) &&
    (!recipient || (recipient === 'stash' ? byId.get(gift.recipient_id)?.is_generic_bucket : gift.recipient_id === recipient)) &&
    [gift.item, gift.storage_location].some(field => field.toLowerCase().includes(query.trim().toLowerCase())))
  const title = tab === 'add' ? 'Add a gift' : tab === 'gifts' ? 'Gift list' : 'Spending'
  const subtitle = tab === 'add' ? 'Capture what you bought, who it’s for, and where it’s tucked away.'
    : tab === 'gifts' ? 'Find what you bought and where you put it.' : 'Compare spending and see how much is left in each budget.'
  return <>
    <main className="frame app-main">
      <div className="page-intro"><div><h1>{title}</h1><p>{subtitle}</p></div>
        {tab !== 'add' && <div className="export-actions"><button className="secondary" onClick={() => void pdf()} disabled={!data || exporting}><FileDown size={18} /> Christmas PDF</button><button className="secondary neutral" disabled={!data} onClick={() => window.print()}><Printer size={18} /> Print</button></div>}
      </div>
      {error && <div className="error status-bar" role="alert">{error} <button className="text-button" onClick={() => void refresh()}>Reload gifts</button></div>}
      {notice && <div className="success status-bar" role="status">{notice}</div>}
      {!data && !error && <p role="status">Loading gifts…</p>}
      {data && tab === 'add' && <div className="dashboard">
        <GiftForm people={people} onSaved={saved} />
        <aside className="form-stack">
          <section className="panel tip-panel">
            <div className="section-heading"><span className="icon-tile amber"><Sparkles size={19} /></span><h2>Dictation tips</h2></div>
            <p>Say the recipient and occasion first, then the gift, where it’s stored, and the price.</p>
            <div className="tip-example">“Rachel Christmas gift, furry earmuffs, gift room second shelf, 25 dollars.”</div>
          </section>
          <section className="panel recent-panel">
            <div className="section-heading"><span className="icon-tile rose"><GiftIcon size={19} /></span><h2>Recent gifts</h2></div>
            {gifts.length ? <ul className="recent-list">{gifts.slice(0, 3).map(gift => <li key={gift.id}>
              <button onClick={() => edit(gift)}><span><strong>{gift.item}</strong><small>{byId.get(gift.recipient_id)?.name} <span aria-hidden="true">·</span> {gift.occasion}</small></span><strong>{money(gift.price)}</strong></button>
            </li>)}</ul> : <p className="recent-empty">Your saved gifts will appear here.</p>}
            <button className="text-button view-all" onClick={() => navigate('gifts')}>View all gifts <ArrowRight size={16} /></button>
          </section>
        </aside>
      </div>}
      {data && tab === 'gifts' && (editing
        ? <GiftForm key={editing.id} gift={editing} people={people} onSaved={saved} onCancel={() => setEditing(null)} onDelete={() => void remove(editing)} />
        : <>
          <div className="panel filters">
            <label>Search <div className="input-icon"><Search size={18} /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search gifts or locations" /></div></label>
            <label>Occasion<select value={occasion} onChange={e => setOccasion(e.target.value as Filter)}><option>All</option>{occasions.map(o => <option key={o}>{o}</option>)}</select></label>
            <label>Recipient<select value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">All recipients</option><option value="stash">Unassigned Stash</option><RecipientOptions people={people} /></select></label>
          </div>
          <div className="list-heading"><h2>{recipient === 'stash' ? 'Unassigned Stash' : 'Gifts'}</h2><span>{matches.length} {matches.length === 1 ? 'gift' : 'gifts'}</span></div>
          {matches.length ? <ul className="gift-list">{matches.map(gift => {
            const person = byId.get(gift.recipient_id)
            return <li key={gift.id} className="panel gift-card">
              <button className="gift-card-main" onClick={() => edit(gift)}>
                <span className="icon-tile rose"><GiftIcon size={20} /></span>
                <span className="gift-description"><strong>{gift.item}</strong><span className="badges"><span>{person?.name ?? 'Recipient unavailable'}</span><span>{gift.occasion}</span></span>
                  <small><MapPin size={15} /> {gift.storage_location || 'No storage location'}</small></span>
                <span className="gift-price">{money(gift.price)} <ChevronRight size={18} /></span>
              </button>
              {person?.is_generic_bucket && <label className="reassign">Reassign to<select aria-label={`Reassign ${gift.item}`} value="" disabled={changing} onChange={e => void reassign(gift, e.target.value)}><option value="">Choose a person</option><RecipientOptions people={people} includeStash={false} /></select></label>}
            </li>
          })}</ul> : <div className="panel empty"><PackageOpen size={30} /><h2>No matching gifts</h2><p>{gifts.length ? 'Try a different search or filter.' : 'Add a gift to start your list.'}</p></div>}
        </>)}
      {data && tab === 'spend' && <Spending data={data} occasion={spendOccasion} setOccasion={setSpendOccasion} />}
    </main>
    <nav className="bottomnav" aria-label="Main navigation"><div className="nav-content">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} />{label}</button>)}
    </div></nav>
    {data && <PrintReport data={data} />}
  </>
}

function Spending({ data, occasion, setOccasion }: { data: Data; occasion: Filter; setOccasion: (value: Filter) => void }) {
  const report = budgetReport(data.recipients, data.gifts, occasion)
  return <div className="form-stack">
    <div className="panel spending-top"><label>Occasion<select value={occasion} onChange={e => setOccasion(e.target.value as Filter)}><option>All</option>{occasions.map(o => <option key={o}>{o}</option>)}</select></label><div><span>Total spent</span><strong>{money(report.total)}</strong></div></div>
    {report.groups.map(group => <section className="panel spending-group" key={group.name}>
      <div className="list-heading"><h2>{group.name}</h2><strong>{money(group.total)}</strong></div>
      <p className="group-stat">{money(group.average)} average per person <span>·</span> {money(group.min)} to {money(group.max)} <span>·</span> {money(group.spread)} spread</p>
      <ul>{group.members.map(person => {
        const target = person.spending_target
        const { balance, progress, relativeToAverage } = person.budget
        const over = balance !== null && balance < 0
        return <li key={person.id} className="spending-person">
          <div><strong>{person.name}</strong><strong>{money(person.spent)}{target !== null && <small> / {money(target)}</small>}</strong></div>
          {progress !== null && <progress max={1} value={progress} aria-label={`${person.name} spending target`} className={over ? 'over' : ''} />}
          <div className="spend-notes">
            <span className={over ? 'over-label' : ''}>{balance === null ? 'No spending target' : over ? `${money(-balance)} over target` : `${money(balance)} remaining`}</span>
            {relativeToAverage && <span className="outlier">{relativeToAverage} group average</span>}
          </div>
        </li>
      })}</ul>
    </section>)}
    <section className="panel stash-summary"><span className="icon-tile amber"><PackageOpen size={20} /></span><h2>Unassigned Stash</h2><strong>{money(report.stash)}</strong></section>
  </div>
}
function PrintReport({ data }: { data: Data }) {
  const report = christmasReport(data.recipients, data.gifts)
  return <section className="print-report">
    <h1>Debbie’s Gifts</h1><h2>Christmas Gift List</h2>
    {report.groups.map(group => <table key={group.name}>
      <caption>{group.name}</caption><thead><tr><th>Item</th><th>Storage Location</th><th>Price</th></tr></thead>
      <tbody>{group.gifts.map(gift => <tr key={gift.id}><td>{gift.item}</td><td>{gift.storage_location || '—'}</td><td>{money(gift.price)}</td></tr>)}</tbody>
      <tfoot><tr><th colSpan={2}>Subtotal</th><td>{money(group.subtotal)}</td></tr></tfoot>
    </table>)}
    <p>Grand Total <strong>{money(report.total)}</strong></p>
  </section>
}

createRoot(document.getElementById('root')!).render(<App />)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Gift tracker offline setup failed', error))
}
