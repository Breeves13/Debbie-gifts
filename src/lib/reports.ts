import type { Gift, Occasion, Recipient } from './types'

function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const group = key(item)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(item)
  }
  return groups
}

export const sumPrices = (gifts: readonly Gift[]) => gifts.reduce((cents, gift) => cents + Math.round(gift.price * 100), 0) / 100

export function budgetReport(recipients: Recipient[], gifts: Gift[], occasion: Occasion | 'All') {
  const filtered = gifts.filter(gift => occasion === 'All' || gift.occasion === occasion)
  const groups = groupBy(recipients.filter(person => !person.is_generic_bucket), person => person.group_name || 'Ungrouped')
  return {
    groups: Array.from(groups, ([name, people]) => {
      const members = people.map(person => ({ ...person, spent: sumPrices(filtered.filter(gift => gift.recipient_id === person.id)) }))
        .sort((a, b) => a.name.localeCompare(b.name))
      const total = members.reduce((cents, member) => cents + Math.round(member.spent * 100), 0) / 100
      const average = total / members.length
      const min = Math.min(...members.map(member => member.spent))
      const max = Math.max(...members.map(member => member.spent))
      return {
        name, total, average, min, max, spread: (Math.round(max * 100) - Math.round(min * 100)) / 100,
        members: members.map(member => ({
          ...member,
          budget: compareSpend(member.spent, member.spending_target, average),
        })),
      }
    }).sort((a,b) => a.name.localeCompare(b.name)),
    stash: sumPrices(filtered.filter(gift => recipients.some(person => person.id === gift.recipient_id && person.is_generic_bucket))),
    total: sumPrices(filtered),
  }
}

function compareSpend(spent: number, target: number | null, average: number) {
  const balance = target === null ? null : (Math.round(target * 100) - Math.round(spent * 100)) / 100
  const progress = target === null ? null : target === 0 ? Number(spent > 0) : Math.min(1, spent / target)
  const deviation = spent - average
  const noticeable = Math.abs(deviation) >= Math.max(5, average * 0.2)
  return { balance, progress, relativeToAverage: noticeable ? (deviation > 0 ? 'Above' : 'Below') : null }
}

export function christmasReport(recipients: Recipient[], gifts: Gift[]) {
  const christmas = gifts.filter(gift => gift.occasion === 'Christmas')
  const byId = new Map(recipients.map(person => [person.id, person]))
  const grouped = groupBy(christmas, gift => {
    const person = byId.get(gift.recipient_id)
    return person && !person.is_generic_bucket ? person.id : null
  })
  const groups = Array.from(grouped, ([id, items]) => ({
    name: id === null ? 'Unassigned Stash' : byId.get(id)!.name,
    stash: id === null, gifts: items, subtotal: sumPrices(items),
  })).sort((a, b) => Number(a.stash) - Number(b.stash) || a.name.localeCompare(b.name))
  return { groups, total: sumPrices(christmas) }
}
