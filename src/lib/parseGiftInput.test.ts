import { describe, expect, it } from 'vitest'
import { parseGiftInput } from './parseGiftInput'
import { buckets } from './types'

describe('parseGiftInput', () => {
  it('pre-fills a new recipient and all fields from the iPhone dictation example', () => {
    expect(parseGiftInput('Rachel Christmas gift, furry earmuffs, gift room second shelf, 25 dollars')).toEqual({
      recipientName: 'Rachel', occasion: 'Christmas', item: 'furry earmuffs', storageLocation: 'gift room second shelf', price: 25,
    })
  })

  it('handles the example when dictation omits the commas', () => {
    expect(parseGiftInput('Rachel Christmas gift furry earmuffs gift room second shelf 25 dollars')).toEqual({
      recipientName: 'Rachel', occasion: 'Christmas', item: 'furry earmuffs', storageLocation: 'gift room second shelf', price: 25,
    })
  })

  it('keeps a named candidate for an occasion filed under Other', () => {
    expect(parseGiftInput('Rachel graduation gift, journal, blue cabinet, $15')).toEqual({
      recipientName: 'Rachel', occasion: 'Other', item: 'journal', storageLocation: 'blue cabinet', price: 15,
    })
  })

  it('matches a canonical known name case-insensitively and prefers the longest match', () => {
    expect(parseGiftInput('mia parker’s Xmas gift: socks in the hallway closet, $18.50', [
      'Mia', { name: 'Mia Parker' },
    ])).toEqual({
      recipientName: 'Mia Parker', occasion: 'Christmas', item: 'socks', storageLocation: 'the hallway closet', price: 18.5,
    })
  })

  for (const name of buckets) {
    it(`recognizes the ${name} stash bucket`, () => {
      expect(parseGiftInput(`${name.toLowerCase()} bday gift, puzzle, attic, 25 bucks`)).toEqual({
        recipientName: name, occasion: 'Birthdays', item: 'puzzle', storageLocation: 'attic', price: 25,
      })
    })
  }

  const occasionCases = [
    ['Xmas', 'Christmas'], ['holiday', 'Christmas'], ['birthday', 'Birthdays'],
    ['birthdays', 'Birthdays'], ['b-day', 'Birthdays'], ['graduation', 'Other'],
  ]
  for (const [word, occasion] of occasionCases) {
    it(`normalizes ${word}`, () => expect(parseGiftInput(`Sam ${word}, book`, ['Sam']).occasion).toBe(occasion))
  }

  const priceCases: [string, number][] = [
    ['$25', 25], ['$1,025.50', 1025.5], ['25.50', 25.5], ['25 dollars', 25],
    ['25 bucks', 25], ['twenty five dollars', 25], ['twenty-five dollars and fifty cents', 25.5],
    ['one hundred and five bucks', 105], ['zero dollars', 0], ['-$4.50', -4.5], ['minus four dollars', -4],
  ]
  for (const [input, price] of priceCases) {
    it(`recognizes ${input}`, () => expect(parseGiftInput(`Sam birthday, book, green bin, ${input}`).price).toBe(price))
  }

  it('keeps a free-text location split across multiple dictated segments', () => {
    expect(parseGiftInput('Sam, birthday, mittens, upstairs, behind the suitcases, $10', ['Sam'])).toEqual({
      recipientName: 'Sam', occasion: 'Birthdays', item: 'mittens', storageLocation: 'upstairs, behind the suitcases', price: 10,
    })
  })

  for (const location of ['second shelf', 'closet', 'bin', 'gift room', 'drawer', 'attic', 'basement', 'garage', 'box', 'tub', 'cabinet']) {
    it(`finds an inline ${location} location`, () => {
      const parsed = parseGiftInput(`Sam Christmas puzzle in the ${location} twenty dollars`)
      expect(parsed.item).toBe('puzzle')
      expect(parsed.storageLocation).toBe(`the ${location}`)
    })
  }

  it('finds an inline location under the bed', () => {
    expect(parseGiftInput('Lee birthday game under the bed $15').storageLocation).toBe('under the bed')
  })

  it('does not mistake a model number for a price', () => {
    expect(parseGiftInput('Sam birthday, PlayStation 5')).toEqual({
      recipientName: 'Sam', occasion: 'Birthdays', item: 'PlayStation 5', storageLocation: '', price: null,
    })
  })

  it('handles empty, incomplete, and oversized prices', () => {
    expect(parseGiftInput(' ; , ')).toEqual({ recipientName: '', occasion: 'Other', item: '', storageLocation: '', price: null })
    expect(parseGiftInput('Cozy scarf, blue box').recipientName).toBe('')
    expect(parseGiftInput('Cozy scarf, blue box').item).toBe('Cozy scarf')
    expect(parseGiftInput('Sam Xmas, coat, $' + '9'.repeat(350)).price).toBeNull()
    expect(parseGiftInput('Sam Xmas, coat, many dollars').price).toBeNull()
  })
})
