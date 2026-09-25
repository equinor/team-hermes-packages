import type { ColumnDef } from '@tanstack/react-table'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { AttributeType, FilterOperator } from '@/shared/types'
import { useFilters } from './useFilters'

const setup = () => renderHook(() => useFilters()).result.current

describe('useFilters', () => {
  describe('createFiltersObjectFromURIString', () => {
    it('returns an empty array for null / empty input', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString(null)).toEqual([])
      expect(createFiltersObjectFromURIString('')).toEqual([])
    })

    it('parses a single column with one operator and one property', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('status*eq*active')).toEqual([
        { id: 'status', value: [{ operator: 'eq', properties: ['active'] }] },
      ])
    })

    it('parses multiple values within a sub-filter (`|`)', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('status*eq*DRAFT|IN_REVIEW')).toEqual([
        { id: 'status', value: [{ operator: 'eq', properties: ['DRAFT', 'IN_REVIEW'] }] },
      ])
    })

    it('parses multiple sub-filters on the same column (`^`)', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('status*eq*DRAFT^ilike*rev')).toEqual([
        {
          id: 'status',
          value: [
            { operator: 'eq', properties: ['DRAFT'] },
            { operator: 'ilike', properties: ['rev'] },
          ],
        },
      ])
    })

    it('parses multiple columns (`~`)', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('status*eq*active~priority*gt*2')).toEqual([
        { id: 'status', value: [{ operator: 'eq', properties: ['active'] }] },
        { id: 'priority', value: [{ operator: 'gt', properties: ['2'] }] },
      ])
    })

    it('trims whitespace around property values', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('status*eq* DRAFT | IN_REVIEW ')).toEqual([
        { id: 'status', value: [{ operator: 'eq', properties: ['DRAFT', 'IN_REVIEW'] }] },
      ])
    })

    it('skips malformed entries instead of throwing', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('foo')).toEqual([])
      expect(createFiltersObjectFromURIString('foo~status*eq*DRAFT~bar*')).toEqual([
        { id: 'status', value: [{ operator: 'eq', properties: ['DRAFT'] }] },
      ])
      expect(createFiltersObjectFromURIString('*eq*DRAFT')).toEqual([])
      expect(createFiltersObjectFromURIString('~~~')).toEqual([])
    })

    it('decodes percent-encoded delimiters inside property values', () => {
      const { createFiltersObjectFromURIString } = setup()

      // %7C = `|`, %7E = `~`, %5E = `^`, %2A = `*`
      expect(createFiltersObjectFromURIString('note*eq*hello%7Cworld')).toEqual([
        { id: 'note', value: [{ operator: 'eq', properties: ['hello|world'] }] },
      ])
      expect(createFiltersObjectFromURIString('note*eq*a%7Eb%5Ec%2Ad')).toEqual([
        { id: 'note', value: [{ operator: 'eq', properties: ['a~b^c*d'] }] },
      ])
    })

    it('leaves invalid percent sequences untouched instead of throwing', () => {
      const { createFiltersObjectFromURIString } = setup()

      expect(createFiltersObjectFromURIString('note*eq*50%off')).toEqual([
        { id: 'note', value: [{ operator: 'eq', properties: ['50%off'] }] },
      ])
    })
  })

  describe('createURIStringFromFiltersObject', () => {
    it('returns an empty string for no filters', () => {
      const { createURIStringFromFiltersObject } = setup()

      expect(createURIStringFromFiltersObject([])).toBe('')
    })

    it('serializes a single column / operator / property', () => {
      const { createURIStringFromFiltersObject } = setup()

      expect(
        createURIStringFromFiltersObject([
          { id: 'status', value: [{ operator: FilterOperator.eq, properties: ['active'] }] },
        ])
      ).toBe('status*eq*active')
    })

    it('joins multiple properties, sub-filters, and columns with the new delimiters', () => {
      const { createURIStringFromFiltersObject } = setup()

      expect(
        createURIStringFromFiltersObject([
          {
            id: 'status',
            value: [
              { operator: FilterOperator.eq, properties: ['DRAFT', 'IN_REVIEW'] },
              { operator: FilterOperator.ilike, properties: ['rev'] },
            ],
          },
          { id: 'priority', value: [{ operator: FilterOperator.gt, properties: [2] }] },
        ])
      ).toBe('status*eq*DRAFT|IN_REVIEW^ilike*rev~priority*gt*2')
    })

    it('skips columns with empty or missing values', () => {
      const { createURIStringFromFiltersObject } = setup()

      expect(
        createURIStringFromFiltersObject([
          { id: 'empty', value: [] },
          { id: 'status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT'] }] },
        ])
      ).toBe('status*eq*DRAFT')
    })

    it('normalizes `null` properties to the literal string "null"', () => {
      const { createURIStringFromFiltersObject } = setup()

      expect(
        createURIStringFromFiltersObject([
          { id: 'reviewer', value: [{ operator: FilterOperator.eq, properties: [null] }] },
        ])
      ).toBe('reviewer*eq*null')
    })

    it('escapes delimiter characters found inside id / operator / properties', () => {
      const { createURIStringFromFiltersObject } = setup()

      expect(
        createURIStringFromFiltersObject([
          { id: 'status', value: [{ operator: FilterOperator.eq, properties: ['a|b', 'c~d', 'e^f', 'g*h', '50%'] }] },
        ])
      ).toBe('status*eq*a%7Cb|c%7Ed|e%5Ef|g%2Ah|50%25')
    })
  })

  describe('roundtrip', () => {
    it('preserves values containing every reserved char', () => {
      const { createURIStringFromFiltersObject, createFiltersObjectFromURIString } = setup()

      const filters = [
        {
          id: 'note',
          value: [{ operator: FilterOperator.eq, properties: ['hello, world; foo+bar', 'a|b^c~d*e%f'] }],
        },
      ]

      const uri = createURIStringFromFiltersObject(filters)
      expect(createFiltersObjectFromURIString(uri)).toEqual(filters)
    })

    it('preserves common text values (commas and semicolons) without percent-encoding', () => {
      const { createURIStringFromFiltersObject, createFiltersObjectFromURIString } = setup()

      const filters = [
        {
          id: 'note',
          value: [{ operator: FilterOperator.ilike, properties: ['Lorem, ipsum; dolor sit'] }],
        },
      ]

      const uri = createURIStringFromFiltersObject(filters)
      expect(uri).toBe('note*ilike*Lorem, ipsum; dolor sit')
      expect(createFiltersObjectFromURIString(uri)).toEqual(filters)
    })
  })

  describe('createRequestString', () => {
    type Row = { status: string; count: number }
    const columns: ColumnDef<Row>[] = [
      { id: 'status', accessorKey: 'status', meta: { dataType: AttributeType.TEXT } },
      { id: 'count', accessorKey: 'count', meta: { dataType: AttributeType.NUMBER } },
    ]

    it('returns undefined when there are no filters', () => {
      const { createRequestString } = setup()

      expect(createRequestString([], columns)).toBeUndefined()
    })

    it('quotes TEXT values and leaves NUMBER values bare', () => {
      const { createRequestString } = setup()

      expect(
        createRequestString(
          [
            { id: 'status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT'] }] },
            { id: 'count', value: [{ operator: FilterOperator.gt, properties: [2] }] },
          ],
          columns
        )
      ).toBe("((status eq 'DRAFT') and (count gt 2))")
    })

    it('joins multiple properties on the same operator with ` or `', () => {
      const { createRequestString } = setup()

      expect(
        createRequestString(
          [{ id: 'status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT', 'IN_REVIEW'] }] }],
          columns
        )
      ).toBe("((status eq 'DRAFT' or status eq 'IN_REVIEW'))")
    })

    it('emits `null` (unquoted) for null-like properties on TEXT columns', () => {
      const { createRequestString } = setup()

      expect(
        createRequestString(
          [{ id: 'status', value: [{ operator: FilterOperator.eq, properties: [null, undefined, 'null'] }] }],
          columns
        )
      ).toBe('((status eq null or status eq undefined or status eq null))')
    })

    it('omits the value for empty-string properties on non-null operators', () => {
      const { createRequestString } = setup()

      expect(
        createRequestString(
          [{ id: 'status', value: [{ operator: FilterOperator.isnull, properties: [''] }] }],
          columns
        )
      ).toBe('((status isnull))')
    })
  })
})
