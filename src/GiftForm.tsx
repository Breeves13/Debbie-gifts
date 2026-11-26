import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, CircleQuestionMark, Gift as GiftIcon, MapPin, Mic, PencilLine, Sparkles, X } from 'lucide-react'
import { parseGiftInput } from './lib/parseGiftInput'
import { occasions, type Gift, type GiftInput, type Occasion, type Recipient } from './lib/types'
import { saveGift } from './lib/data'

const NEW_PERSON = '+new'
const example = 'Rachel Christmas gift, furry earmuffs, gift room second shelf, 25 dollars'
export function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.'
}
export function RecipientOptions({ people, includeNew = false, includeStash = true }: { people: Recipient[]; includeNew?: boolean; includeStash?: boolean }) {
  const named = people.filter(p => !p.is_generic_bucket).sort((a, b) => a.name.localeCompare(b.name))
  const stash = people.filter(p => p.is_generic_bucket)
  return <>
    {named.length > 0 && <optgroup label="Existing people">{named.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
    {includeStash && <optgroup label="Generic stash buckets">{stash.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
    {includeNew && <option value={NEW_PERSON}>+ New Person</option>}
  </>
}

export function GiftForm({ people, gift, onSaved, onCancel, onDelete }: {
  people: Recipient[]; gift?: Gift; onSaved: () => void; onCancel?: () => void; onDelete?: () => void
}) {
  const [dictation, setDictation] = useState('')
  const [recipient, setRecipient] = useState(gift?.recipient_id ?? '')
  const [occasion, setOccasion] = useState<Occasion>(gift?.occasion ?? 'Christmas')
  const [item, setItem] = useState(gift?.item ?? '')
  const [location, setLocation] = useState(gift?.storage_location ?? '')
  const [price, setPrice] = useState(gift ? String(gift.price) : '')
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(false)
  const [busy, setBusy] = useState(false)
  const dictationRef = useRef<HTMLTextAreaElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<HTMLInputElement>(null)
  function parse(value: string) {
    if (!value.trim()) { dictationRef.current?.focus(); return }
    const result = parseGiftInput(value, people)
    const person = people.find(p => p.name.toLowerCase() === result.recipientName.toLowerCase())
    setRecipient(person?.id ?? (result.recipientName ? NEW_PERSON : ''))
    setName(!person ? result.recipientName : '')
    setOccasion(result.occasion)
    setItem(result.item)
    setLocation(result.storageLocation)
    setPrice(result.price === null ? '' : String(result.price))
    setError('')
    setParsed(true)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!recipient) { setError('Choose a recipient or add a new person.'); return }
    if (!item.trim()) { setError('Enter a gift item.'); return }
    if (recipient === NEW_PERSON && !name.trim()) { setError('Enter the new person’s name.'); return }
    const validMoney = (value: string, field: HTMLInputElement | null) =>
      !field?.validity.badInput && /^\d*(?:\.\d{1,2})?$/.test(value) && Number(value) < 1e10
    if (!validMoney(price, priceRef.current)) { setError('Enter a price of $0 or more with up to two decimal places.'); return }
    if (recipient === NEW_PERSON && !validMoney(target, targetRef.current)) { setError('Enter a spending target of $0 or more with up to two decimal places.'); return }
    if (recipient === NEW_PERSON && people.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('That recipient already exists. Choose them from the list.'); return
    }
    const input: GiftInput = { recipient_id: recipient, occasion, item: item.trim(), storage_location: location.trim(), price: Number(price) }
    setBusy(true)
    setError('')
    try {
      await saveGift(input, gift?.id, recipient === NEW_PERSON ? {
        name: name.trim(), group_name: group.trim() || null, spending_target: target === '' ? null : Number(target),
      } : undefined)
      if (!gift) {
        setDictation(''); setRecipient(''); setOccasion('Christmas'); setItem(''); setLocation('')
        setPrice(''); setName(''); setGroup(''); setTarget(''); setParsed(false)
      }
      onSaved()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <div className="form-stack">
    {!gift && <section className="panel dictation-panel" aria-labelledby="dictation-title">
      <div className="section-heading"><span className="icon-tile rose"><Mic size={20} /></span><div>
        <h2 id="dictation-title">Dictate or type your gift</h2>
        <p>Use the microphone on your iPhone keyboard.</p>
      </div></div>
      <textarea ref={dictationRef} aria-label="Dictate or type your gift" placeholder={example} value={dictation}
        onChange={event => { setDictation(event.target.value); setParsed(false) }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); parse(dictation) } }} />
      <div className="dictation-actions">
        <button className="text-button" type="button" onClick={() => { setDictation(example); parse(example) }}><CircleQuestionMark size={15} /> Try an example</button>
        <button className="secondary" type="button" onClick={() => parse(dictation)}><Sparkles size={17} /> {parsed ? 'Parse again' : 'Parse gift'} <ArrowRight size={16} /></button>
      </div>
    </section>}
    <form className="panel review-panel" noValidate onSubmit={submit}>
      <div className="section-heading"><span className="icon-tile sage"><PencilLine size={20} /></span><div>
        <h2>{gift ? 'Edit gift' : 'Review & edit'}</h2>
        <p>{gift ? 'Update the details or choose a new recipient.' : 'Check the details before adding it to your list.'}</p>
      </div>{onCancel && <button className="icon-button ml-auto" type="button" aria-label="Close gift editor" onClick={onCancel}><X size={20} /></button>}</div>
      <div className="field-grid">
        <label>Recipient<select value={recipient} onChange={e => setRecipient(e.target.value)}><option value="" disabled>Choose a recipient</option><RecipientOptions people={people} includeNew /></select></label>
        <label>Occasion<select value={occasion} onChange={e => setOccasion(e.target.value as Occasion)}>{occasions.map(o => <option key={o}>{o}</option>)}</select></label>
        {recipient === NEW_PERSON && <fieldset className="new-person full">
          <legend>New person</legend>
          <div className="field-grid">
            <label className="full">Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rachel" maxLength={120} /></label>
            <label>Group <span>(optional)</span><input value={group} onChange={e => setGroup(e.target.value)} placeholder="e.g. Grandkids" maxLength={120} /></label>
            <label>Spending target <span>(optional)</span><input ref={targetRef} type="number" inputMode="decimal" min="0" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" /></label>
          </div>
        </fieldset>}
        <label className="full">Gift item <div className="input-icon"><GiftIcon size={17} /><input value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. Furry earmuffs" maxLength={300} /></div></label>
        <label>Storage location <div className="input-icon"><MapPin size={17} /><input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Gift room, second shelf" maxLength={500} /></div></label>
        <label>Price <div className="input-icon"><span aria-hidden="true">$</span><input ref={priceRef} type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary save" disabled={busy}><Check size={19} /> {busy ? 'Saving…' : gift ? 'Save changes' : 'Save gift'}</button>
      {onDelete && <button className="text-button danger" type="button" onClick={onDelete} disabled={busy}>Delete gift</button>}
    </form>
  </div>
}
