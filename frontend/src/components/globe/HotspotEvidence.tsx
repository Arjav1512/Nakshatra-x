'use client'

import { useEffect, useState } from 'react'

/**
 * Surface-evidence panel for a mine.
 *
 * WHAT THIS REPLACED
 * ------------------
 * A hardcoded `EVIDENCE_DB` with two entries, presented as satellite evidence:
 *
 *     sceneId: 'S2A_MSIL2A_20260828T050611_N0511_R004_T43QDH_20260828T071533'
 *     sceneId: 'LC08_L2SP_144046_20260827_20260828_02_T1'
 *     ndvi: 0.72, soilMoisture: 42, spectralAnomaly: 0.82,
 *     geologicalSupport: 0.89, drillSupport: 0.91, confidence: 87
 *
 * Those scene identifiers were invented — they look like genuine Copernicus and
 * USGS product IDs but correspond to nothing — and every index beside them was
 * a constant. Any mine other than the two listed silently fell back to
 * Balaghat's row, so the panel showed one mine's "evidence" under another
 * mine's name.
 *
 * It now reads the mine's telemetry, which carries **real** Sentinel-2 scenes
 * from a live STAC query and measured weather. Fields the pipeline does not
 * yet produce — NDVI, soil moisture, spectral anomaly indices — are reported as
 * unavailable rather than filled in. Those arrive with the raster feature
 * pipeline; see docs/TRACK_A.md.
 *
 * Guardrail (PRD §2.2): these are surface and atmospheric observations. They
 * carry no subsurface information.
 */

interface Scene {
  scene_id: string
  satellite?: string
  acquisition_date?: string
  cloud_cover_pct?: number | null
  data_quality?: string
}

interface Telemetry {
  mine?: { name?: string; numericId?: number }
  weather?: {
    rainfall_14d_mm?: number | null
    land_surface_temp_c?: number | null
    soil_moisture_pct?: number | null
    is_live?: boolean
    source?: string
  }
  stacScenes?: Scene[]
  stac_status?: { ok?: boolean; source?: string | null; error?: string | null }
  data_integrity?: { notice?: string }
}

/** The console uses numeric ids; this legacy panel is handed a slug. */
const SLUG_TO_ID: Record<string, number> = {
  balaghat: 1, bharweli: 2, ukwa: 3, tirodi: 4, 'dongri-buzurg': 5,
  chikla: 6, mansar: 7, kandri: 8, gumgaon: 9, beldongri: 10,
}

function Row({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      {value !== null ? (
        <span className="font-mono text-[11px] text-slate-200">{value}</span>
      ) : (
        <span className="font-mono text-[11px] text-slate-500" title={note}>
          unavailable
        </span>
      )}
    </div>
  )
}

export default function HotspotEvidence({ mineId }: { mineId: string }) {
  const [t, setT] = useState<Telemetry | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const id = SLUG_TO_ID[mineId] ?? 1
    setT(null)
    setErr(null)
    fetch(`/api/v1/mines/${id}/telemetry`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => null)
        if (!alive) return
        if (!r.ok) {
          setErr(body?.note || body?.error || `telemetry unavailable (${r.status})`)
          return
        }
        setT(body as Telemetry)
      })
      .catch((e) => alive && setErr(e?.message || 'network error'))
    return () => {
      alive = false
    }
  }, [mineId])

  const name = t?.mine?.name ?? mineId.charAt(0).toUpperCase() + mineId.slice(1).replace('-', ' ')
  const w = t?.weather
  const scenes = t?.stacScenes ?? []

  return (
    <section className="rounded-xl border border-white/10 bg-[#0a0f18]/80 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#E5C76B]">
          Surface evidence · {name}
        </h4>
        {w ? (
          <span
            className={`rounded border px-1.5 py-[1px] font-mono text-[9px] tracking-wider ${
              w.is_live
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
            }`}
          >
            {w.is_live ? 'LIVE' : 'SYNTHETIC'}
          </span>
        ) : null}
      </header>

      {err ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-[11px]">
          <p className="font-semibold text-rose-300">Evidence unavailable</p>
          <p className="mt-1 leading-snug text-slate-400">{err}</p>
        </div>
      ) : !t ? (
        <p className="py-4 text-[11px] text-slate-500">Loading observations…</p>
      ) : (
        <>
          <Row
            label="14-day rainfall"
            value={w?.rainfall_14d_mm != null ? `${w.rainfall_14d_mm} mm` : null}
          />
          <Row
            label="Land surface temp"
            value={w?.land_surface_temp_c != null ? `${w.land_surface_temp_c} °C` : null}
          />
          <Row
            label="Soil moisture"
            value={w?.soil_moisture_pct != null ? `${w.soil_moisture_pct} %` : null}
            note="Not supplied by the active weather source; arrives with the raster pipeline."
          />
          <Row
            label="NDVI / spectral indices"
            value={null}
            note="Requires raster processing of scene assets — see docs/TRACK_A.md."
          />

          <div className="mt-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
              Sentinel-2 scenes {t.stac_status?.ok ? '(live STAC query)' : ''}
            </p>
            {scenes.length ? (
              <ul className="space-y-1">
                {scenes.slice(0, 3).map((s) => (
                  <li key={s.scene_id} className="font-mono text-[10px] leading-snug text-slate-300">
                    {s.scene_id}
                    <span className="text-slate-500">
                      {s.cloud_cover_pct != null ? ` · cloud ${s.cloud_cover_pct}%` : ''}
                      {s.acquisition_date ? ` · ${s.acquisition_date.slice(0, 10)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] leading-snug text-slate-500">
                No scenes returned{t.stac_status?.error ? `: ${t.stac_status.error}` : ''}.
                Identifiers are never fabricated to fill this list.
              </p>
            )}
          </div>

          <p className="mt-3 text-[9px] leading-snug text-slate-500">
            ⛔ Surface and atmospheric observations only. They carry no subsurface information and
            are not evidence of ore at depth (PRD §2.2).
            {w?.source ? ` Source: ${w.source}` : ''}
          </p>
        </>
      )}
    </section>
  )
}
