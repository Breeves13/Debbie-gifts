import { buckets, type Occasion } from './types'

const holiday = /\b(?:christmas|xmas|holidays?)\b/i
const birthday = /\b(?:birthdays?|b-?days?)\b/i
const occasionWord = /\b(?:christmas|xmas|holidays?|birthdays?|b-?days?|other|graduation|anniversary|wedding)\b/i
const locationCue = /\b(?:shel(?:f|ves)|closets?|bins?|rooms?|drawers?|attic|basement|garage|box(?:es)?|tubs?|cabinets?|under (?:the )?bed)\b/i
const units = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
const tens = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ')
const word = [...units, ...tens, 'hundred', 'thousand', 'and'].join('|')
const spoken = new RegExp(`\\b((?:(?:minus|negative) )?(?:${word})(?:[ -]+(?:${word}))*)\\s+(?:dollars?|bucks?)(?:\\s+(?:and\\s+)?(\\d{1,2}|(?:${word})(?:[ -]+(?:${word}))*)\\s+cents?)?\\b`, 'i')
const numeric = /(-?\$\s*-?\d+(?:,\d{3})*(?:\.\d+)?|-?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:dollars?|bucks?))(?!\w)(?:\s+(?:and\s+)?(\d{1,2})\s+cents?)?/i
function wordNumber(value: string) {
  let total = 0
  let group = 0
  for (const part of value.toLowerCase().split(/[ -]+/)) {
    if (part === 'hundred') group = (group || 1) * 100
    else if (part === 'thousand') { total += (group || 1) * 1000; group = 0 }
    else if (units.includes(part)) group += units.indexOf(part)
    else if (tens.includes(part)) group += (tens.indexOf(part) + 2) * 10
  }
  return total + group
}

const clean = (s: string) => s.trim().replace(/^[,;:\s]+|[.,;:\s]+$/g, '')
const title = (s: string) => s.replace(/\b\p{L}/gu, c => c.toUpperCase())
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseGiftInput(input: string, people: readonly (string | { name: string })[] = []) {
  const occasion: Occasion = holiday.test(input) ? 'Christmas' : birthday.test(input) ? 'Birthdays' : 'Other'
  let price: number | null = null
  let body = input.trim()
  const amount = body.match(numeric) ?? body.match(spoken)
  if (amount) {
    const raw = amount[1].replace(/[$,]/g, '').replace(/\s*(?:dollars?|bucks?)$/i, '').trim()
    const negative = /^(?:-|minus |negative )/i.test(raw)
    const dollars = /^-?\d/.test(raw) ? Math.abs(Number(raw)) : wordNumber(raw)
    const cents = amount[2] ? (/^\d/.test(amount[2]) ? Number(amount[2]) : wordNumber(amount[2])) : 0
    price = (negative ? -1 : 1) * (dollars + cents / 100)
    body = body.replace(amount[0], '')
  } else {
    const bare = body.match(/(?:[,;]\s*|\s+)(-?\d+(?:\.\d{1,2})?)\s*\.?$/)
    if (bare && (bare[0].includes(',') || bare[1].includes('.') || locationCue.test(body))) {
      price = Number(bare[1])
      body = body.slice(0, bare.index)
    }
  }
  if (price !== null && !Number.isFinite(price)) price = null
  body = body.replace(/^(?:a )?gift for\s+|^for\s+/i, '')
  const segments = body.split(/[,;\n]+/).map(clean).filter(Boolean)
  let first = segments.shift() ?? ''
  let recipientName = ''
  const names = [...buckets, ...people.map(person => typeof person === 'string' ? person : person.name)]
    .filter(Boolean).sort((a, b) => b.length - a.length)
  for (const name of names) {
    const match = first.match(new RegExp(`^${escaped(name)}(?=$|[\\s:’'])`, 'i'))
    if (match) {
      recipientName = name
      first = first.slice(match[0].length)
      break
    }
  }
  if (!recipientName) {
    const marker = first.search(occasionWord)
    const rawPrefix = first.slice(0, marker < 0 ? first.length : marker)
    const prefix = clean(rawPrefix).replace(/(?:['’]s|\s+gift)$/i, '').trim()
    if (/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,2}$/u.test(prefix)
        && (occasionWord.test(first) || (segments.length > 0 && !locationCue.test(first) && !locationCue.test(segments[0])))) {
      recipientName = title(prefix)
      first = first.slice(rawPrefix.length)
    }
  }
  const stripIntro = (segment: string) => clean(segment.replace(/^[’']s\b/i, '')
    .replace(/^\s*:\s*/, '').replace(occasionWord, '').replace(/^\s*(?:gift\b\s*)?(?:is\b\s*)?:?\s*/i, ''))
  first = stripIntro(first)
  if (!first && recipientName && segments[0]?.search(occasionWord) === 0) {
    first = stripIntro(segments.shift()!)
  }
  if (first) segments.unshift(first)
  const item = clean((segments.shift() ?? ''))
  const inline = item.match(/\s+(?:stored\s+in|located\s+in|in|on|under)\s+(.+)$/i)
  if (inline && locationCue.test(inline[0])) {
    segments.unshift(/^\s+under\b/i.test(inline[0]) ? 'under ' + inline[1] : inline[1])
    return { recipientName, occasion, item: clean(item.slice(0, inline.index)), storageLocation: segments.join(', '), price }
  }
  const room = item.match(/\s+(gift room\b.*)$/i)
  if (room && !segments.length) {
    return { recipientName, occasion, item: clean(item.slice(0, room.index)), storageLocation: room[1], price }
  }
  return { recipientName, occasion, item, storageLocation: segments.join(', ').replace(/^(?:stored in|located in)\s+/i, ''), price }
}
