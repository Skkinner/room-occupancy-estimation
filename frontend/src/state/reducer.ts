/**
 * Pure demo-state reducer. All state is CLIENT-LOCAL and EPHEMERAL (lost on reload).
 *
 * Safety invariant (tested in reducer.test.ts): no model/simulator action ever writes to
 * `inspections`. Only RECORD_INSPECTION — an explicit simulated staff action — can.
 */
import { ROOMS } from '@/data/rooms'
import type { SensorSchema } from '@/lib/schema'
import { TOTAL_STEPS, generateAllSeries } from '@/lib/simulation'
import type { Estimate, InspectionRecord, InspectionStatus, LogEvent, Reading, RoomSeries } from '@/lib/types'

export type ConnectionStatus = 'checking' | 'online' | 'offline'

export interface CsvInfo {
  fileName: string
  roomId: string
  startRow: number
  rowsUsed: number
  totalRows: number
  labelColumn: string | null
}

export interface DemoState {
  connection: { status: ConnectionStatus; error: string | null; checkedAt: string | null; schema: SensorSchema | null }
  forceSimulation: boolean
  drill: { active: boolean; startedAt: string | null; startedStep: number | null }
  replay: { step: number; playing: boolean; speed: 1 | 2 | 4 }
  series: Record<string, RoomSeries>
  seriesVersion: number
  csv: CsvInfo | null
  apiEstimates: Record<string, Estimate>
  apiErrors: Record<string, string>
  pending: Record<string, true>
  inspections: Record<string, InspectionStatus>
  audit: InspectionRecord[]
  events: LogEvent[]
}

export type DemoAction =
  | { type: 'CONNECTION_CHECKING' }
  | { type: 'CONNECTION_RESULT'; status: 'online' | 'offline'; error: string | null; schema: SensorSchema | null; at: string }
  | { type: 'SET_FORCE_SIMULATION'; value: boolean }
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_SPEED'; speed: 1 | 2 | 4 }
  | { type: 'DRILL_START'; at: string }
  | { type: 'DRILL_END'; at: string }
  | { type: 'PREDICT_PENDING'; key: string }
  | { type: 'ESTIMATE_RECEIVED'; key: string; estimate: Estimate }
  | { type: 'PREDICT_ERROR'; key: string; error: string }
  | { type: 'CLEAR_PREDICT_ERROR'; key: string }
  | { type: 'RECORD_INSPECTION'; record: InspectionRecord }
  | { type: 'LOAD_CSV'; info: CsvInfo; readings: Reading[] }
  | { type: 'CLEAR_CSV' }
  | { type: 'LOG'; event: LogEvent }
  | { type: 'RESET'; event: LogEvent }

const MAX_EVENTS = 300

function initialInspections(): Record<string, InspectionStatus> {
  return Object.fromEntries(ROOMS.map((r) => [r.id, 'unknown' as InspectionStatus]))
}

export function createInitialState(): DemoState {
  return {
    connection: { status: 'checking', error: null, checkedAt: null, schema: null },
    forceSimulation: false,
    drill: { active: false, startedAt: null, startedStep: null },
    replay: { step: 0, playing: false, speed: 1 },
    series: generateAllSeries(),
    seriesVersion: 0,
    csv: null,
    apiEstimates: {},
    apiErrors: {},
    pending: {},
    inspections: initialInspections(),
    audit: [],
    events: [],
  }
}

const withoutKey = <T,>(obj: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in obj)) return obj
  const next = { ...obj }
  delete next[key]
  return next
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'CONNECTION_CHECKING':
      return { ...state, connection: { ...state.connection, status: 'checking', error: null } }
    case 'CONNECTION_RESULT':
      return {
        ...state,
        connection: { status: action.status, error: action.error, checkedAt: action.at, schema: action.schema },
        // Schema may have changed — drop cached API results.
        apiEstimates: {},
        apiErrors: {},
        pending: {},
      }
    case 'SET_FORCE_SIMULATION':
      return { ...state, forceSimulation: action.value }
    case 'SET_STEP': {
      const step = Math.max(0, Math.min(TOTAL_STEPS - 1, Math.round(action.step)))
      return { ...state, replay: { ...state.replay, step, playing: step >= TOTAL_STEPS - 1 ? false : state.replay.playing } }
    }
    case 'SET_PLAYING':
      return { ...state, replay: { ...state.replay, playing: action.playing && state.replay.step < TOTAL_STEPS - 1 } }
    case 'SET_SPEED':
      return { ...state, replay: { ...state.replay, speed: action.speed } }
    case 'DRILL_START':
      if (state.drill.active) return state
      return { ...state, drill: { active: true, startedAt: action.at, startedStep: state.replay.step } }
    case 'DRILL_END':
      return { ...state, drill: { active: false, startedAt: null, startedStep: null }, replay: { ...state.replay, playing: false } }
    case 'PREDICT_PENDING':
      return { ...state, pending: { ...state.pending, [action.key]: true }, apiErrors: withoutKey(state.apiErrors, action.key) }
    case 'ESTIMATE_RECEIVED':
      // NOTE: intentionally does not touch `inspections`.
      return {
        ...state,
        apiEstimates: { ...state.apiEstimates, [action.key]: action.estimate },
        pending: withoutKey(state.pending, action.key),
      }
    case 'PREDICT_ERROR':
      return { ...state, apiErrors: { ...state.apiErrors, [action.key]: action.error }, pending: withoutKey(state.pending, action.key) }
    case 'CLEAR_PREDICT_ERROR':
      return { ...state, apiErrors: withoutKey(state.apiErrors, action.key) }
    case 'RECORD_INSPECTION':
      return {
        ...state,
        inspections: { ...state.inspections, [action.record.roomId]: action.record.status },
        audit: [action.record, ...state.audit],
      }
    case 'LOAD_CSV': {
      const readings: (Reading | null)[] = Array.from({ length: TOTAL_STEPS }, (_, i) => action.readings[i] ?? null)
      return {
        ...state,
        csv: action.info,
        series: { ...state.series, [action.info.roomId]: { roomId: action.info.roomId, source: 'historical_replay', readings } },
        seriesVersion: state.seriesVersion + 1,
      }
    }
    case 'CLEAR_CSV': {
      if (!state.csv) return state
      const fresh = generateAllSeries()
      return {
        ...state,
        csv: null,
        series: { ...state.series, [state.csv.roomId]: fresh[state.csv.roomId] },
        seriesVersion: state.seriesVersion + 1,
      }
    }
    case 'LOG':
      return { ...state, events: [action.event, ...state.events].slice(0, MAX_EVENTS) }
    case 'RESET':
      return {
        ...state,
        drill: { active: false, startedAt: null, startedStep: null },
        replay: { step: 0, playing: false, speed: state.replay.speed },
        inspections: initialInspections(),
        audit: [],
        events: [action.event],
      }
    default:
      return state
  }
}
