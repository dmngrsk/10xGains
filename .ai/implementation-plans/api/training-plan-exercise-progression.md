# API Endpoint Implementation Plan: Training Plan Exercise Progression

## 1. Przegląd punktu końcowego
Ten punkt końcowy zarządza regułami progresji dla poszczególnych ćwiczeń w ramach planu treningowego użytkownika. Pozwala na pobieranie istniejących reguł progresji oraz ich tworzenie lub aktualizację (upsert).

## 2. Szczegóły żądania

### GET `/training-plans/{planId}/exercises/{exerciseId}/progression`
-   **Metoda HTTP:** `GET`
-   **Struktura URL:** `/training-plans/{planId}/exercises/{exerciseId}/progression`
-   **Parametry:**
    -   Wymagane (parametry ścieżki):
        -   `planId` (UUID): Identyfikator planu treningowego.
        -   `exerciseId` (UUID): Identyfikator ćwiczenia (z tabeli `exercises`).
-   **Request Body:** Brak

### PUT `/training-plans/{planId}/exercises/{exerciseId}/progression`
-   **Metoda HTTP:** `PUT`
-   **Struktura URL:** `/training-plans/{planId}/exercises/{exerciseId}/progression`
-   **Parametry:**
    -   Wymagane (parametry ścieżki):
        -   `planId` (UUID): Identyfikator planu treningowego.
        -   `exerciseId` (UUID): Identyfikator ćwiczenia (z tabeli `exercises`).
-   **Request Body:** Struktura JSON odpowiadająca `UpdateTrainingPlanExerciseProgressionCommand`.
    ```json
    {
      "weight_increment": 2.5,                   // Opcjonalne (wymagane przy tworzeniu), NUMERIC(7,3) > 0
      "failure_count_for_deload": 3,             // Opcjonalne (wymagane przy tworzeniu), SMALLINT > 0
      "consecutive_failures": 0,                 // Opcjonalne, SMALLINT >= 0, domyślnie 0 przy tworzeniu
      "deload_percentage": 10.0,                 // Opcjonalne, NUMERIC(4,2) > 0, domyślnie 10.0 przy tworzeniu
      "deload_strategy": "PROPORTIONAL",         // Opcjonalne, ENUM('PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM'), domyślnie 'PROPORTIONAL'
      "reference_set_index": null                // Opcjonalne, SMALLINT >= 0 lub null
    }
    ```
    -   Przy tworzeniu (jeśli zasób nie istnieje), pola `weight_increment`, `failure_count_for_deload`, są wymagane. Pozostałe mogą przyjąć wartości domyślne.
    -   Przy aktualizacji, co najmniej jedno pole musi zostać dostarczone.

## 3. Wykorzystywane typy
-   **DTO (Odpowiedź dla GET i PUT):**
    -   `TrainingPlanExerciseProgressionDto` (z `supabase/functions/shared/api-types.ts`)
      ```typescript
      export type TrainingPlanExerciseProgressionDto = Database["public"]["Tables"]["training_plan_exercise_progressions"]["Row"];
      ```
-   **Command Model (Ciało żądania dla PUT):**
    -   `UpdateTrainingPlanExerciseProgressionCommand` (z `supabase/functions/shared/api-types.ts`)
      ```typescript
      export type UpdateTrainingPlanExerciseProgressionCommand = Pick<Database["public"]["Tables"]["training_plan_exercise_progressions"]["Update"], "weight_increment" | "failure_count_for_deload" | "consecutive_failures" | "deload_percentage" | "deload_strategy" | "reference_set_index">;
      ```

## 4. Szczegóły odpowiedzi
-   **GET /training-plans/{planId}/exercises/{exerciseId}/progression**
    -   **Sukces (200 OK):**
        ```json
        {
          "id": "uuid",
          "training_plan_id": "uuid",
          "exercise_id": "uuid",
          "weight_increment": 2.5,
          "failure_count_for_deload": 3,
          "deload_percentage": 10.0,
          "deload_strategy": "PROPORTIONAL",
          "consecutive_failures": 0,
          "last_updated": "2023-01-01T00:00:00Z",
          "reference_set_index": null
        }
        ```
    -   **Błędy:**
        -   `401 Unauthorized`
        -   `404 Not Found`
        -   `400 Bad Request` (np. nieprawidłowy format UUID)

-   **PUT /training-plans/{planId}/exercises/{exerciseId}/progression**
    -   **Sukces:**
        -   `200 OK`: Jeśli zasób `training_plan_exercise_progression` został pomyślnie zaktualizowany. Zwraca zaktualizowany obiekt `TrainingPlanExerciseProgressionDto`.
        -   `201 Created`: Jeśli zasób `training_plan_exercise_progression` został pomyślnie utworzony. Zwraca utworzony obiekt `TrainingPlanExerciseProgressionDto`.
    -   **Błędy:**
        -   `400 Bad Request` (np. nieprawidłowe ciało żądania, walidacja pól, brak wymaganych pól do utworzenia)
        -   `401 Unauthorized`
        -   `404 Not Found` (jeśli plan lub ćwiczenie nie istnieje, lub plan nie należy do użytkownika)

## 5. Przepływ danych

### Ogólny przepływ (dla obu metod GET i PUT)
1.  Żądanie trafia do głównego routera Supabase Edge Function (`supabase/functions/training-plans/index.ts`).
2.  `createMainRouterHandler` obsługuje CORS i uwierzytelnianie JWT. Tworzy `ApiHandlerContext`.
3.  Główny router przekazuje żądanie do Path Handlera `supabase/functions/training-plans/handlers/training-plan-exercise-progression/handler.ts`.
4.  Path Handler używa `routeRequestToMethods` i wyodrębnia `planId` oraz `exerciseId`.

### GET `/training-plans/{planId}/exercises/{exerciseId}/progression`
1.  (Po krokach ogólnych) Żądanie jest kierowane do Method Handlera `get.ts`.
2.  **Walidacja parametrów ścieżki:** `planId` i `exerciseId` muszą być prawidłowymi UUID.
3.  **Weryfikacja nadrzędnych zasobów:** Sprawdź, czy `training_plan` o `planId` istnieje i należy do `context.user.id`. Jeśli nie, `404 Not Found`. Sprawdź, czy `exercise` o `exerciseId` istnieje. Jeśli nie, `404 Not Found`.
4.  **Zapytanie do bazy danych:** Pobierz `training_plan_exercise_progressions` dla `planId` i `exerciseId`.
5.  **Obsługa odpowiedzi:** Jeśli znaleziono, `200 OK` z DTO. Jeśli nie znaleziono progresji (a plan i ćwiczenie istnieją), `404 Not Found`. W przypadku błędu, `500 Internal Server Error`.

### PUT `/training-plans/{planId}/exercises/{exerciseId}/progression`
1.  (Po krokach ogólnych) Żądanie jest kierowane do Method Handlera `put.ts`.
2.  **Walidacja parametrów ścieżki:** `planId` i `exerciseId` muszą być prawidłowymi UUID.
3.  **Pobranie i walidacja ciała żądania:**
    -   Odczytaj ciało żądania.
    -   Zwaliduj je przy użyciu schematu Zod opartego na `UpdateTrainingPlanExerciseProgressionCommand`.
    -   Dodatkowa walidacja (w logice serwera): Jeśli zasób nie istnieje (tworzenie), sprawdź, czy podano `weight_increment`, `failure_count_for_deload`. Jeśli nie, `400 Bad Request`.
4.  **Weryfikacja nadrzędnych zasobów i uprawnień:**
    -   Sprawdź, czy `training_plan` o `planId` istnieje i należy do `context.user.id`. Jeśli nie, zwróć `404 Not Found`.
    -   Sprawdź, czy `exercise` (encja `exercises`) o `exerciseId` (z URL) istnieje. Jeśli nie, zwróć `404 Not Found` (lub `400 Bad Request`, traktując to jako nieprawidłowe `exerciseId` dla progresji).
5.  **Operacja na bazie danych (Upsert - Create/Update):**
    -   Przygotuj dane do operacji upsert, łącząc `planId`, `exerciseId` z URL z danymi z ciała żądania.
    -   Użyj metody `.upsert()` klienta Supabase z opcją `onConflict: ['training_plan_id', 'exercise_id']`.
        -   Pola do wstawienia/aktualizacji: `weight_increment`, `failure_count_for_deload`, `consecutive_failures`, `deload_percentage`, `deload_strategy`, `reference_set_index`.
        -   Automatycznie ustaw `last_updated` na `CURRENT_TIMESTAMP`.
        -   Pola takie jak `id` (dla `training_plan_exercise_progressions`) będą generowane przez bazę danych przy tworzeniu.
        -   Dla pól niepodanych w żądaniu przy tworzeniu, baza danych użyje wartości `DEFAULT` (np. dla `consecutive_failures`, `deload_percentage`, `deload_strategy`).
    -   Metoda `.upsert()` powinna zwrócić utworzony/zaktualizowany rekord.
6.  **Obsługa odpowiedzi:**
    -   Na podstawie wyniku operacji upsert (np. sprawdzając, czy zwrócony rekord miał `id` przed operacją, lub na podstawie statusu zwracanego przez niektóre implementacje upsert), określ, czy zasób został utworzony czy zaktualizowany.
    -   Zwróć `201 Created` z DTO, jeśli zasób został utworzony.
    -   Zwróć `200 OK` z DTO, jeśli zasób został zaktualizowany.
    -   W przypadku błędu bazy danych, zwróć `500 Internal Server Error`.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie:** JWT.
-   **Autoryzacja:** RLS + Jawne sprawdzanie `user_id` dla `training_plan`.
-   **Walidacja danych wejściowych:** UUID, Zod dla ciała żądania, sprawdzanie istnienia powiązanych encji (`exercises`).

## 7. Obsługa błędów
-   **`400 Bad Request`:**
    -   Nieprawidłowy format `planId` lub `exerciseId`.
    -   Nieprawidłowe ciało żądania w PUT (np. wartości poza zakresem, nieprawidłowa wartość `deload_strategy`).
    -   Brak wymaganych pól (`weight_increment`, `failure_count_for_deload`) w ciele żądania PUT podczas próby utworzenia nowego zasobu progresji.
-   **`401 Unauthorized`:** Token JWT.
-   **`404 Not Found`:**
    -   Nie znaleziono planu treningowego (`planId`) należącego do uwierzytelnionego użytkownika.
    -   Nie znaleziono ćwiczenia (`exerciseId` z tabeli `exercises`) powiązanego z progresją.
    -   Dla GET: nie znaleziono rekordu progresji (a plan i ćwiczenie istnieją).
-   **`500 Internal Server Error`:** Błędy serwera/bazy danych.

## 8. Rozważania dotyczące wydajności
-   Indeksy bazodanowe.
-   Optymalizacja zapytań. Operacja Upsert jest generalnie wydajna.

## 9. Etapy wdrożenia

### A. Przygotowanie struktury plików (zgodnie z `supabase.mdc` i analogią do `training-plan-exercises.md`)
1.  **Główna funkcja (jeśli nie istnieje):** `supabase/functions/training-plans/index.ts` i `deno.json`.
2.  **Path Handler dla `/training-plans/{planId}/exercises/{exerciseId}/progression`**:
    -   Utwórz katalog (jeśli nie istnieje w ramach funkcji `training-plans`): `supabase/functions/training-plans/handlers/`
    -   Utwórz katalog dedykowany dla tego konkretnego zasobu: `supabase/functions/training-plans/handlers/training-plan-exercise-progression/`
    -   Plik Path Handlera: `supabase/functions/training-plans/handlers/training-plan-exercise-progression/handler.ts`
3.  **Method Handlers (wewnątrz dedykowanego katalogu zasobu)**:
    -   Utwórz katalog dla metod: `supabase/functions/training-plans/handlers/training-plan-exercise-progression/methods/`
    -   Plik GET: `supabase/functions/training-plans/handlers/training-plan-exercise-progression/methods/get.ts`
    -   Plik PUT: `supabase/functions/training-plans/handlers/training-plan-exercise-progression/methods/put.ts`

### B. Implementacja współdzielonych elementów
1.  **Schematy Zod (jeśli są globalnie reużywalne):**
    -   Schemat Zod specyficzny dla ciała żądania `UpdateTrainingPlanExerciseProgressionCommand` zostanie zdefiniowany bezpośrednio w pliku `put.ts` (patrz sekcja 9.D).

### C. Implementacja Method Handler: GET
1.  W `supabase/functions/training-plans/handlers/training-plan-exercise-progression/methods/get.ts`:
    -   Zaimplementuj funkcję `handleGetProgression(context: ApiHandlerContext)`.
    -   Wyodrębnij `planId` i `exerciseId` z `context.rawPathParams`.
    -   Zwaliduj `planId` i `exerciseId` jako UUID.
    -   Wykonaj weryfikację istnienia `training_plan` (i jego przynależności do `context.user.id`) oraz `exercise` (z tabeli `exercises`).
    -   Wykonaj zapytanie do bazy danych (Supabase client) w celu pobrania rekordu `training_plan_exercise_progressions`.
    -   Zwróć `200 OK` z `TrainingPlanExerciseProgressionDto`, `404 Not Found` lub `500 Internal Server Error` w zależności od wyniku.

### D. Implementacja Method Handler: PUT
1.  W `supabase/functions/training-plans/handlers/training-plan-exercise-progression/methods/put.ts`:
    -   Zdefiniuj schemat Zod dla ciała żądania (`UpdateTrainingPlanExerciseProgressionCommand`) na początku pliku. Na przykład:
        ```typescript
        import { z } from 'zod';

        const updateProgressionBodySchema = z.object({
          weight_increment: z.number().positive().optional(),
          failure_count_for_deload: z.number().int().positive().optional(),
          consecutive_failures: z.number().int().min(0).optional(),
          deload_percentage: z.number().positive().optional(), // np. .max(100)
          deload_strategy: z.enum(['PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM']).optional(),
          reference_set_index: z.number().int().min(0).nullable().optional()
        }).refine(data => Object.keys(data).length > 0, {
          message: "Request body must contain at least one field to update."
        });
        ```
    -   Zaimplementuj logikę weryfikacji istnienia `training_plan` (i przynależności) oraz `exercise`.
    -   Zaimplementuj walidację ciała żądania przy użyciu zdefiniowanego `updateProgressionBodySchema`.
    -   Dodaj logikę sprawdzającą, czy podczas tworzenia (jeśli zasób progresji nie istnieje) są obecne wymagane pola (`weight_increment`, `failure_count_for_deload`).
    -   Użyj operacji `.upsert()` klienta Supabase.
    -   Zaimplementuj logikę determinującą kod statusu odpowiedzi (`200 OK` vs `201 Created`).

### E. Implementacja Path Handler
1.  W `supabase/functions/training-plans/handlers/training-plan-exercise-progression/handler.ts`:
    -   Zaimplementuj funkcję `handlePlanExerciseProgressionRoute(req: Request, context: ApiHandlerContext)`.
    -   Zdefiniuj `ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/exercises/:exerciseId/progression'`.
    -   Importuj Method Handlery (GET, PUT) z podkatalogu `methods/`.
    -   Użyj `routeRequestToMethods` do przekazania żądania do odpowiedniego Method Handlera.

### F. Rejestracja Path Handlera w głównym routerze
1.  W `supabase/functions/training-plans/index.ts`:
    -   Zaimportuj `handlePlanExerciseProgressionRoute` z odpowiedniego pliku Path Handlera.
    -   Dodaj go do tablicy Path Handlerów przekazywanej do `createMainRouterHandler` dla funkcji `training-plans`.

### G. Aktualizacja dokumentacji
1.  Zaktualizuj plik `supabase/functions/README.md` (lub centralną dokumentację API, jeśli istnieje), aby zawierał informacje o nowym punkcie końcowym, jego metodach, parametrach, ciałach żądań i odpowiedziach.

### H. Testowanie
1.  Przetestuj scenariusze tworzenia (zasób nie istnieje) i aktualizacji (zasób istnieje) dla PUT.
2.  Sprawdź poprawność zwracanych kodów statusu (`200` vs `201`).
3.  Przetestuj walidację wymaganych pól przy tworzeniu.

### I. Wdrożenie
1.  Wdróż zaktualizowaną Supabase Edge Function (np. `training-plans`) używając polecenia `supabase deploy functions training-plans` (lub odpowiedniego dla nazwy Twojej funkcji).
