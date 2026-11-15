export interface FeatureSpec {
  name: string
  min?: number
  max?: number
  description?: string
}

export interface SensorSchema {
  features: FeatureSpec[]
  /** `api` = discovered from GET /schema. `offline_fallback` = demo column names used only in offline simulation. */
  origin: 'api' | 'offline_fallback'
  warnings: string[]
}

const LIST_KEYS = [
  'features',
  'feature_names',
  'feature_order',
  'sensor_names',
  'sensors',
  'columns',
  'fields',
  'required_sensors',
]
const NON_FEATURE_KEYS = new Set(['room_id', 'source', 'timestamp', 'mode'])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function specFromObject(name: string, o: Record<string, unknown>): FeatureSpec {
  return {
    name,
    min: num(o.min) ?? num(o.minimum) ?? num(o.ge),
    max: num(o.max) ?? num(o.maximum) ?? num(o.le),
    description: typeof o.description === 'string' ? o.description : undefined,
  }
}

function fromArray(arr: unknown[]): FeatureSpec[] | null {
  const out: FeatureSpec[] = []
  for (const item of arr) {
    if (typeof item === 'string') out.push({ name: item })
    else if (isRecord(item)) {
      const name = item.name ?? item.feature ?? item.key ?? item.id
      if (typeof name !== 'string') return null
      out.push(specFromObject(name, item))
    } else return null
  }
  return out.length ? out : null
}

function fromMap(map: Record<string, unknown>): FeatureSpec[] | null {
  const out: FeatureSpec[] = []
  for (const [name, v] of Object.entries(map)) {
    if (NON_FEATURE_KEYS.has(name)) continue
    out.push(isRecord(v) ? specFromObject(name, v) : { name })
  }
  return out.length ? out : null
}

/**
 * Discover the exact sensor feature names (and order) from GET /schema.
 * Tolerates several common FastAPI response shapes; never guesses names.
 */
export function parseSchema(raw: unknown): SensorSchema {
  let features: FeatureSpec[] | null = null

  if (Array.isArray(raw)) features = fromArray(raw)
  else if (isRecord(raw)) {
    for (const k of LIST_KEYS) {
      const v = raw[k]
      if (Array.isArray(v)) features = fromArray(v)
      else if (isRecord(v)) features = isRecord(v.properties) ? fromMap(v.properties) : fromMap(v)
      if (features) break
    }
    if (!features && isRecord(raw.properties)) {
      const props = raw.properties
      if (isRecord(props.sensors) && isRecord(props.sensors.properties)) features = fromMap(props.sensors.properties)
      else features = fromMap(props)
    }
  }

  if (!features || features.length === 0) {
    throw new Error('Could not find a list of sensor feature names in the /schema response.')
  }

  const names = features.map((f) => f.name)
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  if (dupes.length) throw new Error(`Duplicate feature names in /schema: ${[...new Set(dupes)].join(', ')}`)

  const warnings: string[] = []
  if (features.length !== 16) warnings.push(`Expected 16 features, /schema returned ${features.length}.`)
  return { features, origin: 'api', warnings }
}

/** Find features by pattern among the schema names (used only for display indicators). */
export function findFeatures(schema: SensorSchema, re: RegExp): string[] {
  return schema.features.map((f) => f.name).filter((n) => re.test(n))
}
