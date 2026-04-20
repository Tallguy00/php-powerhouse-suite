
-- ===== ROLES ENUM =====
CREATE TYPE public.app_role AS ENUM ('admin', 'technician', 'customer');
CREATE TYPE public.bill_status AS ENUM ('unpaid', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.outage_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.outage_status AS ENUM ('reported', 'investigating', 'in_progress', 'resolved');
CREATE TYPE public.task_status AS ENUM ('assigned', 'in_progress', 'completed');
CREATE TYPE public.customer_type AS ENUM ('residential', 'commercial', 'industrial');

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  region TEXT,
  customer_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ===== REGIONS =====
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_am TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.regions (code, name_en, name_am) VALUES
  ('AA', 'Addis Ababa', 'አዲስ አበባ'),
  ('OR', 'Oromia', 'ኦሮሚያ'),
  ('AM', 'Amhara', 'አማራ'),
  ('TG', 'Tigray', 'ትግራይ'),
  ('SN', 'Sidama', 'ሲዳማ'),
  ('SO', 'Somali', 'ሶማሌ'),
  ('AF', 'Afar', 'አፋር'),
  ('BG', 'Benishangul-Gumuz', 'ቤንሻንጉል-ጉሙዝ'),
  ('GM', 'Gambela', 'ጋምቤላ'),
  ('HR', 'Harari', 'ሐረሪ'),
  ('DD', 'Dire Dawa', 'ድሬዳዋ'),
  ('SW', 'South West Ethiopia', 'ደቡብ ምዕራብ ኢትዮጵያ'),
  ('SE', 'South Ethiopia', 'ደቡብ ኢትዮጵያ'),
  ('CE', 'Central Ethiopia', 'ማዕከላዊ ኢትዮጵያ');

-- ===== TARIFFS =====
CREATE TABLE public.tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  customer_type customer_type NOT NULL,
  price_per_kwh NUMERIC(10,4) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tariffs (name, customer_type, price_per_kwh) VALUES
  ('Residential Standard', 'residential', 0.6943),
  ('Commercial Standard', 'commercial', 1.3500),
  ('Industrial Standard', 'industrial', 1.8200);

-- ===== METERS =====
CREATE TABLE public.meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id UUID REFERENCES public.regions(id),
  customer_type customer_type NOT NULL DEFAULT 'residential',
  installed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;

-- ===== BILLS =====
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  kwh_consumed NUMERIC(12,2) NOT NULL,
  amount_etb NUMERIC(12,2) NOT NULL,
  status bill_status NOT NULL DEFAULT 'unpaid',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- ===== PAYMENTS =====
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_etb NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'telebirr',
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ===== OUTAGES =====
CREATE TABLE public.outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES public.regions(id),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  severity outage_severity NOT NULL DEFAULT 'medium',
  status outage_status NOT NULL DEFAULT 'reported',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.outages ENABLE ROW LEVEL SECURITY;

-- ===== TECHNICIAN TASKS =====
CREATE TABLE public.technician_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outage_id UUID NOT NULL REFERENCES public.outages(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'assigned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.technician_tasks ENABLE ROW LEVEL SECURITY;

-- ===== TIMESTAMP TRIGGER =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.technician_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== AUTO-CREATE PROFILE + CUSTOMER ROLE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, customer_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'EEU-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 8))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS POLICIES =====
-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Technicians view profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'technician'));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- regions (public read for authed)
CREATE POLICY "Authed read regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage regions" ON public.regions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- tariffs
CREATE POLICY "Authed read active tariffs" ON public.tariffs FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage tariffs" ON public.tariffs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- meters
CREATE POLICY "Customers view own meters" ON public.meters FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Admins view all meters" ON public.meters FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Technicians view meters" ON public.meters FOR SELECT USING (public.has_role(auth.uid(), 'technician'));
CREATE POLICY "Admins manage meters" ON public.meters FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- bills
CREATE POLICY "Customers view own bills" ON public.bills FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Admins view all bills" ON public.bills FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage bills" ON public.bills FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- payments
CREATE POLICY "Customers view own payments" ON public.payments FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers create own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admins view all payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- outages
CREATE POLICY "Authed view outages" ON public.outages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Customers report outages" ON public.outages FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Admins manage outages" ON public.outages FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Technicians update outages" ON public.outages FOR UPDATE USING (public.has_role(auth.uid(), 'technician'));

-- technician_tasks
CREATE POLICY "Technicians view own tasks" ON public.technician_tasks FOR SELECT USING (auth.uid() = technician_id);
CREATE POLICY "Technicians update own tasks" ON public.technician_tasks FOR UPDATE USING (auth.uid() = technician_id);
CREATE POLICY "Admins manage tasks" ON public.technician_tasks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
