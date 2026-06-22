
# The Forge – MVP-plan

En mörk, industriell träningsapp på svenska där styrka, cirkelpass och löpning matar samma streak, XP, nivå och heatmap. Fokus: extremt snabb loggning + omedelbar visuell feedback.

## 1. Backend (Lovable Cloud)

Aktivera Lovable Cloud och skapa följande tabeller med RLS (per användare via `auth.uid()`):

- **profiles** – `id (uuid = auth.users)`, `display_name`, `units` (`kg`/`km`), `created_at`
- **exercises** – `id`, `name`, `category` (Underkropp/Push/Pull/Core/Cirkel/Annat), `default_sets`, `default_reps`, `is_global` (seed-övningar globalt läsbara)
- **workout_templates** – `id`, `user_id`, `name`, `description`, `session_type` (`styrka`/`cirkel`), `is_global`
- **template_exercises** – `id`, `template_id`, `exercise_id`, `order_index`, `target_sets`, `target_reps`
- **workouts** – `id`, `user_id`, `date`, `session_type` (`styrka`/`cirkel`/`löpning`), `template_id?`, `notes`, `duration_minutes`, `energy_level` (1-5), `sunlight_done`, `cold_exposure_done`, `xp_awarded`, `had_pr`
- **sets** – `id`, `workout_id`, `exercise_id`, `set_index`, `weight`, `reps`, `rpe?`, `notes`
- **running_sessions** – `id`, `workout_id`, `distance_km`, `duration_minutes`, `avg_pace_seconds`, `effort_level` (1-10), `route_notes`
- **achievements** – `id`, `code`, `name`, `description`, `icon`, `criteria_type`, `criteria_value` (global tabell, seedad)
- **user_achievements** – `user_id`, `achievement_id`, `unlocked_at`, `progress`
- **user_stats** – `user_id` (PK), `total_sessions`, `current_streak`, `longest_streak`, `total_xp`, `current_level`, `last_workout_date`
- **weekly_quests** – `id`, `user_id`, `week_start`, `description`, `target`, `progress`, `completed`

Trigger: `on auth.users insert` → skapa `profiles` + `user_stats` + initial weekly quest.

Alla `public.*` tabeller får `GRANT`s + RLS-policies scoped till `auth.uid()`. Globala tabeller (`exercises` där `is_global`, `achievements`, globala templates) får `SELECT TO authenticated`.

## 2. Kärnlogik (server functions i `src/lib/*.functions.ts`)

- `logWorkout({type, payload})` – atomär insert av workout + sets/running, kör därefter:
  - **Streak**: om `last_workout_date = igår` → +1, om = idag → oförändrad, annars reset till 1. Uppdatera `longest_streak`.
  - **XP**: base 50/pass. +25 om PR. +10 om progressive overload (totalvolym > förra passet av samma typ). +15 cirkel-bonus om >4 rundor. Löpning: +25 om distans-PR eller pace-PR.
  - **Level**: `floor(sqrt(total_xp / 80))`.
  - **PR**: jämför `weight*reps` per övning mot historiskt max; löpning jämför distans, tid, pace.
  - **Achievements**: utvärdera kriterier (streak_days, total_sessions, pr_count, total_distance, första cirkel, första löprunda, level-trösklar).
  - **Weekly quest**: öka progress, markera completed.
  - Returnerar `{xp_gained, new_level, leveled_up, streak, prs[], unlocked_achievements[]}` för toast-feedback.
- `getDashboard()` – stats, senaste 42 dagars heatmap-data, senaste achievements, aktiv quest, grafdata (squat-vikt + pace över tid).
- `getHistory({filter})`, `getWorkoutDetail(id)`.
- `getWeeklyReview()` – aggregerar veckans pass och anropar Lovable AI (`google/gemini-3-flash-preview`) med svensk prompt → returnerar 2-3 konkreta förslag.

## 3. Sidor & routing (TanStack)

```
src/routes/
  __root.tsx               (mörkt tema, BottomNav, Toaster)
  index.tsx                (redirect → /dashboard om inloggad, annars /auth)
  auth.tsx                 (enkel e-post/lösenord)
  _authenticated/
    route.tsx              (managed gate)
    dashboard.tsx
    log.strength.tsx
    log.circuit.tsx
    log.running.tsx
    history.index.tsx
    history.$id.tsx
    review.tsx             (veckoreview med AI)
    achievements.tsx
    settings.tsx
```

**Dashboard**: Stor streak-räknare (🔥 + orange glow), Forge Level + progress bar, avatar-initial. Tre stora CTA-knappar (Styrka / Cirkel / Löpning). 6-veckors heatmap (orange gradient efter intensitet/typ). Två line charts (Recharts): bästa squat-vikt över tid + snitt-pace. Weekly Quest-kort. Senaste 3 achievements. Liten "compounding"-text: "Din consistency ger +X% projicerad utveckling i kvartalet".

**Loggningsflöden** – varje med stora +/− steppers, sticky "Spara"-knapp, minimal textinmatning:
- *Styrka*: mall-väljare (Pass A/B/Custom) → lista av övningar med set-rader (vikt/reps). Plus-knapp för fler övningar/sets.
- *Cirkel*: mall eller eget. Fält: antal rundor, total tid, övningar per runda (valfritt).
- *Löpning*: distans, tid (mm:ss), pace auto-beräknas, effort-slider 1-10, anteckning.

Efter spar: toast med XP/streak/PR + ev. confetti-pulse + navigera till dashboard.

**Historik**: filter-chips (Alla/Styrka/Cirkel/Löpning), lista grupperad per vecka. Detaljvy visar sets eller löpdata.

**Veckoreview**: sammanfattning (antal pass per typ, total volym, totaldistans, streak-utveckling) + AI-genererade förslag på svenska.

**Achievements**: grid med låsta (gråa) + upplåsta (orange glow) + progressbar.

**Inställningar**: namn, enheter, logga ut.

## 4. Design

`src/styles.css` (Tailwind v4 `@theme inline` + oklch tokens):
- `--background` #0F0F0F, `--card` #18181A, `--border` #262626
- `--primary` #FF6B00 (orange), `--primary-glow`, `--accent` rödorange
- `--foreground` near-white, `--muted-foreground` mellangrå
- Gradient-tokens: `--gradient-forge` (orange→röd), `--shadow-ember` (orange glow)
- Font: Inter via `<link>` i `__root.tsx`

Komponenter: shadcn Card/Button/Dialog/Tabs/Progress/Sonner + egna `StreakBadge`, `LevelBar`, `Heatmap`, `StatCard`, `StepperInput`, `BottomNav`, `WorkoutTypeButton`.

Mobil-first med bottom navigation (Dashboard / Logga / Historik / Achievements / Inställningar). Desktop får sidopadding + max-width.

## 5. Seed-data

Migration seedar:
- ~15 övningar (Knäböj, Marklyft, Bulgarian Split Squat, Push-ups, Pike Push-ups, Dips, Pull-ups, Australian Rows, Hollow Hold, Plankan, Russian Twists, Burpees, Mountain Climbers, Jump Squats, Kettlebell Swings).
- 3 globala templates: "Pass A" (push-fokus), "Pass B" (pull/ben), "Cirkel 20 min".
- 10 achievements (Första passet, 3-dagars streak, 7-dagars streak, 14-dagars, 25 pass totalt, Första löprundan, 10 km totalt, Första PR, Level 5, Allsidig: minst en av varje typ).

För den inloggade demo-användaren (server-fn `seedDemoData` som körs vid första dashboard-laddning om `total_sessions = 0`): 13 spridda historiska pass över senaste 6 veckorna (mix styrka/cirkel/löpning), några PRs, 4 upplåsta achievements, en aktiv weekly quest "Genomför 3 pass denna vecka".

## 6. AI

Veckoreview anropar Lovable AI Gateway via `createServerFn` med veckans aggregerade data. Prompt på svenska ber om 2-3 korta, konkreta förslag (mönster i missade dagar, progressionstips, balans). Hanterar 429/402 med tydligt felmeddelande.

## 7. Implementationsordning

1. Cloud + schema + RLS + seed.
2. Design tokens + BottomNav + auth.
3. Dashboard (med mockad data först) + heatmap + stats.
4. `logWorkout` server-fn med streak/XP/PR/achievements.
5. Tre loggningsflöden + toast-feedback.
6. Historik + detaljvy.
7. Achievements-sida.
8. Veckoreview + AI.
9. Demo-seed + putsning.

## Utanför scope
Sociala funktioner, periodisering, betalningar, push-notiser, wearable-sync, foton, dryckes-/sömnloggning utöver `sunlight_done`/`cold_exposure_done` flaggorna.
