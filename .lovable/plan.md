## Mål
Tighta upp formulärflödet och datalagret så loggning känns snabb och pålitlig: gemensamma typer, RHF+Zod för validering, och TanStack Query med optimistic updates.

## 1. `src/lib/types.ts` — single source of truth
Exportera app-typer härledda från Supabase-typerna + Zod-scheman:

- `Workout`, `WorkoutInsert`, `WorkoutWithDetails` (workout + sets + running_session)
- `Set`, `SetInsert`
- `Goal`, `GoalWithProgress`, `GoalType`, `SessionType`, `ProcessPeriod`, `ProcessMetric`
- `RunningSession`, `Exercise`, `Achievement`, `UserStats`, `WeeklyQuest`
- Zod-scheman: `goalSchema`, `strengthLogSchema`, `runningLogSchema`, `cyclingLogSchema`, `walkingLogSchema`, `circuitLogSchema`, `quickLogSchema` (delade mellan klient och server)

Server-functions (`goals.functions.ts`, `workout.functions.ts`) importerar samma scheman → klient och server validerar identiskt.

## 2. RHF + Zod på alla formulär
Konvertera dessa till `useForm({ resolver: zodResolver(schema) })` och shadcn `<Form>`-komponenter:

- `goals.new.tsx` (ersätter 10+ `useState` + manuell `canSave`)
- `log.strength.tsx`, `log.running.tsx`, `log.cycling.tsx`, `log.walking.tsx`, `log.circuit.tsx`, `log.quick.tsx`

Vinster: inline-fel under varje fält (istället för en "Fyll i fälten"-banner), `formState.isValid` driver submit-knappen, `isSubmitting` ger automatisk loading, default-värden i ett ställe.

Stepper/specialinputs (vikt, reps, distans) wrappas så de spelar med `Controller`.

## 3. TanStack Query — optimistic updates
Lyfter ut query-nycklar till `src/lib/query-keys.ts` (`goals`, `dashboard`, `history`, `stats`, `quests`).

Mutationer som får optimistic updates:

- **Loggning** (`createWorkout`): lägg in workout i `history`-cache direkt, bumpa `stats.total_workouts`/streak, rulla tillbaka vid error. Användaren ser passet i listan innan servern svarar.
- **Skapa/uppdatera/arkivera mål**: lägg in/uppdatera i `goals`-cache direkt.
- **Reflektion + weekly quest tick**: optimistisk progress-bar.

Mönster per mutation:
```ts
onMutate: async (vars) => {
  await qc.cancelQueries({ queryKey });
  const prev = qc.getQueryData(queryKey);
  qc.setQueryData(queryKey, (old) => /* applicera lokalt */);
  return { prev };
},
onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKey, ctx.prev),
onSettled: () => qc.invalidateQueries({ queryKey }),
```

Loaders behålls och primear via `ensureQueryData` (redan så på de flesta routes); de routes som idag använder `useQuery` utan loader får en `queryOptions`-export så samma nyckel används överallt.

## 4. Ordning
1. `src/lib/types.ts` + `src/lib/query-keys.ts` + Zod-scheman.
2. Refaktorera server-functions att importera scheman (inga API-ändringar).
3. Konvertera `goals.new.tsx` (största formuläret, mest värde).
4. Konvertera log-formulären ett i taget; varje får optimistic `createWorkout`.
5. Optimistic mutations för goal CRUD och reflection.

## Tekniska detaljer
- Behåller befintliga server-function signaturer; bara validatorn pekar på det delade schemat.
- `zodResolver` finns redan via `@hookform/resolvers` om paketet saknas lägger jag till det i steg 3.
- Stepper-komponenten får en valfri `name`/`Controller`-variant, ingen breaking change.
- Inga DB-migrationer behövs.
- Inga UI-redesigner — bara plumbing + felmeddelanden under fält.

## Utanför scope
- Ingen omdesign av sidor.
- Inga nya features (streak-logik, achievements etc. orörda).
- `review.tsx` reflection stannar på `localStorage` tills vidare.
