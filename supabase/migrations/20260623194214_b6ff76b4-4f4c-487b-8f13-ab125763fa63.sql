DELETE FROM public.user_stats WHERE user_id NOT IN (SELECT DISTINCT user_id FROM public.workouts);
DELETE FROM public.weekly_quests WHERE user_id NOT IN (SELECT DISTINCT user_id FROM public.workouts);
DELETE FROM public.user_achievements WHERE user_id NOT IN (SELECT DISTINCT user_id FROM public.workouts);
DELETE FROM public.monthly_reviews WHERE user_id NOT IN (SELECT DISTINCT user_id FROM public.workouts);