-- Seed default master fee rates for SALUT and UT Official
INSERT INTO public.fee_rates (fee_type_id, study_program_id, service_scheme_id, calculation_type, amount, is_active)
SELECT 
  ft.id as fee_type_id,
  NULL as study_program_id,
  NULL as service_scheme_id,
  CASE WHEN ft.is_per_sks THEN 'per_sks' ELSE 'fixed' END as calculation_type,
  CASE 
    WHEN ft.code = 'SALUT_SERVICE' THEN 250000
    WHEN ft.code = 'ADMISION' THEN 100000
    WHEN ft.code = 'TUITION_PACKAGE' THEN 1300000
    WHEN ft.code = 'COURSE_PER_SKS' THEN 35000
    ELSE 100000
  END as amount,
  TRUE as is_active
FROM public.fee_types ft
ON CONFLICT DO NOTHING;
