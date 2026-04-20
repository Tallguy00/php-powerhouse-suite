-- Promote the first/only existing user to admin + technician (in addition to customer)
INSERT INTO public.user_roles (user_id, role)
SELECT '0dd638d6-2a05-4373-9bf2-f943befa7de5'::uuid, 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '0dd638d6-2a05-4373-9bf2-f943befa7de5'::uuid AND role = 'admin'
);

INSERT INTO public.user_roles (user_id, role)
SELECT '0dd638d6-2a05-4373-9bf2-f943befa7de5'::uuid, 'technician'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '0dd638d6-2a05-4373-9bf2-f943befa7de5'::uuid AND role = 'technician'
);

-- Seed Ethiopian regions (idempotent)
INSERT INTO public.regions (code, name_en, name_am) VALUES
  ('AA', 'Addis Ababa', 'አዲስ አበባ'),
  ('OR', 'Oromia', 'ኦሮሚያ'),
  ('AM', 'Amhara', 'አማራ'),
  ('TG', 'Tigray', 'ትግራይ'),
  ('SD', 'Sidama', 'ሲዳማ'),
  ('SO', 'Somali', 'ሶማሌ'),
  ('AF', 'Afar', 'አፋር'),
  ('BG', 'Benishangul-Gumuz', 'ቤንሻንጉል ጉሙዝ'),
  ('GM', 'Gambela', 'ጋምቤላ'),
  ('HR', 'Harari', 'ሐረሪ'),
  ('DD', 'Dire Dawa', 'ድሬዳዋ'),
  ('SW', 'South West Ethiopia', 'ደቡብ ምዕራብ ኢትዮጵያ'),
  ('CE', 'Central Ethiopia', 'መካከለኛ ኢትዮጵያ'),
  ('SE', 'South Ethiopia', 'ደቡብ ኢትዮጵያ')
ON CONFLICT (code) DO NOTHING;

-- Seed default tariffs (ETB per kWh)
INSERT INTO public.tariffs (name, customer_type, price_per_kwh, active) VALUES
  ('Residential Standard', 'residential', 2.12, true),
  ('Commercial Standard', 'commercial', 3.65, true),
  ('Industrial Standard', 'industrial', 2.85, true)
ON CONFLICT DO NOTHING;