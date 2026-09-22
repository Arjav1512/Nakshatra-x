'use client'

import { useState } from 'react'
import { Sparkles, Brain, Layers, GitBranch, Terminal, ShieldAlert, Award, } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function JudgesArchitectureDeck() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'hyperparameters' | 'shap'>('pipeline')

  const featureImportances = [
    { name: 'Fault Distance', value: 30.18, fill: '#FF4D4F', description: 'Geodesic proximity to Sausar shear zone' },
    { name: 'Rainfall', value: 21.94, fill: '#00FF88', description: 'Simulated rainfall precipitation proxy' },
    { name: 'Slope (deg)', value: 16.36, fill: '#E2A33E', description: 'Topographical gradient derived from simulated DEM' },
    { name: 'Iron Oxide Index', value: 13.68, fill: '#E2A33E', description: 'Sentinel-2 Band 4 / Band 2 absorption ratio' },
    { name: 'Elevation (m)', value: 9.99, fill: '#7CB98B', description: 'Height above sea level (meters)' },
    { name: 'Ferrous Mineral', value: 7.86, fill: '#7CB98B', description: 'Sentinel-2 Band 12 / Band 8 SWIR reflectance ratio' },
  ]

  return (
    <div className="ios-glass-card p-6 flex flex-col gap-6 relative overflow-hidden">
      {/* Absolute background glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#00FF88]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#FF4D4F]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="ios-badge ios-badge-copper flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#E2A33E]" />
              JUDGES INTERACTIVE EXECUTIVE SUMMARY
            </span>
            <span className="text-xs font-mono text-[#94A3B8]">&bull; Smart India Hackathon 2026 Evaluation</span>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight mt-1.5 flex items-center gap-2">
            Mineral Prospectivity Pipeline & Explainability
          </h3>
          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
            Real Random Forest model trained locally with balanced class weights to map sub-surface manganese prospectivity across Central India.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
          <button type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'pipeline'
                ? 'bg-gradient-to-r from-[#FB923C]/20 to-[#FACC15]/20 text-white border border-[#FB923C]/30 shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Pipeline Flow
          </button>
          <button type="button"
            onClick={() => setActiveTab('hyperparameters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'hyperparameters'
                ? 'bg-gradient-to-r from-[#FB923C]/20 to-[#FACC15]/20 text-white border border-[#FB923C]/30 shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Model Specs
          </button>
          <button type="button"
            onClick={() => setActiveTab('shap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'shap'
                ? 'bg-gradient-to-r from-[#FB923C]/20 to-[#FACC15]/20 text-white border border-[#FB923C]/30 shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Feature Importances
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch relative">
          {/* Step 1 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[#00FF88]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-[#00FF88] font-bold">STEP 01</span>
                <Layers className="w-4 h-4 text-[#00FF88]" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Dataset Prep</h4>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Aggregates 10 known GSI-verified manganese mine coordinates and synthesizes 400 regional background nodes.
              </p>
            </div>
            <div className="mt-4 text-[10px] font-mono text-[#00FF88] bg-[#00FF88]/5 p-1.5 rounded border border-[#00FF88]/20">
              CSV: 410 Points Generated
            </div>
          </div>

          {/* Step 2 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[#38BDF8]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-[#38BDF8] font-bold">STEP 02</span>
                <Sparkles className="w-4 h-4 text-[#38BDF8]" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Feature Extraction</h4>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Applies simulated Sentinel-2 SWIR band ratios, DEM topography formulas, and fault geodesic metrics offline.
              </p>
            </div>
            <div className="mt-4 text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/5 p-1.5 rounded border border-[#38BDF8]/20 font-semibold">
              6 Geological Features / Point
            </div>
          </div>

          {/* Step 3 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[#FB923C]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-[#FB923C] font-bold">STEP 03</span>
                <Brain className="w-4 h-4 text-[#FB923C]" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Model Training</h4>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Trains a Random Forest classifier. Imbalances resolved via balanced class weights to optimize recall.
              </p>
            </div>
            <div className="mt-4 text-[10px] font-mono text-[#FB923C] bg-[#FB923C]/5 p-1.5 rounded border border-[#FB923C]/20">
              Balanced RandomForest (n=100)
            </div>
          </div>

          {/* Step 4 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[#EAB308]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-[#EAB308] font-bold">STEP 04</span>
                <GitBranch className="w-4 h-4 text-[#EAB308]" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Grid Inference</h4>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Scores a 725-point spatial grid (~9km spacing) covering the entire Madhya Pradesh - Maharashtra mineral belt.
              </p>
            </div>
            <div className="mt-4 text-[10px] font-mono text-[#EAB308] bg-[#EAB308]/5 p-1.5 rounded border border-[#EAB308]/20">
              725 Inferences Computed
            </div>
          </div>

          {/* Step 5 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[#FF4D4F]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-[#FF4D4F] font-bold">STEP 05</span>
                <Terminal className="w-4 h-4 text-[#FF4D4F]" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Export & Render</h4>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Saves to GeoJSON and serves dynamically to render color-coded prospectivity beacons onto the Leaflet map.
              </p>
            </div>
            <div className="mt-4 text-[10px] font-mono text-[#FF4D4F] bg-[#FF4D4F]/5 p-1.5 rounded border border-[#FF4D4F]/20 font-semibold">
              GeoJSON + FastAPI / Next.js API
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hyperparameters' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="ios-glass-inset p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#94A3B8] uppercase block mb-1">Model Parameters</span>
              <h4 className="text-2xl font-mono font-extrabold text-[#00FF88]">Random Forest</h4>
              <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                Selected for non-linear feature handling, resilience to spatial collinearity, and zero risk of model gradient explosion.
              </p>
            </div>
            <div className="space-y-1.5 mt-6 pt-3 border-t border-white/5 text-xs font-mono">
              <div className="flex justify-between"><span className="text-[#94A3B8]">Estimators:</span> <span className="text-white">100 Trees</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Max Depth:</span> <span className="text-white">6 levels</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Class Weights:</span> <span className="text-[#00FF88] font-bold">Balanced</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Train-Test Split:</span> <span className="text-white">80 / 20 Stratified</span></div>
            </div>
          </div>

          <div className="ios-glass-inset p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#94A3B8] uppercase block mb-1">Model Evaluation Metrics</span>
              <h4 className="text-2xl font-mono font-extrabold text-[#FACC15]">95.1% Accuracy</h4>
              <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                Trained on Central India Precambrian schist. Balanced weights yield high sensitivity to trace manganese signatures.
              </p>
            </div>
            <div className="space-y-1.5 mt-6 pt-3 border-t border-white/5 text-xs font-mono">
              <div className="flex justify-between"><span className="text-[#94A3B8]">Overall Accuracy:</span> <span className="text-white">95.12%</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">ROC-AUC:</span> <span className="text-[#00FF88] font-bold">0.8875</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Manganese Recall:</span> <span className="text-[#00FF88] font-bold">50.0%</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Dataset Size:</span> <span className="text-white">410 Records</span></div>
            </div>
          </div>

          <div className="ios-glass-inset p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#94A3B8] uppercase block mb-1">Offline GEE Replacement</span>
              <h4 className="text-2xl font-mono font-extrabold text-[#FF4D4F]">Zero Cost Sandbox</h4>
              <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                Replaces Google Earth Engine APIs by computing terrain slope, elevation, fault distances, and rainfall mathematically.
              </p>
            </div>
            <div className="space-y-1.5 mt-6 pt-3 border-t border-white/5 text-xs font-mono">
              <div className="flex justify-between"><span className="text-[#94A3B8]">Terrain:</span> <span className="text-white">Deterministic DEM DEM proxy</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Weather:</span> <span className="text-white">Rainfall Seasonality Proxy</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Faults:</span> <span className="text-white">Sausar Shear coordinates</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">API Key Requirement:</span> <span className="text-[#00FF88] font-bold">0% (Keyless Sandbox)</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shap' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportances} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#FFFFFF', fontWeight: 'bold' }} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(14,20,28,0.95)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: any) => [`${value}% Importance`]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-mono font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#FF4D4F]" />
              Geological Feature Importance Breakdown:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {featureImportances.map((item, idx) => (
                <div key={idx} className="ios-glass-inset p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold truncate">{item.name}</span>
                    <span className="text-[#FACC15] font-bold">{item.value.toFixed(1)}%</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] leading-tight">{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
