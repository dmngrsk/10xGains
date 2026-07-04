# API Endpoint Implementation Plan: Training Plan Exercises

## 1. Przegląd punktu końcowego
Ten zestaw punktów końcowych zarządza ćwiczeniami w ramach określonego dnia planu treningowego (`training_plan_exercises`). Umożliwia użytkownikom listowanie, dodawanie, pobieranie szczegółów, aktualizowanie (głównie kolejności) i usuwanie ćwiczeń z dnia treningowego. Wszystkie operacje są ograniczone do danych uwierzytelnionego użytkownika, a serwer automatycznie zarządza ponownym indeksowaniem `order_index` ćwiczeń.

## 2. Szczegóły żądania

Wszystkie punkty końcowe są poprzedzone bazowym URL `/training-plans/{planId}/days/{dayId}/exercises`.

### 2.1. List Exercises
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID): Identyfikator planu treningowego.
        -   `dayId` (UUID): Identyfikator dnia treningowego.
-   **Request Body**: Brak

### 2.2. Add Exercise
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
-   **Request Body**:
    ```json
    {
      "exercise_id": "uuid", // Required
      "order_index": 1       // Optional, positive integer
    }
    ```
    -   Walidacja Zod: `z.object({ exercise_id: z.string().uuid(), order_index: z.number().int().min(1).optional() })`

### 2.3. Get Specific Exercise
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID): Identyfikator ćwiczenia w planie treningowym (tabela `training_plan_exercises`).
-   **Request Body**: Brak

### 2.4. Update Exercise
-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID)
-   **Request Body**:
    ```json
    {
      "order_index": 2 // Required, positive integer
    }
    ```
    -   Walidacja Zod: `z.object({ order_index: z.number().int().min(1) })`

### 2.5. Delete Exercise
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID)
-   **Request Body**: Brak

## 3. Wykorzystywane typy
-   **`TrainingPlanExerciseDto`** (dla odpowiedzi): Odpowiada strukturze `Database["public"]["Tables"]["training_plan_exercises"]["Row"]`.
    ```typescript
    // Przykład:
    // {
    //   "id": "uuid", // training_plan_exercise_id
    //   "exercise_id": "uuid", // foreign key to exercises table
    //   "order_index": 1,
    //   "training_plan_day_id": "uuid",
    //   // created_at, updated_at etc.
    // }
    ```
-   **Command Modele (Request Body)**: Jak zdefiniowano w sekcji "Szczegóły żądania" przy użyciu schematów Zod.
    -   `CreateTrainingPlanExerciseApiCommand` (dla POST): `{ exercise_id: string; order_index?: number; }`
    -   `UpdateTrainingPlanExerciseApiCommand` (dla PUT): `{ order_index: number; }`

## 4. Szczegóły odpowiedzi
-   **GET (lista)**: `200 OK` z tablicą `TrainingPlanExerciseDto[]`.
-   **POST**: `201 Created` z utworzonym `TrainingPlanExerciseDto`.
-   **GET (szczegóły)**: `200 OK` z pojedynczym `TrainingPlanExerciseDto`.
-   **PUT**: `200 OK` ze zaktualizowanym `TrainingPlanExerciseDto` (lub przynajmniej polami, które mogły ulec zmianie, np. `id`, `order_index`).
-   **DELETE**: `204 No Content`.
-   Błędy: Zobacz sekcję "Obsługa błędów".

## 5. Przepływ danych
1.  Żądanie trafia do Supabase Edge Function (np. `training-plans`).
2.  Główny router (`createMainRouterHandler`) obsługuje CORS i JWT auth. `ApiHandlerContext` jest tworzony.
3.  Żądanie jest kierowane do odpowiedniego Path Handlera (`training-plan-exercises/handler.ts` lub `training-plan-exercises-id/handler.ts`) na podstawie wzorca ścieżki.
4.  Path Handler używa `routeRequestToMethods` do wywołania odpowiedniego Method Handler'a (np. `get.ts`, `post.ts`).
5.  **Method Handler**:
    a.  Waliduje parametry ścieżki (np. format UUID).
    b.  Waliduje ciało żądania (dla POST, PUT) przy użyciu Zod.
    c.  **Sprawdzenie własności i istnienia nadrzędnych zasobów**:
        i.  Pobiera `training_plan` na podstawie `planId` używając `context.supabaseClient` i sprawdza, czy `user_id` zgadza się z `context.user.id`. Jeśli nie, zwraca błąd (prowadzący do 404).
        ii. Pobiera `training_plan_day` na podstawie `dayId` używając `context.supabaseClient` i sprawdza, czy należy do zweryfikowanego `planId`. Jeśli nie, zwraca błąd (prowadzący do 404).
    d.  **Dla POST**: Sprawdza, czy `exercise_id` z ciała żądania istnieje w tabeli `exercises` używając `context.supabaseClient`. Jeśli nie, błąd 400.
    e.  Wykonuje główną operację na bazie danych (SELECT, INSERT, UPDATE, DELETE) na tabeli `training_plan_exercises` używając `context.supabaseClient`.
        -   Wszystkie zapytania muszą zawierać warunki filtrujące, aby zapewnić operacje tylko na danych należących do użytkownika (bezpośrednio lub przez powiązane tabele).
    f.  **Logika `order_index`**:
        -   **POST**: Jeśli `order_index` nie jest podany, znajduje max `order_index` dla `dayId` i dodaje jako następny. Jeśli podany, wstawia i przesuwa istniejące ćwiczenia (zwiększając ich `order_index`).
        -   **PUT**: Aktualizuje `order_index` danego ćwiczenia. Przesuwa inne ćwiczenia, aby dostosować się do zmiany (zwiększając lub zmniejszając ich `order_index`).
        -   **DELETE**: Usuwa ćwiczenie. Zmniejsza `order_index` wszystkich kolejnych ćwiczeń w danym dniu.
        -   Operacje modyfikujące `order_index` wielu wierszy muszą być atomowe (najlepiej przez funkcję RPC w PostgreSQL wywoływaną z Method Handler'a, lub transakcję, jeśli klient Supabase ją obsługuje w Edge Functions w prosty sposób dla wielu operacji).
    g.  Formatowanie odpowiedzi (np. `createSuccessResponse`, `createErrorResponse`) i zwrócenie jej.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Obsługiwane przez `createMainRouterHandler` (JWT).
-   **Autoryzacja**:
    -   Kluczowa jest weryfikacja, czy `planId` należy do uwierzytelnionego użytkownika przy każdej operacji.
    -   Następnie weryfikacja, czy `dayId` należy do tego `planId`, a `exerciseId` (jeśli dotyczy) do tego `dayId`.
    -   Polityki RLS (Row-Level Security) w Supabase muszą być skonfigurowane dla tabel `training_plans`, `training_plan_days`, `training_plan_exercises` w celu dodatkowej ochrony na poziomie bazy danych.
    -   Zapytania w Method Handlerach muszą jawnie uwzględniać `user.id` w klauzulach WHERE, aby zapobiec IDOR, zgodnie z `supabase.mdc`.
-   **Walidacja danych wejściowych**:
    -   Parametry ścieżki (UUID) i ciała żądania (Zod) muszą być rygorystycznie walidowane, aby zapobiec błędom i potencjalnym atakom.
    -   Sprawdzenie istnienia `exercise_id` (z `exercises`) przed dodaniem do `training_plan_exercises`.
-   **Ochrona przed Mass Assignment**: Użycie dedykowanych Command Modeli i selektywne przypisywanie pól podczas operacji INSERT/UPDATE.

## 7. Rozważania dotyczące wydajności
-   **Indeksy bazy danych**:
    -   Upewnij się, że istnieją odpowiednie indeksy na `training_plan_exercises(training_plan_day_id, order_index)` (unikalny), `training_plan_exercises(exercise_id)`.
    -   Indeksy na `training_plan_days(training_plan_id)` i `training_plans(user_id)`.
-   **Operacje re-indeksowania**: Logika zmiany `order_index` może być kosztowna, jeśli dzień zawiera wiele ćwiczeń.
    -   Rozważ użycie funkcji RPC PostgreSQL (`plpgsql`) dla atomowych i wydajnych operacji aktualizacji wsadowej `order_index`. To minimalizuje liczbę zapytań z Edge Function do bazy.
-   **Paginacja (dla GET listy)**: Obecnie nie jest określona, ale jeśli lista ćwiczeń w dniu może być bardzo długa, paginacja powinna zostać dodana w przyszłości. Na razie specyfikacja nie wymaga tego.
-   **Minimalizacja danych**: Zwracaj tylko niezbędne pola w DTO, zgodnie ze specyfikacją.

## 8. Etapy wdrożenia
(Przy założeniu struktury modularnej Supabase Edge Function dla `training-plans`)

1.  **Konfiguracja projektu i zależności**:
    -   Upewnij się, że projekt Supabase Edge Function jest skonfigurowany.
    -   Zainstaluj `zod` jeśli jeszcze nie jest używany.

2.  **Definicje typów i schematów Zod**:
    -   Sprawdź/zaktualizuj `TrainingPlanExerciseDto` w `supabase/functions/shared/api-types.ts` (lub odpowiedniku), jeśli konieczne, dla typów odpowiedzi.
    -   Schematy walidacyjne Zod (np. `const createExerciseSchema = z.object(...)`) dla parametrów ścieżki (path), parametrów zapytania (query) oraz ciał żądań (request bodies) powinny być zdefiniowane bezpośrednio w odpowiednich plikach Method Handler (`get.ts`, `post.ts`, `put.ts`, `delete.ts` itd.). Te schematy będą używane do walidacji danych wejściowych na początku każdego Method Handlera.

3.  **Implementacja Path Handlers i Method Handlers**:
    -   **Path Handler dla `/.../exercises`**:
        -   Utwórz `supabase/functions/training-plans/handlers/training-plan-exercises/handler.ts`.
        -   `ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises'`.
        -   Utwórz Method Handlers w `supabase/functions/training-plans/handlers/training-plan-exercises/methods/`:
            -   `get.ts` (listuje ćwiczenia)
            -   `post.ts` (dodaje ćwiczenie)
    -   **Path Handler dla `/.../exercises/{exerciseId}`**:
        -   Utwórz `supabase/functions/training-plans/handlers/training-plan-exercises-id/handler.ts`.
        -   `ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises/:exerciseId'`.
        -   Utwórz Method Handlers w `supabase/functions/training-plans/handlers/training-plan-exercises-id/methods/`:
            -   `get.ts` (pobiera szczegóły ćwiczenia)
            -   `put.ts` (aktualizuje ćwiczenie)
            -   `delete.ts` (usuwa ćwiczenie)
    -   W każdym Method Handler:
        -   Wyodrębnij parametry ścieżki i ciała żądania.
        -   Wykonaj walidację parametrów ścieżki, parametrów zapytania i/lub ciała żądania używając odpowiedniego, lokalnie zdefiniowanego schematu Zod.
        -   Implementuj logikę weryfikacji własności planu i dnia treningowego (używając `context.user.id`, `planId`, `dayId` oraz `context.supabaseClient`).
        -   Dla POST: Sprawdź istnienie `exercise_id` w tabeli `exercises` używając `context.supabaseClient`.
        -   Wywołaj operacje na bazie danych (`context.supabaseClient.from('training_plan_exercises')...`) dla CRUD.
        -   Zaimplementuj logikę `order_index` (wstawianie, aktualizacja, usuwanie z przesuwaniem). Zaleca się użycie funkcji RPC PostgreSQL dla atomowości tych operacji, wywoływanych z Method Handler'a.
        -   Zwróć odpowiedź używając `createSuccessResponse` lub `createErrorResponse`.

4.  **Rejestracja Path Handlers w głównym routerze**:
    -   W `supabase/functions/training-plans/index.ts`, zaimportuj i dodaj nowe Path Handlery do `createMainRouterHandler`.

5.  **Polityki RLS i Indeksy**:
    -   Przejrzyj i upewnij się, że polityki RLS dla `training_plans`, `training_plan_days`, `training_plan_exercises` są poprawnie skonfigurowane i aktywne.
    -   Sprawdź, czy niezbędne indeksy bazy danych istnieją (jak opisano w "Rozważania dotyczące wydajności").

6.  **Testowanie**:
    -   Napisz testy jednostkowe dla logiki w Method Handlerach, szczególnie dla obsługi `order_index` oraz weryfikacji własności.
    -   Przeprowadź testy integracyjne dla każdego punktu końcowego przy użyciu narzędzi takich jak Postman lub testów automatycznych, obejmując:
        -   Scenariusze "happy path".
        -   Przypadki błędów (nieprawidłowe dane wejściowe, brak autoryzacji, nieznalezione zasoby).
        -   Poprawność działania `order_index` przy różnych operacjach.
        -   Dostęp nieautoryzowanego użytkownika do zasobów innego użytkownika.

7.  **Dokumentacja**:
    -   Zaktualizuj `supabase/functions/README.md` o nowe punkty końcowe.
    -   Upewnij się, że schematy API (np. OpenAPI/Swagger, jeśli są używane) są zaktualizowane.

## Obsługa błędów
-   **`400 Bad Request`**:
    -   Nieprawidłowy format UUID dla `planId`, `dayId`, `exerciseId`.
    -   Brakujące/nieprawidłowe pola w ciele żądania (np. `exercise_id` dla POST, `order_index` dla PUT, nieprawidłowy typ danych `order_index`).
    -   `exercise_id` (w ciele POST) nie istnieje w tabeli `exercises`.
-   **`401 Unauthorized`**: JWT token jest nieobecny, nieprawidłowy lub wygasł (obsługiwane przez `createMainRouterHandler`).
-   **`404 Not Found`**:
    -   `training_plan` o podanym `planId` nie istnieje lub nie należy do uwierzytelnionego użytkownika.
    -   `training_plan_day` o podanym `dayId` nie istnieje w ramach danego `planId`.
    -   `training_plan_exercise` o podanym `exerciseId` (w ścieżce) nie istnieje w ramach danego `dayId`.
-   **`500 Internal Server Error`**:
    -   Nieoczekiwane błędy bazy danych.
    -   Błędy w logice ponownego indeksowania `order_index`.
    -   Inne nieobsłużone wyjątki po stronie serwera.
    -   Odpowiedź powinna zawierać generyczny komunikat błędu, a szczegóły logowane po stronie serwera. 
