import { type NextRequest, NextResponse } from 'next/server'
import {
  getCombinedHistoricalAndFutureData,
  computeDynamicPredictions,
  type PredictionScenarioOptions,
  OFFICIAL_DATA_SOURCES,
} from '@/lib/historical-database'

export async function GET() {
  const data = getCombinedHistoricalAndFutureData()
  return NextResponse.json({
    success: true,
    ...data,
    query_timestamp: new Date().toISOString(),
    // Neither Holt-Winters nor XGBoost is a dependency of this project, and the
// series is generated rather than taken from MOIL or IBM publications.
engine: 'nakshatra-synthetic-v1 (seeded generator; illustrative forward trajectory)',
    engine_note:
      'Synthetic series generated to the published ingestion contract. Not MOIL or IBM data, and not a fitted time-series model. The validated forecaster is nakshatra-gbt-cqr-v1, served by /api/v1/mines/{id}/forecast with a published backtest.',
    provenance: {
      primaryCPSE: 'MOIL Limited (Ministry of Steel, Govt of India)',
      statutoryRegistry: 'Indian Bureau of Mines (IBM) Indian Minerals Yearbook',
      nationalPolicy: 'National Steel Policy (NSP 2017 & Vision 2030/2040)',
      geologicalAuthority: 'Geological Survey of India (GSI) Central Region',
      meteorologicalAgency: 'India Meteorological Department (IMD) Pune',
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const scenario: PredictionScenarioOptions['scenario'] = body.scenario || 'baseline'
    const monsoonRiskFactor = Number(body.monsoonRiskFactor) || 1.0
    const aiEfficiencyBoost = body.aiEfficiencyBoost !== false

    const predictions = computeDynamicPredictions({
      scenario,
      monsoonRiskFactor,
      aiEfficiencyBoost,
    })

    return NextResponse.json({
      success: true,
      scenario,
      monsoonRiskFactor,
      aiEfficiencyBoost,
      predictions,
      sources: OFFICIAL_DATA_SOURCES,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to compute dynamic future predictions' },
      { status: 500 }
    )
  }
}
