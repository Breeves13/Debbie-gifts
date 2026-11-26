export const occasions = ['Christmas', 'Birthdays', 'Other'] as const
export const buckets = ['Male Child', 'Female Child', 'Adult Woman', 'Adult Man'] as const
export type Occasion = typeof occasions[number]
export type Recipient = { id: string; name: string; group_name: string | null; spending_target: number | null; is_generic_bucket: boolean }
export type GiftInput = { recipient_id: string; occasion: Occasion; item: string; storage_location: string; price: number }
export type Gift = GiftInput & { id: string; created_at: string }
export type Data = { recipients: Recipient[]; gifts: Gift[] }
export const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
