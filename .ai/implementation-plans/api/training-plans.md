# API Endpoint Implementation Plan: Training Plans Resource

## 1. Przegląd punktu końcowego
Ten dokument opisuje plan wdrożenia dla punktów końcowych REST API zarządzających zasobem `training-plans`. Obejmuje on tworzenie, odczytywanie, aktualizowanie i usuwanie planów treningowych dla uwierzytelnionych użytkowników. Wszystkie operacje są ograniczone do danych należących do aktualnie zalogowanego użytkownika i są obsługiwane przez **pojedynczą funkcję Supabase Edge Function** zlokalizowaną w `supabase/functions/training-plans/`.

## 2. Szczegóły żądania

### A. List all training plans
-   **Metoda HTTP:** `GET`
-   **Struktura URL:** `/training-plans`
-   **Parametry:**
    -   Opcjonalne (Query):
        -   `limit` (integer): Liczba planów do zwrócenia.
        -   `offset` (integer): Przesunięcie dla paginacji.
        -   `sort` (string): Kryteria sortowania (np. `name:asc`, `created_at:desc`).
-   **Request Body:** Brak

### B. Create a new training plan
-   **Metoda HTTP:** `POST`
-   **Struktura URL:** `/training-plans`
-   **Parametry:** Brak (poza ciałem żądania)
-   **Request Body:**
    ```json
    {
      "name": "string (required, max 255)",
      "description": "string (optional)"
    }
    ```
    Struktura zgodna z `CreateTrainingPlanCommand`.

### C. Retrieve a specific training plan
-   **Metoda HTTP:** `GET`
-   **Struktura URL:** `/training-plans/{planId}`
-   **Parametry:**
    -   Wymagane (Path): `planId` (UUID)
-   **Request Body:** Brak

### D. Update a training plan
-   **Metoda HTTP:** `PUT`
-   **Struktura URL:** `/training-plans/{planId}`
-   **Parametry:**
    -   Wymagane (Path): `planId` (UUID)
-   **Request Body:**
    ```json
    {
      "name": "string (optional, max 255)",
      "description": "string (optional)"
    }
    ```
    Struktura zgodna z `UpdateTrainingPlanCommand`. Co najmniej jedno pole musi być obecne.

### E. Delete a training plan
-   **Metoda HTTP:** `DELETE`
-   **Struktura URL:** `/training-plans/{planId}`
-   **Parametry:**
    -   Wymagane (Path): `planId` (UUID)
-   **Request Body:** Brak

## 3. Wykorzystywane typy
Główne typy DTO i Command Models z `supabase/functions/shared/api-types.ts` (lub równoważnej lokalizacji):
-   `TrainingPlanDto`: Dla odpowiedzi GET (wszystkie i pojedynczy), POST, PUT.
    ```typescript
    // Przykład struktury, rzeczywista definicja w api-types.ts
    // interface TrainingPlanDto extends Database["public"]["Tables"]["training_plans"]["Row"] {
    //   days?: TrainingPlanDayDto[]; 
    // };
    ```
-   `CreateTrainingPlanCommand`: Dla ciała żądania POST.
    ```typescript
    // Przykład struktury
    // interface CreateTrainingPlanCommand extends Pick<Database["public"]["Tables"]["training_plans"]["Insert"], "name" | "description"> {}
    ```
-   `UpdateTrainingPlanCommand`: Dla ciała żądania PUT.
    ```typescript
    // Przykład struktury
    // interface UpdateTrainingPlanCommand extends Pick<Database["public"]["Tables"]["training_plans"]["Update"], "name" | "description"> {}
    ```
-   `TrainingPlanDayDto` oraz `TrainingPlanExerciseDto`: Dla zagnieżdżonych danych w odpowiedzi `GET /training-plans/{planId}`.

## 4. Szczegóły odpowiedzi

### A. `GET /training-plans`
-   **Sukces (200 OK):**
    ```json
    [
      {
        "id": "uuid",
        "name": "Plan Name",
        "description": "Optional description",
        "user_id": "uuid",
        "created_at": "timestamp"
      }
      // ... inne plany
    ]
    ```
    Tablica obiektów `TrainingPlanDto`.

### B. `POST /training-plans`
-   **Sukces (201 Created):**
    ```json
    {
      "id": "uuid",
      "name": "Plan Name",
      "description": "Optional description",
      "user_id": "uuid", // ID uwierzytelnionego użytkownika
      "created_at": "timestamp"
    }
    ```
    Pojedynczy obiekt `TrainingPlanDto` nowo utworzonego planu.

### C. `GET /training-plans/{planId}`
-   **Sukces (200 OK):**
    ```json
    {
      "id": "uuid",
      "name": "Plan Name",
      "description": "Optional description",
      "user_id": "uuid",
      "created_at": "timestamp",
      "days": [ // Zgodnie z TrainingPlanDayDto
        {
          "id": "uuid",
          "name": "Day 1",
          "description": "Optional description",
          "order_index": 1,
          "training_plan_id": "uuid", // ID planu nadrzędnego
          "exercises": [ // Zgodnie z TrainingPlanExerciseDto
            {
              "id": "uuid",
              "exercise_id": "uuid", // ID z tabeli exercises
              "order_index": 1,
              "training_plan_day_id": "uuid" // ID dnia nadrzędnego
              // ... inne pola TrainingPlanExerciseDto, w tym opcjonalne `sets`
            }
          ]
        }
      ]
    }
    ```
    Pojedynczy obiekt `TrainingPlanDto` wraz z zagnieżdżonymi `days` i ich `exercises`.

### D. `PUT /training-plans/{planId}`
-   **Sukces (200 OK):**
    ```json
    {
      "id": "uuid", // ID aktualizowanego planu
      "name": "Updated Plan Name",
      "description": "Updated description",
      "user_id": "uuid",
      "updated_at": "timestamp" // Zaktualizowany timestamp
      // ... inne pola, które nie zostały zmienione
    }
    ```
    Pojedynczy obiekt `TrainingPlanDto` zaktualizowanego planu.

### E. `DELETE /training-plans/{planId}`
-   **Sukces (204 No Content):** Brak ciała odpowiedzi.

### Kody błędów (wspólne):
-   `400 Bad Request`: Błąd walidacji danych wejściowych (parametry ścieżki, zapytania, ciało żądania). Odpowiedź może zawierać szczegóły błędu z Zod.
-   `401 Unauthorized`: Problem z uwierzytelnieniem (np. brakujący/nieprawidłowy token JWT).
-   `403 Forbidden`: Użytkownik uwierzytelniony, ale nie ma uprawnień do wykonania operacji (rzadziej używane jeśli logika aplikacji i RLS konsekwentnie zwracają 404 dla braku dostępu).
-   `404 Not Found`: Zasób (`planId`) nie został znaleziony **lub użytkownik nie ma do niego dostępu**.
-   `500 Internal Server Error`: Wewnętrzny błąd serwera.

## 5. Przepływ danych
1.  Klient wysyła żądanie do punktu końcowego Supabase Edge Function `supabase/functions/training-plans/`.
2.  Główny plik `index.ts` tej funkcji wykorzystuje `createMainRouterHandler` (z `shared/api-handler.ts`).
3.  `createMainRouterHandler`:
    a.  Obsługuje żądania `OPTIONS` dla CORS.
    b.  Weryfikuje token JWT. Jeśli nieprawidłowy lub brak, zwraca `401 Unauthorized`. Tworzy klienta Supabase z uwierzytelnieniem użytkownika.
    c.  Przygotowuje `ApiHandlerContext` zawierający m.in. `user` i `supabaseClient`.
    d.  Iteruje przez zarejestrowane `ApiRouterHandler` (np. `handleTrainingPlansRoute`, `handleTrainingPlanByIdRoute`), próbując dopasować ścieżkę żądania.
4.  Dopasowany `ApiRouterHandler` (np. `handleTrainingPlanByIdRoute` z `handlers/training-plans-id/handler.ts`):
    a.  Definiuje swój `ABSOLUTE_PATH_PATTERN` (np. `/training-plans/:planId`).
    b.  Wykorzystuje `routeRequestToMethods` (z `shared/api-handler.ts`) do:
        i.  Dalszego dopasowania ścieżki i wyekstrahowania `rawPathParams`.
        ii. Rozesłania żądania do odpowiedniej funkcji obsługującej metodę HTTP (np. `handleGetTrainingPlanById` z `methods/get.ts`) na podstawie `req.method`.
5.  Funkcja obsługująca konkretną metodę (np. `handleGetTrainingPlanById`):
    a.  Otrzymuje `ApiHandlerContext` (zawierający `user`, `supabaseClient`, `rawPathParams`, `req`, `url`, `requestInfo`).
    b.  Waliduje parametry ścieżki (np. `planId`), parametry zapytania (np. `limit`, `offset`, `sort`) i/lub ciało żądania używając schematów Zod. W przypadku błędu walidacji, zwraca `400 Bad Request` używając `createErrorResponse`.
    c.  Wykonuje operację na bazie danych (`training_plans`) używając `supabaseClient` i `user.id` do filtrowania/zabezpieczania danych:
        -   **GET /training-plans**: Pobiera listę planów (`SELECT`) z uwzględnieniem `user_id`, paginacji (`limit`, `offset`) i sortowania (`order`).
        -   **POST /training-plans**: Wstawia nowy rekord (`INSERT`) do `training_plans`, ustawiając `user_id`.
        -   **GET /training-plans/{planId}`**: Pobiera konkretny plan (`SELECT`) używając `id` (z `planId`) i **wymuszając `user_id` w zapytaniu**. Dodatkowo pobiera powiązane `training_plan_days` i ich `training_plan_exercises`.
        -   **PUT /training-plans/{planId}`**: Aktualizuje istniejący rekord (`UPDATE`) dla danego `id` (z `planId`) i **wymuszając `user_id` w zapytaniu**.
        -   **DELETE /training-plans/{planId}`**: Usuwa rekord (`DELETE`) dla danego `id` (z `planId`) i **wymuszając `user_id` w zapytaniu**.
    d.  RLS na poziomie bazy danych dodatkowo zapewnia, że operacje są wykonywane tylko na danych należących do `user_id`.
    e.  Jeśli operacja na bazie danych (szczególnie dla GET/PUT/DELETE by ID) nie znajdzie rekordu pasującego do `id` ORAZ `user_id`, funkcja zwraca `404 Not Found` używając `createErrorResponse`.
    f.  Formatuje odpowiedź sukcesu używając `createSuccessResponse` (np. `createSuccessResponse(200, data, message)`) i zwraca ją z odpowiednim kodem statusu (`200 OK`, `201 Created`, `204 No Content`).

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie:** Wszystkie punkty końcowe są chronione. `user_id` jest bezpiecznie pobierany z tokena JWT przez `createMainRouterHandler`.
-   **Autoryzacja:**
    -   **RLS:** Rygorystyczne stosowanie Row-Level Security (RLS) na tabeli `training_plans` jest kluczowe.
        -   Polityka `SELECT`: `USING (auth.uid() = user_id)`
        -   Polityka `INSERT`: `WITH CHECK (auth.uid() = user_id)`
        -   Polityka `UPDATE`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
        -   Polityka `DELETE`: `USING (auth.uid() = user_id)`
    -   **Logika aplikacji:** Dodatkowo, funkcje obsługujące konkretne zasoby (GET/PUT/DELETE by ID) **muszą** zawierać warunek `eq('user_id', user.id)` w swoich zapytaniach do bazy danych. Zapewnia to spójną odpowiedź `404 Not Found` w przypadku braku zasobu lub braku uprawnień, zanim RLS zadziała (lub jako dodatkowa warstwa).
-   **Walidacja danych wejściowych:** Wszystkie dane wejściowe są walidowane po stronie serwera (w funkcjach obsługujących metody) przy użyciu Zod.
    -   `planId` musi być walidowany jako UUID.
    -   `name`, `description` muszą być walidowane (typ, długość).
    -   Parametry paginacji i sortowania muszą być walidowane.
-   **Ochrona przed IDOR:** RLS w połączeniu z walidacją `user_id` w logice aplikacji jest głównym mechanizmem obrony.
-   **Bezpieczne nagłówki odpowiedzi:** `corsHeaders` są stosowane w `createSuccessResponse` i `createErrorResponse`.

## 7. Rozważania dotyczące wydajności
-   **Indeksowanie bazy danych:**
    -   Indeks na `user_id` w `training_plans`.
    -   Rozważyć indeksy na kolumnach używanych do sortowania (`name`, `created_at`).
-   **Paginacja:** Implementacja dla `GET /training-plans` jest kluczowa.
-   **Zapytania dla zagnieżdżonych danych (`GET /training-plans/{planId}`):**
    -   Użycie zagnieżdżonego pobierania Supabase: `supabase.from('training_plans').select('*, days(*, exercises(*))')`.
-   **Rozmiar odpowiedzi:** Zwracać tylko niezbędne pola.
-   **Czas wykonania funkcji brzegowych:** Monitorować i optymalizować.

## 8. Struktura implementacji
Cały zasób `/training-plans` (włącznie z `/training-plans/{planId}`) jest obsługiwany przez **pojedynczą funkcję Supabase Edge Function** zlokalizowaną w `supabase/functions/training-plans/`.

1.  **Konfiguracja projektu Supabase:**
    *   Upewnić się, że tabela `training_plans` istnieje i ma prawidłową strukturę.
    *   Zdefiniować i przetestować polityki RLS.

2.  **Implementacja Głównej Funkcji i Routingu (`supabase/functions/training-plans/`):**
    *   **`index.ts` (Główny Router):**
        *   Importuje `createMainRouterHandler` z `supabase/functions/shared/api-handler.ts`.
        *   Importuje dedykowane funkcje obsługujące trasy (np. `handleTrainingPlansRoute`, `handleTrainingPlanByIdRoute`) z podkatalogu `handlers/`.
        *   Definiuje tablicę `routeHandlers` zawierającą te funkcje.
        *   Wywołuje `createMainRouterHandler(routeHandlers, '/training-plans')` do utworzenia głównego serwera obsługującego żądania.
    *   **Podkatalog `handlers/`:**
        *   Zawiera podkatalogi dla każdej unikalnej ścieżki bazowej, np.:
            *   `training-plans/` (dla ścieżki `/training-plans`)
            *   `training-plans-id/` (dla ścieżki `/training-plans/:planId`)
    *   **Każdy podkatalog w `handlers/` (np. `handlers/training-plans-id/`):**
        *   **`handler.ts` (np. `handleTrainingPlanByIdRoute.ts`):**
            *   Definiuje stałą `ABSOLUTE_PATH_PATTERN` (np. `'/training-plans/:planId'`).
            *   Eksportuje asynchroniczną funkcję (np. `handleTrainingPlanByIdRoute`) przyjmującą `(req: Request, context: ApiHandlerContext)`.
            *   Wykorzystuje `routeRequestToMethods` (z `shared/api-handler.ts`), przekazując `req`, `ABSOLUTE_PATH_PATTERN`, mapę metod HTTP do funkcji obsługujących oraz `context`.
        *   **Podkatalog `methods/`:**
            *   Zawiera pliki `.ts` dla każdej metody HTTP (np. `get.ts`, `put.ts`, `delete.ts`).
            *   **Każdy plik w `methods/` (np. `methods/get.ts`):**
                *   Eksportuje asynchroniczną funkcję (np. `handleGetTrainingPlanById`) przyjmującą `ApiHandlerContext`.
                *   Implementuje logikę walidacji (parametry, ciało żądania) za pomocą Zod.
                *   Wykonuje operacje na bazie danych (`supabaseClient` z kontekstu), **zawsze dołączając warunek `eq('user_id', user.id)` do zapytań dotyczących konkretnych zasobów.**
                *   Zwraca odpowiedź używając `createSuccessResponse(statusCode, data, message)` lub `createErrorResponse`.

3.  **Testowanie:**
    *   Testy jednostkowe/integracyjne dla logiki w `methods/`.
    *   Przetestować działanie RLS i ścieżek routingu.

4.  **Dokumentacja:**
    *   Zaktualizować plik `supabase/functions/README.md`.

5.  **Wdrożenie:**
    *   Wdrożyć funkcję `supabase/functions/training-plans/` do Supabase. 
