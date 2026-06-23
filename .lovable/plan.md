
# Plan: Lugnare, tydligare, mer användbar Forge

Fokus efter dina svar: **du vill veta om du är på rätt väg**, appen ska **inte kännas tom**, och UI:t ska **städas och poleras**. Vi optimerar för två stunder: **direkt efter passet** och **kvällsreflektion**.

Inga nya features läggs till — vi tar bort, omprioriterar och poleras.

---

## 1. Dashboard: en skärm, ett budskap

Idag är dashboarden en lista av kort (streak, XP, quest, trajectory, mål, risk-banner, snabblogga). Det blir brus. Vi gör om till en tydlig hierarki:

```text
┌─────────────────────────────────┐
│  Hej {namn} · {dag, datum}      │  ← lugn header
│                                 │
│  ┌───────────────────────────┐  │
│  │  STATUS IDAG              │  │  ← EN tydlig mening
│  │  "Du ligger i fas med     │  │     genererad från mål +
│  │   ditt halvmaratonmål"    │  │     senaste 7 dagar
│  │   ●●●○○  on track         │  │
│  └───────────────────────────┘  │
│                                 │
│  [ Logga pass ]   ← primär CTA  │
│                                 │
│  Aktiva mål (kompakt lista)     │
│   • Halvmara  ▓▓▓▓▓░░  on track │
│   • 3 pass/v  ▓▓░░░░░  1/3      │
│                                 │
│  Streak 0 · Nivå 1 · 0 XP       │  ← liten rad, inte hjältekort
└─────────────────────────────────┘
```

Konkret:
- En **Status-rad högst upp** som sammanfattar i en mening ("Du ligger före", "Logga ett pass idag för att hålla takten", "Inga aktiva mål — sätt ett för att se framsteg"). Färgkodad prick (grön/gul/röd).
- **Trajectory-kortet flyttas in i målet** istället för att ligga separat — du ser kurvan när du öppnar målet, inte på dashboard.
- **Streak/XP/Nivå** krymps till en liten metarad längst ner. De är roliga men inte huvudsaken.
- **Veckans uppdrag** flyttas till `/review` (det är reflektionsmaterial, inte action).
- **Streak-fara-banner** behålls men bara när den faktiskt är aktuell (sen kväll + streak ≥ 3).

---

## 2. Tomma vyer som hjälper istället för att gapa

När du inte har data idag möts du av "inga pass än". Vi byter ut alla tomma states mot **konkret nästa steg**:

- **Dashboard utan mål:** "Vad vill du uppnå? → Sätt ditt första mål" + 3 förslag (Springa 5 km, 3 pass/vecka, Marknadera i april).
- **Dashboard utan pass:** "Logga ditt första pass — det tar 20 sekunder" + stora knappar för Löpning / Styrka / Cykel / Promenad.
- **Historik tom:** liten illustration + "Dina pass dyker upp här. Logga ett nu."
- **Mål tomma:** samma 3 förslag som ovan, en-tap att skapa.

---

## 3. Efter passet: en riktig "vinst-skärm"

`/log/success` finns redan men kan kännas platt. Vi förstärker just den stunden:

- Stor, tydlig rubrik: **"Klart. Bra jobbat."**
- Tre rader, inget mer:
  1. Vad du gjorde ("5,2 km på 28:14")
  2. Hur det påverkade målet ("+1,2 % mot halvmaran")
  3. En "win" om någon utlöstes ("Din längsta runda på 6 veckor 🔥")
- En knapp: **Klar** → tillbaka till dashboard.
- Inga XP-räknare som tickar, inga konfetti-animationer. Stillsam tillfredsställelse.

---

## 4. Kvällsreflektion: gör `/review` till "kvällsskärmen"

Idag är `/review` blandat. Vi gör den till en lugn kvällsvy:

- **Idag:** vad du loggade (eller "Vilodag — det är också träning").
- **Veckan:** sparkline + en mening ("3 av 3 pass klara — du håller takten").
- **Veckans uppdrag** flyttas hit.
- **Månadsöversikt-länk** längst ner.

Lägg en liten **"Reflektera"-prompt** (valfri textruta, sparas lokalt) — en mening om dagens pass. Inget krav, men finns där.

---

## 5. Polering av designsystem

- **Lugnare typografi:** mindre fetstil överallt, mer hierarki via storlek och färg. Rubriker `font-semibold` istället för `font-black`.
- **Mindre färg-brus:** ta bort gradient-bakgrunder på kort. Använd `bg-card` + subtil border. Spara accentfärg till statuspricken + primär CTA.
- **Konsekvent spacing:** alla kort `p-5 rounded-2xl`, alla sektioner `space-y-4`.
- **Bottom-nav:** 4 ikoner istället för 5 — slå ihop "Mål" och "Översikt" eller flytta en till settings. Aktiv ikon får accentfärg, inte fylld pill.
- Allt via semantiska tokens i `src/styles.css` — inga hårdkodade färger.

---

## 6. Smårättningar samtidigt

- Settings: gruppera "Rensa data" under en egen "Fara-zon"-rubrik så den inte ligger bredvid vanliga inställningar.
- Historik: gruppera per vecka istället för en lång lista.
- Goal-card: visa "krävd takt" som en mening, inte ett separat fält ("Du behöver 0,8 km/vecka till för att klara i tid").

---

## Tekniska detaljer

- **Filer som ändras:**
  - `src/routes/_authenticated/dashboard.tsx` — ny hierarki, ny status-rad, tomt-state.
  - `src/routes/_authenticated/review.tsx` — kvällslayout, flytta veckans uppdrag hit.
  - `src/components/forge/LogSuccess.tsx` — förenkla till 3 rader + en knapp.
  - `src/components/forge/GoalCard.tsx` — bygg in mini-trajectory, krävd-takt-mening.
  - `src/components/forge/BottomNav.tsx` — 4 ikoner, ny aktiv-style.
  - `src/components/forge/EmptyState.tsx` (ny) — återanvändbar tomt-state med CTA.
  - `src/lib/goals.functions.ts` — lägg till `computeStatusSummary(userId)` som returnerar `{ tone: 'good'|'warn'|'bad', message: string }`.
  - `src/styles.css` — lugnare token-paletten, ta bort starka gradienter.

- **Ingen ny databas-migration.** Inga nya server-functions utöver `computeStatusSummary`.
- **Ingen ny dependency.**
- **Inga ändringar i loggningsflödet** (löpning/styrka/cykel/promenad) — du sa att smärtan inte är där.

---

## Vad vi INTE gör nu

- Ingen onboarding-wizard (kan komma senare om tomma states inte räcker).
- Inga nya pass-typer eller mål-typer.
- Ingen AI-coach-chat.
- Ingen omdesign av loggningsformulären.

Säg till om du vill att jag justerar omfattningen — annars bygger jag detta rakt av.
