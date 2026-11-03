const mapIds = new WeakMap<object, number>()
let nextMapId = 0

/** Changes whenever `<arcgis-map>` swaps its backing map, which it does without telling React. */
export function backingMapKey({ itemId, map }: { itemId?: string | null; map?: object | null }) {
  if (map) {
    let id = mapIds.get(map)
    if (id === undefined) {
      id = nextMapId++
      mapIds.set(map, id)
    }
    return `map:${id}`
  }
  return `item:${itemId ?? ''}`
}
