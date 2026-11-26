import { createClient } from '@supabase/supabase-js'
import { buckets, type Data, type GiftInput, type Recipient } from './types'

export const mock = import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false' && !import.meta.env.VITE_SUPABASE_URL)
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
export const client = !mock && url && key ? createClient(url, key) : null

const storageKey = 'debbies-gifts-v1'
const sample: Data = {
  recipients: [
    { id: 'mia', name: 'Mia Parker', group_name: 'Grandkids', spending_target: 100, is_generic_bucket: false },
    { id: 'ben', name: 'Ben Miller', group_name: 'Adults', spending_target: 100, is_generic_bucket: false },
    { id: 'ella', name: 'Ella Brooks', group_name: 'Grandkids', spending_target: 75, is_generic_bucket: false },
    ...buckets.map((name, i) => ({ id: 'stash-' + i, name, group_name: null, spending_target: null, is_generic_bucket: true })),
  ],
  gifts: [
    { id: 'sample-1', recipient_id: 'mia', item: 'Fuzzy earmuffs', storage_location: 'Gift room, second shelf', occasion: 'Christmas', price: 25, created_at: '2026-11-26T00:00:00Z' },
    { id: 'sample-2', recipient_id: 'ben', item: 'Cozy wool socks', storage_location: 'Hall closet, top bin', occasion: 'Christmas', price: 18.50, created_at: '2026-11-25T00:00:00Z' },
    { id: 'sample-3', recipient_id: 'stash-1', item: 'Watercolor set', storage_location: 'Craft room cabinet', occasion: 'Birthdays', price: 22, created_at: '2026-11-24T00:00:00Z' },
  ],
}
function readMock(): Data {
  const raw = localStorage.getItem(storageKey)
  if (raw) return JSON.parse(raw) as Data
  return {
    recipients: sample.recipients.map(person => ({ ...person })),
    gifts: sample.gifts.map(gift => ({ ...gift })),
  }
}
const writeMock = (data: Data) => localStorage.setItem(storageKey, JSON.stringify(data))
function database() {
  if (!client) throw new Error('Supabase is not configured.')
  return client
}

export async function checkGiftAccess(): Promise<boolean> {
  const { data, error } = await database().rpc('gift_app_is_allowed')
  if (error?.code === '42501') return false
  if (error) throw error
  return data === true
}

export async function loadData(): Promise<Data> {
  if (mock) return readMock()
  const [recipients, gifts] = await Promise.all([
    database().rpc('gift_app_list_recipients'),
    database().rpc('gift_app_list_gifts'),
  ])
  if (recipients.error) throw recipients.error
  if (gifts.error) throw gifts.error
  return { recipients: recipients.data, gifts: gifts.data }
}
type NewPerson = Pick<Recipient, 'name' | 'group_name' | 'spending_target'>
export async function saveGift(input: GiftInput, id?: string, person?: NewPerson) {
  if (mock) {
    const data = readMock()
    const recipientId = person ? crypto.randomUUID() : input.recipient_id
    if (person) data.recipients.push({ ...person, id: recipientId, is_generic_bucket: false })
    const existing = data.gifts.find(gift => gift.id === id)
    if (id && !existing) throw new Error('Gift is unavailable.')
    const gift = { ...input, recipient_id: recipientId, id: id ?? crypto.randomUUID(), created_at: existing?.created_at ?? new Date().toISOString() }
    data.gifts = existing ? data.gifts.map(row => row.id === id ? gift : row) : [gift, ...data.gifts]
    writeMock(data)
    return
  }
  const args = { p_gift_data: input, p_gift_id: id ?? null }
  const { error } = person
    ? await database().rpc('gift_app_save_gift_with_person', { ...args, p_person_data: person })
    : await database().rpc('gift_app_save_gift', args)
  if (error) throw error
}
export async function deleteGift(id: string) {
  if (mock) {
    const data = readMock()
    data.gifts = data.gifts.filter(gift => gift.id !== id)
    writeMock(data)
    return
  }
  const { error } = await database().rpc('gift_app_delete_gift', { p_gift_id: id })
  if (error) throw error
}
export async function reassignGift(id: string, recipient_id: string) {
  if (mock) {
    const data = readMock()
    const gift = data.gifts.find(row => row.id === id)
    if (!gift) throw new Error('Gift is unavailable.')
    gift.recipient_id = recipient_id
    writeMock(data)
    return
  }
  const { error } = await database().rpc('gift_app_reassign_gift', { p_gift_id: id, p_recipient_id: recipient_id })
  if (error) throw error
}
