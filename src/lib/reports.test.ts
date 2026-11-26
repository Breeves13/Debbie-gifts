import { describe, expect, it } from 'vitest'
import { budgetReport, christmasReport } from './reports'
import type { Gift, Recipient } from './types'

const people: Recipient[] = [
  { id: 'z', name: 'Zoey', group_name: 'Grandkids', spending_target: 20, is_generic_bucket: false },
  { id: 'a', name: 'Avery', group_name: 'Grandkids', spending_target: null, is_generic_bucket: false },
  { id: 'm', name: 'Morgan', group_name: null, spending_target: 0, is_generic_bucket: false },
  { id: 's1', name: 'Male Child', group_name: null, spending_target: null, is_generic_bucket: true },
  { id: 's2', name: 'Adult Woman', group_name: null, spending_target: null, is_generic_bucket: true },
]
function gift(id: string, recipient_id: string, price: number, occasion: Gift['occasion'] = 'Christmas'): Gift {
  return { id, recipient_id, occasion, item: 'Gift ' + id, storage_location: 'Closet', price, created_at: '2026-11-26' }
}
const gifts = [
  gift('g1', 'z', 20.10), gift('g2', 's2', 3.99), gift('g3', 'a', 0.10), gift('g4', 'a', 0.20),
  gift('g5', 'z', 45.00, 'Birthdays'), gift('g6', 's1', 5.00), gift('g7', 's1', 12, 'Other'),
]

describe('budgetReport', () => {
  it('totals cents accurately, groups named people, and reports a separate stash', () => {
    const report = budgetReport(people, gifts, 'Christmas')
    expect(report.total).toBe(29.39)
    expect(report.stash).toBe(8.99)
    expect(report.groups.map(group => group.name)).toEqual(['Grandkids', 'Ungrouped'])
    const [group, ungrouped] = report.groups
    expect(group).toMatchObject({ total: 20.4, average: 10.2, min: 0.3, max: 20.1, spread: 19.8 })
    expect(group.members.map(person => [person.name, person.spent, person.spending_target])).toEqual([
      ['Avery', 0.3, null], ['Zoey', 20.1, 20],
    ])
    expect(ungrouped.members[0]).toMatchObject({ spent: 0, spending_target: 0 })
    expect(group.members.map(person => person.budget)).toEqual([
      { balance: null, progress: null, relativeToAverage: 'Below' },
      { balance: -0.1, progress: 1, relativeToAverage: 'Above' },
    ])
    expect(ungrouped.members[0].budget).toEqual({ balance: 0, progress: 0, relativeToAverage: null })
  })

  it('calculates remaining budgets, partial progress, and spending over a zero target', () => {
    const report = budgetReport(people, [gift('g1', 'z', 10), gift('g2', 'm', 1)], 'Christmas')
    expect(report.groups[0].members[1].budget).toMatchObject({ balance: 10, progress: 0.5 })
    expect(report.groups[1].members[0].budget).toMatchObject({ balance: -1, progress: 1 })
  })

  it('includes zero-spend named recipients in group averages', () => {
    expect(budgetReport(people, [gift('g1', 'z', 20)], 'Christmas').groups[0])
      .toMatchObject({ total: 20, average: 10, min: 0, max: 20 })
  })

  it('switches between All, Birthdays, and Other', () => {
    expect(budgetReport(people, gifts, 'All')).toMatchObject({ total: 86.39, stash: 20.99 })
    expect(budgetReport(people, gifts, 'Birthdays')).toMatchObject({ total: 45, stash: 0 })
    expect(budgetReport(people, gifts, 'Other')).toMatchObject({ total: 12, stash: 12 })
  })

  it('handles an empty tracker', () => {
    expect(budgetReport([], [], 'All')).toEqual({ groups: [], total: 0, stash: 0 })
  })
})

describe('christmasReport', () => {
  it('sorts named people, combines the stash last, and excludes other occasions', () => {
    const report = christmasReport(people, gifts)
    expect(report.groups.map(group => [group.name, group.subtotal, group.gifts.map(item => item.id)])).toEqual([
      ['Avery', 0.3, ['g3', 'g4']], ['Zoey', 20.1, ['g1']], ['Unassigned Stash', 8.99, ['g2', 'g6']],
    ])
    expect(report.total).toBe(29.39)
  })

  it('omits empty groups and leaves out the stash when empty', () => {
    expect(christmasReport(people, [gifts[0]]).groups.map(group => group.name)).toEqual(['Zoey'])
    expect(christmasReport(people, [gift('g7', 's1', 12, 'Other')])).toEqual({ groups: [], total: 0 })
  })
})
