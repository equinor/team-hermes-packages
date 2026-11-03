import { describe, expect, it } from 'vite-plus/test'
import { findBounds } from './find-bounds'

describe('findBounds', () => {
  it('should return valid bounds for single valid polygon', () => {
    expect(
      findBounds([
        [-1, 0],
        [0, 1],
        [2, 2],
        [1, 0],
        [-1, 0],
      ])
    ).toEqual({
      minLatitude: -1,
      maxLatitude: 2,
      minLongitude: 0,
      maxLongitude: 2,
    })
  })

  it('should return the entire world for a polygon with no points', () => {
    expect(findBounds([])).toEqual({
      minLatitude: -90,
      maxLatitude: 90,
      minLongitude: -180,
      maxLongitude: 180,
    })
  })

  it('should return valid bounds for polygon outside typical bounds', () => {
    expect(
      findBounds([
        [100, 100],
        [100, 101],
        [101, 101],
        [101, 100],
        [100, 100],
      ])
    ).toEqual({
      minLatitude: 90,
      maxLatitude: 101,
      minLongitude: 100,
      maxLongitude: 101,
    })
  })

  it('should create minimum bounds around a single point', () => {
    expect(findBounds([[10, 20]])).toEqual({
      minLatitude: 9.75,
      maxLatitude: 10.25,
      minLongitude: 19.75,
      maxLongitude: 20.25,
    })
  })

  it('should expand only bounds narrower than the minimum difference', () => {
    expect(
      findBounds([
        [0, 0],
        [0.25, 1],
      ])
    ).toEqual({
      minLatitude: -0.125,
      maxLatitude: 0.375,
      minLongitude: 0,
      maxLongitude: 1,
    })
  })

  it('should preserve bounds at the minimum difference', () => {
    expect(
      findBounds([
        [0, 0],
        [0.5, 0.5],
      ])
    ).toEqual({
      minLatitude: 0,
      maxLatitude: 0.5,
      minLongitude: 0,
      maxLongitude: 0.5,
    })
  })
})
