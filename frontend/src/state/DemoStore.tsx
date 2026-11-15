import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { ROOMS, type RoomInfo } from '@/data/rooms'
import { ApiError, getHealth, getSchema, postPredict } from '@/lib/api'
import { parseHistoricalCsv } from '@/lib/csv'
import { freshnessFor, indicatorsFrom, priorityFor, type Freshness, type Indicators, type Priority } from '@/lib/safety'
import type { SensorSchema } from '@/lib/schema'
import { OFFLINE_FALLBACK_SCHEMA, TOTAL_STEPS, simulateEstimate } from '@/lib/simulation'
import type { Estimate, EventKey, EventType, InspectionRecord, InspectionStatus, Reading, RoomSeries } from '@/lib/types'
import { localId } from '@/lib/utils'
import { validateSensors, type SensorIssue } from '@/lib/validation'
import { createInitialState, demoReducer, type DemoState } from './reducer'

export type Mode = 'api' | 'offline'

export interface RoomView {
  room: RoomInfo
  series: RoomSeries
  latestReading: Reading | null
  freshness: Freshness
  ageSeconds: number | null
  estimate: Estimate | null
  estimateFreshness: Freshness
  estimateAgeSeconds: number | null
  estimatePending: boolean
  estimateError: string | null
  validationIssues: SensorIssue[] | null
  inspection: InspectionStatus
  lastRecord: InspectionRecord | null
  priority: Priority
  indicators: Indicators
}

interface DemoContextValue {
  state: DemoState
  mode: Mode
  schema: SensorSchema
  rooms: RoomView[]
  checkConnection: () => Promise<void>
  setForceSimulation: (v: boolean) => void
  setStep: (step: number) => void
  stepBy: (delta: number) => void
  setPlaying: (v: boolean) => void
  setSpeed: (s: 1 | 2 | 4) => void
  startDrill: () => void
  endDrill: () => void
  recordInspection: (input: { roomId: string; actor: string; status: InspectionStatus; comment: string }) => InspectionRecord
  retryPrediction: (roomId: string) => void
  loadCsv: (file: File, roomId: string, startRow: number) => Promise<{ rowsUsed: number; labelColumn: string | null }>
  clearCsv: () => void
  reset: () => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

const now = () => new Date().toISOString()

function latestReadingAtOrBefore(series: RoomSeries, step: number): Reading | null {
  for (let i = Math.min(step, series.readings.length - 1); i >= 0; i--) {
    const r = series.readings[i]
    if (r) return r
  }
  return null
}

function estimateKey(version: number, roomId: string, readingStep: number) {
  return `v${version}:${roomId}:${readingStep}`
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, createInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const mode: Mode =
    state.connection.status === 'online' && state.connection.schema && !state.forceSimulation ? 'api' : 'offline'
  const schema: SensorSchema = mode === 'api' && state.connection.schema ? state.connection.schema : OFFLINE_FALLBACK_SCHEMA

  const log = useCallback(
    (type: EventType, key: EventKey, extra: { params?: Record<string, string | number>; roomId?: string } = {}) => {
      dispatch({
        type: 'LOG',
        event: { id: localId('evt'), at: now(), replayStep: stateRef.current.replay.step, type, key, ...extra },
      })
    },
    [],
  )

  // ---- Connection --------------------------------------------------------
  const checkingRef = useRef(false)
  /**
   * Probe /health then /schema. `silent` checks (background reconnect, or after a failed
   * prediction) skip the "checking…" state and only log real transitions.
   */
  const probe = useCallback(
    async (silent: boolean) => {
      const wasOnline = stateRef.current.connection.status === 'online'
      const goOffline = (error: string, key: EventKey) => {
        dispatch({ type: 'CONNECTION_RESULT', status: 'offline', error, schema: null, at: now() })
        if (!silent || wasOnline) log('connection', key)
      }
      if (!silent) dispatch({ type: 'CONNECTION_CHECKING' })
      try {
        const health = await getHealth()
        if (!health.modelLoaded) {
          // API is up but the model is not: never pretend predictions exist.
          goOffline(`Model unavailable on server${health.detail ? `: ${health.detail}` : ''}`, 'apiOffline')
          return
        }
      } catch (e) {
        goOffline(e instanceof Error ? e.message : String(e), 'apiOffline')
        return
      }
      try {
        const sch = await getSchema()
        dispatch({ type: 'CONNECTION_RESULT', status: 'online', error: null, schema: sch, at: now() })
        if (!wasOnline) log('connection', 'apiOnline', { params: { count: sch.features.length } })
      } catch (e) {
        // Without a valid schema we refuse to send predictions: fall back to clearly labeled simulation.
        goOffline(`/schema: ${e instanceof ApiError ? e.message : String(e)}`, 'schemaError')
      }
    },
    [log],
  )

  /**
   * Probe /health then /schema. `silent` checks (background reconnect, or after a failed
   * prediction) skip the "checking…" state and only log real transitions.
   */
  const checkConnection = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        await probe(!!opts.silent)
      } finally {
        checkingRef.current = false
      }
    },
    [probe],
  )

  const checkConnectionRef = useRef(checkConnection)
  checkConnectionRef.current = checkConnection

  useEffect(() => {
    void checkConnection()
  }, [checkConnection])

  // Background reconnect: while the API is unreachable (and the user has not chosen the simulator),
  // re-probe every 15 s so the dashboard switches back to real model output when the API returns.
  useEffect(() => {
    if (state.connection.status !== 'offline' || state.forceSimulation) return
    const id = window.setInterval(() => void checkConnection({ silent: true }), 15000)
    return () => window.clearInterval(id)
  }, [state.connection.status, state.forceSimulation, checkConnection])

  // ---- Playback ----------------------------------------------------------
  useEffect(() => {
    if (!state.replay.playing) return
    const id = window.setInterval(() => {
      const s = stateRef.current.replay.step
      if (s >= TOTAL_STEPS - 1) dispatch({ type: 'SET_PLAYING', playing: false })
      else dispatch({ type: 'SET_STEP', step: s + 1 })
    }, 1000 / state.replay.speed)
    return () => window.clearInterval(id)
  }, [state.replay.playing, state.replay.speed])

  // ---- API predictions ---------------------------------------------------
  const requestPrediction = useCallback(
    async (roomId: string, reading: Reading, source: RoomSeries['source'], version: number, sch: SensorSchema) => {
      const key = estimateKey(version, roomId, reading.step)
      const v = validateSensors(sch, reading.sensors)
      if (!v.ok) return
      dispatch({ type: 'PREDICT_PENDING', key })
      try {
        const { response } = await postPredict({ room_id: roomId, source, sensors: v.sensors })
        dispatch({
          type: 'ESTIMATE_RECEIVED',
          key,
          estimate: {
            roomId,
            readingStep: reading.step,
            readingTimestamp: reading.timestamp,
            source,
            origin: 'api_model',
            estimatedOccupancy: response.estimated_occupancy,
            estimatedOccupied: response.estimated_occupied,
            scores: response.class_probabilities,
            note: response.note,
            receivedAt: now(),
          },
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        dispatch({ type: 'PREDICT_ERROR', key, error: msg })
        log('model', 'predictError', { roomId })
        // Lost the API or the model mid-session → re-probe so the offline banner (with Retry) appears.
        if (e instanceof ApiError && (e.kind === 'network' || e.kind === 'timeout' || e.status === 503)) {
          void checkConnectionRef.current({ silent: true })
        }
      }
    },
    [log],
  )

  useEffect(() => {
    if (mode !== 'api') return
    const sch = state.connection.schema
    if (!sch) return
    for (const room of ROOMS) {
      const series = state.series[room.id]
      const reading = latestReadingAtOrBefore(series, state.replay.step)
      if (!reading) continue
      const key = estimateKey(state.seriesVersion, room.id, reading.step)
      if (state.apiEstimates[key] || state.pending[key] || state.apiErrors[key]) continue
      void requestPrediction(room.id, reading, series.source, state.seriesVersion, sch)
    }
  }, [mode, state.replay.step, state.series, state.seriesVersion, state.connection.schema, state.apiEstimates, state.pending, state.apiErrors, requestPrediction])

  const retryPrediction = useCallback(
    (roomId: string) => {
      const s = stateRef.current
      const reading = latestReadingAtOrBefore(s.series[roomId], s.replay.step)
      if (!reading) return
      // Clearing the error lets the prediction effect issue the request again.
      dispatch({ type: 'CLEAR_PREDICT_ERROR', key: estimateKey(s.seriesVersion, roomId, reading.step) })
    },
    [],
  )

  // ---- Room views (derived) ---------------------------------------------
  const rooms: RoomView[] = useMemo(() => {
    const step = state.replay.step
    return ROOMS.map((room) => {
      const series = state.series[room.id]
      const latestReading = latestReadingAtOrBefore(series, step)
      const fr = freshnessFor(latestReading?.step ?? null, step)
      let estimate: Estimate | null = null
      let estimatePending = false
      let estimateError: string | null = null
      let validationIssues: SensorIssue[] | null = null

      if (latestReading) {
        if (mode === 'offline') {
          const sim = simulateEstimate(latestReading.sensors)
          estimate = {
            roomId: room.id,
            readingStep: latestReading.step,
            readingTimestamp: latestReading.timestamp,
            source: series.source,
            origin: 'offline_simulator',
            estimatedOccupancy: sim.cls,
            estimatedOccupied: sim.cls > 0,
            scores: sim.scores,
            note: '',
            receivedAt: '',
          }
        } else {
          const v = validateSensors(schema, latestReading.sensors)
          if (!v.ok) validationIssues = v.issues
          const key = estimateKey(state.seriesVersion, room.id, latestReading.step)
          estimatePending = !!state.pending[key]
          estimateError = state.apiErrors[key] ?? null
          // Show the newest estimate available (its own age is always displayed).
          for (let i = latestReading.step; i >= 0 && !estimate; i--) {
            estimate = state.apiEstimates[estimateKey(state.seriesVersion, room.id, i)] ?? null
          }
        }
      }
      const efr = freshnessFor(estimate?.readingStep ?? null, step)
      const inspection = state.inspections[room.id] ?? 'unknown'
      const indicators = indicatorsFrom(fr.state === 'current' ? latestReading?.sensors ?? null : null)
      return {
        room,
        series,
        latestReading,
        freshness: fr.state,
        ageSeconds: fr.ageSeconds,
        estimate,
        estimateFreshness: efr.state,
        estimateAgeSeconds: efr.ageSeconds,
        estimatePending,
        estimateError,
        validationIssues,
        inspection,
        lastRecord: state.audit.find((a) => a.roomId === room.id) ?? null,
        priority: priorityFor({
          inspection,
          freshness: fr.state,
          estimate: efr.state === 'current' ? estimate?.estimatedOccupancy ?? null : null,
          indicators,
        }),
        indicators,
      }
    })
  }, [state, mode, schema])

  // ---- Sensor freshness transitions → event log ---------------------------
  const lastFreshness = useRef<Record<string, Freshness>>({})
  useEffect(() => {
    for (const r of rooms) {
      const prev = lastFreshness.current[r.room.id]
      if (prev === r.freshness) continue
      if (r.freshness === 'stale') log('sensor', 'sensorStale', { roomId: r.room.id })
      else if (r.freshness === 'unavailable' && prev === undefined) log('sensor', 'sensorUnavailable', { roomId: r.room.id })
      else if (r.freshness === 'current' && prev === 'stale') log('sensor', 'sensorRecovered', { roomId: r.room.id })
      lastFreshness.current[r.room.id] = r.freshness
    }
  }, [rooms, log])

  // ---- Actions -----------------------------------------------------------
  const value: DemoContextValue = {
    state,
    mode,
    schema,
    rooms,
    checkConnection,
    setForceSimulation: (v) => {
      dispatch({ type: 'SET_FORCE_SIMULATION', value: v })
      log('connection', v ? 'forceSimOn' : 'forceSimOff')
    },
    setStep: (step) => dispatch({ type: 'SET_STEP', step }),
    stepBy: (d) => dispatch({ type: 'SET_STEP', step: stateRef.current.replay.step + d }),
    setPlaying: (v) => dispatch({ type: 'SET_PLAYING', playing: v }),
    setSpeed: (s) => dispatch({ type: 'SET_SPEED', speed: s }),
    startDrill: () => {
      dispatch({ type: 'DRILL_START', at: now() })
      log('drill', 'drillStarted')
    },
    endDrill: () => {
      dispatch({ type: 'DRILL_END', at: now() })
      log('drill', 'drillEnded')
    },
    recordInspection: ({ roomId, actor, status, comment }) => {
      const s = stateRef.current
      const record: InspectionRecord = {
        id: localId('chk'),
        roomId,
        actor: actor.trim(),
        status,
        previousStatus: s.inspections[roomId] ?? 'unknown',
        comment: comment.trim(),
        recordedAt: now(),
        replayStep: s.replay.step,
        drillActive: s.drill.active,
      }
      dispatch({ type: 'RECORD_INSPECTION', record })
      log('inspection', 'inspection', { roomId, params: { actor: record.actor, status, previous: record.previousStatus } })
      return record
    },
    retryPrediction,
    loadCsv: async (file, roomId, startRow) => {
      const text = await file.text()
      const res = parseHistoricalCsv(text, schema, startRow, TOTAL_STEPS)
      dispatch({
        type: 'LOAD_CSV',
        readings: res.readings,
        info: {
          fileName: file.name,
          roomId,
          startRow,
          rowsUsed: res.readings.length,
          totalRows: res.totalRows,
          labelColumn: res.labelColumn,
        },
      })
      lastFreshness.current = {}
      log('replay', 'csvLoaded', { roomId, params: { file: file.name, rows: res.readings.length } })
      return { rowsUsed: res.readings.length, labelColumn: res.labelColumn }
    },
    clearCsv: () => {
      dispatch({ type: 'CLEAR_CSV' })
      lastFreshness.current = {}
      log('replay', 'csvCleared')
    },
    reset: () => {
      lastFreshness.current = {}
      dispatch({ type: 'RESET', event: { id: localId('evt'), at: now(), replayStep: 0, type: 'drill', key: 'reset' } })
    },
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used within DemoProvider')
  return ctx
}
