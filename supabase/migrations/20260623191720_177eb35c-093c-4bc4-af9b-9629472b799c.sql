
-- Sub-goals + process goals
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS parent_goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS process_period TEXT CHECK (process_period IN ('week','month'));
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS process_target_count INT;

-- Tillåt process som goal_type
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_goal_type_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_goal_type_check
  CHECK (goal_type IN ('strength', 'distance', 'sessions', 'event', 'process'));

-- Tillåt cykling / promenad som session_type på mål
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_session_type_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_session_type_check
  CHECK (session_type IN ('styrka', 'cirkel', 'löpning', 'cykling', 'promenad'));

CREATE INDEX IF NOT EXISTS goals_parent_idx ON public.goals(parent_goal_id);

-- Cachad månadsreview
CREATE TABLE IF NOT EXISTS public.monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  payload JSONB NOT NULL,
  insights TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reviews TO authenticated;
GRANT ALL ON public.monthly_reviews TO service_role;

ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_reviews own" ON public.monthly_reviews
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER monthly_reviews_touch_updated
  BEFORE UPDATE ON public.monthly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_goals_updated_at();
