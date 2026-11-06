import { describe, expect, it } from 'vite-plus/test'

import { backingMapKey } from '@/helpers/backing-map-key'

describe('backingMapKey', () => {
  it('is stable for the same itemId and changes with it', () => {
    expect(backingMapKey({ itemId: 'a' })).toBe(backingMapKey({ itemId: 'a' }))
    expect(backingMapKey({ itemId: 'a' })).not.toBe(backingMapKey({ itemId: 'b' }))
  })

  it('treats a missing itemId and no map as one key', () => {
    expect(backingMapKey({})).toBe(backingMapKey({ itemId: null, map: null }))
  })

  it('is stable for the same map instance and changes with the instance', () => {
    const first = {}
    const second = {}
    expect(backingMapKey({ map: first })).toBe(backingMapKey({ map: first }))
    expect(backingMapKey({ map: first })).not.toBe(backingMapKey({ map: second }))
  })

  it('prefers the map instance over itemId, as <arcgis-map> does', () => {
    const map = {}
    expect(backingMapKey({ map, itemId: 'a' })).toBe(backingMapKey({ map, itemId: 'b' }))
    expect(backingMapKey({ map })).not.toBe(backingMapKey({ itemId: 'a' }))
  })
})
