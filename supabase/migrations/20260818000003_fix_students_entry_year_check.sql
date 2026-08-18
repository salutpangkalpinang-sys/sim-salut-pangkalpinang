-- Fix check constraint on public.students.entry_year to allow 5-digit UT Masa (e.g. 20251, 20261, 20262)
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_entry_year_check;

ALTER TABLE public.students ADD CONSTRAINT students_entry_year_check 
  CHECK (entry_year IS NULL OR (entry_year >= 1980 AND entry_year <= 2100) OR (entry_year >= 19801 AND entry_year <= 21002));
