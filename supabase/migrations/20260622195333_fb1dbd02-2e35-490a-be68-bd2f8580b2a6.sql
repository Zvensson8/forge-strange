
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('strength', 'distance', 'sessions', 'event')),
  -- Mål-värde och enhet
  target_value NUMERIC NOT NULL,
  target_unit TEXT NOT NULL,
  -- För 'strength': vikt i kg, target_reps anger reps
  target_reps INT,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  -- För 'distance' / 'sessions' / 'event': vilken passtyp som räknas
  session_type TEXT CHECK (session_type IN ('styrka', 'cirkel', 'löpning')),
  -- För 'event': datum att räkna ner mot
  target_date DATE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Påminnelse
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_cadence TEXT CHECK (reminder_cadence IN ('daily', 'weekly')) DEFAULT 'weekly',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX goals_user_status_idx ON public.goals(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals own" ON public.goals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_goals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER goals_touch_updated
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_goals_updated_at();
