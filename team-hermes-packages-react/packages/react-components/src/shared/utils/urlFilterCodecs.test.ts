import { describe, expect, it } from 'vite-plus/test'
import {
  parseRangeFilterString,
  parseTermFilterString,
  serializeRangeFilters,
  serializeTermFilters,
} from './urlFilterCodecs'

describe('term filter codecs', () => {
  it('merges repeated selections for the same key and serializes each key once', () => {
    const filters = parseTermFilterString('analysis_type:RCA|XRD,analysis_type:XRD|SCAL,laboratory:Lab A')
    expect(filters).toEqual({ analysis_type: ['RCA', 'XRD', 'SCAL'], laboratory: ['Lab A'] })
    expect(serializeTermFilters(filters)).toBe('analysis_type:RCA|XRD|SCAL,laboratory:Lab A')
  })

  it('round-trips plural and canonical names as distinct keys', () => {
    const value = 'analysis_types:RCA,analysis_type:XRD,laboratories:Lab A,laboratory:Lab B'
    const filters = parseTermFilterString(value)
    expect(filters).toEqual({
      analysis_types: ['RCA'],
      analysis_type: ['XRD'],
      laboratories: ['Lab A'],
      laboratory: ['Lab B'],
    })
    expect(serializeTermFilters(filters)).toBe(value)
  })

  it('preserves unqualified and qualified term keys without translating between them', () => {
    const filters = parseTermFilterString(
      'analysis_types:old,quality:good,categorical_measurements.analysis_types:a|b'
    )
    expect(filters).toEqual({
      analysis_types: ['old'],
      quality: ['good'],
      'categorical_measurements.analysis_types': ['a', 'b'],
    })
  })

  it('preserves unknown keys, including object prototype names, as own properties', () => {
    const terms = parseTermFilterString('__proto__:safe,constructor:yes,toString:')
    expect(Object.keys(terms)).toEqual(['__proto__', 'constructor', 'toString'])
    expect(terms.__proto__).toEqual(['safe'])
    expect(serializeTermFilters(terms)).toBe('__proto__:safe,constructor:yes,toString:')
  })

  it('retains empty controls and skips malformed entries without discarding valid ones', () => {
    expect(parseTermFilterString('invalid,formation:,:bad,analysis_type:RCA')).toEqual({
      formation: [],
      analysis_type: ['RCA'],
    })
    expect(parseTermFilterString('analysis_types:,analysis_type:,analysis_type:,toString:')).toEqual({
      analysis_types: [],
      analysis_type: [],
      toString: [],
    })
  })

  it('round-trips empty filter state', () => {
    expect(parseTermFilterString('')).toEqual({})
    expect(serializeTermFilters({})).toBe('')
  })
})

describe('range filter codecs', () => {
  it('keeps the last complete range for repeated keys, including open bounds', () => {
    expect(parseRangeFilterString('porosity:0~10,density:1~,porosity:~5')).toEqual({
      porosity: { from: '', to: '5' },
      density: { from: '1', to: '' },
    })
  })

  it('preserves zero when serializing an open range', () => {
    expect(serializeRangeFilters({ porosity: { from: 0 } })).toBe('porosity:0~')
  })

  it('preserves unqualified and qualified ranges independently', () => {
    expect(parseRangeFilterString('pore.size:0~10,numeric_measurements.pore.size:~5')).toEqual({
      'pore.size': { from: '0', to: '10' },
      'numeric_measurements.pore.size': { from: '', to: '5' },
    })
  })

  it('preserves object prototype names as own properties', () => {
    const ranges = parseRangeFilterString('__proto__:0~1,constructor:~2')
    expect(Object.keys(ranges)).toEqual(['__proto__', 'constructor'])
    expect(ranges.__proto__).toEqual({ from: '0', to: '1' })
  })

  it('round-trips date bounds with time components without truncating colons', () => {
    const url = 'analysis_date:2026-09-10T12:30:00Z~now/d,depth_md:0~'
    expect(serializeRangeFilters(parseRangeFilterString(url))).toBe(url)
  })

  it('retains empty controls and skips malformed entries without discarding valid ones', () => {
    expect(parseRangeFilterString('invalid,depth_md:~')).toEqual({ depth_md: { from: '', to: '' } })
  })

  it('round-trips empty filter state', () => {
    expect(parseRangeFilterString('')).toEqual({})
    expect(serializeRangeFilters({})).toBe('')
  })
})
