-- Filter active service schemes for Bangka Belitung (SALUT Mega Cendekia)
-- Only 3 official schemes apply: SIPAS Non-TTM, SIPAS Semi, and Non-SIPAS

UPDATE public.service_schemes
SET is_active = FALSE
WHERE code IN ('SIPAS_PENUH', 'SIPAS_PLUS', 'SIPAS Penuh', 'SIPAS Plus') 
   OR name LIKE '%Penuh%' OR name LIKE '%Plus%';

UPDATE public.service_schemes
SET is_active = TRUE
WHERE code IN ('SIPAS_NON_TTM', 'SIPAS_SEMI', 'NON_SIPAS', 'SIPAS Non-TTM', 'SIPAS Semi', 'Non-SIPAS')
   OR name LIKE '%Non-TTM%' OR name LIKE '%Semi%' OR name LIKE '%Non-SIPAS%';
