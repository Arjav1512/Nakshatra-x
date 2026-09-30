import { NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Prospectivity surface proxy.
 *
 * This route used to read `src/data/prospectivity.geojson` off disk and serve
 * it. That file is output from the **superseded** Track A model: 1,326 cells
 * carrying `dist_to_fault_km`, `temp_c` and `rainfall_mm` — two features the
 * honest rebuild dropped because they leaked the labels, and one the model
 * never had. The current model scores 1,710 cells and has none of them.
 *
 * So the map was drawing the old model's surface under the new model's name,
 * and its popups called a committed static file "LIVE ML · Real-Time
 * Telemetry". This now proxies the service layer, which scores the grid with
 * the model that is actually loaded and returns `model_version` and `n_cells`
 * with it.
 */
export async function GET() {
  const r = await fetchFromBackend('/api/v1/prospectivity/grid', { timeoutMs: 30000 })
  if (r.ok) {
    return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  }
  return NextResponse.json(
    {
      error: 'Prospectivity surface unavailable',
      detail: r.error,
      note: r.status
        ? `The FastAPI service layer answered ${r.status}. No surface is drawn, because a surface this route invented would not be the model's.`
        : 'The FastAPI service layer could not be reached. No surface is drawn.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
