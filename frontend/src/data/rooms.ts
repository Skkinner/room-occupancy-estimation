/**
 * FICTIONAL DEMO ROOMS. This is not a real building, floor plan, or room inventory.
 * The underlying dataset was recorded in ONE room; these rooms exist only to tell a drill story.
 */
export type RoomId = 'A101' | 'A102' | 'A103' | 'A104' | 'A105' | 'A106'

export interface RoomInfo {
  id: RoomId
  floor: number
  /** i18n key suffix under `rooms.` */
  key: 'lecture' | 'seminar' | 'storage' | 'lab' | 'office' | 'study'
  capacity: number
  /** Schematic position on the fictional plan (SVG units, 1000×560 canvas). */
  plan: { x: number; y: number; w: number; h: number }
}

export const ROOMS: RoomInfo[] = [
  { id: 'A101', floor: 1, key: 'lecture', capacity: 60, plan: { x: 40, y: 40, w: 300, h: 200 } },
  { id: 'A102', floor: 1, key: 'seminar', capacity: 20, plan: { x: 350, y: 40, w: 300, h: 200 } },
  { id: 'A103', floor: 1, key: 'storage', capacity: 2, plan: { x: 660, y: 40, w: 300, h: 200 } },
  { id: 'A104', floor: 1, key: 'lab', capacity: 30, plan: { x: 40, y: 320, w: 300, h: 200 } },
  { id: 'A105', floor: 1, key: 'office', capacity: 4, plan: { x: 350, y: 320, w: 300, h: 200 } },
  { id: 'A106', floor: 1, key: 'study', capacity: 6, plan: { x: 660, y: 320, w: 300, h: 200 } },
]

export const FLOORS = [1, 2] as const

export function getRoom(id: string | undefined): RoomInfo | undefined {
  return ROOMS.find((r) => r.id === id)
}
