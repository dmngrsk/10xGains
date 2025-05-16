# API Endpoint Implementation Plan: Exercises Resource

## 1. Przegląd punktu końcowego
Punkty końcowe zasobu `Exercises` umożliwiają zarządzanie globalną listą dostępnych ćwiczeń w systemie. Obejmują operacje odczytu (listy i pojedynczego ćwiczenia), tworzenia, aktualizacji oraz usuwania ćwiczeń. Operacje modyfikujące (tworzenie, aktualizacja, usuwanie) wymagają odpowiednich uprawnień administratora.

## 2. Szczegóły żądania

### 2.1. Pobieranie listy ćwiczeń
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/exercises`
-   **Parametry Query**:
    -   Opcjonalne:
        -   `limit` (number): Liczba wyników na stronę.
        -   `offset` (number): Numer strony (przesunięcie).
        -   `sort` (string): Klucz sortowania (np. `name.asc`).
-   **Request Body**: Brak

### 2.2. Tworzenie nowego ćwiczenia
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/exercises`
-   **Parametry**: Brak
-   **Request Body**:
    ```json
    {
      "name": "string (required, min 1 char)",
      "description": "string (nullable)"
    }
    ```

### 2.3. Pobieranie szczegółów ćwiczenia
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/exercises/{id}`
-   **Parametry Ścieżki**:
    -   Wymagane: `id` (UUID) - identyfikator ćwiczenia.
-   **Request Body**: Brak

### 2.4. Aktualizacja ćwiczenia
-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/exercises/{id}`
-   **Parametry Ścieżki**:
    -   Wymagane: `id` (UUID) - identyfikator ćwiczenia.
-   **Request Body**:
    ```json
    {
      "name": "string (optional, min 1 char if provided)",
      "description": "string (nullable, optional)"
    }
    ```

### 2.5. Usuwanie ćwiczenia
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/exercises/{id}`
-   **Parametry Ścieżki**:
    -   Wymagane: `id` (UUID) - identyfikator ćwiczenia.
-   **Request Body**: Brak

## 3. Wykorzystywane typy
Zdefiniowane w `supabase/functions/shared/api-types.ts`:
-   `ExerciseDto`: Używany w odpowiedziach zwracających dane ćwiczenia.
    ```typescript
    export type ExerciseDto = Database["public"]["Tables"]["exercises"]["Row"];
    ```
-   `CreateExerciseCommand`: Używany do walidacji ciała żądania przy tworzeniu ćwiczenia.
    ```typescript
    export type CreateExerciseCommand = Pick<Database["public"]["Tables"]["exercises"]["Insert"], "name" | "description">;
    ```
-   `UpdateExerciseCommand`: Używany do walidacji ciała żądania przy aktualizacji ćwiczenia.
    ```typescript
    export type UpdateExerciseCommand = Pick<Database["public"]["Tables"]["exercises"]["Update"], "name" | "description">;
    ```

## 4. Szczegóły odpowiedzi

### 4.1. `GET /exercises`
-   **Sukces (200 OK)**:
    ```json
    [
      {
        "id": "uuid",
        "name": "Squat",
        "description": "A lower-body exercise."
      },
      // ... inne ćwiczenia
    ]
    ```
-   **Błędy**:
    -   500 Internal Server Error

### 4.2. `POST /exercises`
-   **Sukces (201 Created)**:
    ```json
    {
      "id": "uuid",
      "name": "Exercise Name",
      "description": "Details about the exercise"
    }
    ```
-   **Błędy**:
    -   400 Bad Request
    -   401 Unauthorized
    -   403 Forbidden
    -   500 Internal Server Error

### 4.3. `GET /exercises/{id}`
-   **Sukces (200 OK)**:
    ```json
    {
      "id": "uuid",
      "name": "Squat",
      "description": "A lower-body exercise."
    }
    ```
-   **Błędy**:
    -   400 Bad Request (jeśli `id` nie jest UUID)
    -   404 Not Found
    -   500 Internal Server Error

### 4.4. `PUT /exercises/{id}`
-   **Sukces (200 OK)**:
    ```json
    {
      "id": "uuid",
      "name": "Updated Exercise Name",
      "description": "Updated details about the exercise"
    }
    ```
-   **Błędy**:
    -   400 Bad Request
    -   401 Unauthorized
    -   403 Forbidden
    -   404 Not Found
    -   500 Internal Server Error

### 4.5. `DELETE /exercises/{id}`
-   **Sukces (204 No Content)**: Brak ciała odpowiedzi.
-   **Błędy**:
    -   400 Bad Request (jeśli `id` nie jest UUID)
    -   401 Unauthorized
    -   403 Forbidden
    -   404 Not Found
    -   500 Internal Server Error

## 5. Przepływ danych
1.  Żądanie HTTP trafia do głównego routera Supabase Edge Function w `supabase/functions/exercises/index.ts`.
2.  Router (`createMainRouterHandler`) obsługuje CORS, uwierzytelnianie JWT (tworzy `ApiHandlerContext` z `user` i `supabaseClient`).
3.  Na podstawie ścieżki żądania, router kieruje je do odpowiedniego Path Handlera:
    -   `/exercises` -> `supabase/functions/exercises/handlers/exercises/handler.ts`
    -   `/exercises/{id}` -> `supabase/functions/exercises/handlers/exercise-id/handler.ts`
4.  Path Handler (`routeRequestToMethods`) dopasowuje ścieżkę, wyodrębnia parametry (np. `{id}`) i przekazuje żądanie wraz z kontekstem do odpowiedniego Method Handlera (np. `get.ts`, `post.ts`) na podstawie metody HTTP.
5.  Method Handler:
    -   Waliduje parametry ścieżki i ciało żądania przy użyciu schematów Zod.
    -   W przypadku operacji POST, PUT, DELETE, sprawdza uprawnienia użytkownika (np. rola 'admin' w `context.user.app_metadata.roles`).
    -   Wykonuje operacje na bazie danych (`public.exercises`) za pomocą `context.supabaseClient`.
    -   Konstruuje odpowiedź (sukces lub błąd) używając `createSuccessResponse` lub `createErrorResponse`.
6.  Odpowiedź jest zwracana przez kolejne warstwy do klienta.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Wszystkie endpointy, nawet te publicznie dostępne (`GET`), przechodzą przez mechanizm `createMainRouterHandler`, który próbuje zweryfikować token JWT. Dla operacji modyfikujących (POST, PUT, DELETE) token JWT jest wymagany.
-   **Autoryzacja**:
    -   Operacje `POST /exercises`, `PUT /exercises/{id}`, `DELETE /exercises/{id}` wymagają specjalnych uprawnień (np. rola administratora). Implementacja musi sprawdzać te uprawnienia w `ApiHandlerContext.user`. Jeśli użytkownik nie ma uprawnień, zwracany jest błąd 403 Forbidden.
    -   Operacje `GET /exercises` i `GET /exercises/{id}` są publicznie dostępne i nie wymagają specjalnych uprawnień poza ważnym (lub brakiem) tokenem.
-   **Walidacja danych wejściowych**:
    -   Parametry ścieżki (`id`) muszą być walidowane jako UUID.
    -   Ciała żądań (`CreateExerciseCommand`, `UpdateExerciseCommand`) muszą być walidowane przy użyciu schematów Zod (np. `name` nie może być puste, odpowiednie typy danych).
    -   Parametry query (`limit`, `offset`, `sort`) powinny być walidowane.
-   **Ochrona przed SQL Injection**: Zapewniona przez użycie Supabase client-a.
-   **CORS**: Obsługiwane przez `createMainRouterHandler`.

## 7. Obsługa błędów
Błędy będą obsługiwane za pomocą funkcji pomocniczych `createErrorResponse(statusCode, message, details?)`.
-   **400 Bad Request**: Błędy walidacji Zod (parametrów ścieżki, query, ciała żądania). Wiadomość błędu powinna zawierać szczegóły walidacji.
-   **401 Unauthorized**: Brakujący lub nieprawidłowy token JWT.
-   **403 Forbidden**: Użytkownik uwierzytelniony, ale nie posiada wymaganych uprawnień do wykonania operacji.
-   **404 Not Found**: Zasób (np. ćwiczenie o danym `id`) nie został znaleziony w bazie danych.
-   **500 Internal Server Error**: Wewnętrzne błędy serwera, np. problemy z połączeniem z bazą danych, nieoczekiwane wyjątki w logice. Błędy te powinny być logowane po stronie serwera.

## 8. Rozważania dotyczące wydajności
-   **Odpytywanie bazy danych**:
    -   `GET /exercises`: Zapytanie powinno być zoptymalizowane. Domyślnie Supabase zwraca wszystkie kolumny. Należy rozważyć użycie `.select()` do wybrania tylko potrzebnych pól, jeśli nie wszystkie są wymagane w listingu. Implementacja paginacji (`limit`, `offset`) jest kluczowa dla dużych zbiorów danych. Indeksowanie kolumny `name` może poprawić wydajność sortowania.
    -   `GET /exercises/{id}`: Zapytanie o pojedynczy rekord po kluczu głównym (`id`) jest zazwyczaj wydajne.
-   **Rozmiar odpowiedzi**: Dla `GET /exercises`, domyślna paginacja powinna być rozsądna (np. 20-50 elementów).
-   **Złożoność logiki**: Logika w Method Handlerach jest prosta (CRUD), więc nie przewiduje się wąskich gardeł.

## 9. Etapy wdrożenia

### 9.1. Struktura folderów i plików (zgodnie z `supabase.mdc`):
1.  Utwórz katalog główny funkcji: `supabase/functions/exercises/`
2.  W `supabase/functions/exercises/` utwórz `deno.json` (można skopiować i dostosować z innej funkcji).
3.  W `supabase/functions/exercises/` utwórz `index.ts` (główny router).
4.  Utwórz katalogi dla Path Handlerów:
    -   `supabase/functions/exercises/handlers/exercises/`
    -   `supabase/functions/exercises/handlers/exercise-id/`
5.  W `supabase/functions/exercises/handlers/exercises/` utwórz `handler.ts`.
6.  W `supabase/functions/exercises/handlers/exercise-id/` utwórz `handler.ts`.
7.  Utwórz katalogi dla Method Handlerów:
    -   `supabase/functions/exercises/handlers/exercises/methods/`
    -   `supabase/functions/exercises/handlers/exercise-id/methods/`

### 9.2. Implementacja `index.ts` (Główny Router)
1.  Importuj `createMainRouterHandler` z `supabase/functions/shared/api-handler.ts`.
2.  Importuj Path Handlery: `handleExercisesRoute` z `./handlers/exercises/handler.ts` i `handleExerciseByIdRoute` z `./handlers/exercise-id/handler.ts`.
3.  Zainicjuj `createMainRouterHandler` z tablicą Path Handlerów i bazową ścieżką `/exercises`.

### 9.3. Implementacja Path Handler dla `/exercises` (`supabase/functions/exercises/handlers/exercises/handler.ts`)
1.  Zdefiniuj `ABSOLUTE_PATH_PATTERN = '/exercises'`.
2.  Importuj `routeRequestToMethods` z `supabase/functions/shared/api-handler.ts`.
3.  Importuj Method Handlery: `handleGetExercises` z `./methods/get.ts` i `handleCreateExercise` z `./methods/post.ts`.
4.  Wyeksportuj funkcję `handleExercisesRoute(req, context)`:
    -   Wywołaj `routeRequestToMethods` z `req`, `ABSOLUTE_PATH_PATTERN`, mapą metod (`{ GET: handleGetExercises, POST: handleCreateExercise }`) i `context`.

### 9.4. Implementacja Path Handler dla `/exercises/{id}` (`supabase/functions/exercises/handlers/exercise-id/handler.ts`)
1.  Zdefiniuj `ABSOLUTE_PATH_PATTERN = '/exercises/:id'`.
2.  Importuj `routeRequestToMethods`.
3.  Importuj Method Handlery: `handleGetExerciseById` z `./methods/get.ts`, `handlePutExerciseById` z `./methods/put.ts`, `handleDeleteExerciseById` z `./methods/delete.ts`.
4.  Wyeksportuj funkcję `handleExerciseByIdRoute(req, context)`:
    -   Wywołaj `routeRequestToMethods` z `req`, `ABSOLUTE_PATH_PATTERN`, mapą metod (`{ GET: handleGetExerciseById, PUT: handlePutExerciseById, DELETE: handleDeleteExerciseById }`) i `context`.

### 9.5. Implementacja Method Handlerów

#### 9.5.1. `GET /exercises` (`supabase/functions/exercises/handlers/exercises/methods/get.ts`)
1.  Wyeksportuj `async function handleGetExercises(context: ApiHandlerContext)`.
2.  Pobierz parametry `limit`, `offset`, `sort` z `context.url.searchParams`.
3.  Zwaliduj parametry query przy użyciu schematów Zod. Jeśli błąd, zwróć `createErrorResponse(400, ...)`.
4.  Skonstruuj zapytanie do Supabase: `context.supabaseClient.from('exercises').select('*')`.
5.  Dodaj paginację (`.range(offset, offset + limit - 1)`) i sortowanie (`.order()`) jeśli parametry są obecne.
6.  Wykonaj zapytanie. Jeśli błąd, zwróć `createErrorResponse(500, ...)`.
7.  Zwróć `createSuccessResponse(200, data)`.

#### 9.5.2. `POST /exercises` (`supabase/functions/exercises/handlers/exercises/methods/post.ts`)
1.  Wyeksportuj `async function handleCreateExercise(context: ApiHandlerContext)`.
2.  Sprawdź uprawnienia administratora (np. `if (!context.user?.app_metadata?.roles?.includes('admin')) return createErrorResponse(403, 'Forbidden');`). Jeśli brak `context.user`, `createMainRouterHandler` powinien zwrócić 401.
3.  Pobierz ciało żądania: `const body = await context.req.json()`.
4.  Zwaliduj ciało żądania używając `CreateExerciseCommand` i Zod. Jeśli błąd, zwróć `createErrorResponse(400, ...)`.
5.  Wstaw dane do tabeli `exercises`: `context.supabaseClient.from('exercises').insert(validatedBody).select().single()`.
6.  Jeśli błąd (np. unikalności `name`, jeśli taki constraint istnieje), zwróć `createErrorResponse(500, ...)` lub odpowiedni kod błędu (np. 409 Conflict).
7.  Zwróć `createSuccessResponse(201, data)`.

#### 9.5.3. `GET /exercises/{id}` (`supabase/functions/exercises/handlers/exercise-id/methods/get.ts`)
1.  Wyeksportuj `async function handleGetExerciseById(context: ApiHandlerContext)`.
2.  Pobierz `id` z `context.rawPathParams.id`.
3.  Zwaliduj `id` jako UUID. Jeśli błąd, zwróć `createErrorResponse(400, 'Invalid exercise ID format')`.
4.  Pobierz ćwiczenie: `context.supabaseClient.from('exercises').select('*').eq('id', id).single()`.
5.  Jeśli `error` i `error.code === 'PGRST116'` (lub podobny dla braku rekordu), zwróć `createErrorResponse(404, 'Exercise not found')`.
6.  Jeśli inny błąd, zwróć `createErrorResponse(500, ...)`.
7.  Zwróć `createSuccessResponse(200, data)`.

#### 9.5.4. `PUT /exercises/{id}` (`supabase/functions/exercises/handlers/exercise-id/methods/put.ts`)
1.  Wyeksportuj `async function handlePutExerciseById(context: ApiHandlerContext)`.
2.  Sprawdź uprawnienia administratora.
3.  Pobierz `id` z `context.rawPathParams.id`. Zwaliduj.
4.  Pobierz ciało żądania: `const body = await context.req.json()`.
5.  Zwaliduj ciało żądania używając `UpdateExerciseCommand` i Zod.
6.  Zaktualizuj ćwiczenie: `context.supabaseClient.from('exercises').update(validatedBody).eq('id', id).select().single()`.
7.  Jeśli `error` i `error.code === 'PGRST116'` (brak rekordu do aktualizacji), zwróć `createErrorResponse(404, 'Exercise not found')`.
8.  Jeśli inny błąd, zwróć `createErrorResponse(500, ...)`.
9.  Zwróć `createSuccessResponse(200, data)`.

#### 9.5.5. `DELETE /exercises/{id}` (`supabase/functions/exercises/handlers/exercise-id/methods/delete.ts`)
1.  Wyeksportuj `async function handleDeleteExerciseById(context: ApiHandlerContext)`.
2.  Sprawdź uprawnienia administratora.
3.  Pobierz `id` z `context.rawPathParams.id`. Zwaliduj.
4.  Usuń ćwiczenie: `context.supabaseClient.from('exercises').delete().eq('id', id)`.
5.  Sprawdź `error` i `data` (lub `count` w zależności od wersji Supabase clienta) aby upewnić się, że rekord został usunięty. Jeśli rekord nie istniał, można rozważyć zwrot 404, chociaż specyfikacja mówi o 204. Dla spójności z 204, można nie sprawdzać czy istniał.
6.  Jeśli błąd podczas usuwania, zwróć `createErrorResponse(500, ...)`.
7.  Zwróć `createSuccessResponse(204, null)`.

### 9.6. Testowanie
1.  Lokalne testowanie funkcji Supabase Edge przy użyciu Supabase CLI.
2.  Testowanie manualne poszczególnych endpointów za pomocą narzędzia typu Postman lub Insomnia.
3.  Weryfikacja kodów odpowiedzi, struktur odpowiedzi i obsługi błędów.
4.  Testowanie autoryzacji dla operacji POST, PUT, DELETE z różnymi rolami użytkowników (admin i zwykły użytkownik).

### 9.7. Dokumentacja
1.  Zaktualizuj `supabase/functions/README.md` o nowe endpointy, jeśli to konieczne (choć `.ai/api-plan.md` jest głównym źródłem).
2.  Upewnij się, że komentarze w kodzie są jasne. 
