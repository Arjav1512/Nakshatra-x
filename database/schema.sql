-- ==============================================================================
-- NAKSHATRA-X : ENTERPRISE USER DATA STORE & REAL-TIME GOOGLE AUTH SYNC
-- ==============================================================================

-- 1. Create Types safely if they don't already exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'operator', 'analyst', 'admin', 'superadmin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise', 'orbital');
  END IF;
END $$;

-- 2. Create the unified user profile table
CREATE TABLE IF NOT EXISTS public.db_users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  
  -- Identity & Personal Variables
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone_number TEXT,
  
  -- Nakshatra-X Orbital Mission Roles & Clearances
  role user_role DEFAULT 'user'::user_role NOT NULL,
  designation TEXT DEFAULT 'Mission Specialist',
  security_clearance TEXT DEFAULT 'Level-1 (Telemetry Access)',
  
  -- Authentication & Telemetry Variables
  auth_provider TEXT DEFAULT 'google',
  last_sign_in_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  last_sign_in_ip TEXT,
  sign_in_count INTEGER DEFAULT 1,
  
  -- Subscription & Tier
  subscription_tier subscription_tier DEFAULT 'free'::subscription_tier NOT NULL,
  subscription_status TEXT DEFAULT 'active',
  
  -- UI / Mission Control Preferences (Dark mode, GIS overlays, alerts)
  preferences JSONB DEFAULT '{
    "theme": "dark",
    "gis3d": true,
    "sound_alerts": true,
    "telemetry_refresh_rate_ms": 2000,
    "preferred_projection": "3d-globe"
  }'::jsonb,
  
  -- Extra Metadata from Google OAuth (Locale, verified email, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configure Row Level Security (RLS)
ALTER TABLE public.db_users ENABLE ROW LEVEL SECURITY;

-- SELECT was previously `USING (true)`, which let any holder of the anon key
-- read every row in db_users (emails, names, metadata). A user may now read
-- only their own row; service-role keys bypass RLS for admin tooling.
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.db_users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.db_users;
CREATE POLICY "Users can view their own profile" ON public.db_users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.db_users;
CREATE POLICY "Users can insert their own profile" ON public.db_users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.db_users;
CREATE POLICY "Users can update their own profile" ON public.db_users
  FOR UPDATE USING (auth.uid() = id);

-- 4. Intelligent Auto-Sync Trigger from Google OAuth (auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_avatar TEXT;
  v_provider TEXT;
BEGIN
  -- Extract real data supplied by Google OAuth
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'given_name',
    split_part(v_full_name, ' ', 1)
  );
  
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'family_name',
    NULLIF(substring(v_full_name from ' (.*)$'), ''),
    ''
  );
  
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  );

  v_provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'google'
  );

  -- Upsert real profile into public.db_users
  INSERT INTO public.db_users (
    id,
    email,
    first_name,
    last_name,
    full_name,
    avatar_url,
    auth_provider,
    last_sign_in_at,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_full_name,
    v_avatar,
    v_provider,
    timezone('utc'::text, now()),
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, db_users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, db_users.avatar_url),
    last_sign_in_at = timezone('utc'::text, now()),
    sign_in_count = db_users.sign_in_count + 1,
    metadata = EXCLUDED.metadata,
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Updated_at auto-trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_db_users_updated_at ON public.db_users;
CREATE TRIGGER trg_db_users_updated_at
  BEFORE UPDATE ON public.db_users
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ==============================================================================
-- 7. ISRO RADAR SYNCED EARLY FLOOD ALERT & AUTOMATED SCADA PUMP TABLES
-- ==============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flood_risk_level') THEN
    CREATE TYPE flood_risk_level AS ENUM ('NOMINAL', 'MODERATE', 'CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scada_pump_status') THEN
    CREATE TYPE scada_pump_status AS ENUM ('STANDBY', 'ENGAGED', 'OFFLINE', 'MAINTENANCE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.flood_alert_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name TEXT NOT NULL,
  state_code VARCHAR(10) NOT NULL DEFAULT 'MH',
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  rainfall_14d_mm NUMERIC(8,2) NOT NULL DEFAULT 0.0,
  soil_moisture_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  land_surface_temp_c NUMERIC(5,2),
  humidity_pct NUMERIC(5,2),
  live_precipitation_rate_mm_hr NUMERIC(6,2) DEFAULT 0.0,
  flood_risk_level flood_risk_level NOT NULL DEFAULT 'NOMINAL',
  radar_lead_time_minutes INTEGER NOT NULL DEFAULT 30,
  scada_pump_status scada_pump_status NOT NULL DEFAULT 'STANDBY',
  telemetry_source TEXT DEFAULT 'LIVE Open-Meteo & ISRO MOSDAC Radar Stream',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scada_dewatering_pumps (
  pump_id VARCHAR(64) PRIMARY KEY,
  mine_code VARCHAR(32) NOT NULL,
  mine_name TEXT NOT NULL,
  shaft_level_m TEXT DEFAULT '-340m RL Sump',
  discharge_capacity_m3h NUMERIC(8,2) DEFAULT 1270.0,
  current_power_duty_pct NUMERIC(5,2) DEFAULT 0.0,
  status scada_pump_status NOT NULL DEFAULT 'STANDBY',
  auto_trigger_enabled BOOLEAN DEFAULT true,
  last_cloudburst_trigger_at TIMESTAMP WITH TIME ZONE,
  last_maintenance_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cloudburst_predictive_vectors (
  vector_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telemetry_id UUID REFERENCES public.flood_alert_telemetry(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  lead_time_label VARCHAR(32) NOT NULL,
  time_step_index INTEGER NOT NULL,
  predicted_rain_intensity_mm_hr NUMERIC(6,2) NOT NULL,
  recommended_scada_duty_pct NUMERIC(5,2) NOT NULL,
  isro_radar_confidence_pct NUMERIC(5,2) DEFAULT 94.2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

