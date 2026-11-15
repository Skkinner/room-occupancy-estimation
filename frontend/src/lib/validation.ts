import type { SensorSchema } from './schema'
import type { OccupancyClass, PredictResponse } from './types'

export type SensorIssue = { feature: string; reason: 'missing' | 'not_finite' | 'out_of_range' }

export type SensorValidation =
  | { ok: true; sensors: Record<string, number> }
  | { ok: false; issues: SensorIssue[] }

/**
 * Build the sensors payload strictly from the schema's feature names.
 * Extra keys in the reading are dropped; missing or invalid values fail validation.
 */
export function validateSensors(schema: SensorSchema, reading: Record<string, number>): SensorValidation {
  const issues: SensorIssue[] = []
  const sensors: Record<string, number> = {}
  for (const f of schema.features) {
    const v = reading[f.name]
    if (v === undefined || v === null) {
      issues.push({ feature: f.name, reason: 'missing' })
      continue
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      issues.push({ feature: f.name, reason: 'not_finite' })
      continue
    }
    if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
      issues.push({ feature: f.name, reason: 'out_of_range' })
      continue
    }
    sensors[f.name] = v
  }
  return issues.length ? { ok: false, issues } : { ok: true, sensors }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Validate a POST /predict response and normalize it to the UI's internal shape.
 *
 * Accepts the FastAPI backend contract (`estimated_count`, `probabilities`, `safety_notice`,
 * `requires_manual_verification`) and, for compatibility, the earlier draft contract
 * (`estimated_occupancy`, `class_probabilities`, `note`).
 *
 * The safety status is FORCED to UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION regardless of what the
 * server says — nothing from the model can mark a room clear.
 */
export function parsePredictResponse(raw: unknown): { response: PredictResponse; warnings: string[] } {
  if (!isRecord(raw)) throw new Error('Prediction response is not a JSON object.')
  const warnings: string[] = []
  const occ = raw.estimated_count ?? raw.estimated_occupancy
  if (typeof occ !== 'number' || ![0, 1, 2, 3].includes(occ)) {
    throw new Error('estimated_count must be an integer 0–3.')
  }
  const probs = raw.probabilities ?? raw.class_probabilities
  if (!isRecord(probs)) throw new Error('probabilities must be an object.')
  const scores: Record<string, number> = {}
  for (const [k, v] of Object.entries(probs)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`probabilities["${k}"] is not a finite number.`)
    scores[k] = v
  }
  if (raw.safety_status !== undefined && raw.safety_status !== 'UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION') {
    warnings.push('Server returned an unexpected safety_status; the UI keeps the room as Unknown.')
  }
  if (raw.requires_manual_verification !== undefined && raw.requires_manual_verification !== true) {
    warnings.push('Server did not require manual verification; the UI requires it anyway.')
  }
  if (typeof raw.mode !== 'string' || raw.mode.toUpperCase() !== 'RESEARCH_DEMO') {
    warnings.push('Server did not declare research-demo mode.')
  }
  const source = raw.source === 'historical_replay' || raw.source === 'simulated' ? raw.source : 'simulated'
  const note = typeof raw.safety_notice === 'string' ? raw.safety_notice : typeof raw.note === 'string' ? raw.note : ''
  return {
    warnings,
    response: {
      room_id: typeof raw.room_id === 'string' ? raw.room_id : '',
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
      source,
      mode: 'RESEARCH_DEMO',
      estimated_occupancy: occ as OccupancyClass,
      estimated_occupied: typeof raw.estimated_occupied === 'boolean' ? raw.estimated_occupied : occ > 0,
      class_probabilities: scores,
      safety_status: 'UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION',
      note,
      model: typeof raw.model === 'string' ? raw.model : null,
    },
  }
}

const ALIAS_PATTERN = /^[\p{L}\p{N} ._-]{2,40}$/u
export function validateAlias(alias: string): boolean {
  return ALIAS_PATTERN.test(alias.trim())
}
