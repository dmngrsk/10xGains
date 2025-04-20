# API Endpoint Implementation Plan: User Profiles

## 1. Przegląd punktu końcowego
Endpoint ten umożliwia pobieranie oraz aktualizację profilu użytkownika. Użytkownik może pobrać swój profil (GET /profiles/{id}) lub zaktualizować dane takie jak imię i aktywny plan treningowy (PUT /profiles/{id}). Endpointy wykorzystują mechanizmy uwierzytelniania i autoryzacji Supabase, a także ograniczenia Row-Level Security (RLS), aby zapewnić dostęp tylko do zasobów przypisanych do autoryzowanego użytkownika.

## 2. Szczegóły żądania
- **Metoda HTTP:**
  - GET dla pobierania profilu
  - PUT dla aktualizacji profilu
- **Struktura URL:**
  - `/profiles/{id}` – wartość `{id}` musi odpowiadać ID uwierzytelnionego użytkownika
- **Parametry:**
  - **Wymagane:**
    - `id` (ścieżka)
    - Nagłówek `Authorization` z tokenem JWT
  - **Opcjonalne:**
    - Brak dodatkowych parametrów
- **Request Body (PUT):**
  ```json
  {
    "first_name": "John",
    "active_training_plan_id": "uuid"
  }
  ```

## 3. Wykorzystywane typy
- `UserProfileDto` – reprezentuje pełne dane profilu użytkownika, w tym `id`, `first_name`, `active_training_plan_id`, `created_at` oraz `updated_at`.
- `UpdateUserProfileCommand` – zawiera pola do aktualizacji: `first_name` oraz `active_training_plan_id`.

## 4. Szczegóły odpowiedzi
- **GET /profiles/{id}:**
  - **Sukces (200 OK):** Zwraca obiekt profilu użytkownika w formacie `UserProfileDto`.
  - **Błędy:**
    - 401 Unauthorized - brak poprawnego tokena
    - 403 Forbidden - użytkownik nie ma dostępu do zasobu
- **PUT /profiles/{id}:**
  - **Sukces (200 OK):** Zwraca zaktualizowany profil użytkownika.
  - **Błędy:**
    - 400 Bad Request - dane wejściowe są nieprawidłowe
    - 401 Unauthorized - brak poprawnego tokena
    - 403 Forbidden - użytkownik nie ma dostępu do zasobu

## 5. Przepływ danych
1. Klient wysyła żądanie (GET lub PUT) do endpointu `/profiles/{id}`, zawierające nagłówek `Authorization` z tokenem JWT oraz (w przypadku PUT) odpowiedni payload JSON.
2. Żądanie trafia do funkcji edge `profiles`, wdrożonej w Supabase, która obsługuje żądania dla tego endpointu.
3. Funkcja edge ekstraktuje token z nagłówka i weryfikuje autentyczność użytkownika przy użyciu Supabase Auth.
4. Na podstawie zweryfikowanego tokena, funkcja sprawdza, czy parametr `id` w URL odpowiada tożsamości użytkownika.
5. W zależności od metody żądania:
   - **GET:** Funkcja wykorzystuje Supabase Client do pobrania danych z tabeli `user_profiles` (z zastosowaniem RLS) i zwraca dane profilu.
   - **PUT:** Funkcja weryfikuje dane wejściowe (np. za pomocą Zod), a następnie wykonuje aktualizację rekordu w tabeli `user_profiles` przy użyciu Supabase Client, zachowując RLS.
6. Funkcja generuje odpowiedź z odpowiednim kodem statusu (np. 200 dla sukcesu, 400/401/403/404/500 dla błędów) i przesyła ją z powrotem do klienta.

## 6. Względy bezpieczeństwa
- Uwierzytelnianie poprzez token JWT oraz weryfikacja, że ID w URL odpowiada autoryzowanemu użytkownikowi.
- Wykorzystanie mechanizmu Row-Level Security (RLS) w Supabase, aby zapewnić, że użytkownicy mogą uzyskać dostęp tylko do swoich danych.
- Walidacja danych wejściowych (np. typów oraz formatów) przed przetworzeniem.
- Monitorowanie i logowanie błędów oraz nieautoryzowanych prób dostępu.

## 7. Obsługa błędów
- **400 Bad Request:** - Nieprawidłowe lub brakujące dane wejściowe w żądaniu PUT.
- **401 Unauthorized:** - Brak tokena lub token niepoprawny.
- **403 Forbidden:** - Użytkownik próbuje uzyskać lub zmodyfikować dane, do których nie ma uprawnień.
- **404 Not Found:** - Nie znaleziono profilu użytkownika (gdy dane ID nie istnieje).
- **500 Internal Server Error:** - Błąd serwera, np. nieoczekiwane wyjątki podczas operacji na bazie.

## 8. Etapy wdrożenia (Serverless)
1. **Projekt i struktura funkcji:** Utworzyć funkcję edge w katalogu `supabase/functions/`, np. `profiles/index.ts`, która obsługuje żądania GET i PUT dla endpointu `/profiles/{id}`.
2. **Implementacja logiki serwerless:** Zaimplementować logikę obsługi żądań, obejmującą:
   - Pobieranie tokena z nagłówka `Authorization`.
   - Weryfikację tokena i spójności `id` z tożsamością użytkownika.
   - Wykorzystanie Supabase Client do operacji na tabeli `user_profiles` z uwzględnieniem RLS.
3. **Walidacja danych wejściowych:** Implementacja walidacji danych (np. przy użyciu Zod) dla żądania PUT, zgodnie z modelem `UpdateUserProfileCommand`.
4. **Testowanie lokalne:** Testowanie funkcji lokalnie za pomocą `supabase functions serve` oraz przygotowanie testów jednostkowych i integracyjnych.
5. **Monitorowanie i logowanie:** Zaimplementowanie mechanizmów logowania błędów i monitorowania działania funkcji edge, np. poprzez integrację z narzędziami do monitoringu.
6. **Deployment:** Wdrożenie funkcji za pomocą `supabase functions deploy profiles` oraz przeprowadzenie testów środowiskowych.
7. **Dokumentacja:** Aktualizacja dokumentacji API i poinformowanie zespołu o wdrożeniu funkcji edge. 
