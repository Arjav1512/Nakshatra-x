import { NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Track A validation metrics proxy (PRD A-8, D-7).
 *
 * This route previously read a local JSON file and, when it was missing,
 * returned a hardcoded fallback: `accuracy: 0.9512, roc_auc: 0.8875` with
 * `dist_to_fault_km` as the top feature. Those were the leaked pipeline's
 * numbers — the very figures Phase 5 invalidated — and they were served as
 * though measured.
 *
 * It now proxies the real endpoint, which returns leave-one-mine-out AUC with
 * its confidence interval and the feature ablation. When the service layer is
 * unreachable, no metric is returned at all.
 */
export async function GET() {
  const r = await fetchFromBackend('/api/v1/prospectivity/metrics', { timeoutMs: 30000 })
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  return NextResponse.json(
    {
      error: 'Model metrics unavailable',
      detail: r.error,
      note: 'No accuracy figure is returned. The previous hardcoded fallback reported metrics from a pipeline invalidated by target leakage.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
