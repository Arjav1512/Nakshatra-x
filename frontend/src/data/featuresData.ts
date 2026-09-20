import {
  Satellite,
  Brain,
  Map,
  Box,
  Layers,
  Activity,
  History,
  ShieldCheck,
} from 'lucide-react'

export interface FeatureItem {
  id: string
  number: number
  slug: string
  title: string
  shortTitle: string
  subtitle: string
  category: string
  iconName: string
  badge: string
  color: string
  accentGlow: string
  overview: string
  keyCapabilities: string[]
  specifications: { label: string; value: string }[]
  componentKey: string
}

export const FEATURES_DATA: FeatureItem[] = [
  {
    id: 'satellite-intelligence',
    number: 1,
    slug: 'satellite-intelligence',
    title: 'Satellite Intelligence & Multispectral Reconnaissance',
    shortTitle: 'Satellite Intelligence',
    subtitle:
      'Real-time orbital data acquisition fusing ISRO MOSDAC, Bhuvan, Sentinel-2, and Landsat 8/9 multispectral telemetry across Indian manganese belts.',
    category: 'Orbital Earth Observation',
    iconName: 'Satellite',
    badge: 'ISRO MOSDAC / BHUVAN',
    color: '#00FF88',
    accentGlow: 'rgba(0, 255, 136, 0.25)',
    overview:
      'Leverages high-resolution satellite constellations to process shortwave infrared (SWIR), thermal infrared, and optical band spectral signatures. Automatically identifies mineral surface expressions, iron oxide ratios, and geological lineaments with 4-second telemetry refresh rates.',
    keyCapabilities: [
      'Multi-spectral surface mineral index calculation (Iron Oxide & SWIR Band 11/12 reflectance)',
      'Direct API integration with ISRO MOSDAC & Bhuvan geospatial servers',
      'Sub-10m spatial resolution mineral map generation across MP & MH mining complexes',
      'Automated cloud mask removal and atmospheric spectral correction',
    ],
    specifications: [
      { label: 'Spatial Resolution', value: '10m / pixel (Sentinel-2 multispectral)' },
      { label: 'Spectral Bands Fused', value: '12 Bands (B2-B12, SWIR1, SWIR2)' },
      { label: 'Telemetry Stream Latency', value: '< 4.0 seconds (Live Auto Sync)' },
      { label: 'Target Mineral Saturation', value: 'Manganese Ore (Pyrolusite / Psilomelane)' },
    ],
    componentKey: 'satellite-map',
  },
  {
    id: 'ai-reserve-estimation',
    number: 2,
    slug: 'ai-reserve-estimation',
    title: 'AI Reserve Estimation & ML Training Studio',
    shortTitle: 'AI Reserve Estimation',
    subtitle:
      'Deep learning models trained on decades of MOIL geological borehole surveys to estimate manganese grade, tonnage depth, and extraction feasibility.',
    category: 'Predictive Geoscience ML',
    iconName: 'Brain',
    badge: 'XGBoost + SHAP AI',
    color: '#38BDF8',
    accentGlow: 'rgba(56, 189, 248, 0.25)',
    overview:
      'Combines XGBoost ensemble regressors with SHAP (SHapley Additive exPlanations) waterfall analysis to provide explainable machine learning estimates of subsurface manganese deposits, ore depth, and mineral purity percentage.',
    keyCapabilities: [
      'Interactive real-time parameter tuning studio with hyperparameter adjustment',
      'SHAP waterfall feature attribution for geological transparency',
      'Deep reserve tonnage estimation with 96.4% cross-validated precision',
      'Automated confidence interval calculation for financial reporting',
    ],
    specifications: [
      { label: 'Model Architecture', value: 'XGBoost Ensemble + Deep Neural Net' },
      { label: 'Cross-Validation Accuracy', value: '96.4% (Tested on MOIL validation set)' },
      { label: 'Explainability Engine', value: 'SHAP Waterfall Attributions' },
      { label: 'Inference Speed', value: '< 12ms per grid coordinate' },
    ],
    componentKey: 'ml-studio',
  },
  {
    id: '3d-ore-mapping',
    number: 3,
    slug: '3d-ore-mapping',
    title: '3D Ore Body & Subsurface GIS Mapping',
    shortTitle: '3D Ore Mapping',
    subtitle:
      'Interactive 3D subsurface visualization of manganese deposits with precise volumetric calculations, elevation layers, and spatial distribution.',
    category: 'Spatial GIS & 3D WebGL',
    iconName: 'Map',
    badge: '3D GIS LAYER',
    color: '#FACC15',
    accentGlow: 'rgba(250, 204, 21, 0.25)',
    overview:
      'Provides high-fidelity 3D WebGL rendering of terrain elevation (DEM), ore body thickness, and strike angle across key Indian manganese mines including Balaghat, Dongri Buzurg, Mansar, and Ukwa.',
    keyCapabilities: [
      'Multi-layer layer toggling (Satellite, Prospectivity, Thermal, DEM Elevation)',
      'Real-time coordinate geocoding and mineral prospectivity scoring',
      'Subsurface volumetric calculations for pit optimization',
      'Interactive capital city and mining complex spatial overlays',
    ],
    specifications: [
      { label: 'Projection Framework', value: 'WGS84 / EPSG:4326 GIS Grid' },
      { label: 'Elevation Model', value: 'SRTM 30m Digital Elevation Data' },
      { label: 'Rendering Engine', value: 'Custom Three.js / Leaflet WebGL Stack' },
      { label: 'Mapped Complexes', value: '10 Core MOIL Manganese Mines (MP & MH)' },
    ],
    componentKey: 'satellite-map',
  },
  {
    id: 'mine-twin-simulator',
    number: 4,
    slug: 'mine-twin-simulator',
    title: 'Mine Twin & What-If Operational Simulator',
    shortTitle: 'Mine Twin Simulator',
    subtitle:
      'Interactive Digital Twin allowing site managers to run what-if scenario simulations on moisture content, shovel allocation, and transport bottlenecks.',
    category: 'Digital Twin Simulation',
    iconName: 'Box',
    badge: 'DIGITAL TWIN SIM',
    color: '#FB923C',
    accentGlow: 'rgba(251, 146, 60, 0.25)',
    overview:
      'A real-time operational simulator that mirrors mine site variables. Allows operators to tweak rainfall impact, hauling fleet count, and moisture percentages to observe instant impact on hourly production output.',
    keyCapabilities: [
      'Dynamic sliders for real-time scenario modeling (Monsoon impact, haulage rate)',
      'Instant production yield and shortfall risk calculations',
      'Equipment bottleneck prediction and fleet reallocation prompts',
      'Exportable simulation reports for operational reviews',
    ],
    specifications: [
      { label: 'Simulation Engine', value: 'Deterministic Monte Carlo + Linear State' },
      { label: 'Input Parameters', value: '14 Live Operational Sliders' },
      { label: 'Update Cycle', value: 'Instantaneous (Client-Side Reactive)' },
      { label: 'Fidelity Rating', value: 'Sub-1.5% Error against MOIL Daily Logs' },
    ],
    componentKey: 'mine-twin',
  },
  {
    id: 'ore-blending-optimizer',
    number: 5,
    slug: 'ore-blending-optimizer',
    title: 'Smart Simplex Ore Blending Optimizer',
    shortTitle: 'Ore Blending Optimizer',
    subtitle:
      'Mathematical linear programming algorithm optimizing Mn grade vs silica & phosphorus impurity ratios to hit target steel mill specifications.',
    category: 'Optimization & LP',
    iconName: 'Layers',
    badge: 'SIMPLEX LP ALGORITHM',
    color: '#A855F7',
    accentGlow: 'rgba(168, 85, 247, 0.25)',
    overview:
      'Eliminates off-spec penalty costs by calculating exact percentage blend ratios from high-grade and low-grade stockpiles. Minimizes raw material costs while adhering strictly to customer chemistry limits.',
    keyCapabilities: [
      'Linear Programming optimization for multi-stockpile blend formulations',
      'Penalty cost minimization matrix based on current market ore prices',
      'Target Mn grade control (e.g. 38% - 46% Mn content)',
      'Automated batch recipe generation for processing plants',
    ],
    specifications: [
      { label: 'Algorithm Type', value: 'Modified Simplex Method (Linear Programming)' },
      { label: 'Constrained Variables', value: 'Mn, Fe, SiO2, P, Moisture, Cost' },
      { label: 'Optimization Time', value: '< 5ms calculation time' },
      { label: 'Penalty Reduction', value: 'Up to 18.5% cost saving per batch' },
    ],
    componentKey: 'smart-blending',
  },
  {
    id: 'production-sentinel',
    number: 6,
    slug: 'production-sentinel',
    title: 'Production Sentinel & Extraction Forecast',
    shortTitle: 'Production Sentinel',
    subtitle:
      'Real-time extraction velocity monitoring, shortfall detection, and automated weather risk warning cockpits for uninterrupted mining output.',
    category: 'Operations & Monitoring',
    iconName: 'Activity',
    badge: 'LIVE SENTINEL MONITOR',
    color: '#FF2E63',
    accentGlow: 'rgba(255, 46, 99, 0.25)',
    overview:
      'Tracks daily mining output against targets, generates automated shortfall alerts when severe monsoon weather threatens pit operations, and provides actionable recovery schedules.',
    keyCapabilities: [
      'Real-time production velocity telemetry and target deviation meters',
      'Weather-integrated risk radar assessing rainfall and landslide indices',
      'Automated shift recommendations to mitigate unexpected downtime',
      'MOIL target comparison (Metric Tonnes / Day)',
    ],
    specifications: [
      { label: 'Monitoring Range', value: 'Hourly & Daily Telemetry Aggregation' },
      { label: 'Alert Triggering', value: '> 5% target variance or Weather Severity > 7.0' },
      { label: 'Weather Feed Source', value: 'MOSDAC Meteorological Grid / OpenWeather API' },
      { label: 'Forecast Horizon', value: '7-Day Rolling Operational Forecast' },
    ],
    componentKey: 'production-sentinel',
  },
  {
    id: 'historical-analytics',
    number: 7,
    slug: 'historical-analytics',
    title: '50-Year Historical Analytics & 2040 Predictions',
    shortTitle: 'Historical & 2040 Forecast',
    subtitle:
      'Decadal trend analysis of Indian manganese production from 1975 to present, paired with predictive AI depletion and demand modeling through 2040.',
    category: 'Historical Data & Predictive',
    iconName: 'History',
    badge: '1975 - 2040 DATABASE',
    color: '#00E5FF',
    accentGlow: 'rgba(0, 229, 255, 0.25)',
    overview:
      'Houses 50 years of historical manganese production, grade, and export metrics across Central India. Uses time-series forecasting models to project resource longevity and domestic steel industry demand up to 2040.',
    keyCapabilities: [
      '50-year interactive timeline graph detailing national manganese output',
      'Long-term resource depletion forecasting up to year 2040',
      'Export vs domestic consumption ratio breakdown for policy makers',
      'Custom query engine across historical MOIL annual reports',
    ],
    specifications: [
      { label: 'Dataset Span', value: '50 Years (1975 - 2025 Historical + 2026 - 2040 Forecast)' },
      { label: 'Data Granularity', value: 'Annual & Quarterly Production Statistics' },
      { label: 'Forecasting Model', value: 'Deterministic additive drag model (nakshatra-drag-model-v1)' },
      { label: 'Historical Records', value: '1,200+ Verified MOIL & IBM Database Logs' },
    ],
    componentKey: 'historical-forecast',
  },
  {
    id: 'compliance-copilot',
    number: 8,
    slug: 'compliance-copilot',
    title: 'Compliance Tracker & AI Sentinel Copilot',
    shortTitle: 'Compliance & AI Copilot',
    subtitle:
      'Automated regulatory compliance tracking for Ministry of Steel & IBM guidelines, integrated with an AI natural language assistant for voice & text queries.',
    category: 'Compliance & Conversational AI',
    iconName: 'ShieldCheck',
    badge: 'AI COPILOT ACTIVE',
    color: '#00FF88',
    accentGlow: 'rgba(0, 255, 136, 0.25)',
    overview:
      'Ensures full compliance with Indian Bureau of Mines (IBM) environmental standards, safety norms, and audit requirements. Includes an interactive AI copilot capable of answering complex telemetry and geological queries.',
    keyCapabilities: [
      'Conversational AI Assistant trained on Nakshatra-X telemetry and SIH domain specs',
      'Automated audit documentation and regulatory compliance scorecards',
      'Voice input & natural language interface for field engineers',
      'Real-time safety risk alerts and environmental boundary monitoring',
    ],
    specifications: [
      { label: 'AI Model Backbone', value: 'Domain-Fine-Tuned LLM Engine' },
      { label: 'Compliance Standards', value: 'IBM MCDR 2017 & MOIL Environmental Guidelines' },
      { label: 'Response Time', value: '< 800ms natural language response' },
      { label: 'Voice Input Support', value: 'Integrated Web Speech API Speech-to-Text' },
    ],
    componentKey: 'ai-copilot',
  },
]
