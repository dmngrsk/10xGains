# API Endpoint Implementation Plan: Session Sets

## 1. Przegląd punktu końcowego
Ten punkt końcowy zarządza seriami ćwiczeń (`session_sets`) w ramach określonej sesji treningowej (`training_sessions`) użytkownika. Umożliwia listowanie, tworzenie, pobieranie szczegółów, aktualizowanie oraz oznaczanie serii jako ukończone lub nieudane. Wszystkie operacje są częścią Supabase Edge Function `training-sessions`.

## 2. Szczegóły żądania

### 2.1. GET `/training-sessions/{sessionId}/sets`
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
    -   Opcjonalne: Brak
-   **Request Body**: Brak

### 2.2. POST `/training-sessions/{sessionId}/sets`
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
        -   `training_plan_exercise_id` (Body, UUID): Identyfikator ćwiczenia w ramach dnia treningowego.
        -   `actual_weight` (Body, NUMERIC(7,3)): Rzeczywisty ciężar użyty w serii (>= 0).
        -   `actual_reps` (Body, SMALLINT): Rzeczywista liczba powtórzeń wykonanych w serii (>= 0).
        -   `completed_at`: (Body, DATETIME, warunkowo): Datetime string (w sytuacji, gdy status to COMPLETED lub FAILED, jest wymagany).
    -   Opcjonalne: Brak
-   **Request Body**:
    ```json
    {
      "training_plan_exercise_id": "uuid", // ID z tabeli training_plan_exercises
      "set_index": 1, // Opcjonalne, SMALLINT >= 1. Jeśli podane, wstawia na tej pozycji i przesuwa kolejne. Jeśli niepodane, dodaje na końcu.
      "actual_weight": 57.5, // Wymagane, NUMERIC(7,3) >= 0
      "actual_reps": 5, // Wymagane, SMALLINT >= 0
      "status": "PENDING",  // Opcjonalne, np. 'PENDING', 'COMPLETED', 'FAILED', 'SKIPPED', domyślnie PENDING
      "completed_at": "datetime" // Opcjonalne; jeśli podany status to COMPLETED lub FAILED, wymagane
    }
    ```

### 2.3. GET `/training-sessions/{sessionId}/sets/{setId}`
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets/{setId}`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
        -   `setId` (Path, UUID): Identyfikator serii sesji.
    -   Opcjonalne: Brak
-   **Request Body**: Brak

### 2.4. PUT `/training-sessions/{sessionId}/sets/{setId}`
-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets/{setId}`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
        -   `setId` (Path, UUID): Identyfikator serii sesji.
        -   `completed_at`: (Body, DATETIME, warunkowo): Datetime string (w sytuacji, gdy status to COMPLETED lub FAILED, jest wymagany).
    -   Opcjonalne: Brak
-   **Request Body** (Przynajmniej jedno pole opcjonalne musi być dostarczone):
    ```json
    {
      "set_index": 1, // Opcjonalne, SMALLINT >= 1. Jeśli zmienione, wyzwala przeindeksowanie.
      "actual_reps": 5, // Opcjonalne, SMALLINT >= 0
      "actual_weight": 57.5, // Opcjonalne, NUMERIC(7,3) >= 0
      "status": "COMPLETED", // Opcjonalne, np. 'PENDING', 'COMPLETED', 'FAILED', 'SKIPPED'
      "completed_at": "datetime" // Opcjonalne; jeśli podany status to COMPLETED lub FAILED, wymagane
    }
    ```

### 2.5. DELETE `/training-sessions/{sessionId}/sets/{setId}`
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets/{setId}`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
        -   `setId` (Path, UUID): Identyfikator serii sesji.
    -   Opcjonalne: Brak
-   **Request Body**: Brak

### 2.6. PATCH `/training-sessions/{sessionId}/sets/{setId}/complete`
-   **Metoda HTTP**: `PATCH`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets/{setId}/complete`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
        -   `setId` (Path, UUID): Identyfikator serii sesji.
    -   Opcjonalne: Brak
-   **Request Body**: Brak

### 2.7. PATCH `/training-sessions/{sessionId}/sets/{setId}/fail`
-   **Metoda HTTP**: `PATCH`
-   **Struktura URL**: `/training-sessions/{sessionId}/sets/{setId}/fail`
-   **Parametry**:
    -   Wymagane:
        -   `sessionId` (Path, UUID): Identyfikator sesji treningowej.
        -   `setId` (Path, UUID): Identyfikator serii sesji.
    -   Opcjonalne:
        -   `reps` (Query, integer): Liczba faktycznie wykonanych powtórzeń. Wartość domyślna 0. Musi być >= 0.
-   **Request Body**: Brak

## 3. Wykorzystywane typy
Zdefiniowane w `supabase/functions/shared/models/api-types.ts` (lub ich odpowiedniki Zod dla walidacji):
-   `SessionSetDto`
-   `CreateSessionSetCommand`
-   `UpdateSessionSetCommand`
-   `CompleteSessionSetResponseDto`
-   `FailSessionSetResponseDto`

Schematy Zod dla walidacji parametrów ścieżki, zapytań i ciał żądań będą zdefiniowane **bezpośrednio w odpowiednich plikach Method Handlerów**.
-   `sessionId`, `setId`: Muszą być prawidłowymi UUID.
-   **POST Body** (`CreateSessionSetCommand`):
    -   `training_plan_exercise_id`: Wymagany UUID.
    -   `set_index`: Opcjonalna liczba całkowita >= 1.
    -   `actual_weight`: Wymagana liczba >= 0.
    -   `actual_reps`: Wymagana liczba całkowita >= 0.
    -   `status`: Opcjonalny string, jeden z `['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']` (domyślnie PENDING).
    -   `completed_at`: Opcjonalny datetime string (gdy status to COMPLETED lub FAILED, jest wymagany).
-   **PUT Body** (`UpdateSessionSetCommand`):
    -   Co najmniej jedno pole musi być obecne.
    -   `set_index`: Opcjonalna liczba całkowita >= 1.
    -   `actual_reps`: Opcjonalna liczba całkowita >= 0.
    -   `actual_weight`: Opcjonalna liczba >= 0.
    -   `status`: Opcjonalny string, jeden z `['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']`.
    -   `completed_at`: Opcjonalny datetime string (gdy status to COMPLETED lub FAILED, jest wymagany).
-   **PATCH Query Parameter `reps`**: Opcjonalna nieujemna liczba całkowita.

## 4. Szczegóły odpowiedzi
Wszystkie odpowiedzi sukcesu (200, 201) zwracają pełny obiekt `SessionSetDto` (lub tablicę obiektów).
-   **GET `/training-sessions/{sessionId}/sets`**: `200 OK`
    ```json
    [
      {
        "id": "uuid",
        "training_session_id": "uuid",
        "training_plan_exercise_id": "uuid",
        "set_index": 1,
        "actual_weight": 57.5,
        "actual_reps": 5,
        "status": "PENDING",
        "completed_at": null
      }
    ]
    ```
-   **POST `/training-sessions/{sessionId}/sets`**: `201 Created`
    ```json
    {
      "id": "uuid",
      "training_session_id": "uuid",
      "training_plan_exercise_id": "uuid",
      "set_index": 1, // lub przypisany indeks
      "actual_weight": 57.5, // z żądania
      "actual_reps": 5,   // z żądania
      "status": "PENDING", // lub podany status (domyślnie PENDING)
      "completed_at": null
    }
    ```
-   **GET `/training-sessions/{sessionId}/sets/{setId}`**: `200 OK` (zwraca pojedynczy obiekt `SessionSetDto`)
-   **PUT `/training-sessions/{sessionId}/sets/{setId}`**: `200 OK` (zwraca zaktualizowany obiekt `SessionSetDto`)
-   **DELETE `/training-sessions/{sessionId}/sets/{setId}`**: `204 No Content`
-   **PATCH `/training-sessions/{sessionId}/sets/{setId}/complete`**: `200 OK`
    ```json
    {
      "id": "uuid",
      "training_session_id": "uuid",
      "training_plan_exercise_id": "uuid",
      "set_index": 1,
      "actual_weight": 57.5,
      "actual_reps": 5,
      "status": "COMPLETED",
      "completed_at": "2023-01-01T00:00:00Z" // Aktualny czas serwera
    }
    ```
-   **PATCH `/training-sessions/{sessionId}/sets/{setId}/fail`**: `200 OK`
    ```json
    {
      "id": "uuid",
      "training_session_id": "uuid",
      "training_plan_exercise_id": "uuid",
      "set_index": 1,
      "actual_weight": 57.5,
      "actual_reps": 3,    // Zaktualizowane na podstawie parametru `reps` lub 0
      "status": "FAILED", // Zmienione na FAILED
      "completed_at": "2023-01-01T00:00:00Z" // Aktualny czas serwera
    }
    ```
-   **Błędy**: `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `500 Internal Server Error`.

## 5. Przepływ danych
1.  Żądanie klienta trafia do Supabase Edge Function `training-sessions`.
2.  Główny router (`index.ts` funkcji `training-sessions`) weryfikuje token JWT i tworzy `ApiHandlerContext`.
3.  Żądanie jest kierowane do odpowiedniego Path Handlera (np. `supabase/functions/training-sessions/handlers/training-session-sets/handler.ts` lub `.../training-session-sets-id/handler.ts`).
4.  Path Handler używa `routeRequestToMethods` do wywołania Method Handlera.
5.  **Method Handler**:
    a.  Waliduje parametry (ścieżki, zapytania, ciała) używając schematów Zod zdefiniowanych w tym samym pliku.
    b.  Weryfikuje istnienie `training_sessions` (`sessionId`) i przynależność do `context.user.id`. Jeśli nie, `404 Not Found`.
    c.  Dla operacji na konkretnej serii (`setId`): weryfikuje istnienie `session_sets` (`setId`) i przynależność do `sessionId`. Jeśli nie, `404 Not Found`.
    d.  Weryfikuje istnienie `training_plan_exercises` (`training_plan_exercise_id` z ciała żądania POST lub z pobranej serii) i jego powiązanie z planem treningowym sesji.
    e.  **Logika specyficzna dla metody**:
        -   **GET (lista)**: Pobiera wszystkie `session_sets` dla danego `sessionId` i `context.user.id`, sortując po `set_index`.
        -   **POST**:
            -   `actual_reps` i `actual_weight` są pobierane z wymaganego ciała żądania.
            -   `status` domyślnie `PENDING`, jeśli nie podano w ciele.
            -   `completed_at` jest inicjalizowane na `null`, chyba że podano w ciele żądania.
            -   Buduje obiekt nowej serii. Pobiera listę serii powiązanych z sesją i ćwiczeniem, a następnie używając funkcji `insertAndNormalizeOrder` (`supabase/functions/shared/services/index-order.ts`), aktualizuje `set_index` tej i potencjalnie innych serii dla danego `training_session_id` i `training_plan_exercise_id` w ramach transakcji bazodanowej (obsługiwanej przez serwis).
        -   **GET (szczegóły)**: Pobiera konkretny `session_sets`.
        -   **PUT**:
            -   Aktualizuje tylko dostarczone pola (`set_index`, `actual_reps`, `actual_weight`, `status`, `completed_at`) w `session_sets`.
            -   Jeśli `set_index` jest podany i różni się od istniejącego: używa `insertAndNormalizeOrder` do aktualizacji `set_index` tej serii i przeindeksowania pozostałych serii dla danego `training_session_id` i `training_plan_exercise_id` (w ramach transakcji).
            -   Jeśli status to `COMPLETED` lub `FAILED`, a `completed_at` nie jest podane w żądaniu, ustawia `completed_at` na bieżący czas. Jeśli `completed_at` jest podane w żądaniu wraz ze statusem `COMPLETED` lub `FAILED`, używa wartości z żądania.
        -   **DELETE**:
            -   Pobiera `session_set` aby uzyskać `training_plan_exercise_id` przed usunięciem.
            -   Pobiera wszystkie pozostałe `session_sets` dla tego samego `training_session_id` i `training_plan_exercise_id`.
            -   Usuwa `session_set` o identyfikatorze podanym w zapytaniu z `session_sets`.
            -   Używa `insertAndNormalizeOrder` (przekazując `null` jako `entity` do wstawienia/aktualizacji oraz pobraną listę pozostałych serii) do przeindeksowania pozostałych serii. Wynikowa znormalizowana lista serii jest następnie aktualizowana w bazie danych (upsert).
        -   **PATCH (complete)**: Ustawia `status = 'COMPLETED'`, `completed_at = NOW()`.
        -   **PATCH (fail)**: Ustawia `status = 'FAILED'`, `completed_at = NOW()`. Aktualizuje `actual_reps` na podstawie parametru `reps` (domyślnie 0).
    f.  Zwraca odpowiedź.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: JWT (obsługiwane przez `createMainRouterHandler`).
-   **Autoryzacja**:
    -   RLS na `training_sessions` i `session_sets`.
    -   Logika aplikacji weryfikuje przynależność `sessionId` do `user.id` i `setId` do `sessionId`.
-   **Walidacja danych wejściowych**: Schematy Zod w Method Handlerach.
-   **IDOR**: Zapobieganie przez sprawdzanie własności na każdym poziomie hierarchii.

## 7. Obsługa błędów
-   **`400 Bad Request`**: Błędy walidacji Zod (np. brakujące `actual_reps`/`actual_weight` w POST), nieprawidłowy `set_index` (np. < 1).
-   **`401 Unauthorized`**: Błąd JWT.
-   **`404 Not Found`**: Nie znaleziono `sessionId`, `setId`, `training_plan_exercise_id` lub brak uprawnień.
-   **`500 Internal Server Error`**: Błędy bazy danych.

## 8. Rozważania dotyczące wydajności
-   **Indeksy bazy danych**: Na `session_sets(training_session_id, training_plan_exercise_id, set_index)`, `session_sets(id)`, `training_sessions(id, user_id)`, `training_plan_exercises(id)`.
-   **Przeindeksowywanie `set_index`**: Chcemy zaktualizować wszystkie encje w jednej transakcji, w związku z czym wykonamy `upsert` na kolekcji serii. Logika w `insertAndNormalizeOrder` powinna jedynie przyjmować gotowe dane, bez potrzeby przekazywania dodatkowych zależności.

## 9. Etapy wdrożenia
1.  **Przygotowanie środowiska (w ramach istniejącej funkcji `training-sessions`)**:
    -   Upewnić się, że katalog `supabase/functions/training-sessions` istnieje.
    -   Jeśli `training-sessions` to nowa funkcja, skopiować `deno.json` i `index.ts` (z `createMainRouterHandler`) z innej funkcji.
2.  **Implementacja `insertAndNormalizeOrder`**:
    -   Utworzyć plik `supabase/functions/shared/services/index-order.ts`.
    -   Przygotować generyczną funkcję `insertAndNormalizeOrder<T>`, która przyjmie parametry:
        -   `entities: T[]` - kolekcja encji do posortowania.
        -   `entity: T | null`: - encja do wstawienia. Jeśli `null`, nie wstawia żadnego elementu do wynikowej kolekcji.
        -   `entity_id_selector: T => string` - funkcja, która wywołana na encji zwróci jej identyfikator.
        -   `entity_index_selector: T => number` - funkcja, która wywołana na encji zwróci jej indeks.
        -   `entity_index_mutator: (T, number) => T` - funkcja, która zwraca zmutowaną encję `T` z ustawionym właściwym indeksem.
    -   Utworzyć plik `supabase/functions/shared/services/index-order.test.ts`.
    - Przygotować stosowne testy jednostkowe zaimplementowanej funkcji. Musimy zweryfikować:
        -   Poprawność kolejności przy dodaniu nowego elementu.
        -   Poprawność kolejności przy aktualizacji istniejącego elementu.
        -   Poprawność kolejności przy usunięciu elementu.
        -   Poprawność weryfikacji funkcji mutującej, tj. czy nie ma żadnych efektów ubocznych (np. nadpisania pól innych, niż określone w funkcji).
3.  **Implementacja Path Handlerów i Method Handlerów** (w `supabase/functions/training-sessions/handlers/`):
    -   Struktura katalogów:
        -   `training-session-sets/` (dla `/.../sets`)
            -   `handler.ts`
            -   `methods/get.ts`, `methods/post.ts`
        -   `training-session-sets-id/` (dla `/.../sets/{setId}`)
            -   `handler.ts`
            -   `methods/get.ts`, `methods/put.ts`, `methods/delete.ts`
        -   `training-session-sets-complete/` (dla `/.../sets/{setId}/complete`)
            -   `handler.ts`
            -   `methods/patch.ts`
        -   `training-session-sets-fail/` (dla `/.../sets/{setId}/fail`)
            -   `handler.ts`
            -   `methods/patch.ts`
    -   Zarejestrować nowe Path Handlery w głównym `index.ts` funkcji `training-sessions`.
4.  **Implementacja logiki biznesowej w Method Handlerach**:
    -   W każdym Method Handlerze:
        -   Definiować i używać schematów Zod do walidacji.
        -   Interakcje z bazą danych:
            -   Dla operacji modyfikujących `set_index` (POST z `set_index`, PUT ze zmianą `set_index`), używać `insertAndNormalizeOrder`.
            -   Dla prostych odczytów (GET) i aktualizacji niemodyfikujących kolejności (PUT bez zmiany `set_index`, PATCH), używać standardowych zapytań `supabaseClient`.
            -   Dla POST: `actual_reps` i `actual_weight` są teraz wymagane. `status` jest opcjonalny (domyślnie `PENDING`). `completed_at` jest `null`.
            -   Dla DELETE: pobrać serię w celu uzyskania `training_plan_exercise_id`, usunąć serię, a następnie użyć `insertAndNormalizeOrder` do przeindeksowania pozostałych serii dla danego `training_session_id` i `training_plan_exercise_id`.
        -   Obsługiwać `completed_at` dla PATCH `complete`/`fail` oraz dla PUT jeśli status to `COMPLETED`/`FAILED` (używając wartości z żądania lub `NOW()` jeśli nie podano).
5.  **Konfiguracja RLS**: Sprawdzić i dostosować polityki RLS.
6.  **Testowanie**: Testy manualne (Postman/curl) i, jeśli możliwe, automatyczne, weryfikujące logikę `set_index` i `insertAndNormalizeOrder`.
7.  **Dokumentacja**: Zaktualizować `supabase/functions/README.md`.
8.  **Wdrożenie**: Wdrożyć funkcję `training-sessions`.
