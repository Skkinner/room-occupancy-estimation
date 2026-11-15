/**
 * DETERMINISTIC DEMO SIMULATION — clearly labeled mock data.
 *
 * Nothing here is measured. Readings are generated from a seeded PRNG so every run of the
 * demo looks the same. The offline "estimator" below is a hand-written heuristic, NOT the
 * trained ML model, and the UI always labels it as such.
 */
import { ROOMS, type RoomId } from '@/data/rooms'
import type { SensorSchema } from './schema'
import { STEP_SECONDS } from './safety'
import type { OccupancyClass, Reading, RoomSeries } from './types'

export const TOTAL_STEPS = 60

/** Simulated clock origin (only the time of day is shown, labeled “simulated clock”). */
const SIM_BASE_MS = Date.UTC(2026, 0, 1, 10, 0, 0)

export function simTimestamp(step: number): string {
  return new Date(SIM_BASE_MS + step * STEP_SECONDS * 1000).toISOString()
}

/**
 * Column names used ONLY by the offline simulation (they follow the public UCI
 * “Room Occupancy Estimation” dataset). When the API is online, the app uses
 * GET /schema instead and never relies on this list or its order.
 */
export const OFFLINE_FALLBACK_SCHEMA: SensorSchema = {
  origin: 'offline_fallback',
  warnings: [],
  features: [
    'S1_Temp', 'S2_Temp', 'S3_Temp', 'S4_Temp',
    'S1_Light', 'S2_Light', 'S3_Light', 'S4_Light',
    'S1_Sound', 'S2_Sound', 'S3_Sound', 'S4_Sound',
    'S5_CO2', 'S5_CO2_Slope', 'S6_PIR', 'S7_PIR',
  ].map((name) => ({ name })),
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

interface Scenario {
  seed: number
  /** Scenario occupancy at each step (design label, NOT measured truth). */
  occupancy: (step: number) => OccupancyClass
  moving: (step: number, rng: () => number) => boolean
  lights: (step: number) => [number, number, number, number]
  /** Steps that deliver a reading. */
  hasReading: (step: number) => boolean
  co2Start: number
}

const always = () => true

const SCENARIOS: Record<RoomId, Scenario> = {
  // Booked lecture room: one person sitting still near the front. Motion sensors rarely fire.
  A101: {
    seed: 101,
    occupancy: () => 1,
    moving: (s) => s === 2 || s === 17,
    lights: () => [145, 18, 6, 4],
    hasReading: always,
    co2Start: 425,
  },
  // Seminar: three people, who leave around step 35–40.
  A102: {
    seed: 102,
    occupancy: (s) => (s < 35 ? 3 : s < 38 ? 2 : s < 40 ? 1 : 0),
    moving: (s, rng) => (s < 40 ? rng() < 0.75 : false),
    lights: (s) => (s < 41 ? [320, 290, 260, 240] : [4, 3, 3, 2]),
    hasReading: always,
    co2Start: 690,
  },
  // Storage: empty, lights off.
  A103: {
    seed: 103,
    occupancy: () => 0,
    moving: () => false,
    lights: () => [3, 2, 0, 1],
    hasReading: always,
    co2Start: 402,
  },
  // Computer lab: two people; the sensor feed drops after step 27 (becomes STALE).
  A104: {
    seed: 104,
    occupancy: () => 2,
    moving: (_s, rng) => rng() < 0.45,
    lights: () => [210, 230, 190, 60],
    hasReading: (s) => s <= 27,
    co2Start: 560,
  },
  // Office: no sensor data at all (UNAVAILABLE).
  A105: {
    seed: 105,
    occupancy: () => 0,
    moving: () => false,
    lights: () => [0, 0, 0, 0],
    hasReading: () => false,
    co2Start: 400,
  },
  // Study room: one person moving occasionally, leaves at step 44.
  A106: {
    seed: 106,
    occupancy: (s) => (s < 44 ? 1 : 0),
    moving: (s, rng) => s < 44 && rng() < 0.3,
    lights: (s) => (s < 46 ? [40, 175, 30, 12] : [2, 3, 1, 0]),
    hasReading: always,
    co2Start: 520,
  },
}

function generateSeries(roomId: RoomId): RoomSeries {
  const sc = SCENARIOS[roomId]
  const rng = mulberry32(sc.seed)
  const co2: number[] = []
  let c = sc.co2Start
  const readings: (Reading | null)[] = []
  for (let step = 0; step < TOTAL_STEPS; step++) {
    const n = sc.occupancy(step)
    c = c + 2.4 * n - 0.035 * (c - 400) + (rng() - 0.5) * 2
    co2.push(c)
    const moving = sc.moving(step, rng)
    if (!sc.hasReading(step)) {
      readings.push(null)
      continue
    }
    const back = co2[Math.max(0, step - 4)]
    const slope = (c - back) / Math.max(1, Math.min(step, 4)) / (STEP_SECONDS / 60)
    const lights = sc.lights(step)
    const sensors: Record<string, number> = {}
    ;['S1', 'S2', 'S3', 'S4'].forEach((s, i) => {
      sensors[`${s}_Temp`] = round(24.8 + i * 0.12 + n * 0.18 + (rng() - 0.5) * 0.12)
      sensors[`${s}_Light`] = Math.max(0, Math.round(lights[i] + (lights[i] > 20 ? (rng() - 0.5) * 14 : 0)))
      const talk = n > 0 && moving ? 0.25 + rng() * (0.4 + n * 0.35) : 0
      sensors[`${s}_Sound`] = round(0.06 + rng() * 0.03 + (i === 0 || n > 1 ? talk : talk * 0.3))
    })
    sensors.S5_CO2 = Math.round(c)
    sensors.S5_CO2_Slope = round(slope)
    sensors.S6_PIR = moving && rng() < 0.85 ? 1 : 0
    sensors.S7_PIR = moving && n > 1 && rng() < 0.6 ? 1 : 0
    readings.push({ step, timestamp: simTimestamp(step), sensors, label: n, labelKind: 'scenario_simulated' })
  }
  return { roomId, source: 'simulated', readings }
}

export function generateAllSeries(): Record<string, RoomSeries> {
  const out: Record<string, RoomSeries> = {}
  for (const r of ROOMS) out[r.id] = generateSeries(r.id)
  return out
}

const softmax = (xs: number[]) => {
  const m = Math.max(...xs)
  const e = xs.map((x) => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

const meanOf = (sensors: Record<string, number>, re: RegExp) => {
  const vals = Object.entries(sensors).filter(([k]) => re.test(k)).map(([, v]) => v)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}
const maxOf = (sensors: Record<string, number>, re: RegExp) => {
  const vals = Object.entries(sensors).filter(([k]) => re.test(k)).map(([, v]) => v)
  return vals.length ? Math.max(...vals) : 0
}

/**
 * OFFLINE SIMULATOR — a deterministic heuristic standing in for the API when it is unreachable.
 * It is NOT the trained model and its scores mean nothing beyond this demo. Like the real model,
 * it leans on light/sound/motion and can miss a still person.
 */
export function simulateEstimate(sensors: Record<string, number>): { cls: OccupancyClass; scores: Record<string, number> } {
  const light = meanOf(sensors, /light/i)
  const sound = maxOf(sensors, /sound/i)
  const pir = maxOf(sensors, /pir/i) > 0 ? 1 : 0
  const slope = meanOf(sensors, /slope/i)
  const logits = [
    2.2 - light / 60 - sound * 2 - pir * 2.5 - slope * 0.3,
    0.3 + light / 150 + sound * 0.8 + pir * 1.2 + slope * 0.15,
    -1 + light / 110 + sound * 1.5 + pir * 1.4 + slope * 0.3,
    -2.2 + light / 85 + sound * 2.2 + pir * 1.6 + slope * 0.4,
  ]
  const p = softmax(logits)
  let cls = 0
  p.forEach((v, i) => {
    if (v > p[cls]) cls = i
  })
  return { cls: cls as OccupancyClass, scores: { '0': p[0], '1': p[1], '2': p[2], '3': p[3] } }
}
