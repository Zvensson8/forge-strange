# Plan: Långsiktig progression, smartare review och starkare feedback

Stort paket – jag bygger det i fyra sammanhängande delar så allt hänger ihop. Mörk smides-estetik och orange accent behålls. Allt på svenska.

---

## 1. Trajectory & långsiktig progression

**Dashboard – Trajectory-kort**
- Nytt kort högst upp (under streak/level) för det mest tidskritiska aktiva målet (event närmast i tid, annars första aktiva).
- Linjediagram: faktisk kumulativ progress vs. krävd linjär takt fram till deadline. Två linjer + en "nu"-prick.
- Statusrad: "På rätt spår" / "Behöver öka takten" + konkret tal: *"Öka med 0,8 km/vecka"* eller *"+1,5 kg på bänkpress inom 3 veckor"*.

**Compounding-vy (1 %-effekten)**
- Liten panel på dashboard och på målsidan: *"Fortsätter du i nuvarande takt är du ~18 % starkare om 12 veckor"*.
- Räknas från senaste 4 veckornas trend (PR-utveckling för styrkemål, snittpace/distans för uthållighet, antal pass för processmål).

**Målsidan blir mer visuell**
- Måldetaljvyn får två grafer istället för en:
  1. Utveckling över tid mot målvärdet (finns delvis – förbättras med "krävd takt"-linje och prognoslinje).
  2. Veckovis bidrag (stapeldiagram – hur mycket varje vecka tog dig närmare).
- Mållista (`/goals`) får mini-sparkline per kort.

**Tekniskt**
- Ny serverfunktion `getGoalTrajectory(goalId)` → returnerar `{ actualSeries, requiredSeries, projection, weeklyDelta, requiredPace, currentPace, compoundingPct }`.
- Beräkning sker server-side från `workouts` + `sets` + `running_sessions`.

---

## 2. Vecko- och månadsreview

**Veckoreviewn utökas** (samma sida, fler sektioner från AI:n):
- **Målstatus nu** – auto-genererad rad per aktivt mål: nuläge, krävd takt, gap.
- **Vad fungerade / vad föll bort** – heuristik på vilka veckodagar och aktivitetstyper som fick pass (jämfört med snittet de senaste 4 veckorna).
- **Konkreta rekommendationer för nästa vecka** – AI:n får full mål- och pace-kontext och måste ge 2–3 specifika action items (t.ex. *"Lägg in en cykelrunda 30 min på torsdag"*).

**Ny månadsreview**
- Ny route `/review/month` + knapp i veckoreview ("Se månadsöversikt").
- Visas automatiskt som prompt på dashboard första gången användaren öppnar appen i en ny månad.
- Innehåll: total volym per aktivitet, antal pass, alla PR:er, mål-delta (% förflyttning per mål under månaden), 4-veckors heatmap, AI-summering.
- Cachas i ny tabell `monthly_reviews` (user_id, month_start, payload jsonb).

---

## 3. Smartare målsystem

**Delmål (sub-goals)**
- `goals`-tabellen utökas med `parent_goal_id uuid null`.
- I `/goals/new`: när man skapar ett mål kan man lägga till delmål direkt (t.ex. huvudmål "Halvmaraton sub 1:55" + delmål "10 km sub 55").
- I måldetaljvy: delmål visas som checklist med egna progressbars under huvudmålet.

**"Det här tog dig närmare målet"**
- Efter loggning: success-toast/skärm som listar berörda mål och delta i procentenheter: *"Bänkpress 35×6 → +4 % mot målet 40 kg × 8 (nu 72 %)"*.
- Visas både direkt efter logg och i historik-detaljvyn.

**"Risk att missa målet"-varning**
- När pace = `behind` eller `danger`: röd/amber banner på dashboard med konkret förslag genererat från krävd takt (samma data som Trajectory).
- Också i veckoreviewn som egen sektion när minst ett mål är i riskzonen.

**Process- vs prestationsmål**
- Ny `goal_type = 'process'` (utöver befintliga `strength`/`distance`/`sessions`/`event`).
- Definieras som "X pass per vecka av typ Y" eller "Logga minst Z minuter/vecka". Mäts rullande över valda veckor.
- Visualiseras som rad med veckorutor (gröna = uppfyllda veckor) istället för stapel.

---

## 4. Dopamin och omedelbar feedback

**Stark logg-bekräftelse**
- Ny `LogSuccess`-komponent som visas efter varje logg istället för enkel toast:
  - XP fått + ny totalnivå (med progressbar-animation).
  - "Wins" auto-detekterade: längsta pass på X veckor, ny PR, snabbaste pace på X veckor, första gången sedan datum, streak-milstolpe.
  - Berörda mål med delta-procent.
  - Knapp "Klart" som tar tillbaka till dashboard.

**Streak-fara**
- På dashboard: om streak > 0 och inget pass loggat idag, visas en amber-ruta efter kl 18:00 lokal tid: *"Träna idag för att hålla 47 dagars streak"*.
- Vid streak ≥ 7 dagar visas faran tidigare på dagen (efter kl 12).

**Små "wins" visas även på dashboard**
- Litet "Senaste milstolpe"-kort med den nyaste auto-detekterade prestationen, så den inte bara syns vid loggning.

**Tekniskt**
- Ny hjälpare `detectWins(userId, workoutId)` som returnerar lista av wins. Körs i `logStrength`/`logDistance`/`logCircuit`/`logQuick` och returneras till klienten tillsammans med XP/level-delta.

---

## Tekniska ändringar i korthet

```text
DB-migration:
  - ALTER TABLE goals ADD COLUMN parent_goal_id uuid references goals
  - ALTER TABLE goals: tillåt goal_type = 'process' + nya kolumner
    (process_period 'week'|'month', process_target_count int)
  - CREATE TABLE monthly_reviews (user_id, month_start, payload jsonb, ...)
  - GRANT + RLS som vanligt

Server fns (src/lib/):
  - goals.functions.ts: + getGoalTrajectory, + computeProcessGoalProgress,
    uppdaterad computeGoalsWithProgress (delmål, compounding)
  - workout.functions.ts: + detectWins, returnera wins+xp+level från logg-fns,
    uppdaterad getWeeklyReview (mål-kontext + rekommendationer),
    + getMonthlyReview, + getDashboardTrajectory

UI:
  - src/components/forge/TrajectoryCard.tsx (nytt)
  - src/components/forge/CompoundingBadge.tsx (nytt)
  - src/components/forge/LogSuccess.tsx (nytt – ersätter toast efter logg)
  - src/components/forge/StreakDangerBanner.tsx (nytt)
  - src/components/forge/WinChip.tsx (nytt)
  - GoalCard: + sparkline, + delmål-rendering, + process-vy
  - Ny route src/routes/_authenticated/review.month.tsx
  - Uppdaterade: dashboard, review, goals.$id, goals.new, alla log.*-routes
```

---

## Vad jag INTE gör i denna omgång (för att hålla scope)

- Push-notiser (in-app banners räcker enligt tidigare beslut).
- Sociala/delningsfunktioner.
- AI-genererade träningsprogram (bara rekommendationer i review).

Säg till om något ska skalas ner eller delas upp i flera steg, annars kör jag hela paketet.