# API Endpoint Implementation Plan: Training Plan Exercise Sets

## 1. Przegląd punktu końcowego
Punkty końcowe te zarządzają seriami ćwiczeń (sets) w ramach konkretnego ćwiczenia (exercise) przypisanego do dnia treningowego (training plan day) w planie treningowym (training plan) użytkownika. Umożliwiają operacje CRUD (Create, Read, Update, Delete) na seriach, w tym automatyczne zarządzanie kolejnością (`set_index`). Wymagane jest uwierzytelnienie użytkownika dla wszystkich operacji.

## 2. Szczegóły żądania

### 2.1. Pobieranie wszystkich serii dla ćwiczenia w planie treningowym
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID): Identyfikator planu treningowego.
        -   `dayId` (UUID): Identyfikator dnia treningowego.
        -   `exerciseId` (UUID): Identyfikator ćwiczenia w planie treningowym.
-   **Request Body**: Brak

### 2.2. Tworzenie nowej serii dla ćwiczenia w planie treningowym
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID)
-   **Request Body**:
    ```json
    {
      "expected_reps": 10, // Wymagane, SMALLINT > 0
      "expected_weight": 50.0, // Wymagane, NUMERIC(7,3) > 0
      "set_index": 1 // Opcjonalne, SMALLINT >= 0. Jeśli podane, wstawia na tej pozycji i przesuwa kolejne. Jeśli niepodane, dodaje na końcu.
    }
    ```

### 2.3. Pobieranie szczegółów konkretnej serii
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID)
        -   `setId` (UUID): Identyfikator serii.
-   **Request Body**: Brak

### 2.4. Aktualizacja konkretnej serii
-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID)
        -   `setId` (UUID)
-   **Request Body**:
    ```json
    {
      "set_index": 1, // Opcjonalne, SMALLINT >= 0
      "expected_reps": 12, // Opcjonalne, SMALLINT > 0
      "expected_weight": 55.0 // Opcjonalne, NUMERIC(7,3) > 0
    }
    ```
    Jeśli `set_index` zostanie zmieniony, pozostałe serie dla tego ćwiczenia zostaną automatycznie przeindeksowane.

### 2.5. Usuwanie konkretnej serii
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}`
-   **Parametry**:
    -   Wymagane (w ścieżce):
        -   `planId` (UUID)
        -   `dayId` (UUID)
        -   `exerciseId` (UUID)
        -   `setId` (UUID)
-   **Request Body**: Brak. Kolejne serie zostaną automatycznie przeindeksowane.

## 3. Wykorzystywane typy
-   `TrainingPlanExerciseSetDto` (z `supabase/functions/shared/api-types.ts`): Używany w odpowiedziach GET. Odpowiada `Database["public"]["Tables"]["training_plan_exercise_sets"]["Row"]`. Nazwa typu pozostaje niezmieniona ze względu na powiązanie z kodem, ale w kontekście tego dokumentu odnosi się do "serii".
    ```typescript
    export type TrainingPlanExerciseSetDto = {
      id: string; // UUID
      training_plan_exercise_id: string; // UUID
      set_index: number; // SMALLINT
      expected_reps: number; // SMALLINT
      expected_weight: number; // NUMERIC(7,3)
    };
    ```
-   `CreateTrainingPlanExerciseSetCommand` (z `supabase/functions/shared/api-types.ts`): Używany jako podstawa dla walidacji ciała żądania POST. Należy dostosować schemat Zod, aby `set_index` był opcjonalny. Nazwa typu pozostaje niezmieniona.
    ```typescript
    // Definicja z api-types.ts:
    // export type CreateTrainingPlanExerciseSetCommand = Omit<Database["public"]["Tables"]["training_plan_exercise_sets"]["Insert"], "id" | "training_plan_exercise_id">;
    // Odpowiada: { set_index: number, expected_reps: number, expected_weight: number }
    // Zod schema dla POST body:
    // {
    //   expected_reps: z.number().int().positive(),
    //   expected_weight: z.number().positive(),
    //   set_index: z.number().int().nonnegative().optional()
    // }
    ```
-   `UpdateTrainingPlanExerciseSetCommand` (z `supabase/functions/shared/api-types.ts`): Używany jako podstawa dla walidacji ciała żądania PUT. Nazwa typu pozostaje niezmieniona.
    ```typescript
    // Definicja z api-types.ts:
    // export type UpdateTrainingPlanExerciseSetCommand = Pick<Database["public"]["Tables"]["training_plan_exercise_sets"]["Update"], "set_index" | "expected_reps" | "expected_weight">;
    // Odpowiada: { set_index?: number | null, expected_reps?: number | null, expected_weight?: number | null }
    // Zod schema dla PUT body:
    // {
    //   set_index: z.number().int().nonnegative(),
    //   expected_reps: z.number().int().positive(),
    //   expected_weight: z.number().positive()
    // }
    ```

## 4. Szczegóły odpowiedzi

### Sukces
-   **GET /.../sets**: `200 OK`
    ```json
    [
      {
        "id": "uuid",
        "set_index": 1,
        "expected_reps": 10,
        "expected_weight": 50.0,
        "training_plan_exercise_id": "uuid"
      },
      // ... inne serie
    ]
    ```
-   **POST /.../sets**: `201 Created`
    ```json
    {
      "id": "uuid",
      "set_index": 1,
      "expected_reps": 10,
      "expected_weight": 50.0,
      "training_plan_exercise_id": "uuid"
    }
    ```
-   **GET /.../sets/{setId}**: `200 OK`
    ```json
    {
      "id": "uuid",
      "set_index": 1,
      "expected_reps": 10,
      "expected_weight": 50.0,
      "training_plan_exercise_id": "uuid"
    }
    ```
-   **PUT /.../sets/{setId}**: `200 OK`
    ```json
    {
      "id": "uuid",
      "set_index": 1,
      "expected_reps": 12,
      "expected_weight": 55.0,
      "training_plan_exercise_id": "uuid"
    }
    ```
-   **DELETE /.../sets/{setId}**: `204 No Content`

### Błędy
-   `400 Bad Request`: Nieprawidłowe dane wejściowe (np. błędny format UUID, wartości `expected_reps`/`expected_weight` poza zakresem, nieprawidłowy JSON).
-   `401 Unauthorized`: Brak lub nieprawidłowy token JWT; użytkownik nie jest uwierzytelniony.
-   `404 Not Found`: Nie znaleziono zasobu (`planId`, `dayId`, `exerciseId`, `setId`) lub użytkownik nie ma do niego uprawnień (RLS i dodatkowe sprawdzenia własności w logice aplikacji).
-   `500 Internal Server Error`: Wewnętrzny błąd serwera (np. błąd transakcji bazodanowej podczas przeindeksowywania).

## 5. Przepływ danych
1.  Żądanie HTTP trafia do głównego routera funkcji Supabase Edge Function `training-plans` (tj. `supabase/functions/training-plans/index.ts`).
2.  Główny router (`createMainRouterHandler` z `supabase/functions/shared/api-handler.ts`, wywoływany w `training-plans/index.ts`) obsługuje:
    -   Wstępną obsługę CORS (np. żądania OPTIONS).
    -   Uwierzytelnienie JWT: Ekstrakcja i walidacja tokena. W przypadku niepowodzenia zwraca `401 Unauthorized`.
    -   Utworzenie instancji klienta Supabase w kontekście użytkownika.
    -   Przygotowanie obiektu `ApiHandlerContext` zawierającego `user`, `supabaseClient`, `request`, `url`, `requestInfo`.
3.  Główny router (`training-plans/index.ts`) kieruje żądanie do odpowiedniego "Path Handler" na podstawie wzorca ścieżki. Dla serii ćwiczeń będą to nowe handlery w strukturze `supabase/functions/training-plans/handlers/`:
    -   `training-plan-exercise-sets/handler.ts` dla ścieżki `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets`
    -   `training-plan-exercise-sets-id/handler.ts` dla ścieżki `/training-plans/{planId}/days/{dayId}/exercises/{exerciseId}/sets/{setId}`
4.  "Path Handler" (np. `training-plan-exercise-sets/handler.ts`):
    -   Używa `routeRequestToMethods` (z `supabase/functions/shared/api-handler.ts`) do dopasowania ścieżki do swojego `ABSOLUTE_PATH_PATTERN` i wywołania odpowiedniego "Method Handler" (np. `get.ts`, `post.ts` z podkatalogu `methods/`).
    -   Ekstrahuje `rawPathParams` (np. `planId`, `dayId`, `exerciseId`, `setId`) i dodaje je do `ApiHandlerContext`.
5.  "Method Handler" (np. `supabase/functions/training-plans/handlers/training-plan-exercise-sets/methods/post.ts`):
    -   **Walidacja**:
        -   Waliduje parametry ścieżki (np. `planId`, `dayId`, `exerciseId`, `setId` jako UUID) używając schematów Zod.
        -   Waliduje ciało żądania (dla POST, PUT) przy użyciu odpowiednich schematów Zod (zgodnie z sekcją 3, z uwzględnieniem opcjonalności pól dla PUT). Dla PUT, sprawdza czy przynajmniej jedno pole jest dostarczone.
    -   **Weryfikacja hierarchii i własności**:
        -   Pobiera `training_plan` na podstawie `planId` i sprawdza, czy `user_id` zgadza się z `context.user.id`.
        -   Pobiera `training_plan_day` na podstawie `dayId` i sprawdza, czy należy do zweryfikowanego `planId`.
        -   Pobiera `training_plan_exercise` (rekord z tabeli `training_plan_exercises`) na podstawie `exerciseId` (ID z parametrów ścieżki, które jest ID rekordu `training_plan_exercises`) i sprawdza, czy należy do zweryfikowanego `dayId`.
        -   Jeśli którykolwiek z powyższych warunków nie jest spełniony (zasób nie istnieje lub użytkownik nie ma do niego uprawnień), zwraca błąd prowadzący do `404 Not Found`.
    -   **Logika biznesowa i operacje na bazie danych** (używając `supabaseClient` z `ApiHandlerContext` na tabeli `training_plan_exercise_sets`):
        -   **GET All**: Pobiera wszystkie serie (`training_plan_exercise_sets`) powiązane ze zweryfikowanym `training_plan_exercise_id` (ustalonym na podstawie `exerciseId` z parametrów ścieżki), sortując po `set_index`.
        -   **POST**:
            -   Używa zweryfikowanego `training_plan_exercise_id` jako klucza obcego.
            -   Jeśli `set_index` jest podany w ciele żądania:
                -   Pobiera wszystkie istniejące serie dla danego `training_plan_exercise_id`, których `set_index` jest >= podanemu `set_index`.
                -   Zwiększa `set_index` tych serii o 1.
                -   Wstawia nową serię z podanym `set_index` i danymi z ciała żądania.
            -   Jeśli `set_index` nie jest podany:
                -   Znajduje maksymalny `set_index` dla danego `training_plan_exercise_id` i używa `max_set_index + 1` (lub 0, jeśli brak serii).
                -   Wstawia nową serię.
            -   Zwraca utworzoną serię. Operacje modyfikujące `order_index` wielu wierszy powinny być atomowe (np. transakcja lub funkcja RPC).
        -   **GET One**: Pobiera konkretną serię (`training_plan_exercise_sets`) na podstawie `setId` i dodatkowo sprawdza, czy `training_plan_exercise_id` tej serii pasuje do zweryfikowanego `training_plan_exercise_id` z kontekstu.
        -   **PUT**:
            -   Pobiera istniejącą serię na podstawie `setId` i weryfikuje jej przynależność do `training_plan_exercise_id`.
            -   Jeśli `set_index` w żądaniu (opcjonalny) różni się od istniejącego i jest podany:
                -   Implementuje logikę przeindeksowania: pobiera wszystkie serie dla `training_plan_exercise_id`, usuwa stary `set_index` edytowanej serii, wstawia ją na nowej pozycji `set_index` i odpowiednio przesuwa inne serie.
            -   Aktualizuje tylko te pola (`expected_reps`, `expected_weight`, `set_index`), które zostały podane w ciele żądania.
            -   Zwraca zaktualizowaną serię. Operacje modyfikujące `set_index` wielu wierszy powinny być atomowe.
        -   **DELETE**:
            -   Pobiera usuwaną serię, aby uzyskać jej `set_index` i zweryfikować przynależność.
            -   Usuwa serię.
            -   Pobiera wszystkie pozostałe serie dla danego `training_plan_exercise_id`, których `set_index` był > `set_index` usuniętej serii.
            -   Zmniejsza `set_index` tych serii o 1. Operacje modyfikujące `set_index` wielu wierszy powinny być atomowe.
    -   **Odpowiedź**: Zwraca odpowiedź używając `createSuccessResponse` lub `createErrorResponse` (z `supabase/functions/shared/api-helpers.ts`).

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Realizowane przez `createMainRouterHandler` za pomocą JWT. Każde żądanie musi zawierać ważny token.
-   **Autoryzacja**:
    -   Polityki RLS (Row-Level Security) na tabeli `training_plan_exercise_sets` oraz tabelach nadrzędnych (`training_plans`, `training_plan_days`, `training_plan_exercises`) muszą zapewniać, że użytkownik ma dostęp tylko do swoich danych (`WHERE user_id = auth.uid()` lub poprzez powiązania).
    -   Logika aplikacji w Method Handlers musi dodatkowo weryfikować, czy `planId`, `dayId` i `exerciseId` (z parametrów ścieżki) faktycznie należą do uwierzytelnionego użytkownika i tworzą poprawną hierarchię. Zapobiega to wyciekowi informacji o istnieniu zasobów, do których użytkownik nie ma dostępu, i zapewnia poprawne zwracanie błędów `404 Not Found`.
-   **Walidacja danych wejściowych**:
    -   Użycie Zod do walidacji parametrów ścieżki (format UUID) oraz ciała żądania (typy danych, zakresy wartości, wymagane pola).
    -   Zabezpieczenie przed atakami typu injection poprzez parametryzowane zapytania Supabase.
-   **Ochrona przed nadmiernym wykorzystaniem (Rate Limiting)**: Może być konieczne wdrożenie na poziomie globalnym lub dla specyficznych endpointów, jeśli przewiduje się duże obciążenie. (Poza zakresem tej funkcji, ale warto o tym pamiętać).

## 7. Rozważania dotyczące wydajności
-   **Indeksowanie bazy danych**:
    -   Kluczowe jest posiadanie indeksów na:
        -   `training_plan_exercise_sets(training_plan_exercise_id, set_index)` (istnieje jako `UNIQUE` constraint).
        -   `training_plan_exercise_sets(training_plan_exercise_id)` (istnieje).
        -   Klucze obce i pola używane w klauzulach `WHERE` do weryfikacji własności (np. `training_plans(user_id)`).
-   **Operacje przeindeksowywania**:
    -   Logika przeindeksowywania (w POST, PUT, DELETE) może być kosztowna, jeśli obejmuje wiele aktualizacji.
    -   Należy dążyć do minimalizacji liczby zapytań do bazy danych. Rozważenie użycia transakcji bazodanowych (np. przez wywołanie funkcji PostgreSQL za pomocą `supabaseClient.rpc()`) może być korzystne dla atomowości i potencjalnie wydajności, zamiast wielu osobnych zapytań z Edge Function. Alternatywnie, staranne sekwencjonowanie operacji w Edge Function.
    -   Dla małej liczby serii na ćwiczenie (co jest typowe), operacje w Edge Function powinny być wystarczająco wydajne.
-   **Pobieranie danych**: Unikać pobierania niepotrzebnych danych (np. używać `.select()` do określenia kolumn).

## 8. Etapy wdrożenia
1.  **Struktura katalogów** (w ramach istniejącej funkcji `supabase/functions/training-plans/`):
    -   Wewnątrz `supabase/functions/training-plans/handlers/` utwórz nowe podkatalogi:
        -   `training-plan-exercise-sets/`
            -   Wewnątrz `training-plan-exercise-sets/` utwórz `handler.ts`.
            -   Wewnątrz `training-plan-exercise-sets/` utwórz podkatalog `methods/` z plikami `get.ts` (dla listowania serii) i `post.ts` (dla tworzenia serii).
        -   `training-plan-exercise-sets-id/`
            -   Wewnątrz `training-plan-exercise-sets-id/` utwórz `handler.ts`.
            -   Wewnątrz `training-plan-exercise-sets-id/` utwórz podkatalog `methods/` z plikami `get.ts` (dla pobierania konkretnej serii), `put.ts` (dla aktualizacji) i `delete.ts` (dla usuwania).
2.  **Konfiguracja `deno.json`**: Nie jest wymagana nowa konfiguracja, ponieważ handlery są częścią istniejącej funkcji `training-plans`.
3.  **Aktualizacja `index.ts` głównego routera funkcji `training-plans`**:
    -   W `supabase/functions/training-plans/index.ts`:
        -   Zaimportuj nowo utworzone Path Handlery (`training-plan-exercise-sets/handler.ts` i `training-plan-exercise-sets-id/handler.ts`).
        -   Dodaj te Path Handlery do listy w `createMainRouterHandler`, upewniając się, że ich wzorce ścieżek są poprawne i nie kolidują z istniejącymi.
4.  **Implementacja "Path Handlers"**:
    -   **`supabase/functions/training-plans/handlers/training-plan-exercise-sets/handler.ts`**:
        -   Zdefiniuj `ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises/:exerciseId/sets'`.
        -   Importuj Method Handlers z `./methods/`.
        -   Eksportuj funkcję `handleTrainingPlanExerciseSetsRoute(req, context)` używającą `routeRequestToMethods` z mapą metod (GET, POST).
    -   **`supabase/functions/training-plans/handlers/training-plan-exercise-sets-id/handler.ts`**:
        -   Zdefiniuj `ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises/:exerciseId/sets/:setId'`.
        -   Importuj Method Handlers z `./methods/`.
        -   Eksportuj funkcję `handleTrainingPlanExerciseSetByIdRoute(req, context)` używającą `routeRequestToMethods` z mapą metod (GET, PUT, DELETE).
5.  **Definicje schematów Zod**:
    -   Schematy Zod dla walidacji parametrów ścieżki oraz ciał żądań (zgodnie z Sekcją 3, z uwzględnieniem opcjonalnych pól dla PUT) powinny być zdefiniowane bezpośrednio w odpowiednich plikach Method Handler.
    -   Dla PUT, schemat Zod powinien walidować, że przynajmniej jedno z opcjonalnych pól (`set_index`, `expected_reps`, `expected_weight`) jest obecne w żądaniu. Można to osiągnąć za pomocą metody `.refine()` lub `.superRefine()` na obiekcie Zod.
6.  **Implementacja "Method Handlers"**: Dla każdego pliku `.ts` w nowo utworzonych katalogach `methods/`:
    -   Eksportuj asynchroniczną funkcję handlera (np. `handleGetTrainingPlanExerciseSets(context)`, `handleCreateTrainingPlanExerciseSet(context)` itd.).
    -   **Walidacja**: Użyj zdefiniowanych schematów Zod do walidacji `context.rawPathParams` i `await context.req.json()` (jeśli dotyczy).
    -   **Weryfikacja własności i hierarchii**: Zgodnie z opisem w zaktualizowanej Sekcji 5 (weryfikacja `planId`, `dayId`, `exerciseId` aż do `training_plan_exercise_id`).
    -   **Logika biznesowa**: Implementuj logikę opisaną w zaktualizowanej Sekcji 5, w tym operacje CRUD na tabeli `training_plan_exercise_sets` i logikę przeindeksowywania `set_index`.
        -   Rozważ użycie funkcji RPC PostgreSQL dla atomowych operacji przeindeksowywania, jeśli logika staje się skomplikowana lub wymaga wielu kroków.
    -   **Odpowiedź**: Użyj `createSuccessResponse` i `createErrorResponse`.
7.  **Dokumentacja**: Zaktualizuj plik `supabase/functions/README.md` (główny README dla funkcji w Supabase), dodając dokumentację dla nowo utworzonych endpointów w ramach funkcji `training-plans`.
8.  **Testowanie**: Dokładnie przetestuj wszystkie przypadki użycia, w tym scenariusze błędów i logikę przeindeksowywania.
    -   Testy powinny obejmować weryfikację poprawnego działania w kontekście zintegrowanej funkcji `training-plans`.

Ten plan powinien zapewnić solidne podstawy dla zespołu programistów do wdrożenia punktów końcowych API dla serii ćwiczeń w planie treningowym. 
