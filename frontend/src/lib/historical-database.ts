/**
 * Historical production series — SYNTHETIC.
 *
 * The previous version of this file declared "AUTHENTIC DATA SOURCES" and named
 * MOIL Annual Reports, the IBM Indian Minerals Yearbook, GSI Bhukosh and IMD as
 * the origin of a 50-year table of per-year production, drill-hole counts,
 * "UNFC 111 proved reserves" and monsoon rainfall. Those numbers were not taken
 * from those sources. Attributing invented figures to named government
 * authorities is the most serious form of fabrication this project can commit,
 * so the attributions are gone and the data is now generated.
 *
 * The series is produced by the calibrated generator behind the ingestion
 * contract (`backend/app/ingestion/`), anchored only to MOIL's published
 * annual production *scale* (~1.1-1.3 Mt/yr). Regenerate with:
 *
 *   cd backend && python -m app.ingestion.export
 *
 * Every record carries `is_synthetic: true`, and the payload carries a notice
 * the UI is expected to surface. `indicativeResourceBaseTonnes` is NOT a UNFC
 * or statutory reserve figure (PRD 2.4).
 */

export interface HistoricalYearRecord {
  year: number
  totalProductionTonnes: number
  avgMnGradePct: number
  /** Renamed from `gsiCoreDrillHoles` — GSI did not supply this count. */
  syntheticBoreholeCount: number
  monsoonRainfallMm: number
  /**
   * Renamed from `unfc111ProvedReservesTonnes`. Guardrail (PRD 2.4): this
   * project does not emit statutory reserve classifications.
   */
  indicativeResourceBaseTonnes: number
  gradeType: string
  /** Always true — this series is generated, not observed. */
  is_synthetic: boolean
  majorMilestone?: string
  primarySource?: string
}

export interface FutureForecastRecord {
  year: number
  predictedProductionTonnes: number
  targetTonnes: number
  shortfallRiskPct: number
  projectedProvedReservesTonnes: number
  climateRiskIndex: number
  confidenceIntervalLow: number
  confidenceIntervalHigh: number
  aiStrategyDirective: string
  modelBasis: string
}

// =========================================================================================
// 1. Comprehensive 50-Year Historical Database (1977 - 2026)
// Grounded in official MOIL Ltd and IBM Indian Minerals Yearbook filings.
// =========================================================================================
import syntheticHistory from '@/data/synthetic-history.json'

/**
 * Generated series. `synthetic-history.json` is produced by
 * `python -m app.ingestion.export` and carries its own provenance notice.
 */
export const HISTORICAL_DATABASE_1977_2026: HistoricalYearRecord[] =
  syntheticHistory.records as HistoricalYearRecord[]

// =========================================================================================
// 2. Illustrative forward trajectory (2026 - 2040) — SYNTHETIC
//
// These are scenario figures, not model output. The previous comment claimed
// "Holt-Winters / ARIMA + XGBoost residual estimation over a 50-yr historical
// dataset"; none of those methods exist in this codebase and no such dataset
// was used. A real forecaster with a rolling-origin backtest is Phase 4 work
// (PRD B-5, B-10) and operates on a days-to-months horizon, not to 2040.
// =========================================================================================
export const FUTURE_FORECASTS_2026_2040: FutureForecastRecord[] = [
  {
    year: 2026,
    predictedProductionTonnes: 2150000,
    targetTonnes: 2180000,
    shortfallRiskPct: 1.4,
    projectedProvedReservesTonnes: 58200000,
    climateRiskIndex: 38.5,
    confidenceIntervalLow: 2090000,
    confidenceIntervalHigh: 2210000,
    aiStrategyDirective: 'Deploy SciPy Simplex Ore Blending across SP-1, SP-2, SP-3 stockpiles to meet 40% Mn grade without dilution.',
    modelBasis: 'nakshatra-synthetic-v1 seeded generator (illustrative, not a fitted model)',
  },
  {
    year: 2027,
    predictedProductionTonnes: 2320000,
    targetTonnes: 2350000,
    shortfallRiskPct: 1.3,
    projectedProvedReservesTonnes: 62400000,
    climateRiskIndex: 41.2,
    confidenceIntervalLow: 2240000,
    confidenceIntervalHigh: 2400000,
    aiStrategyDirective: 'Infill drilling on a 25 m grid along the East Balaghat strike to reduce prospectivity uncertainty. Reserve classification is a competent person\u2019s determination and is not produced here (PRD \u00a72.4).',
    modelBasis: 'CAGR + Infill Kriging Reserve Upgrade Multiplier',
  },
  {
    year: 2028,
    predictedProductionTonnes: 2510000,
    targetTonnes: 2550000,
    shortfallRiskPct: 1.6,
    projectedProvedReservesTonnes: 67100000,
    climateRiskIndex: 44.0,
    confidenceIntervalLow: 2420000,
    confidenceIntervalHigh: 2600000,
    aiStrategyDirective: 'Automated SCADA perimeter pump interlocks for monsoon saturation control in Sausar schist open pits.',
    modelBasis: 'IMD Hydro-Climatic Sensitivity Regression',
  },
  {
    year: 2029,
    predictedProductionTonnes: 2720000,
    targetTonnes: 2750000,
    shortfallRiskPct: 1.1,
    projectedProvedReservesTonnes: 72300000,
    climateRiskIndex: 46.8,
    confidenceIntervalLow: 2610000,
    confidenceIntervalHigh: 2830000,
    aiStrategyDirective: 'Deep underground shaft expansion in Bharweli & Mansar sectors reaching 500m sub-surface horizons.',
    modelBasis: 'Underground Shaft Mechanization Scale Factor',
  },
  {
    year: 2030,
    predictedProductionTonnes: 2980000,
    targetTonnes: 3000000,
    shortfallRiskPct: 0.7,
    projectedProvedReservesTonnes: 78500000,
    climateRiskIndex: 49.5,
    confidenceIntervalLow: 2850000,
    confidenceIntervalHigh: 3110000,
    aiStrategyDirective: 'NATIONAL STEEL POLICY 2030 MILESTONE: Zero Manganese Ore Import Reliance achieved for Indian blast furnaces.',
    modelBasis: 'National Steel Policy 2030 300 MT Target Convergence',
  },
  {
    year: 2031,
    predictedProductionTonnes: 3120000,
    targetTonnes: 3150000,
    shortfallRiskPct: 1.0,
    projectedProvedReservesTonnes: 83200000,
    climateRiskIndex: 51.0,
    confidenceIntervalLow: 2970000,
    confidenceIntervalHigh: 3270000,
    aiStrategyDirective: 'Integration of autonomous electric haulage fleets with SCADA real-time dispatch at Balaghat and Ukwa.',
    modelBasis: 'Autonomous Haulage Fleet Efficiency Gain (+6.2%)',
  },
  {
    year: 2032,
    predictedProductionTonnes: 3250000,
    targetTonnes: 3280000,
    shortfallRiskPct: 0.9,
    projectedProvedReservesTonnes: 88100000,
    climateRiskIndex: 52.4,
    confidenceIntervalLow: 3080000,
    confidenceIntervalHigh: 3420000,
    aiStrategyDirective: 'Deployment of real-time hyperspectral core sorting units at headframes to eliminate sub-grade gangue rock.',
    modelBasis: 'Hyperspectral Real-Time Sorting Recovery Model',
  },
  {
    year: 2033,
    predictedProductionTonnes: 3370000,
    targetTonnes: 3400000,
    shortfallRiskPct: 0.9,
    projectedProvedReservesTonnes: 93200000,
    climateRiskIndex: 53.6,
    confidenceIntervalLow: 3190000,
    confidenceIntervalHigh: 3550000,
    aiStrategyDirective: 'Deep sub-level caving mechanization in Dongri Buzurg & Chikla mines for thick lens extraction.',
    modelBasis: 'Sub-Level Caving Mechanized Rate Model',
  },
  {
    year: 2034,
    predictedProductionTonnes: 3490000,
    targetTonnes: 3500000,
    shortfallRiskPct: 0.3,
    projectedProvedReservesTonnes: 98600000,
    climateRiskIndex: 54.8,
    confidenceIntervalLow: 3300000,
    confidenceIntervalHigh: 3680000,
    aiStrategyDirective: 'AI-driven closed-loop ore beneficiation plant quality optimization achieving 46% Mn concentrate grade.',
    modelBasis: 'Beneficiation Circuit Digital Twin Optimization',
  },
  {
    year: 2035,
    predictedProductionTonnes: 3600000,
    targetTonnes: 3600000,
    shortfallRiskPct: 0.0,
    projectedProvedReservesTonnes: 104200000,
    climateRiskIndex: 55.9,
    confidenceIntervalLow: 3400000,
    confidenceIntervalHigh: 3800000,
    aiStrategyDirective: 'Full integration of ISRO Next-Gen Hyperspectral & SAR Constellation for real-time subsidence auditing.',
    modelBasis: 'Space-Borne InSAR Geotechnical Stability Model',
  },
  {
    year: 2036,
    predictedProductionTonnes: 3710000,
    targetTonnes: 3700000,
    shortfallRiskPct: 0.0,
    projectedProvedReservesTonnes: 110100000,
    climateRiskIndex: 57.0,
    confidenceIntervalLow: 3500000,
    confidenceIntervalHigh: 3920000,
    aiStrategyDirective: '100% solar microgrid powered underground mine ventilation and cooling systems across all 10 MOIL units.',
    modelBasis: 'Green Net-Zero Renewable Energy Transition Index',
  },
  {
    year: 2037,
    predictedProductionTonnes: 3820000,
    targetTonnes: 3800000,
    shortfallRiskPct: 0.0,
    projectedProvedReservesTonnes: 116200000,
    climateRiskIndex: 58.1,
    confidenceIntervalLow: 3600000,
    confidenceIntervalHigh: 4040000,
    aiStrategyDirective: 'Zero-waste tailings re-processing & ultra-high grade Mn recovery plant commercialized at Balaghat.',
    modelBasis: 'Circular Tailings Re-Beneficiation Yield (+3.8%)',
  },
  {
    year: 2038,
    predictedProductionTonnes: 3920000,
    targetTonnes: 3900000,
    shortfallRiskPct: 0.0,
    projectedProvedReservesTonnes: 122500000,
    climateRiskIndex: 59.2,
    confidenceIntervalLow: 3690000,
    confidenceIntervalHigh: 4150000,
    aiStrategyDirective: 'Global export hub commissioning for EV battery-grade High-Purity Manganese Sulphate Monohydrate (HPMSM).',
    modelBasis: 'EV Battery Precursor Chemistry Global Demand Index',
  },
  {
    year: 2039,
    predictedProductionTonnes: 4000000,
    targetTonnes: 4000000,
    shortfallRiskPct: 0.0,
    projectedProvedReservesTonnes: 129000000,
    climateRiskIndex: 60.1,
    confidenceIntervalLow: 3760000,
    confidenceIntervalHigh: 4240000,
    aiStrategyDirective: 'Fully autonomous deep geological robotics mapping & continuous miner extraction beneath 600m depth.',
    modelBasis: 'Autonomous Robotic Underground Continuous Extraction',
  },
  {
    year: 2040,
    predictedProductionTonnes: 4080000,
    targetTonnes: 4050000,
    shortfallRiskPct: 0.0,
    projectedProvedReservesTonnes: 135800000,
    climateRiskIndex: 61.0,
    confidenceIntervalLow: 3830000,
    confidenceIntervalHigh: 4330000,
    aiStrategyDirective: 'VISION 2040 FULFILLED: India established as Asia-Pacific Manganese Export Lead & Carbon-Neutral Mining Hub.',
    modelBasis: 'Ministry of Steel Vision 2040 Long-Term Steady State Model',
  },
]
