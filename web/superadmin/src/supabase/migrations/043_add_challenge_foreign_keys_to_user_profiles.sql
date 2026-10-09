-- Migration 043: Add foreign key constraints from challenges to user_profiles and reload PostgREST cache

-- 1. Clean up any orphaned challenger_id or accepted_by records that do not exist in user_profiles
UPDATE public.challenges
SET accepted_by = NULL
WHERE accepted_by IS NOT NULL
  AND accepted_by NOT IN (SELECT id FROM public.user_profiles);

DELETE FROM public.challenges
WHERE challenger_id IS NOT NULL
  AND challenger_id NOT IN (SELECT id FROM public.user_profiles);

-- 2. Drop legacy or duplicate constraints if present
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS fk_challenges_challenger_user_profiles;
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS fk_challenges_acceptor_user_profiles;

-- 3. Add explicit foreign key constraints referencing public.user_profiles(id)
ALTER TABLE public.challenges
  ADD CONSTRAINT fk_challenges_challenger_user_profiles
  FOREIGN KEY (challenger_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.challenges
  ADD CONSTRAINT fk_challenges_acceptor_user_profiles
  FOREIGN KEY (accepted_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
