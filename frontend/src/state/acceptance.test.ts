/**
 * Automated checks for the demo's safety acceptance criteria (pure logic, no DOM).
 * UI-level criteria are covered by the manual checklist in README.md.
 */
import { describe, expect, it } from 'vitest'
import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'
import { parseHistoricalCsv } from '@/lib/csv'
import { freshnessFor, indicatorsFrom, priorityFor, needsManualVerification, STALE_AFTER_SECONDS, STEP_SECONDS } from '@/lib/safety'
import { parseSchema } from '@/lib/schema'
import { OFFLINE_FALLBACK_SCHEMA, TOTAL_STEPS, generateAllSeries, simulateEstimate } from '@/lib/simulation'
import type { Estimate } from '@/lib/types'
import { parsePredictResponse, validateSensors } from '@/lib/validation'
import { createInitialState, demoReducer } from './reducer'

const zeroEstimate = (roomId: string): Estimate => ({
  roomId,
  readingStep: 0,
  readingTimestamp: '2026-01-01T10:00:00Z',
  source: 'simulated',
  origin: 'api_model',
  estimatedOccupancy: 0,
  estimatedOccupied: false,
  scores: { '0': 0.97, '1': 0.01, '2': 0.01, '3': 0.01 },
  note: '',
  receivedAt: new Date().toISOString(),
})

describe('zero ML prediction never verifies a room', () => {
  it('ESTIMATE_RECEIVED with 0 leaves every inspection status unchanged', () => {
    const s0 = createInitialState()
    let s = s0
    for (const id of Object.keys(s0.inspections)) {
      s = demoReducer(s, { type: 'ESTIMATE_RECEIVED', key: `v0:${id}:0`, estimate: zeroEstimate(id) })
    }
    expect(s.inspections).toEqual(s0.inspections)
    expect(Object.values(s.inspections).every((v) => v === 'unknown')).toBe(true)
    expect(s.audit).toHaveLength(0)
  })

  it('a zero estimate never yields a "recorded check" priority', () => {
    const p = priorityFor({ inspection: 'unknown', freshness: 'current', estimate: 0, indicators: indicatorsFrom({}) })
    expect(p).toBe('unconfirmed')
    expect(needsManualVerification('unknown')).toBe(true)
  })

  it('server cannot override the safety status', () => {
    const { response, warnings } = parsePredictResponse({
      room_id: 'A101',
      estimated_occupancy: 0,
      class_probabilities: { '0': 1 },
      safety_status: 'CLEAR',
      mode: 'RESEARCH_DEMO',
      source: 'simulated',
    })
    expect(response.safety_status).toBe('UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('parses the FastAPI backend contract and keeps the room Unknown', () => {
    const { response, warnings } = parsePredictResponse({
      estimated_count: 1,
      estimated_occupied: true,
      probabilities: { '0': 0.0037, '1': 0.9957, '2': 0.0006, '3': 0 },
      model: 'Logistic Regression',
      mode: 'research_demo',
      requires_manual_verification: true,
      safety_status: 'UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION',
      safety_notice: 'AI predictions cannot establish that a room is empty or safe.',
    })
    expect(warnings).toEqual([])
    expect(response).toMatchObject({
      estimated_occupancy: 1,
      class_probabilities: { '1': 0.9957 },
      safety_status: 'UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION',
      model: 'Logistic Regression',
    })
  })

  it('rejects malformed predictions instead of inventing one', () => {
    expect(() => parsePredictResponse({ detail: 'Model unavailable. No prediction was made.' })).toThrow()
    expect(() => parsePredictResponse({ estimated_count: 7, probabilities: {} })).toThrow()
    expect(() => parsePredictResponse({ estimated_count: 1, probabilities: { '1': 'high' } })).toThrow()
  })

  it('warns when a server omits the manual-verification requirement', () => {
    const { warnings } = parsePredictResponse({
      estimated_count: 0,
      probabilities: { '0': 1 },
      mode: 'research_demo',
      requires_manual_verification: false,
    })
    expect(warnings.join(' ')).toMatch(/manual verification/)
  })

  it('no dictionary marks ML output as clear/safe/evacuated', () => {
    const banned = /\b(clear|safe|evacuated)\b/i
    for (const v of Object.values(en.inspection)) expect(v).not.toMatch(/^(clear|safe|evacuated)/i)
    for (const v of Object.values(en.priority)) expect(v).not.toMatch(banned)
  })
})

describe('manual check creates an audit entry', () => {
  it('RECORD_INSPECTION updates status and prepends to the audit trail', () => {
    const s = demoReducer(createInitialState(), {
      type: 'RECORD_INSPECTION',
      record: {
        id: 'chk-1',
        roomId: 'A103',
        actor: 'Warden 7',
        status: 'no_one_found',
        previousStatus: 'unknown',
        comment: 'checked',
        recordedAt: new Date().toISOString(),
        replayStep: 5,
        drillActive: true,
      },
    })
    expect(s.inspections.A103).toBe('no_one_found')
    expect(s.audit[0]).toMatchObject({ roomId: 'A103', actor: 'Warden 7', previousStatus: 'unknown' })
  })
})

describe('stale readings cannot appear current', () => {
  it('flags readings older than the threshold', () => {
    const steps = STALE_AFTER_SECONDS / STEP_SECONDS
    expect(freshnessFor(10, 10).state).toBe('current')
    expect(freshnessFor(10, 10 + steps).state).toBe('stale')
    expect(freshnessFor(null, 10).state).toBe('unavailable')
  })
  it('stale data forces the "no current data" priority even with a positive estimate', () => {
    expect(
      priorityFor({ inspection: 'unknown', freshness: 'stale', estimate: 3, indicators: indicatorsFrom({ S6_PIR: 1 }) }),
    ).toBe('no_data')
  })
  it('the A104 scenario goes stale and A105 is unavailable', () => {
    const series = generateAllSeries()
    const lastA104 = series.A104.readings.reduce<number | null>((acc, r, i) => (r ? i : acc), null)
    expect(freshnessFor(lastA104, TOTAL_STEPS - 1).state).toBe('stale')
    expect(series.A105.readings.every((r) => r === null)).toBe(true)
  })
})

describe('replay and labels', () => {
  it('built-in data is labeled simulated, never historical or real-time', () => {
    const series = generateAllSeries()
    for (const s of Object.values(series)) {
      expect(s.source).toBe('simulated')
      for (const r of s.readings) if (r) expect(r.labelKind).toBe('scenario_simulated')
    }
  })
  it('CSV rows become dataset-recorded labels only when present in the file', () => {
    const names = OFFLINE_FALLBACK_SCHEMA.features.map((f) => f.name)
    const header = ['Date', 'Time', ...names, 'Room_Occupancy_Count'].join(',')
    const row = ['2017/12/22', '10:49:41', ...names.map(() => '1'), '2'].join(',')
    const res = parseHistoricalCsv(`${header}\n${row}\n`, OFFLINE_FALLBACK_SCHEMA, 0, 10)
    expect(res.readings[0]).toMatchObject({ label: 2, labelKind: 'dataset_recorded', timestamp: '2017-12-22T10:49:41Z' })
  })
  it('A101 demonstrates the miss: simulator says 0, scenario label 1, CO2 rising', () => {
    const r = generateAllSeries().A101.readings[20]!
    expect(simulateEstimate(r.sensors).cls).toBe(0)
    expect(r.label).toBe(1)
    expect(indicatorsFrom(r.sensors).co2Rising).toBe(true)
  })
  it('simulator scores are normalized and deterministic', () => {
    const r = generateAllSeries().A102.readings[5]!
    const a = simulateEstimate(r.sensors)
    const b = simulateEstimate(r.sensors)
    expect(a).toEqual(b)
    expect(Object.values(a.scores).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 6)
  })
})

describe('schema discovery and validation', () => {
  it('reads feature names in server order from several shapes', () => {
    expect(parseSchema({ features: ['b', 'a'] }).features.map((f) => f.name)).toEqual(['b', 'a'])
    expect(parseSchema({ feature_names: ['x'] }).features[0].name).toBe('x')
    expect(parseSchema([{ name: 'y', min: 0, max: 1 }]).features[0]).toMatchObject({ name: 'y', min: 0, max: 1 })
    expect(() => parseSchema({ nothing: true })).toThrow()
  })
  it('rejects missing or out-of-range sensor values', () => {
    const schema = parseSchema([{ name: 'a', min: 0, max: 1 }, { name: 'b' }])
    const v = validateSensors(schema, { a: 5 })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.issues.map((i) => i.reason).sort()).toEqual(['missing', 'out_of_range'])
  })
})

describe('i18n', () => {
  it('Arabic dictionary has exactly the same keys as English', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${p}${k}`] : keys(v, `${p}${k}.`)))
    expect(keys(ar).sort()).toEqual(keys(en).sort())
  })
  it('uncalibrated wording is present for model scores', () => {
    expect(en.room.scoresTitle.toLowerCase()).toContain('uncalibrated')
    expect(en.room.scoresNote).toContain('NOT calibrated')
  })
})
