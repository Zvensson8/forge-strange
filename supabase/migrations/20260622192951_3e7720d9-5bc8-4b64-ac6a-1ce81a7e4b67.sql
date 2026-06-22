
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  units_weight TEXT NOT NULL DEFAULT 'kg',
  units_distance TEXT NOT NULL DEFAULT 'km',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- exercises
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_sets INT NOT NULL DEFAULT 3,
  default_reps INT NOT NULL DEFAULT 10,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises read" ON public.exercises FOR SELECT TO authenticated USING (is_global OR user_id = auth.uid());
CREATE POLICY "exercises insert own" ON public.exercises FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_global);
CREATE POLICY "exercises update own" ON public.exercises FOR UPDATE TO authenticated USING (user_id = auth.uid() AND NOT is_global);
CREATE POLICY "exercises delete own" ON public.exercises FOR DELETE TO authenticated USING (user_id = auth.uid() AND NOT is_global);

-- workout_templates
CREATE TABLE public.workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_templates TO authenticated;
GRANT ALL ON public.workout_templates TO service_role;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl read" ON public.workout_templates FOR SELECT TO authenticated USING (is_global OR user_id = auth.uid());
CREATE POLICY "tpl insert own" ON public.workout_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_global);
CREATE POLICY "tpl update own" ON public.workout_templates FOR UPDATE TO authenticated USING (user_id = auth.uid() AND NOT is_global);
CREATE POLICY "tpl delete own" ON public.workout_templates FOR DELETE TO authenticated USING (user_id = auth.uid() AND NOT is_global);

-- template_exercises
CREATE TABLE public.template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  target_sets INT NOT NULL DEFAULT 3,
  target_reps INT NOT NULL DEFAULT 10
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_exercises TO authenticated;
GRANT ALL ON public.template_exercises TO service_role;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tplex read" ON public.template_exercises FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND (t.is_global OR t.user_id = auth.uid()))
);
CREATE POLICY "tplex write" ON public.template_exercises FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
);

-- workouts
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT NOT NULL,
  template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  notes TEXT,
  duration_minutes INT,
  energy_level INT,
  sunlight_done BOOLEAN NOT NULL DEFAULT false,
  cold_exposure_done BOOLEAN NOT NULL DEFAULT false,
  xp_awarded INT NOT NULL DEFAULT 0,
  had_pr BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workouts_user_date_idx ON public.workouts(user_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workouts own" ON public.workouts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sets
CREATE TABLE public.sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  set_index INT NOT NULL DEFAULT 1,
  weight NUMERIC,
  reps INT,
  rpe NUMERIC,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sets TO authenticated;
GRANT ALL ON public.sets TO service_role;
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sets own" ON public.sets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
);

-- running_sessions
CREATE TABLE public.running_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL UNIQUE REFERENCES public.workouts(id) ON DELETE CASCADE,
  distance_km NUMERIC NOT NULL,
  duration_minutes NUMERIC NOT NULL,
  avg_pace_seconds INT NOT NULL,
  effort_level INT,
  route_notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.running_sessions TO authenticated;
GRANT ALL ON public.running_sessions TO service_role;
ALTER TABLE public.running_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run own" ON public.running_sessions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
);

-- achievements (global)
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value NUMERIC NOT NULL
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ach read all" ON public.achievements FOR SELECT TO authenticated USING (true);

-- user_achievements
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ,
  progress NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (user_id, achievement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua own" ON public.user_achievements FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- user_stats
CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  total_xp INT NOT NULL DEFAULT 0,
  current_level INT NOT NULL DEFAULT 0,
  last_workout_date DATE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats own" ON public.user_stats FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- weekly_quests
CREATE TABLE public.weekly_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  description TEXT NOT NULL,
  target INT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_quests TO authenticated;
GRANT ALL ON public.weekly_quests TO service_role;
ALTER TABLE public.weekly_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest own" ON public.weekly_quests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wk DATE := date_trunc('week', CURRENT_DATE)::date;
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.weekly_quests (user_id, week_start, description, target)
    VALUES (NEW.id, wk, 'Genomför 3 pass denna vecka', 3)
    ON CONFLICT (user_id, week_start) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
