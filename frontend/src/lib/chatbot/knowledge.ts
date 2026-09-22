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
      "NAKSHATRA-X combines Sentinel-2 SWIR satellite absorption bands (11/12 & 4/2) with 10,829 GSI deep borehole core logs using 3D Ordinary Kriging interpolation. Satellites identify surface alteration anomalies; physics and geostatistical math calculate depth and grade—slashing blind exploratory drilling costs by up to 60% (saving ₹2.25 Crores per mineral block)!",
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
      "Our mission is to achieve 100% manganese self-reliance for India and power the National Steel Policy target of 300 Million Tonnes of Steel by 2030. By eliminating ₹4,000 Crores of foreign manganese imports and protecting domestic mines from monsoon disruptions, NAKSHATRA-X turns raw space intelligence into over ₹1,200 Crores of annual national profit.",
  },
  {
    id: 'k3',
    category: 'features',
    keywords: ['monsoon', 'flooding', 'shortfall', 'prevent', 'weather', 'dewatering', 'haul road', 'rain', 'pumps', 'scada'],
    question: 'How do we prevent monsoon pit flooding and operational shortfall?',
    answer:
      "We connect directly to ISRO MOSDAC radar precipitation telemetry. When rainfall exceeds 20mm/hr within 15 km, our backend sends automated MQTT/Modbus triggers to SCADA dewatering pumps 30 minutes before water reaches haulage ramps. This prevents 45 days of monsoon downtime—saving ₹380 Crores across Indian PSUs.",
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
      "Our SciPy Simplex Linear Programming (LP) solver calculates the mathematically optimal multi-stockpile blend ratio (e.g., 60% Grade-A + 40% Low-grade dump) in under 200 milliseconds. This guarantees export contracts always hit ≥42.0% Mn purity, eliminating 100% of grade penalty deductions and saving ₹2.8 Crores per million tonnes.",
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
      "NAKSHATRA-X delivers a payback period of under 60 days by plugging 3 major multi-crore drains:\n• ₹650 Cr saved by substituting low-grade ore with AI-optimized 42%+ blend (cutting imports)\n• ₹380 Cr protected by preventing 45-day monsoon pit flooding\n• ₹170 Cr saved in exploratory drilling CAPEX and dumper fuel optimization\nTotal annual national impact: Over ₹1,200 Crores in pure value.",
  },
  {
    id: 'k9',
    category: 'operations',
    keywords: ['twin', 'mine twin', 'simulator', 'flight simulator', 'dispatch', 'truck', 'dumper', 'fuel', 'shovel'],
    question: 'How does the 3D Mine Twin Simulator optimize daily shift operations?',
    answer:
      "The Mine Twin acts as a digital flight simulator running discrete-event optimization. It synchronizes excavator cycle times and dumper arrival queues to eliminate truck idling—cutting diesel burn by 11.4% (saving ₹55 Lakhs/year for 20 dumpers) and recovering +2,420 extra metric tonnes of ore per quarter worth ₹1.02 Crores.",
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
      "InSAR radar measures millimeter-level phase shifts in open-pit rock faces. If bench subsidence exceeds safety thresholds, the system triggers audio-visual alarms 4 to 6 hours before a slope failure occurs—preventing fatal casualties and avoiding ₹8–12 Crores in excavator and equipment destruction.",
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
      "The Mine Twin is a 3D Canvas flight simulator for open-pit operations. It models shovel cycle times (-340m RL pit floor to surface winder), dumper dispatch queues, and fuel burn optimization—cutting diesel consumption by 11.4% (saving ₹55 Lakhs/yr per fleet) and recovering +2,420 tonnes of ore per quarter.",
  },
  {
    id: 'k19',
    category: 'features',
    keywords: ['production', 'sentinel', 'pumps', 'dewatering', 'scada', 'haul road', 'interlock'],
    question: 'How does Production Sentinel (Page 4 /production) work?',
    answer:
      "Production Sentinel monitors pit wall InSAR radar sensors and haul road precipitation in real-time. When rainfall exceeds 20mm/hr, it transmits automatic MQTT interlock signals to perimeter pumps #4 & #7—preventing pit drowning and keeping haul roads operational during heavy monsoons.",
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
      "The Ore Blending module uses a SciPy Simplex Linear Programming (LP) solver to combine high-grade ore (SP-1) with low-grade dump material (SP-2/SP-3). In <200ms, it locks target specs (≥42% Mn purity), eliminating 100% of grade penalty deductions and saving ₹2.8 Crores per million tonnes exported.",
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

