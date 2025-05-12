# Propozycja Scentralizowanej Weryfikacji Hierarchii i Własności Zasobów

## Kontekst

Podczas implementacji endpointów API dla zasobów zagnieżdżonych (np. Plany Treningowe -> Dni -> Ćwiczenia -> Serie) zauważono powtarzającą się potrzebę weryfikacji:
1.  Czy dany zasób (np. Plan) należy do zalogowanego użytkownika.
2.  Czy żądane zasoby niższego poziomu (np. Dzień, Ćwiczenie, Seria) poprawnie należą do zasobów nadrzędnych w hierarchii.

Implementowanie tej logiki indywidualnie w każdym handlerze metody (GET, POST, PUT, DELETE dla każdego poziomu) prowadzi do duplikacji kodu i utrudnia zarządzanie.

## Proponowane Rozwiązanie: Scentralizowana Funkcja Pomocnicza

Proponuje się stworzenie współdzielonej funkcji pomocniczej, np. `verifyResourceHierarchyAndOwnership`, która hermetyzowałaby logikę weryfikacji. Mogłaby ona znajdować się w `supabase/functions/shared/verification-helpers.ts`.

### Definicja Funkcji (Draft)

```typescript
// Proponowana zawartość dla supabase/functions/shared/verification-helpers.ts

import type { SupabaseClient, User } from 'supabase';
import { createErrorResponse } from './api-helpers.ts';

interface HierarchyParams {
  planId?: string;
  dayId?: string;
  exerciseId?: string; // Odpowiada ID z tabeli training_plan_exercises
  setId?: string;      // Odpowiada ID z tabeli training_plan_exercise_sets
}

interface VerifiedIds {
  planId?: string;
  dayId?: string;
  exerciseId?: string;
  setId?: string;
}

export async function verifyResourceHierarchyAndOwnership(
  supabaseClient: SupabaseClient,
  user: User,
  params: HierarchyParams
): Promise<VerifiedIds | Response> { // Zwraca Response (błąd) lub VerifiedIds (sukces)
  const verifiedIds: VerifiedIds = {};

  // 1. Weryfikacja Planu Treningowego
  if (params.planId) {
    const { data: planData, error: planError } = await supabaseClient
      .from('training_plans')
      .select('id')
      .eq('id', params.planId)
      .eq('user_id', user.id)
      .single();

    if (planError || !planData) {
      return createErrorResponse(404, `Training plan with ID ${params.planId} not found or user does not have access.`);
    }
    verifiedIds.planId = planData.id;
  } else if (params.dayId || params.exerciseId || params.setId) {
    return createErrorResponse(400, 'planId is required to verify lower-level resources.');
  }

  // 2. Weryfikacja Dnia Planu Treningowego
  if (params.dayId && verifiedIds.planId) {
    const { data: dayData, error: dayError } = await supabaseClient
      .from('training_plan_days')
      .select('id')
      .eq('id', params.dayId)
      .eq('training_plan_id', verifiedIds.planId)
      .single();

    if (dayError || !dayData) {
      return createErrorResponse(404, `Training plan day with ID ${params.dayId} not found in plan ${verifiedIds.planId}.`);
    }
    verifiedIds.dayId = dayData.id;
  } else if ((params.exerciseId || params.setId) && !params.dayId && params.planId) {
    return createErrorResponse(400, 'dayId is required to verify exerciseId or setId when planId is provided.');
  }

  // 3. Weryfikacja Ćwiczenia w Dniu Planu (tabela training_plan_exercises)
  if (params.exerciseId && verifiedIds.dayId) {
    const { data: exerciseData, error: exerciseError } = await supabaseClient
      .from('training_plan_exercises')
      .select('id')
      .eq('id', params.exerciseId)
      .eq('training_plan_day_id', verifiedIds.dayId)
      .single();

    if (exerciseError || !exerciseData) {
      return createErrorResponse(404, `Training plan exercise with ID ${params.exerciseId} not found in day ${verifiedIds.dayId}.`);
    }
    verifiedIds.exerciseId = exerciseData.id;
  } else if (params.setId && !params.exerciseId && params.dayId) {
     return createErrorResponse(400, 'exerciseId is required to verify setId when dayId is provided.');
  }

  // 4. Weryfikacja Serii Ćwiczenia
  if (params.setId && verifiedIds.exerciseId) {
    const { data: setData, error: setError } = await supabaseClient
      .from('training_plan_exercise_sets')
      .select('id')
      .eq('id', params.setId)
      .eq('training_plan_exercise_id', verifiedIds.exerciseId)
      .single();

    if (setError || !setData) {
      return createErrorResponse(404, `Training plan exercise set with ID ${params.setId} not found for exercise ${verifiedIds.exerciseId}.`);
    }
    verifiedIds.setId = setData.id;
  }

  return verifiedIds;
}
```

### Przykład Użycia w Handlerze Metody

```typescript
// W pliku metody, np. .../methods/get.ts

import { verifyResourceHierarchyAndOwnership } from 'shared/verification-helpers.ts';

// ...
  const { planId, dayId, exerciseId } = pathParamsParsed.data;

  const verificationResult = await verifyResourceHierarchyAndOwnership(
    supabaseClient,
    user,
    { planId, dayId, exerciseId }
  );

  if (verificationResult instanceof Response) {
    return verificationResult; // Błąd, zwróć odpowiedź
  }

  // Sukces, verificationResult to obiekt VerifiedIds
  const verifiedExerciseId = verificationResult.exerciseId;
  // ... dalsza logika z użyciem verifiedExerciseId ...
// ...
```

### Kluczowe Korzyści

*   **Redukcja Duplikacji Kodu**: Logika weryfikacji jest w jednym miejscu.
*   **Poprawa Czytelności**: Handlery metod stają się prostsze.
*   **Łatwiejsze Zarządzanie**: Zmiany w logice weryfikacji wprowadzane są w jednym pliku.
*   **Spójność**: Zapewnia jednolity sposób weryfikacji w całym module API.
*   **Elastyczność**: Weryfikuje tylko te poziomy hierarchii, dla których dostarczono ID.

### Dalsze Rozważania

*   Funkcja ta może być rozbudowana o bardziej szczegółowe komunikaty błędów.
*   Można rozważyć optymalizacje zapytań SQL, jeśli zajdzie taka potrzeba.
*   Dla operacji zapisu (POST, PUT, DELETE), gdzie używane są funkcje RPC (PostgreSQL), te funkcje RPC powinny same w sobie zawierać odpowiednią weryfikację własności i hierarchii, co stanowi dodatkową warstwę bezpieczeństwa i spójności danych. Scentralizowana funkcja pomocnicza w Edge Function może służyć jako wstępna walidacja lub główna walidacja dla operacji GET. 
