# API Endpoint Implementation Plan: /training-sessions

## 1. Przegląd punktu końcowego
Ten zestaw punktów końcowych zarządza sesjami treningowymi użytkowników. Umożliwia tworzenie, listowanie, pobieranie szczegółów, aktualizowanie (np. anulowanie) oraz oznaczanie sesji jako ukończonych, co wiąże się z logiką progresji ćwiczeń. Wszystkie operacje są chronione i dostępne tylko dla uwierzytelnionego użytkownika w kontekście jego własnych danych.

## 2. Ogólna Struktura Implementacji (Supabase Edge Function)
-   **Główna funkcja**: `supabase/functions/training-sessions/`
-   **Plik wejściowy**: `index.ts` (zawierający `createMainRouterHandler`)
-   **Konfiguracja Deno**: `deno.json`
-   **Path Handlers**: W `supabase/functions/training-sessions/handlers/`
    -   `training-sessions/handler.ts`: Obsługuje `GET /training-sessions` i `POST /training-sessions`.
    -   `training-sessions-id/handler.ts`: Obsługuje `GET /training-sessions/{sessionId}`, `PUT /training-sessions/{sessionId}`, `DELETE /training-sessions/{sessionId}`.
    -   `training-sessions-complete/handler.ts`: Obsługuje `POST /training-sessions/{sessionId}/complete`.
-   **Method Handlers**: W podkatalogach `methods/` dla każdego Path Handlera (np. `get.ts`, `post.ts`).
-   **Walidacja**: Schematy Zod dla wszystkich parametrów ścieżki, zapytań i ciał żądań.
-   **Narzędzia pomocnicze**: Wykorzystanie `createSuccessResponse`, `createErrorResponse` z `shared/api-helpers.ts`.

---

## 3. Szczegółowy Opis Punktów Końcowych

### 3.1. Endpoint: `GET /training-sessions`

#### 3.1.1. Szczegóły żądania
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-sessions`
-   **Parametry Query (opcjonalne)**:
    -   `limit` (number): Liczba rekordów do zwrócenia.
    -   `offset` (number): Przesunięcie (dla paginacji).
    -   `order` (string): Kierunek sortowania (np. `session_date.asc`, `session_date.desc`). Domyślnie `session_date.desc`.
    -   `status` (string): Filtrowanie po statusie sesji (np. `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
    -   `date_from` (string ISO 8601): Filtrowanie sesji od tej daty (włącznie).
    -   `date_to` (string ISO 8601): Filtrowanie sesji do tej daty (włącznie).
-   **Request Body**: Brak.

#### 3.1.2. Wykorzystywane typy
-   Odpowiedź: `TrainingSessionDto[]`

#### 3.1.3. Szczegóły odpowiedzi
-   **Sukces (200 OK)**:
    ```json
    [
      {
        "id": "uuid",
        "training_plan_id": "uuid",
        "training_plan_day_id": "uuid",
        "user_id": "uuid",
        "session_date": "2023-01-01T00:00:00Z",
        "status": "IN_PROGRESS"
      }
      // ... inne sesje
    ]
    ```
-   **Błędy**: Patrz sekcja "Obsługa błędów" poniżej (dla każdego endpointu).

#### 3.1.4. Przepływ danych
1.  Uwierzytelnienie użytkownika (obsługiwane przez `createMainRouterHandler`).
2.  Walidacja opcjonalnych parametrów query (Zod schema).
3.  Pobranie `user_id` z `ApiHandlerContext`.
4.  Zapytanie do tabeli `training_sessions` z Supabase client:
    -   `SELECT * FROM training_sessions WHERE user_id = :user_id`
    -   Zastosowanie filtrów: `status`, `session_date >= :date_from`, `session_date <= :date_to`.
    -   Zastosowanie sortowania (`ORDER BY`).
    -   Zastosowanie paginacji (`LIMIT`, `OFFSET`).
5.  Zwrócenie listy sesji jako `TrainingSessionDto[]`.

#### 3.1.5. Względy bezpieczeństwa
-   Uwierzytelnianie JWT.
-   RLS na tabeli `training_sessions`.
-   Jawne filtrowanie po `user_id` w zapytaniu SQL.
-   Walidacja typów i formatów parametrów query.

#### 3.1.6. Obsługa błędów
-   **400 Bad Request**: Nieprawidłowy format parametrów query (np. `limit` nie jest liczbą).
-   **401 Unauthorized**: Problem z tokenem JWT.
-   **500 Internal Server Error**: Błąd serwera.

#### 3.1.7. Rozważania dotyczące wydajności
-   Indeksy na `training_sessions(user_id, session_date)` oraz `training_sessions(user_id, status)`.
-   Paginacja jest kluczowa dla dużych list.

#### 3.1.8. Etapy wdrożenia
1.  Zdefiniowanie schematu Zod dla parametrów query.
2.  Implementacja Method Handlera (`get.ts`) w `supabase/functions/training-sessions/handlers/training-sessions/methods/`.
3.  Konstrukcja zapytania SQL z dynamicznym dodawaniem filtrów, sortowania i paginacji.
4.  Testowanie z różnymi kombinacjami parametrów.

### 3.2. Endpoint: `POST /training-sessions`

#### 3.2.1. Szczegóły żądania
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/training-sessions`
-   **Parametry**: Brak.
-   **Request Body**: `CreateTrainingSessionCommand`
    ```json
    {
      "training_plan_id": "uuid", // Wymagane
      "training_plan_day_id": "uuid" // Wymagane
    }
    ```

#### 3.2.2. Wykorzystywane typy
-   Żądanie: `CreateTrainingSessionCommand`
-   Odpowiedź: `TrainingSessionDto`

#### 3.2.3. Szczegóły odpowiedzi
-   **Sukces (201 Created)**:
    ```json
    {
      "id": "uuid", // Nowo utworzonej sesji
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid",
      "user_id": "uuid", // ID zalogowanego użytkownika
      "session_date": "2023-01-01T00:00:00Z", // Aktualna data/czas utworzenia
      "status": "IN_PROGRESS" // Domyślny status
    }
    ```

#### 3.2.4. Przepływ danych
1.  Uwierzytelnienie użytkownika.
2.  Walidacja ciała żądania (Zod schema dla `CreateTrainingSessionCommand`).
3.  Pobranie `user_id` z `ApiHandlerContext`.
4.  Weryfikacja istnienia i przynależności `training_plan_id` do użytkownika:
    -   `SELECT id FROM training_plans WHERE id = :training_plan_id AND user_id = :user_id`. Jeśli brak -> 400/404.
5.  Weryfikacja istnienia `training_plan_day_id` i jego powiązania z `training_plan_id`:
    -   `SELECT id FROM training_plan_days WHERE id = :training_plan_day_id AND training_plan_id = :training_plan_id`. Jeśli brak -> 400/404.
6.  Wstawienie nowego rekordu do tabeli `training_sessions`:
    -   `user_id`: z kontekstu.
    -   `training_plan_id`, `training_plan_day_id`: z ciała żądania.
    -   `session_date`: `DEFAULT CURRENT_TIMESTAMP`.
    -   `status`: `DEFAULT 'IN_PROGRESS'`.
7.  Zwrócenie nowo utworzonego obiektu `TrainingSessionDto`.

#### 3.2.5. Względy bezpieczeństwa
-   Uwierzytelnianie JWT.
-   RLS na tabelach `training_sessions`, `training_plans`, `training_plan_days`.
-   Jawne sprawdzanie `user_id` przy weryfikacji `training_plan_id`.
-   Walidacja formatu UUID dla ID w ciele żądania.

#### 3.2.6. Obsługa błędów
-   **400 Bad Request**:
    -   Brakujące lub nieprawidłowe pola w ciele żądania.
    -   Podany `training_plan_id` nie istnieje lub nie należy do użytkownika.
    -   Podany `training_plan_day_id` nie istnieje lub nie jest powiązany z podanym `training_plan_id`.
-   **401 Unauthorized**: Problem z tokenem JWT.
-   **500 Internal Server Error**: Błąd serwera.

#### 3.2.7. Rozważania dotyczące wydajności
-   Szybkie operacje INSERT. Indeksy na kluczach obcych (`training_plan_id`, `user_id`) są istotne dla weryfikacji.

#### 3.2.8. Etapy wdrożenia
1.  Zdefiniowanie schematu Zod dla `CreateTrainingSessionCommand`.
2.  Implementacja Method Handlera (`post.ts`) w `supabase/functions/training-sessions/handlers/training-sessions/methods/`.
3.  Implementacja logiki weryfikacji `training_plan_id` i `training_plan_day_id`.
4.  Implementacja wstawiania rekordu.
5.  Testowanie tworzenia sesji.

### 3.3. Endpoint: `GET /training-sessions/{sessionId}`

#### 3.3.1. Szczegóły żądania
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-sessions/{sessionId}`
-   **Parametry Path (wymagane)**:
    -   `sessionId` (UUID): ID sesji do pobrania.
-   **Request Body**: Brak.

#### 3.3.2. Wykorzystywane typy
-   Odpowiedź: `TrainingSessionDto`

#### 3.3.3. Szczegóły odpowiedzi
-   **Sukces (200 OK)**:
    ```json
    {
      "id": "uuid", // Równy {sessionId}
      "training_plan_id": "uuid",
      "training_plan_day_id": "uuid",
      "user_id": "uuid",
      "session_date": "2023-01-01T00:00:00Z",
      "status": "IN_PROGRESS"
    }
    ```

#### 3.3.4. Przepływ danych
1.  Uwierzytelnienie użytkownika.
2.  Walidacja `sessionId` z ścieżki (musi być UUID - Zod). `rawPathParams` z `ApiHandlerContext`.
3.  Pobranie `user_id` z `ApiHandlerContext`.
4.  Zapytanie do tabeli `training_sessions`:
    -   `SELECT * FROM training_sessions WHERE id = :sessionId AND user_id = :user_id`.
5.  Jeśli rekord nie zostanie znaleziony, zwróć 404.
6.  Zwróć znaleziony obiekt `TrainingSessionDto`.

#### 3.3.5. Względy bezpieczeństwa
-   Uwierzytelnianie JWT.
-   RLS na tabeli `training_sessions`.
-   Jawne filtrowanie po `id` ORAZ `user_id` w zapytaniu SQL.
-   Walidacja formatu `sessionId`.

#### 3.3.6. Obsługa błędów
-   **400 Bad Request**: Nieprawidłowy format `sessionId`.
-   **401 Unauthorized**: Problem z tokenem JWT.
-   **404 Not Found**: Sesja o podanym ID nie istnieje lub nie należy do zalogowanego użytkownika.
-   **500 Internal Server Error**: Błąd serwera.

#### 3.3.7. Rozważania dotyczące wydajności
-   Indeks na `training_sessions(id, user_id)` (lub osobno na `id` i `user_id`, jeśli `id` jest PK). PK jest domyślnie indeksowany.

#### 3.3.8. Etapy wdrożenia
1.  Zdefiniowanie schematu Zod dla `sessionId` w parametrach ścieżki.
2.  Implementacja Path Handlera (`handler.ts`) w `supabase/functions/training-sessions/handlers/training-sessions-id/` z `ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId'`.
3.  Implementacja Method Handlera (`get.ts`) w `supabase/functions/training-sessions/handlers/training-sessions-id/methods/`.
4.  Implementacja zapytania i logiki 404.
5.  Testowanie.

### 3.4. Endpoint: `PUT /training-sessions/{sessionId}`

#### 3.4.1. Szczegóły żądania
-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/training-sessions/{sessionId}`
-   **Parametry Path (wymagane)**:
    -   `sessionId` (UUID): ID sesji do aktualizacji.
-   **Request Body**: `UpdateTrainingSessionCommand`
    ```json
    {
      "status": "CANCELLED" // lub inny dozwolony status
    }
    ```

#### 3.4.2. Wykorzystywane typy
-   Żądanie: `UpdateTrainingSessionCommand`
-   Odpowiedź: `TrainingSessionDto` (spec API sugeruje `id` i `status`)
    ```json
    {
      "id": "uuid",
      "status": "CANCELLED"
    }
    ```

#### 3.4.3. Szczegóły odpowiedzi
-   **Sukces (200 OK)**: Zaktualizowany częściowy obiekt sesji.

#### 3.4.4. Przepływ danych
1.  Uwierzytelnienie użytkownika.
2.  Walidacja `sessionId` (UUID - Zod).
3.  Walidacja ciała żądania (Zod schema dla `UpdateTrainingSessionCommand`, np. `status` musi być jedną z wartości: `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
4.  Pobranie `user_id` z `ApiHandlerContext`.
5.  Aktualizacja rekordu w tabeli `training_sessions`:
    -   `UPDATE training_sessions SET status = :status WHERE id = :sessionId AND user_id = :user_id RETURNING id, status`.
6.  Jeśli aktualizacja nie wpłynęła na żaden wiersz (np. sesja nie istnieje lub nie należy do użytkownika), zwróć 404.
7.  Zwróć zaktualizowany obiekt (`id`, `status`).

#### 3.4.5. Względy bezpieczeństwa
-   Uwierzytelnianie JWT.
-   RLS.
-   Jawne warunki `id = :sessionId AND user_id = :user_id` w klauzuli `WHERE` zapytania `UPDATE`.
-   Walidacja `sessionId` i ciała żądania.

#### 3.4.6. Obsługa błędów
-   **400 Bad Request**:
    -   Nieprawidłowy format `sessionId`.
    -   Nieprawidłowe ciało żądania (np. brak `status` lub nieprawidłowa wartość `status`).
-   **401 Unauthorized**: Problem z tokenem JWT.
-   **404 Not Found**: Sesja o podanym ID nie istnieje lub nie należy do zalogowanego użytkownika.
-   **500 Internal Server Error**: Błąd serwera.

#### 3.4.7. Rozważania dotyczące wydajności
-   Szybka operacja UPDATE, jeśli poprawnie zindeksowana.

#### 3.4.8. Etapy wdrożenia
1.  Zdefiniowanie schematu Zod dla `sessionId` i `UpdateTrainingSessionCommand`.
2.  Implementacja Method Handlera (`put.ts`) w `supabase/functions/training-sessions/handlers/training-sessions-id/methods/`.
3.  Implementacja logiki aktualizacji i sprawdzania liczby zmodyfikowanych wierszy dla 404.
4.  Testowanie.

### 3.5. Endpoint: `DELETE /training-sessions/{sessionId}`

#### 3.5.1. Szczegóły żądania
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/training-sessions/{sessionId}`
-   **Parametry Path (wymagane)**:
    -   `sessionId` (UUID): ID sesji do usunięcia.
-   **Request Body**: Brak.

#### 3.5.2. Wykorzystywane typy
-   Brak.

#### 3.5.3. Szczegóły odpowiedzi
-   **Sukces (204 No Content)**: Pomyślnie usunięto sesję.

#### 3.5.4. Przepływ danych
1.  Uwierzytelnienie użytkownika.
2.  Walidacja `sessionId` (UUID - Zod).
3.  Pobranie `user_id` z `ApiHandlerContext`.
4.  Usunięcie rekordu z tabeli `training_sessions`:
    -   `DELETE FROM training_sessions WHERE id = :sessionId AND user_id = :user_id`.
5.  Jeśli usunięcie nie wpłynęło na żaden wiersz, zwróć 404.
6.  Zwróć 204 No Content. (Tabela `session_sets` ma `ON DELETE CASCADE`, więc powiązane sety zostaną usunięte automatycznie przez bazę danych).

#### 3.5.5. Względy bezpieczeństwa
-   Uwierzytelnianie JWT.
-   RLS.
-   Jawne warunki `id = :sessionId AND user_id = :user_id` w klauzuli `WHERE` zapytania `DELETE`.
-   Walidacja `sessionId`.

#### 3.5.6. Obsługa błędów
-   **400 Bad Request**: Nieprawidłowy format `sessionId`.
-   **401 Unauthorized**: Problem z tokenem JWT.
-   **404 Not Found**: Sesja o podanym ID nie istnieje lub nie należy do zalogowanego użytkownika.
-   **500 Internal Server Error**: Błąd serwera.

#### 3.5.7. Rozważania dotyczące wydajności
-   Szybka operacja DELETE. Kaskadowe usuwanie może wpłynąć na wydajność, jeśli jest wiele powiązanych `session_sets`.

#### 3.5.8. Etapy wdrożenia
1.  Zdefiniowanie schematu Zod dla `sessionId`.
2.  Implementacja Method Handlera (`delete.ts`) w `supabase/functions/training-sessions/handlers/training-sessions-id/methods/`.
3.  Implementacja logiki usuwania i sprawdzania liczby zmodyfikowanych wierszy dla 404.
4.  Testowanie.

### 3.6. Endpoint: `POST /training-sessions/{sessionId}/complete`

#### 3.6.1. Szczegóły żądania
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/training-sessions/{sessionId}/complete`
-   **Parametry Path (wymagane)**:
    -   `sessionId` (UUID): ID sesji do oznaczenia jako ukończona.
-   **Request Body**: Puste (`CompleteTrainingSessionCommand` to `Record<string, never>`).

#### 3.6.2. Wykorzystywane typy
-   Żądanie: `CompleteTrainingSessionCommand`
-   Odpowiedź: `CompleteTrainingSessionResponseDto`
    ```json
    {
      "id": "uuid",
      "status": "COMPLETED"
    }
    ```

#### 3.6.3. Szczegóły odpowiedzi
-   **Sukces (200 OK)**: Sesja oznaczona jako ukończona.

#### 3.6.4. Przepływ danych
1.  Uwierzytelnienie użytkownika.
2.  Walidacja `sessionId` (UUID - Zod).
3.  Pobranie `user_id` z `ApiHandlerContext`.
4.  **Krok Główny 1: Aktualizacja statusu sesji**
    -   `UPDATE training_sessions SET status = 'COMPLETED' WHERE id = :sessionId AND user_id = :user_id AND status == 'IN_PROGRESS' RETURNING *`.
    -   Jeśli aktualizacja nie wpłynęła na żaden wiersz (np. sesja nie istnieje, nie należy do użytkownika, była już `COMPLETED` lub była `CANCELLED`), zwróć odpowiednio 404 lub 400.
    -   Pobranie `training_plan_id` z zaktualizowanej sesji.
5.  **Krok Główny 2: Logika biznesowa aktualizacji progresji ćwiczeń**
    -   Pobierz wszystkie `session_sets` dla tej `training_session_id` (która jest równa `sessionId`):
        -   `SELECT ss.*, tpe.exercise_id, tpesets.expected_reps FROM session_sets ss JOIN training_plan_exercises tpe ON ss.training_plan_exercise_id = tpe.id JOIN training_plan_exercise_sets tpesets ON ss.training_plan_exercise_id = tpesets.training_plan_exercise_id AND ss.set_index = tpesets.set_index WHERE ss.training_session_id = :sessionId`.
    -   Dla każdego `exercise_id` występującego w pobranych `session_sets` (grupując po `exercise_id`):
        -   Określ, czy ćwiczenie zostało wykonane pomyślnie: wszystkie sety (`session_sets`) dla danego `exercise_id` w ramach tej sesji muszą mieć status `COMPLETED` (lub `actual_reps >= expected_reps` - do sprecyzowania definicji sukcesu seta).
        -   Pobierz odpowiedni rekord `training_plan_exercise_progressions` dla `training_plan_id` (z sesji) i `exercise_id`.
        -   Jeśli ćwiczenie udane:
            -   Zresetuj `consecutive_failures = 0`.
            -   Zwiększ `expected_weight` na wszystkich seriach w planie treningowym `training_plan_id` w skorelowanym ćwiczeniu o `weight_increment`.
        -   Jeśli ćwiczenie nieudane:
            -   Zwiększ `consecutive_failures` o 1.
            -   Jeśli `consecutive_failures >= failure_count_for_deload`:
                -   Zastosuj deload zgodny z aktualnie wybraną strategią (np. dla proportional: `expected_weight = expected_weight * (1 - deload_percentage / 100)`).
                -   Zresetuj `consecutive_failures = 0`.
        -   Zaktualizuj rekord `training_plan_exercise_progressions`.
    - Zaimplementuj tę logikę w ramach funkcji `applyExerciseProgression`, którą zapiszesz w `supabase/functions/shared/services/exercise-progression.ts`.
6.  Zwróć `CompleteTrainingSessionResponseDto` (`id` sesji i `status: 'COMPLETED'`).
7.  **Transakcyjność**: Operacje w kroku 4 i 5 (aktualizacja statusu sesji i progresji) powinny być wykonane atomowo w ramach jednej transakcji bazodanowej. Korzystając z serwisu `ProgressionService`, należy zbudować kolekcję stanów zaktualizowanych obiektów progresji ciężaru, które zaktualizujemy atomową operacją `supabaseClient.upsert(records, { onConflict: 'id' })`.

#### 3.6.5. Względy bezpieczeństwa
-   Uwierzytelnianie JWT.
-   RLS na wszystkich zaangażowanych tabelach.
-   Jawne filtrowanie po `user_id` we wszystkich zapytaniach.
-   Walidacja `sessionId`.

#### 3.6.6. Obsługa błędów
-   **400 Bad Request**:
    -   Nieprawidłowy format `sessionId`.
    -   Próba ukończenia sesji, która jest w stanie niepozwalającym na ukończenie (np. już `CANCELLED` lub `COMPLETED`).
-   **401 Unauthorized**: Problem z tokenem JWT.
-   **404 Not Found**: Sesja o podanym ID nie istnieje lub nie należy do zalogowanego użytkownika.
-   **500 Internal Server Error**: Błąd serwera, szczególnie podczas skomplikowanej logiki aktualizacji progresji.

#### 3.6.7. Rozważania dotyczące wydajności
-   Logika aktualizacji progresji może być złożona i wymagać wielu zapytań. Optymalizacja zapytań i użycie funkcji bazodanowej (PL/pgSQL) dla transakcyjności i wydajności jest kluczowe.
-   Indeksy na `session_sets(training_session_id)`, `training_plan_exercise_progressions(training_plan_id, exercise_id)`.

#### 3.6.8. Etapy wdrożenia
1.  Zdefiniowanie schematu Zod dla `sessionId`.
2.  Implementacja Path Handlera (`handler.ts`) w `supabase/functions/training-sessions/handlers/training-sessions-complete/` z `ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/complete'`.
3.  Implementacja Method Handlera (`post.ts`) w `supabase/functions/training-sessions/handlers/training-sessions-complete/methods/`.
4.  Zaprojektowanie i implementacja funkcji PL/pgSQL (lub logiki w Method Handlerze z ręcznym zarządzaniem transakcją, jeśli funkcja DB nie jest możliwa) do atomowego wykonania aktualizacji statusu sesji i logiki progresji ćwiczeń.
    -   Definicja kryterium sukcesu/porażki dla ćwiczenia na podstawie jego setów.
    -   Pobieranie i aktualizowanie `training_plan_exercise_progressions`.
5.  Dokładne testowanie, w tym przypadków brzegowych dla progresji i stanów sesji.
