/**
 * Safety rules for the demo. These are deliberately conservative:
 *  - An ML estimate never sets or changes the manual inspection state.
 *  - No status derived from sensors or the model is ever "clear", "safe" or "evacuated".
 *  - Old readings are always flagged as stale; missing readings as unavailable.
 */
import type { InspectionStatus, OccupancyClass } from './types'

/** Nominal interval between replay steps (the source dataset sampled roughly every 30 s). */
export const STEP_SECONDS = 30
/** A reading older than this (in replay time) is STALE and must not be shown as current. */
export const STALE_AFTER_SECONDS = 90

/** The ONLY safety status the UI ever derives from ML output. */
export const ML_SAFETY_STATUS = 'UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION' as const

export type Freshness = 'current' | 'stale' | 'unavailable'

export function freshnessFor(
  lastReadingStep: number | null,
  currentStep: number,
): { state: Freshness; ageSeconds: number | null } {
  if (lastReadingStep === null || lastReadingStep > currentStep) return { state: 'unavailable', ageSeconds: null }
  const ageSeconds = (currentStep - lastReadingStep) * STEP_SECONDS
  return { state: ageSeconds >= STALE_AFTER_SECONDS ? 'stale' : 'current', ageSeconds }
}

/** Statuses that a (simulated) staff member can record. "Verified/clear/safe" deliberately does not exist. */
export const INSPECTION_STATUSES: InspectionStatus[] = [
  'unknown',
  'in_progress',
  'person_found',
  'inaccessible',
  'no_one_found',
]

/** Every room still needs a physical check unless a (simulated) check found no one. */
export function needsManualVerification(status: InspectionStatus): boolean {
  return status !== 'no_one_found'
}

export interface Indicators {
  pirActive: boolean
  co2Rising: boolean
  co2Slope: number | null
  pirValues: { name: string; value: number }[]
}

export const CO2_RISING_SLOPE = 0.2

/** Simple display indicators read from schema-named features (PIR motion, CO2 slope). */
export function indicatorsFrom(sensors: Record<string, number> | null): Indicators {
  if (!sensors) return { pirActive: false, co2Rising: false, co2Slope: null, pirValues: [] }
  const pirValues = Object.entries(sensors)
    .filter(([k]) => /pir/i.test(k))
    .map(([name, value]) => ({ name, value }))
  const slopeKey = Object.keys(sensors).find((k) => /slope/i.test(k))
  const co2Slope = slopeKey !== undefined ? sensors[slopeKey] : null
  return {
    pirActive: pirValues.some((p) => p.value > 0),
    co2Rising: co2Slope !== null && co2Slope > CO2_RISING_SLOPE,
    co2Slope,
    pirValues,
  }
}

/**
 * Sweep priority. Note there is no "clear" outcome: the lowest priority for a room
 * without a recorded check is still "unconfirmed — physical check required".
 */
export type Priority = 'responders' | 'check_first' | 'no_data' | 'unconfirmed' | 'check_recorded'

export const PRIORITY_RANK: Record<Priority, number> = {
  responders: 0,
  check_first: 1,
  no_data: 2,
  unconfirmed: 3,
  check_recorded: 4,
}

export function priorityFor(input: {
  inspection: InspectionStatus
  freshness: Freshness
  estimate: OccupancyClass | null
  indicators: Indicators
}): Priority {
  const { inspection, freshness, estimate, indicators } = input
  if (inspection === 'person_found' || inspection === 'inaccessible') return 'responders'
  if (inspection === 'no_one_found') return 'check_recorded'
  if (freshness !== 'current') return 'no_data'
  if ((estimate ?? 0) >= 1 || indicators.pirActive || indicators.co2Rising) return 'check_first'
  return 'unconfirmed'
}
