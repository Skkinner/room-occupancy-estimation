/**
 * Parse a HISTORICAL dataset CSV (e.g. the UCI Room Occupancy Estimation file) into replay readings.
 * Recorded labels found in the file are kept as `dataset_recorded` — the only labels the UI calls
 * "recorded ground truth". Data never leaves the browser.
 */
import type { SensorSchema } from './schema'
import type { OccupancyClass, Reading } from './types'

export interface CsvParseResult {
  readings: Reading[]
  totalRows: number
  labelColumn: string | null
}

function toIsoish(date: string, time: string): string | null {
  const d = date.trim().replace(/\//g, '-')
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d)
  if (!m || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time.trim())) return null
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${time.trim().padStart(8, '0')}Z`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

export function parseHistoricalCsv(text: string, schema: SensorSchema, startRow: number, maxRows: number): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('The CSV file has no data rows.')
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const col = (name: string) => header.indexOf(name)

  const missing = schema.features.map((f) => f.name).filter((n) => col(n) === -1)
  if (missing.length) throw new Error(`CSV is missing required feature columns: ${missing.join(', ')}`)

  const dateCol = header.findIndex((h) => /^date$/i.test(h))
  const timeCol = header.findIndex((h) => /^time$/i.test(h))
  const labelIdx = header.findIndex((h) => /occupancy/i.test(h))
  const labelColumn = labelIdx >= 0 ? header[labelIdx] : null

  const dataLines = lines.slice(1)
  if (startRow < 0 || startRow >= dataLines.length) {
    throw new Error(`Start row must be between 0 and ${dataLines.length - 1}.`)
  }
  const slice = dataLines.slice(startRow, startRow + maxRows)
  const readings: Reading[] = slice.map((line, i) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const sensors: Record<string, number> = {}
    for (const f of schema.features) {
      const v = Number(cells[col(f.name)])
      if (!Number.isFinite(v)) throw new Error(`Row ${startRow + i + 2}: "${f.name}" is not a number.`)
      sensors[f.name] = v
    }
    let label: OccupancyClass | null = null
    if (labelIdx >= 0) {
      const lv = Number(cells[labelIdx])
      if ([0, 1, 2, 3].includes(lv)) label = lv as OccupancyClass
    }
    const ts = dateCol >= 0 && timeCol >= 0 ? toIsoish(cells[dateCol], cells[timeCol]) : null
    return {
      step: i,
      timestamp: ts ?? `row-${startRow + i + 2}`,
      sensors,
      label,
      labelKind: label === null ? null : 'dataset_recorded',
    }
  })
  return { readings, totalRows: dataLines.length, labelColumn }
}
