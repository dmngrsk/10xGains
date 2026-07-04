# API Endpoint Implementation Plan: User Profiles

## 1. Przegląd punktu końcowego
Ten punkt końcowy zarządza profilami użytkowników. Pozwala uwierzytelnionym użytkownikom na pobieranie i aktualizowanie własnych informacji profilowych. Dostęp jest ograniczony do danych należących do zalogowanego użytkownika.

## 2. Szczegóły żądania

### GET /user-profiles/{id}
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/user-profiles/:id` (gdzie `:id` to UUID użytkownika)
- **Parametry**:
  - Wymagane:
    - `id` (parametr ścieżki): UUID użytkownika. Musi być zgodny z ID uwierzytelnionego użytkownika.
  - Opcjonalne: Brak
- **Ciało żądania**: Brak

### PUT /user-profiles/{id}
- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/user-profiles/:id` (gdzie `:id` to UUID użytkownika)
- **Parametry**:
  - Wymagane:
    - `id` (parametr ścieżki): UUID użytkownika. Musi być zgodny z ID uwierzytelnionego użytkownika.
  - Opcjonalne: Brak
- **Ciało żądania**:
  ```json
  {
    "first_name": "string",
    "active_training_plan_id": "uuid | null"
  }
  ```
  - `first_name`: Wymagane, niepuste.
  - `active_training_plan_id`: Opcjonalne, UUID lub `null`.

## 3. Wykorzystywane typy
Na podstawie `src/app/shared/api/api.types.ts`:
- **DTO (Data Transfer Object)**:
  - `UserProfileDto`: Używany jako typ odpowiedzi dla GET i PUT.
    ```typescript
    // export type UserProfileDto = Database["public"]["Tables"]["user_profiles"]["Row"];
    // Obejmuje: id, first_name, active_training_plan_id, created_at, updated_at
    ```
- **Command Model**:
  - `UpsertUserProfileCommand`: Używany jako typ ciała żądania dla PUT.
    ```typescript
    // export type UpsertUserProfileCommand = Pick<UserProfileDto, "first_name" | "active_training_plan_id">;
    ```

## 4. Szczegóły odpowiedzi

### GET /user-profiles/{id}
- **Sukces (200 OK)**:
  ```json
  {
    "id": "uuid",
    "first_name": "John",
    "active_training_plan_id": "uuid | null",
    "ai_suggestions_remaining": 0,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
  ```
  (Zgodnie z `UserProfileDto`)
- **Błędy**:
  - `401 Unauthorized`
  - `403 Forbidden`
  - `404 Not Found`

### PUT /user-profiles/{id}
- **Sukces (200 OK)**: Zwraca zaktualizowany obiekt `UserProfileDto`.
  ```json
  {
    "id": "uuid",
    "first_name": "John",
    "active_training_plan_id": "uuid | null",
    "ai_suggestions_remaining": 0,
    "created_at": "timestamp",
    "updated_at": "timestamp // zaktualizowany
  }
  ```
- **Błędy**:
  - `400 Bad Request`
  - `401 Unauthorized`
  - `403 Forbidden`
  - `404 Not Found`

## 5. Przepływ danych

### Ogólny przepływ (dla obu metod)
1.  Żądanie trafia do Supabase Edge Function (`user-profiles/index.ts`).
2.  `createMainRouterHandler` (z `shared/api-handler.ts`) obsługuje:
    *   Żądania OPTIONS (CORS).
    *   Uwierzytelnianie JWT: Weryfikuje token, wyodrębnia `user`. Jeśli nie powiedzie się, zwraca `401 Unauthorized`.
    *   Tworzy `supabaseClient` z kontekstem użytkownika.
    *   Tworzy `ApiHandlerContext` zawierający `user`, `supabaseClient`, `request`, `url`, `requestInfo`.
3.  Główny router przekierowuje żądanie do odpowiedniego "Path Handler" (`user-profiles/handlers/user-profile-id/handler.ts`) na podstawie ścieżki (`/user-profiles/:id`).

### GET /user-profiles/{id} (w `user-profile-id/methods/get.ts`)
1.  "Path Handler" (`handleUserProfileByIdRoute`) używa `routeRequestToMethods` do przekazania żądania do `handleGetUserProfile`.
2.  `handleGetUserProfile` otrzymuje `ApiHandlerContext`.
3.  **Autoryzacja**: Sprawdza, czy `context.rawPathParams.id` (parametr `{id}` ze ścieżki) jest równy `context.user.id`. Jeśli nie, zwraca `403 Forbidden`.
4.  Pobiera dane profilu z tabeli `user_profiles` używając `context.supabaseClient`:
    ```sql
    SELECT * FROM user_profiles WHERE id = context.user.id;
    ```
5.  Jeśli profil nie zostanie znaleziony, zwraca `404 Not Found`.
6.  Jeśli sukces, zwraca `200 OK` z danymi profilu (`UserProfileDto`).

### PUT /user-profiles/{id} (w `user-profile-id/methods/put.ts`)
1.  "Path Handler" (`handleUserProfileByIdRoute`) używa `routeRequestToMethods` do przekazania żądania do `handleUpsertUserProfile`.
2.  `handleUpsertUserProfile` otrzymuje `ApiHandlerContext`.
3.  **Autoryzacja**: Sprawdza, czy `context.rawPathParams.id` jest równy `context.user.id`. Jeśli nie, zwraca `403 Forbidden`.
4.  Parsuje i waliduje ciało żądania (`UpsertUserProfileCommand`) przy użyciu schematu Zod:
    *   `first_name`: `string`, wymagany, niepusty.
    *   `active_training_plan_id`: `string (UUID)` lub `null`.
    *   Jeśli walidacja nie powiedzie się, zwraca `400 Bad Request` z odpowiednimi komunikatami o błędach.
5.  Aktualizuje dane profilu w tabeli `user_profiles` używając `context.supabaseClient` dla `context.user.id`:
    ```sql
    UPDATE user_profiles
    SET first_name = validated_data.first_name,
        active_training_plan_id = validated_data.active_training_plan_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = context.user.id
    RETURNING *;
    ```
6.  Jeśli profil do aktualizacji nie zostanie znaleziony (np. rekord dla `context.user.id` nie istnieje), zwraca `404 Not Found`. (Chociaż w praktyce, jeśli użytkownik jest uwierzytelniony, jego profil powinien istnieć lub być tworzony przy rejestracji).
7.  Jeśli sukces, zwraca `200 OK` ze zaktualizowanymi danymi profilu (`UserProfileDto`).

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: Zapewniane przez `createMainRouterHandler` poprzez weryfikację tokena JWT. Wszystkie żądania bez ważnego tokena JWT będą odrzucane z kodem `401 Unauthorized`.
- **Autoryzacja**: Kluczowym elementem jest weryfikacja, czy parametr `{id}` w ścieżce URL jest identyczny z `id` użytkownika uzyskanym z tokena JWT (`context.user.id`). Jeśli ID nie pasują, żądanie jest odrzucane z kodem `403 Forbidden`. Uniemożliwia to użytkownikom dostęp lub modyfikację profili innych użytkowników.
- **Walidacja danych wejściowych**:
    - Ciało żądania dla `PUT` jest walidowane przy użyciu Zod (na podstawie `UpsertUserProfileCommand`), aby zapobiec nieprawidłowym danym i potencjalnym atakom (np. Mass Assignment). Sprawdzane są typy danych, wymagane pola oraz formaty (np. UUID).
    - Parametr ścieżki `{id}` jest niejawnie walidowany jako UUID przez mechanizm dopasowania ścieżki, a jego zgodność z ID użytkownika jest sprawdzana jawnie.
- **Ochrona RLS (Row-Level Security)**: Dodatkowa warstwa zabezpieczeń na poziomie bazy danych. Wszystkie zapytania do tabeli `user_profiles` będą podlegać politykom RLS, które powinny ograniczać dostęp tylko do wierszy, gdzie `id = auth.uid()`. Logika aplikacji (sprawdzanie `id === user.id`) działa jako pierwsza linia obrony i zapewnia bardziej szczegółowe kody odpowiedzi HTTP.
- **Najmniejsze uprawnienia**: Funkcja Supabase Edge Function powinna działać z minimalnymi wymaganymi uprawnieniami.

## 7. Obsługa błędów
Błędy są obsługiwane za pomocą `createErrorResponse` z `shared/api-helpers.ts`.
- **`400 Bad Request`**: Nieprawidłowe dane wejściowe w ciele żądania PUT (np. brakujące `first_name`, nieprawidłowy format `active_training_plan_id`). Odpowiedź powinna zawierać szczegóły błędu walidacji Zod.
- **`401 Unauthorized`**: Problem z tokenem JWT (brak, nieważny, wygasły). Obsługiwane globalnie przez `createMainRouterHandler`.
- **`403 Forbidden`**: Użytkownik próbuje uzyskać dostęp/zmodyfikować profil innego użytkownika (`{id}` w ścieżce != `user.id` z tokena).
- **`404 Not Found`**: Profil użytkownika nie został znaleziony dla danego `user.id` (po pomyślnym sprawdzeniu autoryzacji).
- **`500 Internal Server Error`**: Ogólne błędy serwera, np. błąd bazy danych podczas operacji SELECT lub UPDATE. Odpowiedź powinna być generyczna, aby nie ujawniać szczegółów implementacji.

Standardowe logowanie Supabase Edge Function będzie używane do rejestrowania wszystkich błędów po stronie serwera.

## 8. Rozważania dotyczące wydajności
- **Zapytania do bazy danych**: Operacje na tabeli `user_profiles` (SELECT i UPDATE) są wykonywane na podstawie klucza głównego (`id`), co jest wydajne. Upewnij się, że indeks na `user_profiles(id)` istnieje (zgodnie z `db-plan.md`).
- **Rozmiar odpowiedzi**: `UserProfileDto` zawiera tylko niezbędne pola, więc rozmiar odpowiedzi jest mały.
- **Walidacja**: Walidacja Zod jest szybka i nie powinna stanowić wąskiego gardła.
- **Zimne starty funkcji Supabase**: Mogą wpływać na czas odpowiedzi pierwszego żądania. Dalsze żądania powinny być szybsze.

Ogólnie, dla tego konkretnego endpointu, nie przewiduje się znaczących problemów z wydajnością ze względu na prostotę operacji i małą ilość danych.

## 9. Etapy wdrożenia

Struktura plików (zgodnie z `supabase.mdc`):
```
supabase/
└── functions/
    └── user-profiles/
        ├── deno.json
        ├── index.ts            // Główny router dla /user-profiles
        └── handlers/
            └── user-profile-id/
                ├── handler.ts  // Path Handler dla /user-profiles/:id
                └── methods/
                    ├── get.ts  // Method Handler dla GET
                    └── put.ts  // Method Handler dla PUT
```

1.  **Konfiguracja funkcji (`deno.json`)**:
    *   Utwórz plik `supabase/functions/user-profiles/deno.json`.
    *   Skonfiguruj go, aby importował niezbędne zależności (np. z `shared`).

2.  **Główny punkt wejścia (`user-profiles/index.ts`)**:
    *   Zaimportuj `createMainRouterHandler` z `shared/api-handler.ts`.
    *   Zaimportuj "Path Handler" `handleUserProfileByIdRoute` z `handlers/user-profile-id/handler.ts`.
    *   Zainicjuj `createMainRouterHandler` z tablicą zawierającą `handleUserProfileByIdRoute` i bazową ścieżką montowania (np. `/user-profiles`).

3.  **Path Handler (`user-profiles/handlers/user-profile-id/handler.ts`)**:
    *   Zdefiniuj `ABSOLUTE_PATH_PATTERN` jako `/user-profiles/:id`.
    *   Zaimportuj `routeRequestToMethods` z `shared/api-handler.ts`.
    *   Zaimportuj "Method Handlers" `handleGetUserProfile` (z `methods/get.ts`) i `handleUpsertUserProfile` (z `methods/put.ts`).
    *   Wyeksportuj funkcję `handleUserProfileByIdRoute(req, context)`:
        *   Wywołaj `routeRequestToMethods` z `req`, `ABSOLUTE_PATH_PATTERN`, mapą metod HTTP do odpowiednich handlerów (`{ GET: handleGetUserProfile, PUT: handleUpsertUserProfile }`) i `context`.

4.  **Method Handler dla GET (`user-profiles/handlers/user-profile-id/methods/get.ts`)**:
    *   Wyeksportuj asynchroniczną funkcję `handleGetUserProfile(context: ApiHandlerContext)`.
    *   Zaimplementuj logikę pobierania profilu:
        *   Pobierz `userId` z `context.user.id` i `pathId` z `context.rawPathParams.id`.
        *   **Autoryzacja**: Porównaj `userId` i `pathId`. Jeśli różne, zwróć `createErrorResponse(403, 'Forbidden')`.
        *   Użyj `context.supabaseClient.from('user_profiles').select('*').eq('id', userId).single()` do pobrania profilu.
        *   Obsłuż błędy (np. `error` z Supabase, `data` jest `null` -> `404 Not Found`).
        *   Zwróć `createSuccessResponse(200, data)`.

5.  **Method Handler dla PUT (`user-profiles/handlers/user-profile-id/methods/put.ts`)**:
    *   Wyeksportuj asynchroniczną funkcję `handleUpsertUserProfile(context: ApiHandlerContext)`.
    *   Zaimplementuj logikę aktualizacji profilu:
        *   Pobierz `userId` z `context.user.id` i `pathId` z `context.rawPathParams.id`.
        *   **Autoryzacja**: Porównaj `userId` i `pathId`. Jeśli różne, zwróć `createErrorResponse(403, 'Forbidden')`.
        *   Odczytaj ciało żądania: `const body = await context.request.json()`.
        *   **Walidacja**: Zdefiniuj schemat Zod dla `UpsertUserProfileCommand`:
            ```typescript
            // Wewnątrz put.ts lub w dedykowanym pliku walidacji
            import { z } from 'zod';
            const UpsertUserProfilePayloadSchema = z.object({
              first_name: z.string().min(1, { message: 'First name is required.' }),
              active_training_plan_id: z.string().uuid({ message: 'Invalid UUID format for active training plan ID.' }).nullable(),
            });
            ```
        *   Waliduj `body` używając `UpsertUserProfilePayloadSchema.safeParse(body)`.
        *   Jeśli walidacja nie powiedzie się (`!result.success`), zwróć `createErrorResponse(400, 'Validation failed', result.error.flatten())`.
        *   Użyj `context.supabaseClient.from('user_profiles').update(result.data).eq('id', userId).select().single()` do aktualizacji profilu.
        *   Obsłuż błędy (np. `error` z Supabase, `data` jest `null` -> `404 Not Found`, jeśli profil nie istniałby do aktualizacji).
        *   Zwróć `createSuccessResponse(200, data)`.

6.  **Współdzielone typy i pomocnicy**:
    *   Upewnij się, że `UserProfileDto` i `UpsertUserProfileCommand` są poprawnie zdefiniowane w `src/app/shared/api/api.types.ts`.
    *   Użyj `createSuccessResponse` i `createErrorResponse` z `supabase/functions/shared/api-helpers.ts`.

7.  **Testowanie**:
    *   Napisz testy jednostkowe dla logiki w handlerach (walidacja, autoryzacja, interakcje z Supabase client mock).
    *   Przeprowadź testy integracyjne endpointu po wdrożeniu funkcji Supabase (np. używając narzędzi takich jak Postman lub testów e2e).

8.  **Dokumentacja**:
    *   Zaktualizuj `supabase/functions/README.md`, jeśli jest to wymagane, aby odzwierciedlić nowy endpoint. (Chociaż ten plan jest już formą dokumentacji).

9.  **Wdrożenie**:
    *   Wdróż funkcję Supabase (`supabase functions deploy user-profiles`). 
