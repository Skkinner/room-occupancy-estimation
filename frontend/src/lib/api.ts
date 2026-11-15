import { parseSchema, type SensorSchema } from './schema'
import type { PredictRequest, PredictResponse } from './types'
import { parsePredictResponse } from './validation'

export const API_URL = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000').replace(/\/+$/, '')

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse'

export class ApiError extends Error {
  constructor(
    message: string,
    public kind: ApiErrorKind,
    public status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function requestJson(path: string, init: RequestInit = {}, timeoutMs = 4000): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch (e) {
    if (ctrl.signal.aborted) throw new ApiError(`Request to ${path} timed out after ${timeoutMs} ms.`, 'timeout')
    throw new ApiError(`Could not reach ${API_URL}${path}: ${(e as Error).message}`, 'network')
  } finally {
    clearTimeout(timer)
  }
  let body: unknown = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      if (res.ok) throw new ApiError(`${path} did not return valid JSON.`, 'parse', res.status)
    }
  }
  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body ? JSON.stringify((body as { detail: unknown }).detail) : text.slice(0, 200)
    throw new ApiError(`${path} returned HTTP ${res.status}${detail ? `: ${detail}` : ''}`, 'http', res.status)
  }
  return body
}

export interface HealthInfo {
  modelLoaded: boolean
  detail: string | null
  raw: unknown
}

/**
 * GET /health. The backend answers 200 even when the model failed to load, with
 * `model_loaded: false` — treated as "API reachable but NO predictions available".
 */
export async function getHealth(): Promise<HealthInfo> {
  const raw = await requestJson('/health', {}, 3000)
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const modelLoaded = obj.model_loaded === undefined ? true : obj.model_loaded === true
  return { modelLoaded, detail: typeof obj.detail === 'string' ? obj.detail : null, raw }
}

export async function getSchema(): Promise<SensorSchema> {
  const raw = await requestJson('/schema')
  try {
    return parseSchema(raw)
  } catch (e) {
    throw new ApiError((e as Error).message, 'parse')
  }
}

/**
 * POST /predict. The backend accepts EXACTLY the 16 schema features as a flat JSON object
 * (unknown fields → 422), so room_id and source stay client-side for labeling.
 */
export async function postPredict(req: PredictRequest): Promise<{ response: PredictResponse; warnings: string[] }> {
  const raw = await requestJson('/predict', { method: 'POST', body: JSON.stringify(req.sensors) }, 6000)
  try {
    return parsePredictResponse(raw)
  } catch (e) {
    throw new ApiError((e as Error).message, 'parse')
  }
}
