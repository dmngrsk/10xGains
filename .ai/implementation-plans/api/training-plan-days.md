# API Endpoint Implementation Plan: Training Plan Days

## 1. Przegląd punktu końcowego
Punkty końcowe API do zarządzania dniami w ramach określonego planu treningowego (`training_plans`). Obejmują one tworzenie, odczytywanie, aktualizowanie i usuwanie dni treningowych (`training_plan_days`). System automatycznie zarządza kolejnością dni (`order_index`) oraz zapewnia, że wszystkie operacje są wykonywane w kontekście uwierzytelnionego użytkownika i jego zasobów. Odpowiedzi dla zapytań o listę dni lub pojedynczy dzień zawierają zagnieżdżone dane dotyczące ćwiczeń (`training_plan_exercises`) i ich serii (`training_plan_exercise_sets`).

## 2. Szczegóły żądania

### 2.1. GET /training-plans/{planId}/days
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/training-plans/{planId}/days`
- **Parametry**:
  - Wymagane:
    - `planId` (UUID): Identyfikator planu treningowego. Musi należeć do uwierzytelnionego użytkownika.
  - Opcjonalne:
    - `limit` (integer): Liczba dni do zwrócenia (paginacja). Domyślnie np. 20. Max np. 100.
    - `offset` (integer): Przesunięcie wyników (paginacja). Domyślnie 0.
- **Request Body**: Brak

### 2.2. POST /training-plans/{planId}/days
- **Metoda HTTP**: `POST`
- **Struktura URL**: `/training-plans/{planId}/days`
- **Parametry**:
  - Wymagane:
    - `planId` (UUID): Identyfikator planu treningowego. Musi należeć do uwierzytelnionego użytkownika.
- **Request Body**:
  ```json
  {
    "name": "string", // Wymagane
    "description": "string", // Opcjonalne
    "order_index": "integer" // Opcjonalne, >= 1
  }
  ```

### 2.3. GET /training-plans/{planId}/days/{dayId}
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/training-plans/{planId}/days/{dayId}`
- **Parametry**:
  - Wymagane:
    - `planId` (UUID): Identyfikator planu treningowego.
    - `dayId` (UUID): Identyfikator dnia treningowego. Musi należeć do `planId` i pośrednio do użytkownika.
- **Request Body**: Brak

### 2.4. PUT /training-plans/{planId}/days/{dayId}
- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/training-plans/{planId}/days/{dayId}`
- **Parametry**:
  - Wymagane:
    - `planId` (UUID): Identyfikator planu treningowego.
    - `dayId` (UUID): Identyfikator dnia treningowego.
- **Request Body**:
  ```json
  {
    "name": "string", // Opcjonalne
    "description": "string", // Opcjonalne
    "order_index": "integer" // Opcjonalne, >= 1
  }
  ```
  Przynajmniej jedno pole musi być obecne.

### 2.5. DELETE /training-plans/{planId}/days/{dayId}
- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/training-plans/{planId}/days/{dayId}`
- **Parametry**:
  - Wymagane:
    - `planId` (UUID): Identyfikator planu treningowego.
    - `dayId` (UUID): Identyfikator dnia treningowego.
- **Request Body**: Brak

## 3. Wykorzystywane typy
Zgodnie z `supabase/functions/shared/api-types.ts`:
- **DTO (Odpowiedzi)**:
  - `TrainingPlanDayDto`
  - `TrainingPlanExerciseDto` (zagnieżdżone)
  - `TrainingPlanExerciseSetDto` (zagnieżdżone)
- **Command Models (Ciała żądań)**:
  - `CreateTrainingPlanDayCommand`: `Omit<Database["public"]["Tables"]["training_plan_days"]["Insert"], "id" | "training_plan_id">`
    - Pola: `name`, `description` (opcjonalne), `order_index` (opcjonalne)
  - `UpdateTrainingPlanDayCommand`: `Pick<Database["public"]["Tables"]["training_plan_days"]["Update"], "name" | "description" | "order_index">`
    - Pola: `name` (opcjonalne), `description` (opcjonalne), `order_index` (opcjonalne)

## 4. Szczegóły odpowiedzi
- **GET /training-plans/{planId}/days**
  - Sukces: `200 OK`
    ```json
    [ // Array of TrainingPlanDayDto
      {
        "id": "uuid",
        "name": "Day Name",
        "description": "Optional description",
        "order_index": 1,
        "training_plan_id": "uuid",
        "exercises": [ /* Array of TrainingPlanExerciseDto */ ]
      }
    ]
    ```
- **POST /training-plans/{planId}/days**
  - Sukces: `201 Created`
    ```json
    { // TrainingPlanDayDto
      "id": "uuid",
      "name": "Day Name",
      "description": "Optional description",
      "order_index": 1,
      "training_plan_id": "uuid"
    }
    ```
- **GET /training-plans/{planId}/days/{dayId}**
  - Sukces: `200 OK`
    ```json
    { // TrainingPlanDayDto
      "id": "uuid",
      "name": "Day Name",
      "description": "Optional description",
      "order_index": 1,
      "training_plan_id": "uuid",
      "exercises": [ /* Array of TrainingPlanExerciseDto */ ]
    }
    ```
- **PUT /training-plans/{planId}/days/{dayId}**
  - Sukces: `200 OK`
    ```json
    { // TrainingPlanDayDto
      "id": "uuid",
      "name": "Updated Day Name",
      "description": "Updated description",
      "order_index": 2,
      "training_plan_id": "uuid"
    }
    ```
- **DELETE /training-plans/{planId}/days/{dayId}**
  - Sukces: `204 No Content`

## 5. Przepływ danych
1.  Żądanie API trafia do Supabase Edge Function.
2.  Główny router (`createMainRouterHandler` w `index.ts`) obsługuje CORS i uwierzytelnianie JWT.
3.  Jeśli uwierzytelnianie powiedzie się, tworzony jest `ApiHandlerContext` zawierający `user`, `supabaseClient`, `request`, `url`, `requestInfo`.
4.  Główny router przekazuje żądanie do odpowiedniego "Path Handlera" (`plan-days.handler.ts` lub `plan-day-detail.handler.ts`).
5.  "Path Handler" używa `routeRequestToMethods` do dopasowania ścieżki i wyodrębnienia `rawPathParams` (`planId`, `dayId`).
6.  `routeRequestToMethods` przekazuje żądanie do odpowiedniego "Method Handlera" (np. `get.ts`, `post.ts`).
7.  "Method Handler":
    a.  Waliduje `rawPathParams` (czy są UUID) oraz ciało żądania (używając schematów Zod).
    b.  **Sprawdza Własność**: Weryfikuje, czy `training_plans` o podanym `planId` należy do `context.user.id`. Jeśli nie, zwraca `404 Not Found`.
    c.  **Operacje na Bazie Danych**:
        i.  **GET (List/Retrieve)**: Pobiera dane `training_plan_days`. Dla `GET /{dayId}` i `GET /days` (lista) dołącza zagnieżdżone `training_plan_exercises` oraz ich `training_plan_exercise_sets`. Zapytania muszą być filtrowane po `user_id` (poprzez `training_plan_id`).
        ii. **POST (Create)**:
            1.  Określa `order_index`: Jeśli nie podano, znajduje maksymalny `order_index` dla danego `planId` i dodaje 1. Jeśli podano, przesuwa inne dni z `order_index >= podany_order_index` o 1 w dół.
            2.  Wstawia nowy `training_plan_days` z `training_plan_id = planId`, `name`, `description`, obliczonym `order_index`.
            3.  Zwraca utworzony obiekt.
        iii. **PUT (Update)**:
            1.  Pobiera istniejący `training_plan_days` aby sprawdzić istnienie i uprawnienia.
            2.  Jeśli `order_index` jest zmieniany: Przesuwa inne dni treningowe w ramach tego samego `planId`, aby zachować spójność `order_index`.
            3.  Aktualizuje pola `name`, `description`, `order_index`.
            4.  Zwraca zaktualizowany obiekt.
        iv. **DELETE**:
            1.  Pobiera `order_index` usuwanego dnia.
            2.  Usuwa `training_plan_days`.
            3.  Przesuwa inne dni (`order_index > usunięty_order_index`) o 1 w górę.
    d.  Konstruuje odpowiedź sukcesu lub błędu.
8.  **Zarządzanie `order_index`**: Operacje modyfikujące `order_index` (POST, PUT, DELETE) muszą być atomowe. Rozważ użycie funkcji PostgreSQL (`rpc`) do enkapsulacji logiki zmiany kolejności. Jeśli nie, logika w Edge Function musi starannie zarządzać transakcjami lub sekwencją operacji, aby uniknąć niespójności.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: JWT obsługiwane przez `createMainRouterHandler`. Wymagane dla wszystkich endpointów.
-   **Autoryzacja**:
    -   Kluczowe jest sprawdzanie, czy `planId` należy do uwierzytelnionego użytkownika (`auth.uid()`) przy każdej operacji.
    -   Przy dostępie do `dayId`, weryfikacja, czy `dayId` należy do `planId`, który z kolei należy do użytkownika.
    -   RLS na tabelach `training_plans`, `training_plan_days`, `training_plan_exercises`, `training_plan_exercise_sets` zapewni dodatkową warstwę ochrony na poziomie bazy danych. Polityki RLS muszą być zdefiniowane tak, aby użytkownik mógł modyfikować tylko własne dane.
    -   Zapytania SQL muszą zawierać warunek `user_id = context.user.id` (lub przez powiązany `plan_id`) oprócz polegania na RLS, zgodnie z `supabase.mdc`.
-   **Walidacja Danych Wejściowych**:
    -   Użycie schematów Zod do walidacji typów, formatów, wymaganych pól i zakresów wartości dla parametrów ścieżki, zapytania i ciała żądania.
    -   `planId`, `dayId`: muszą być poprawnymi UUID.
    -   `limit`, `offset`: nieujemne liczby całkowite; zastosowanie rozsądnych wartości domyślnych i maksymalnych.
    -   `name`: niepusty string, ograniczona długość (np. 255 znaków).
    -   `order_index`: liczba całkowita >= 1.
-   **Ochrona przed IDOR**: Zapewniona przez ścisłe sprawdzanie własności zasobów. Żądanie zasobu innego użytkownika powinno skutkować `404 Not Found`.
-   **Minimalizacja Danych**: Zwracać tylko niezbędne dane w odpowiedziach.

## 7. Obsługa błędów
Standardowe odpowiedzi JSON z odpowiednimi kodami statusu HTTP:
-   `400 Bad Request`:
    -   Niepoprawny format UUID dla `planId` lub `dayId`.
    -   Niepoprawne wartości dla `limit` lub `offset`.
    -   Błąd walidacji ciała żądania (np. brak `name` w POST, niepoprawny typ danych, `order_index < 1`).
-   `401 Unauthorized`:
    -   Brakujący, niepoprawny lub wygasły token JWT (obsługiwane przez `createMainRouterHandler`).
-   `403 Forbidden`:
    -   Specyfikacja API wspomina o tym dla POST. W praktyce, jeśli użytkownik jest uwierzytelniony, ale nie ma uprawnień do planu (np. plan nie jest jego), `404 Not Found` jest bardziej odpowiednie. `403` mogłoby być użyte, gdyby istniały inne warunki biznesowe uniemożliwiające operację pomimo własności.
-   `404 Not Found`:
    -   `planId` nie istnieje lub nie należy do uwierzytelnionego użytkownika.
    -   `dayId` nie istnieje dla danego `planId` lub (pośrednio przez plan) nie należy do użytkownika.
-   `500 Internal Server Error`:
    -   Nieoczekiwane błędy bazy danych (np. naruszenie unikalności `order_index` jeśli nie jest poprawnie zarządzane).
    -   Błędy w logice zarządzania `order_index` (np. nieudane transakcje).
    -   Inne nieobsłużone wyjątki w Edge Function.

## 8. Rozważania dotyczące wydajności
-   **Zapytania do Bazy Danych**:
    -   Upewnij się, że istnieją odpowiednie indeksy na `training_plan_days(training_plan_id, order_index)`, `training_plan_exercises(training_plan_day_id, order_index)`, `training_plan_exercise_sets(training_plan_exercise_id, set_index)`.
    -   Pobieranie zagnieżdżonych danych (`exercises`, `sets`) dla list (GET /days) może być kosztowne. Użyj efektywnych złączeń SQL lub metody Supabase do pobierania powiązanych danych (np. `select('*, training_plan_exercises(*, training_plan_exercise_sets(*))')`).
    -   Implementuj paginację (limit/offset) dla endpointu listującego dni.
-   **Zarządzanie `order_index`**: Operacje reindeksowania mogą być kosztowne przy dużej liczbie dni. Użycie funkcji RPC w PostgreSQL może zoptymalizować te operacje, wykonując je atomowo i po stronie serwera bazy danych.
-   **Edge Function Cold Starts**: Zminimalizuj zależności i rozmiar funkcji, aby skrócić czas zimnego startu.

## 9. Etapy wdrożenia
Struktura plików będzie zgodna z `supabase.mdc`:
`supabase/functions/training-plan/`
  - `deno.json`
  - `index.ts` (główny router)
  - `handlers/`
    - `training-plan-days/` (dla `/training-plans/{planId}/days`)
      - `handler.ts`
      - `methods/`
        - `get.ts` (list days)
        - `post.ts` (create day)
    - `training-plan-days-id/` (dla `/training-plans/{planId}/days/{dayId}`)
      - `handler.ts`
      - `methods/`
        - `get.ts` (retrieve day)
        - `put.ts` (update day)
        - `delete.ts` (delete day)

**Kroki:**
1.  **Konfiguracja Podstawowa Funkcji** (o ile już nie istnieje):
    -   Utwórz katalog `supabase/functions/training-plans/`.
    -   Dodaj `deno.json` i podstawowy `index.ts` z `createMainRouterHandler`.
2.  **Implementacja Logiki Zarządzania `order_index`**:
    -   Zdecyduj o podejściu: funkcje RPC w PostgreSQL lub logika w Edge Function.
    -   **Podejście RPC (zalecane)**:
        -   Zdefiniuj i utwórz migracje SQL dla funkcji:
            -   `create_training_plan_day(p_user_id UUID, p_plan_id UUID, p_name TEXT, p_description TEXT, p_order_index SMALLINT)`: Wstawia dzień i reindeksuje. Zwraca nowy dzień.
            -   `update_training_plan_day(p_user_id UUID, p_day_id UUID, p_name TEXT, p_description TEXT, p_order_index SMALLINT)`: Aktualizuje dzień i reindeksuje. Zwraca zaktualizowany dzień.
            -   `delete_training_plan_day(p_user_id UUID, p_day_id UUID)`: Usuwa dzień i reindeksuje.
        -   Funkcje te powinny wewnętrznie sprawdzać własność planu (`user_id` na `training_plans`).
    -   **Podejście Edge Function**:
        -   `get_next_order_index(planId)`: Funkcja pomocnicza.
        -   `shift_order_indexes(planId, startIndex, shiftAmount)`: Funkcja pomocnicza.
        -   Każda operacja CUD będzie wymagać sekwencji zapytań (np. select max, insert, update others). Należy rozważyć transakcje, jeśli Supabase JS client je wspiera dla wielu operacji lub zapewnić odporność.
3.  **Implementacja `POST /training-plans/{planId}/days` (`training-plan-days/methods/post.ts`)**:
    -   Walidacja `planId` (UUID) i ciała żądania (Zod).
    -   Sprawdzenie własności planu.
    -   Wywołanie logiki tworzenia dnia i zarządzania `order_index` (RPC lub funkcja pomocnicza).
    -   Zwrócenie `201 Created` z danymi nowego dnia.
4.  **Implementacja `GET /training-plans/{planId}/days` (`training-plan-days/methods/get.ts`)**:
    -   Walidacja `planId` (UUID) oraz parametrów `limit`/`offset`.
    -   Sprawdzenie własności planu.
    -   Zapytanie do bazy o dni treningowe dla `planId` z uwzględnieniem `user_id`, paginacji i sortowania po `order_index`.
    -   Dołączenie zagnieżdżonych `exercises` i ich `sets` (np. `select('*, exercises:training_plan_exercises(*, sets:training_plan_exercise_sets(*))')`).
    -   Zwrócenie `200 OK` z listą dni.
5.  **Implementacja `GET /training-plans/{planId}/days/{dayId}` (`training-plan-days-id/methods/get.ts`)**:
    -   Walidacja `planId` i `dayId` (UUID).
    -   Sprawdzenie własności planu (a przez to dnia).
    -   Zapytanie do bazy o konkretny dzień (`id = dayId`, `training_plan_id = planId`).
    -   Dołączenie zagnieżdżonych `exercises` i ich `sets`.
    -   Zwrócenie `200 OK` z danymi dnia lub `404 Not Found`.
6.  **Implementacja `PUT /training-plans/{planId}/days/{dayId}` (`training-plan-days-id/methods/put.ts`)**:
    -   Walidacja `planId`, `dayId` i ciała żądania (Zod, przynajmniej jedno pole do aktualizacji).
    -   Sprawdzenie własności planu (a przez to dnia).
    -   Wywołanie logiki aktualizacji dnia i zarządzania `order_index` (RPC lub funkcja pomocnicza).
    -   Zwrócenie `200 OK` z danymi zaktualizowanego dnia lub `404 Not Found`.
7.  **Implementacja `DELETE /training-plans/{planId}/days/{dayId}` (`training-plan-days-id/methods/methods/delete.ts`)**:
    -   Walidacja `planId` i `dayId`.
    -   Sprawdzenie własności planu (a przez to dnia).
    -   Wywołanie logiki usuwania dnia i zarządzania `order_index` (RPC lub funkcja pomocnicza).
    -   Zwrócenie `204 No Content` lub `404 Not Found`.
8.  **Testowanie**:
    -   Testy jednostkowe dla logiki zarządzania `order_index` (jeśli nie RPC).
    -   Testy integracyjne dla każdego endpointu, pokrywające przypadki sukcesu, błędów walidacji, braku autoryzacji, nieznalezionych zasobów oraz poprawność reindeksowania.
9. **Dokumentacja**: Aktualizacja `supabase/functions/README.md` z opisem nowych endpointów. 
