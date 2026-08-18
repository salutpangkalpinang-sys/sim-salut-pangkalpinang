-- Fix RLS policy for public.faculties to allow authenticated users to manage master data
DROP POLICY IF EXISTS "Authenticated users can read faculties" ON public.faculties;
DROP POLICY IF EXISTS "Authenticated users can manage faculties" ON public.faculties;

CREATE POLICY "Authenticated users can manage faculties" ON public.faculties
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert Sekolah Vokasi (SV)
INSERT INTO public.faculties (code, name) VALUES ('SV', 'Sekolah Vokasi')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Update D4 Kearsipan and D3 Perpajakan to link to SV
UPDATE public.study_programs
SET faculty_id = (SELECT id FROM public.faculties WHERE code = 'SV')
WHERE code IN ('411', '412') OR name LIKE '%Kearsipan%' OR name LIKE '%D-III Perpajakan%' OR name LIKE '%D3 Perpajakan%';
