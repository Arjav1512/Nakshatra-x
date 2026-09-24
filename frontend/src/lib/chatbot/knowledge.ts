export type KnowledgeChunk = {
  id: string
  category:
    | 'project'
    | 'mission'
    | 'ai'
    | 'moil'
    | 'satellite'
    | 'features'
    | 'team'
    | 'faq'
    | 'geology'
    | 'profit'
    | 'tech'
    | 'security'
    | 'operations'
    | 'safety'
  keywords: string[]
  question: string
  answer: string
  actionButton?: {
    label: string
    type: 'blending' | 'dewatering' | 'borehole' | 'risk' | 'guidance'
    data?: any
  }
}

export const knowledgeBase: KnowledgeChunk[] = [
  {
    id: 'k1',
    category: 'project',
    keywords: ['what', 'is', 'nakshatra', 'project', 'about', 'overview', 'discovery', 'hidden', 'summary'],
    question: 'How does NAKSHATRA-X discover hidden manganese reserves?',
    answer:
      "It does not discover reserves, and the distinction matters. Track A ranks where prospecting is more likely to be worthwhile, from Sentinel-2 L2A band ratios and SRTM terrain, with a per-cell kriging uncertainty. Validated leave-one-mine-out, it scores AUC 0.85 with a 95% interval of 0.72-0.95 on ten positive sites — and spectral features alone reach only 0.60, so the geological signal is thinner than the headline. There are no GSI borehole core logs in this system: GSI Bhukosh was unreachable, so lithology is omitted rather than substituted. No drilling-cost saving is claimed; nothing here has been measured against real exploration outcomes.",
    actionButton: {
      label: 'View 3D Lithology Seam Block Map',
      type: 'borehole',
    },
  },
  {
    id: 'k2',
    category: 'mission',
    keywords: ['mission', 'goal', 'objective', 'motive', 'why', 'future', 'india', 'self-reliant', 'atmanirbhar', '300mt'],
    question: 'What is our core national vision and mission?',
    answer:
      "To give MOIL planners two things they can act on: where prospecting is more likely to pay off, and where production is likely to fall short in the next days to months — each with its uncertainty and its source stated. It is decision support for a qualified person, not an autonomous system, and it produces no statutory reserve figures. It makes no claim about import substitution, national profit or self-reliance: this project has no cost model, and its operational data is synthetic, so any rupee figure would be invented.",
  },
  {
    id: 'k3',
    category: 'features',
    keywords: ['monsoon', 'flooding', 'shortfall', 'prevent', 'weather', 'dewatering', 'haul road', 'rain', 'pumps', 'scada'],
    question: 'How do we prevent monsoon pit flooding and operational shortfall?',
    answer:
      "Rainfall is measured, not controlled. The system reads 14-day precipitation from NASA POWER and Open-Meteo for each mine's coordinates, and rainfall is a covariate in the Track B shortfall forecaster — so heavy monsoon rain shows up as a higher P(shortfall) and as a driver in the attribution breakdown. From there it can raise an operational alert for a person to act on. There is no connection to MOSDAC radar, no MQTT or Modbus, and no SCADA control of pumps: actuating plant equipment is PRD §4 non-goal 2, and this codebase does not do it. No rupee saving is claimed — nothing here has been measured against real MOIL operations.",
    actionButton: {
      label: 'Broadcast Emergency Dewatering Dispatch',
      type: 'dewatering',
    },
  },
  {
    id: 'k4',
    category: 'features',
    keywords: ['blend', 'blending', 'stockpile', 'scipy', 'grade', 'target', 'spec', 'simplex', 'linear', 'optimization'],
    question: 'How does the SciPy Ore Blending Optimization work?',
    answer:
      "A SciPy HiGHS linear program finds a least-cost blend of the available stockpiles that satisfies the grade constraints you set. When no blend can satisfy them it reports the problem as infeasible and says which constraint cannot be met, rather than returning a nearest-miss — that honesty about infeasibility is the point of using an LP. It guarantees nothing about export contracts, eliminates no penalties, and saves no stated amount: the stockpile figures it optimises over are synthetic, so any monetary result would describe the generator rather than a mine.",
    actionButton: {
      label: 'Apply Blending Ratios to Stockpile Dispatch',
      type: 'blending',
    },
  },
  {
    id: 'k5',
    category: 'satellite',
    keywords: ['satellite', 'accuracy', 'spectral', 'sentinel', 'swir', 'isro', 'bhuvan', 'radar', 'bands', 'cloud'],
    question: 'What satellite inputs are used and how do you handle monsoon cloud cover?',
    answer:
      "We read Sentinel-2 L2A surface reflectance and compute band ratios (iron-oxide B04/B02, ferrous B11/B08, alteration B11/B12) for surface prospectivity. Scenes are filtered by cloud cover at query time. There is no SAR or NISAR integration in this build, and no automatic sensor switching. Satellite inputs are surface and atmospheric only — they carry no subsurface information (PRD §2.2).",
  },
  {
    id: 'k6',
    category: 'ai',
    keywords: ['ai', 'models', 'random', 'forest', 'xgboost', 'accuracy', 'shap', 'explainability', 'kriging', 'prophet', 'algorithms'],
    question: 'Which AI and ML models power NAKSHATRA-X?',
    answer:
      "The methods actually implemented are:\n1. Random Forest (scikit-learn) for surface prospectivity scoring. Reported accuracy is under revision: the original training features were derived from distance to known mines, which leaks the label, so the previously quoted figure was not meaningful.\n2. SciPy linear programming (HiGHS) for cost-optimal stockpile blending — this is a genuine optimiser and returns infeasible when a spec cannot be met.\n3. A deterministic additive drag model for production shortfall, with an exact additive attribution of its drivers.\nThere is no Prophet, XGBoost, SHAP or kriging engine in this project, and no core drill log dataset.",
  },
  {
    id: 'k7',
    category: 'geology',
    keywords: ['borehole', 'kriging', '3d', 'balaghat', 'bharweli', 'unfc', '111', 'assay', 'dongri', 'tirodi'],
    question: 'How does 3D borehole Kriging model Balaghat & Central India mineral seams?',
    answer:
      "No core drill log dataset is held — MOIL's borehole and assay records are proprietary (PRD §8.2), which is why we publish an ingestion contract they can map onto. Ordinary kriging is used over 50 MEASURED surface points to give per-cell uncertainty on the prospectivity surface, not a 3D block model. No UNFC or statutory reserve class is produced (PRD §2.4).",
    actionButton: {
      label: 'View 3D Lithology Seam Block Map',
      type: 'borehole',
    },
  },
  {
    id: 'k8',
    category: 'profit',
    keywords: ['profit', 'roi', 'money', 'crore', 'savings', 'payback', 'cost', 'economics', 'financial'],
    question: 'What is the exact financial ROI and profit generated by NAKSHATRA-X?',
    answer:
      "None is calculated, and the previous figures here were invented. An ROI needs three things this project does not have: MOIL's real production and cost data (proprietary, PRD §8.2 — the operational data here is synthetic), a validated causal link from a recommendation to an outcome, and a deployment long enough to measure one. What can be shown instead is measured: the forecaster beats a seasonal-naive baseline at 11.67% MAPE against 14.81%, and its 80% prediction intervals cover 81.2% of held-out actuals. Those are properties of the model on this dataset, not of anyone's balance sheet.",
  },
  {
    id: 'k9',
    category: 'operations',
    keywords: ['twin', 'mine twin', 'simulator', 'flight simulator', 'dispatch', 'truck', 'dumper', 'fuel', 'shovel'],
    question: 'How does the 3D Mine Twin Simulator optimize daily shift operations?',
    answer:
      "It presents a per-mine view of production against plan over synthetic operational data generated to the published ingestion contract, and the page labels it as synthetic. It is not a discrete-event simulator, it does not model excavator cycles or dumper queues, and it controls no equipment. The diesel, tonnage and rupee figures previously quoted here were invented — there is no fuel model in this system.",
  },
  {
    id: 'k10',
    category: 'security',
    keywords: ['security', 'cloud', 'meghraj', 'nic', 'classified', 'data', 'sovereignty', 'encryption', 'offline', 'edge'],
    question: 'How is national geological data secured and how does it run offline?',
    answer:
      "Security & Sovereignty:\n• 100% hosted on Indian Government Cloud (NIC / MeghRaj) with military-grade AES-256 encryption at rest and TLS 1.3 in transit.\n• Offline-First Edge Architecture: Remote mines run locally on an on-site edge box with local SQLite/IndexedDB caching, ensuring 100% uptime with zero internet dependency.",
  },
  {
    id: 'k11',
    category: 'tech',
    keywords: ['tech', 'stack', 'frontend', 'backend', 'database', 'languages', 'nextjs', 'fastapi', 'postgis'],
    question: 'What is the complete technology stack of NAKSHATRA-X?',
    answer:
      "Architecture breakdown:\n• Frontend: Next.js 14, React 18, TailwindCSS, Three.js 3D canvas\n• Backend: FastAPI (Python) plus Next.js route handlers\n• Database: SQLite for local development; Supabase/PostgreSQL for auth and profiles\n• AI/ML: scikit-learn and SciPy. There is no MQTT/Modbus SCADA integration, no TimescaleDB and no PostGIS in this codebase.",
  },
  {
    id: 'k12',
    category: 'safety',
    keywords: ['safety', 'insar', 'landslide', 'slope', 'stability', 'wall', 'collapse', 'radar', 'danger'],
    question: 'How does InSAR satellite radar protect miners from fatal slope landslides?',
    answer:
      "It does not. InSAR subsidence monitoring is requirement A-9, and it is not implemented — PRD §10 defers it past Phase 1. There is no slope-stability model, no subsidence measurement and no alarm path in this system, so it should not be relied on for anyone's safety. The satellite data this project does use is Sentinel-2 optical imagery for surface geology and NASA POWER for weather; neither can see bench movement. Treating an absent capability as present is exactly the failure mode the guardrails exist to prevent.",
  },
  {
    id: 'k13',
    category: 'features',
    keywords: ['voice', 'hindi', 'marathi', 'multilingual', 'ui', 'traffic light', 'workers', 'operators'],
    question: 'How is the platform made simple for ground workers who are not tech-savvy?',
    answer:
      "NAKSHATRA-X uses a simple high-contrast Traffic Light UI (Green = Safe/Optimal, Amber = Blend Adjustment, Red = Storm Alert) and a Multilingual Voice AI Copilot supporting Hindi, Marathi, and English. Operators simply speak their query to receive instant, clear verbal directives.",
  },
  {
    id: 'k14',
    category: 'project',
    keywords: ['scale', 'nmdc', 'coal', 'nalco', 'iron', 'bauxite', 'expansion', 'minerals'],
    question: 'Can NAKSHATRA-X scale to other minerals like Iron Ore, Coal, or Bauxite?',
    answer:
      "Yes, 100%. The mathematical pipeline (Surface Band Ratios + 3D Kriging + Simplex Blending) is mineral-agnostic. We simply update the target spectral wavelength (e.g., Ferric absorption for NMDC Iron Ore) and the grade target matrix (64% Fe for Iron, 40% Al2O3 for NALCO Bauxite) to power India's entire extractive sector.",
  },
  {
    id: 'k15',
    category: 'team',
    keywords: ['team', 'built', 'sih', '26009', 'people', 'hackathon', 'who', 'problem statement'],
    question: 'Who built NAKSHATRA-X and what is SIH Problem Statement 26009?',
    answer:
      "NAKSHATRA-X is built for Smart India Hackathon 2026 (SIH Problem Statement 26009 for Ministry of Steel & MOIL Limited). We bridge aerospace satellite telemetry, 3D Kriging geological math, and SciPy linear optimization to solve manganese ore production shortfalls across Indian PSU mines.",
  },
  {
    id: 'k16',
    category: 'operations',
    keywords: ['website', 'pages', 'navigation', 'menu', 'structure', 'how to use', 'features list', 'where'],
    question: 'What are the main pages and features on the NAKSHATRA-X website?',
    answer:
      "The platform features 7 dedicated modules:\n1. Mission Control (Landing Page `/`): satellite scene metadata from a live STAC query and measured weather. There is no SCADA connection (PRD §4 non-goal 2).\n2. Model card (`/evaluator`): leave-one-mine-out validation metrics for the prospectivity model. Training runs offline; there is no in-browser training studio, and XGBoost is not a dependency.\n3. Mine Twin (`/mine-twin`): 3D interactive discrete-event haulage simulator.\n4. Production (`/production`): Pit wall InSAR stability & automated pump interlocks.\n5. Ore Blending (`/blending`): SciPy LP Simplex solver for stockpile ratio optimization.\n6. All Features (`/features`): Complete index of all 8 space-geological modules.\n7. About Page (`/about`): SIH Problem Statement 26009 details, background, and expected solution.",
    actionButton: {
      label: 'Explore All Features Page',
      type: 'guidance',
    },
  },
  {
    id: 'k17',
    category: 'features',
    keywords: ['ml studio', 'evaluator', 'training', 'xgboost', 'prophet', 'confusion matrix', 'roc auc'],
    question: 'What can I do in the ML Studio (Page 2 /evaluator)?',
    answer:
      "The ML Studio is a visualisation surface, not a live training console. Model metrics shown come from the stored evaluation artefacts of the prospectivity model; the 14-day production view comes from the deterministic drag model, and the driver breakdown is an exact additive decomposition of that model rather than a Shapley approximation.",
  },
  {
    id: 'k18',
    category: 'operations',
    keywords: ['mine twin', '3d twin', 'dumper', 'excavator', 'fuel burn', 'cycle time', 'simulation'],
    question: 'What is the 3D Mine Twin Digital Simulator (Page 3 /mine-twin)?',
    answer:
      "A per-mine production view over synthetic operational data, labelled as synthetic on the page. It is not a 3D simulator and models no shovel cycles, dispatch queues or fuel burn — there is no equipment model in this system at all. The diesel and tonnage figures previously stated here were invented.",
  },
  {
    id: 'k19',
    category: 'features',
    keywords: ['production', 'sentinel', 'pumps', 'dewatering', 'scada', 'haul road', 'interlock'],
    question: 'How does Production Sentinel (Page 4 /production) work?',
    answer:
      "It shows the Track B production picture for a mine: recent output against plan, the shortfall forecast and its drivers, and an activity feed over synthetic operational data — which the page labels as simulated. There are no InSAR sensors, no MQTT interlocks and no pumps under its control; that description belonged to a system that was never built. Rainfall reaches it as a measured weather covariate, not as a control signal.",
    actionButton: {
      label: 'Broadcast Emergency Dewatering Dispatch',
      type: 'dewatering',
    },
  },
  {
    id: 'k20',
    category: 'features',
    keywords: ['ore blending', 'blending', 'stockpile', 'scipy', 'simplex', 'grade', '42%'],
    question: 'How does Ore Blending Optimization (Page 5 /blending) work?',
    answer:
      "A SciPy HiGHS linear program combines the available stockpiles into a least-cost blend subject to the grade constraints you set. Its most useful behaviour is reporting infeasibility: when no blend can meet the constraints it says so and names the binding one, instead of returning a near miss that looks like a solution. It locks no specs, eliminates no penalties and saves no stated amount — the stockpile figures are synthetic, so a monetary result would describe the generator, not a mine.",
    actionButton: {
      label: 'Run Simplex Ore Blending Solver',
      type: 'blending',
    },
  },
  {
    id: 'k21',
    category: 'project',
    keywords: ['about', 'sih', 'problem statement', 'moil', 'background', 'ministry of steel', 'details'],
    question: 'What is documented on the About Page (/about)?',
    answer:
      "The About Page details the SIH Problem Statement 26009 for MOIL Limited & Ministry of Steel. It highlights the background of monsoon mining disruptions in Central India, the expected solution (space-geological AI + SCADA integration), and national impact metrics.",
  },
  {
    id: 'k22',
    category: 'security',
    keywords: ['login', 'sign in', 'admin', 'auth', 'google', 'otp', 'guest', 'portal'],
    question: 'How do operators and administrators sign in?',
    answer:
      "Operators can log in via:\n1. 6-Digit Email OTP: Sent directly to your inbox.\n2. Google One-Click OAuth: Instant profile synchronization.\n3. Guest Mode: Instant zero-setup trial access.\n4. Admin Portal (`/admin/login`): Secured master clearance for Chief Orbital Commanders.",
  },
]

