/** Where a sensor reading came from. Neither is ever a live feed. */
export type DataSource = 'historical_replay' | 'simulated'

/** Who produced an occupancy estimate. */
export type EstimateOrigin = 'api_model' | 'offline_simulator'

export type OccupancyClass = 0 | 1 | 2 | 3

export interface Reading {
  /** Replay step index this reading belongs to. */
  step: number
  /** Timestamp of the reading itself (simulated clock or dataset clock). */
  timestamp: string
  sensors: Record<string, number>
  /** Expected label: scenario design label (simulated) or recorded dataset label (historical). */
  label: OccupancyClass | null
  labelKind: 'scenario_simulated' | 'dataset_recorded' | null
}

export interface RoomSeries {
  roomId: string
  source: DataSource
  /** Indexed by replay step. `null` means no new reading arrived at that step. */
  readings: (Reading | null)[]
}

export interface Estimate {
  roomId: string
  /** Replay step of the reading this estimate was produced from. */
  readingStep: number
  readingTimestamp: string
  source: DataSource
  origin: EstimateOrigin
  estimatedOccupancy: OccupancyClass
  estimatedOccupied: boolean
  /** Per-class scores. UNCALIBRATED — never a validated certainty. */
  scores: Record<string, number>
  note: string
  /** Device wall-clock time the estimate was produced/received. */
  receivedAt: string
}

/** Manual inspection state. Changed ONLY by an explicit (simulated) staff check. */
export type InspectionStatus = 'unknown' | 'in_progress' | 'person_found' | 'inaccessible' | 'no_one_found'

export interface InspectionRecord {
  id: string
  roomId: string
  actor: string
  status: InspectionStatus
  previousStatus: InspectionStatus
  comment: string
  /** Device wall-clock time of the record. */
  recordedAt: string
  /** Replay step at the time of the record. */
  replayStep: number
  drillActive: boolean
}

export type EventType = 'connection' | 'drill' | 'replay' | 'sensor' | 'model' | 'inspection'

export interface LogEvent {
  id: string
  at: string
  replayStep: number | null
  type: EventType
  /** i18n key under `events.` */
  key: EventKey
  params?: Record<string, string | number>
  roomId?: string
}

export type EventKey =
  | 'apiOnline'
  | 'apiOffline'
  | 'schemaError'
  | 'forceSimOn'
  | 'forceSimOff'
  | 'drillStarted'
  | 'drillEnded'
  | 'reset'
  | 'csvLoaded'
  | 'csvCleared'
  | 'sensorStale'
  | 'sensorRecovered'
  | 'sensorUnavailable'
  | 'predictError'
  | 'inspection'

export interface PredictRequest {
  room_id: string
  source: DataSource
  sensors: Record<string, number>
}

/** Internal, normalized prediction result (see parsePredictResponse for the wire formats). */
export interface PredictResponse {
  model: string | null
  room_id: string
  timestamp: string
  source: DataSource
  mode: 'RESEARCH_DEMO'
  estimated_occupancy: OccupancyClass
  estimated_occupied: boolean
  class_probabilities: Record<string, number>
  safety_status: 'UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION'
  note: string
}
