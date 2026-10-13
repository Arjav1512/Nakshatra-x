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
      "It does not discover reserves, and the distinction matters. Track A ranks where prospecting is more likely to be worthwhile, from Sentinel-2 L2A band ratios and SRTM terrain, with a per-cell kriging uncertainty, and it is validated leave-one-mine-out — each fold holds out a whole deposit. Its AUC, the confidence interval around it, and the ablations that show how much comes from spectral features alone are on the Track A panel of the console, each with its provenance. There are no GSI borehole core logs in this system: GSI Bhukosh was unreachable, so lithology is omitted rather than substituted. No drilling-cost saving is claimed; nothing here has been measured against real exploration outcomes.",
    actionButton: {
      label: "Is there a 3D block model?",
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
      "Rainfall is measured, not controlled. The system reads 14-day precipitation from NASA POWER and Open-Meteo for each mine's coordinates, and weather is an input to the Track B shortfall forecaster, so heavy monsoon rain shows up in the mine's expected shortfall. Acting on it is a person's decision: there is no connection to MOSDAC radar, no MQTT or Modbus, and no SCADA control of pumps — actuating plant equipment is PRD §4 non-goal 2, and this codebase does not do it. No saving is claimed; nothing here has been measured against real MOIL operations.",
    actionButton: {
      label: "Can it send a dewatering order?",
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
      label: "Where do I run a blend?",
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
      "The methods actually implemented are:\n1. Track A — a gradient-boosting classifier over Sentinel-2 band ratios and SRTM terrain, validated leave-one-mine-out, with ordinary kriging over measured points for per-cell uncertainty.\n2. Track B — quantile gradient boosting with conformalised prediction intervals, forecasting daily production per mine and per grade, checked by a rolling-origin backtest against a seasonal-naive baseline.\n3. A constraint engine that checks every corrective action against shift, blasting, equipment and relocation rules — enforced, not learned.\n4. SciPy linear programming (HiGHS) for least-cost stockpile blending, which reports infeasible when a specification cannot be met.\nThere is no Prophet, XGBoost, SHAP or neural network in this project, and no core drill log dataset. The measured accuracy of each model is on the console, with its provenance.",
  },
  {
    id: 'k7',
    category: 'geology',
    keywords: ['borehole', 'kriging', '3d', 'balaghat', 'bharweli', 'unfc', '111', 'assay', 'dongri', 'tirodi'],
    question: "Is there a 3D borehole or block model?",
    answer:
      "No core drill log dataset is held — MOIL's borehole and assay records are proprietary (PRD §8.2), which is why we publish an ingestion contract they can map onto. Ordinary kriging over measured surface points gives the prospectivity surface its per-cell uncertainty; it is not a 3D block model, and no UNFC or statutory reserve class is produced (PRD §2.4).",
    actionButton: {
      label: "Is there a 3D block model?",
      type: 'borehole',
    },
  },
  {
    id: 'k8',
    category: 'profit',
    keywords: ['profit', 'roi', 'money', 'crore', 'savings', 'payback', 'cost', 'economics', 'financial'],
    question: "Does NAKSHATRA-X calculate a financial ROI?",
    answer:
      "None is calculated. An ROI needs three things this project does not have: MOIL's real production and cost data (proprietary, PRD §8.2 — the operational data here is synthetic), a validated causal link from a recommendation to an outcome, and a deployment long enough to measure one. What can be shown instead is measured, and it is on the console rather than in this answer: the rolling-origin backtest against a seasonal-naive baseline, and how often the daily prediction intervals held, each with its interval and provenance. The probability of shortfall is withdrawn while under validation. Those are properties of the model on this synthetic dataset, not of anyone's balance sheet.",
  },
  {
    id: 'k9',
    category: 'operations',
    keywords: ['twin', 'mine twin', 'simulator', 'flight simulator', 'dispatch', 'truck', 'dumper', 'fuel', 'shovel'],
    question: "How does Mine twin help plan a shift?",
    answer:
      "Mine twin is a what-if calculator for one mine. You set operating assumptions — the haulage shift, a blasting delay, equipment redeployment, a dry-blast tolerance — and it shows what that arithmetic gives against the mine's own forecast baseline, and whether the constraint engine permits the plan. The multipliers are stated planner assumptions, not fitted coefficients, and the page labels the result as an assumption-based estimate, not a forecast. It is not a discrete-event simulator, models no shovel cycles or fuel burn, and controls no equipment.",
  },
  {
    id: 'k10',
    category: 'security',
    keywords: ['security', 'cloud', 'meghraj', 'nic', 'classified', 'data', 'sovereignty', 'encryption', 'offline', 'edge'],
    question: "How is data secured, and does it run offline?",
    answer:
      "Honestly: this is a hackathon build, not a deployed government system. It is not hosted on NIC or MeghRaj, and no encryption or uptime figure is claimed for it. What it does do: the backend serves committed, versioned artifacts, so the forecasts and the backtest are on screen without a network; the map can draw its imagery from a local tile cache; and when a live source is unreachable the console says so — weather turns SYNTHETIC with a DEGRADED banner — rather than inventing a value. Auth routes refuse to run without a session secret, and secrets come only from the environment.",
  },
  {
    id: 'k11',
    category: 'tech',
    keywords: ['tech', 'stack', 'frontend', 'backend', 'database', 'languages', 'nextjs', 'fastapi', 'postgis'],
    question: 'What is the complete technology stack of NAKSHATRA-X?',
    answer:
      "Architecture:\n• Frontend: Next.js and React, with Tailwind CSS, Recharts for charts and Leaflet for the map\n• Backend: FastAPI (Python), plus Next.js route handlers that proxy it\n• Data: committed synthetic operational data generated to a published ingestion contract, and versioned model artifacts\n• Auth: Firebase and Supabase for sign-in and profiles\n• ML: scikit-learn and SciPy\nThere is no MQTT/Modbus SCADA integration, no TimescaleDB, no PostGIS and no 3D canvas in this codebase.",
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
      "The console leads each screen with one answer in plain words — which mine is short and by how much — and puts the evidence one click below it. Status colours are always paired with a text label and a distinct shape, so they read in greyscale and for colour-blind users, and every synthetic figure carries a SYNTHETIC badge. There is no voice interface and no Hindi or Marathi translation in this build.",
  },
  {
    id: 'k14',
    category: 'project',
    keywords: ['scale', 'nmdc', 'coal', 'nalco', 'iron', 'bauxite', 'expansion', 'minerals'],
    question: 'Can NAKSHATRA-X scale to other minerals like Iron Ore, Coal, or Bauxite?',
    answer:
      "In principle the method is not specific to manganese: Track A ranks places from surface band ratios and terrain, and Track B forecasts production per grade, so both could be refitted for another mineral with its own spectral ratios, grades and labelled sites. Nothing has been built or validated for iron ore, coal or bauxite, so no claim about them is made.",
  },
  {
    id: 'k15',
    category: 'team',
    keywords: ['team', 'built', 'sih', '26009', 'people', 'hackathon', 'who', 'problem statement'],
    question: 'Who built NAKSHATRA-X and what is SIH Problem Statement 26009?',
    answer:
      "NAKSHATRA-X is built for Smart India Hackathon 2026, Problem Statement 26009 for the Ministry of Steel and MOIL Limited. It answers two questions on two clocks: Track B forecasts where production will fall short over days to months, per mine and per grade, and Track A ranks where prospecting is more likely to be worthwhile over years, from surface geology and terrain. Every figure carries its source and uncertainty.",
  },
  {
    id: 'k16',
    category: 'operations',
    keywords: ['website', 'pages', 'navigation', 'menu', 'structure', 'how to use', 'features list', 'where'],
    question: 'What are the main pages and features on the NAKSHATRA-X website?',
    answer:
      "The main pages:\n1. Landing (`/`): what the two tracks are, and a way in.\n2. Console (`/console`): the portfolio ranked by expected shortfall, each mine's forecast, backtest and constraint-checked actions, and Track A prospectivity with its map.\n3. Mine twin (`/mine-twin`): the what-if calculator with the constraint check.\n4. Production (`/production`): a mine's production picture over synthetic operational data, labelled as such.\n5. Blending (`/blending`): the SciPy linear-programming blend optimiser.\n6. Method (`/method`): how each model was built and validated.\n7. About (`/about`): the problem statement and its background.",
    actionButton: {
      label: "Open the console",
      type: 'guidance',
    },
  },
  {
    id: 'k17',
    category: 'features',
    keywords: ['ml studio', 'evaluator', 'training', 'xgboost', 'prophet', 'confusion matrix', 'roc auc'],
    question: "What is on the Method page (/method)?",
    answer:
      "Method (`/method`) explains how each model was built and validated: Track A's leave-one-mine-out validation and why the earlier, leaky figure was withdrawn, and Track B's rolling-origin backtest against a seasonal-naive baseline and how its intervals were calibrated. Training runs offline in the batch job; there is no in-browser training console.",
  },
  {
    id: 'k18',
    category: 'operations',
    keywords: ['mine twin', '3d twin', 'dumper', 'excavator', 'fuel burn', 'cycle time', 'simulation'],
    question: "What is the Mine twin page (/mine-twin)?",
    answer:
      "A what-if calculator over a synthetic series generated to the published ingestion contract, labelled as synthetic on the page. You change the operating assumptions and see the arithmetic against the mine's forecast baseline, and the constraint engine says whether the plan is allowed — a delayed blast outside the permitted windows is rejected by name. It is not a 3D or discrete-event simulator and has no equipment model.",
  },
  {
    id: 'k19',
    category: 'features',
    keywords: ['production', 'sentinel', 'pumps', 'dewatering', 'scada', 'haul road', 'interlock'],
    question: "What is on the Production page (/production)?",
    answer:
      "It shows the Track B production picture for a mine: recent output against plan and an activity feed over synthetic operational data, which the page labels as simulated. There are no InSAR sensors, no MQTT interlocks and no pumps under its control; that description belonged to a system that was never built. Rainfall reaches the forecaster as a measured weather input, not as a control signal.",
    actionButton: {
      label: "Can it send a dewatering order?",
      type: 'dewatering',
    },
  },
  {
    id: 'k20',
    category: 'features',
    keywords: ['ore blending', 'blending', 'stockpile', 'scipy', 'simplex', 'grade', '42%'],
    question: "How does the Blending page (/blending) work?",
    answer:
      "A SciPy HiGHS linear program combines the available stockpiles into a least-cost blend subject to the grade constraints you set. Its most useful behaviour is reporting infeasibility: when no blend can meet the constraints it says so and names the binding one, instead of returning a near miss that looks like a solution. It locks no specs, eliminates no penalties and saves no stated amount — the stockpile figures are synthetic, so a monetary result would describe the generator, not a mine.",
    actionButton: {
      label: "Where do I run a blend?",
      type: 'blending',
    },
  },
  {
    id: 'k21',
    category: 'project',
    keywords: ['about', 'sih', 'problem statement', 'moil', 'background', 'ministry of steel', 'details'],
    question: 'What is documented on the About Page (/about)?',
    answer:
      "The About page sets out SIH Problem Statement 26009 for MOIL Limited and the Ministry of Steel: the background, and the expected solution as the problem statement describes it — a dashboard showing predicted reserves, production trends, possible shortfall risks and recommended corrective steps. How this build answers it, and what it deliberately does not claim, is on the console and the Method page.",
  },
  {
    id: 'k22',
    category: 'security',
    keywords: ['login', 'sign in', 'admin', 'auth', 'google', 'otp', 'guest', 'portal'],
    question: 'How do operators and administrators sign in?',
    answer:
      "Sign-in options:\n1. Email one-time code.\n2. Google sign-in.\n3. GitHub sign-in.\n4. Guest mode, for a look without an account.\nAdministrators use `/admin/login`. The console itself does not require signing in.",
  },
]

