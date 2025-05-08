# Plan implementacji widoku: Lista Planów Treningowych

## 1. Przegląd
Widok "Lista Planów Treningowych" ma na celu wyświetlenie wszystkich planów treningowych należących do zalogowanego użytkownika. Umożliwia nieskończone przewijanie (infinite scroll) w celu ładowania kolejnych planów. Każdy element listy wyświetla kluczowe informacje o planie, takie jak tytuł, data utworzenia i podgląd opisu. Widok zawiera również przycisk umożliwiający przejście do tworzenia nowego planu treningowego.

## 2. Routing widoku
Widok będzie dostępny pod następującą ścieżką:
- `/plans`

## 3. Struktura komponentów
Struktura katalogów i komponentów dla tej funkcji będzie wyglądać następująco:

```
src/app/features/plans/
├── plans.routes.ts                 // Definicja routingu dla funkcji
├── components/
│   └── plan-list/                  // Komponent listy planów (kontener)
│       ├── plan-list.component.ts
│       ├── plan-list.component.html
│       └── plan-list.component.scss
│       ├── plan-card/              // Prezentacyjny komponent karty planu
│       │   ├── plan-card.component.ts
│       │   └── plan-card.component.html
│       │   └── plan-card.component.scss
│       └── plan-card-skeleton/     // Prezentacyjny komponent szkieletu karty planu
│           ├── plan-card-skeleton.component.ts
│           └── plan-card-skeleton.component.html
│           └── plan-card-skeleton.component.scss
├── services/
│   └── plans.service.ts            // Serwis do pobierania danych o planach
└── shared/
    └── models/                     // Modele specyficzne dla tej funkcji (jeśli potrzebne)
        └── plan-list-item.view-model.ts
```

Hierarchia komponentów:
1.  `PlanListComponent` (komponent zarządzający, kontener dla widoku) - dawniej `PlansPageComponent`
    *   Wyświetla przycisk "Dodaj nowy plan".
    *   Zarządza logiką nieskończonego przewijania.
    *   Pobiera dane za pomocą `PlansService`.
    *   Renderuje listę komponentów `PlanCardComponent` lub `PlanCardSkeletonComponent`.
    *   Zawiera element-wartownik (`sentinel`) do wykrywania końca listy przez `IntersectionObserver`.
2.  `PlanCardComponent` (komponent prezentacyjny)
    *   Wyświetla informacje o pojedynczym planie treningowym (tytuł, data utworzenia, podgląd opisu, oraz podgląd ćwiczeń) używając `MatCard`.
    *   Emituje zdarzenie po kliknięciu, umożliwiając nawigację do szczegółów planu.
3.  `PlanCardSkeletonComponent` (komponent prezentacyjny)
    *   Wyświetla wersję szkieletową (ładowanie) dla `PlanCardComponent`.

## 4. Szczegóły komponentów

### `PlanListComponent` (dawniej `PlansPageComponent`)
-   **Opis komponentu**: Główny komponent strony `/plans`. Odpowiada za pobieranie listy planów treningowych użytkownika, obsługę nieskończonego przewijania, wyświetlanie stanu ładowania i błędów, oraz nawigację do tworzenia nowego planu i szczegółów istniejącego planu. Jest to komponent typu "smart".
-   **Główne elementy HTML**:
    *   Kontener dla całej strony.
    *   Przycisk `MatButton` ("Dodaj nowy plan") do nawigacji do formularza tworzenia planu (np. `/plans/create`).
    *   Lista planów (np. w `div`), w której renderowane są dynamicznie komponenty `txg-plan-card` lub `txg-plan-card-skeleton`.
    *   Element `div` (wartownik/sentinel) na końcu listy do obserwacji przez `IntersectionObserver`.
-   **Obsługiwane interakcje**:
    *   Kliknięcie przycisku "Dodaj nowy plan" -> nawigacja do `/plans/create`.
    *   Przewijanie listy -> gdy wartownik staje się widoczny, ładowana jest kolejna partia planów.
    *   Kliknięcie na kartę planu (obsługiwane przez zdarzenie z `PlanCardComponent`) -> nawigacja do `/plans/:id`.
-   **Obsługiwana walidacja**: Brak bezpośredniej walidacji danych wejściowych. Komponent polega na `AuthGuard` do zabezpieczenia trasy i `PlansService` do poprawnego pobrania danych.
-   **Typy**:
    *   `PlanListItemViewModel[]` (dla przechowywania listy planów).
    *   Sygnały dla stanu: `isLoading: Signal<boolean>`, `error: Signal<string | null>`, `plans: WritableSignal<PlanListItemViewModel[]>`, `hasMore: Signal<boolean>`.
-   **Propsy**: Brak (jest to komponent routowalny najwyższego poziomu dla tej funkcji).

### `PlanCardComponent`
-   **Opis komponentu**: Komponent prezentacyjny ("dumb") wyświetlający informacje o pojedynczym planie treningowym w formie karty (`MatCard`).
-   **Główne elementy HTML**:
    *   `mat-card` jako główny kontener.
    *   `mat-card-header` z `mat-card-title` (tytuł planu).
    *   `mat-card-subtitle` (data utworzenia).
    *   `mat-card-content` (podgląd opisu planu - przycięty tekst, oraz podgląd ćwiczeń, np. "Podgląd ćwiczeń: Przysiad, Wyciskanie, Martwy ciąg...").
-   **Obsługiwane interakcje**:
    *   Kliknięcie na kartę: emituje zdarzenie `(planClicked): string` (emituje ID planu).
-   **Obsługiwana walidacja**: Brak.
-   **Typy**:
    *   `@Input() plan: PlanListItemViewModel`.
-   **Propsy**:
    *   `plan: PlanListItemViewModel` - obiekt zawierający dane planu do wyświetlenia.

### `PlanCardSkeletonComponent`
-   **Opis komponentu**: Komponent prezentacyjny ("dumb") wyświetlający szkielet ładowania dla karty planu. Używany podczas oczekiwania na dane.
-   **Główne elementy HTML**:
    *   Struktura `mat-card` odzwierciedlająca `PlanCardComponent`, ale z elementami zastępczymi (np. `div` ze stylami animacji szkieletu dla tytułu, daty, opisu, podglądu ćwiczeń).
-   **Obsługiwane interakcje**: Brak.
-   **Obsługiwana walidacja**: Brak.
-   **Typy**: Brak.
-   **Propsy**: Brak.

## 5. Typy

### `TrainingPlanRow` (z `src/app/shared/db/database.types.ts`)
Reprezentuje wiersz z tabeli `training_plans` w bazie danych.
```typescript
export type TrainingPlanRow = Database["public"]["Tables"]["training_plans"]["Row"];
// Pola:
//   id: string
//   created_at: string | null
//   description: string | null
//   name: string
//   user_id: string
```

### `PlanListItemViewModel`
Niestandardowy model widoku używany przez `PlanCardComponent` i zarządzany w `PlanListComponent`. Definicja w `src/app/features/plans/shared/models/plan-list-item.view-model.ts`.
```typescript
export interface PlanListItemViewModel {
  id: string;
  title: string; // mapowane z TrainingPlanRow.name
  creationDate: string; // mapowane i formatowane z TrainingPlanRow.created_at
  descriptionPreview: string | null; // mapowane i przycięte z TrainingPlanRow.description
  exercisePreview: string | null; // np. "Przysiad, Wyciskanie, Martwy ciąg..." (mapowane z połączonych danych)
  userId: string; // mapowane z TrainingPlanRow.user_id
}
```

## 6. Zarządzanie stanem
Stan będzie zarządzany w `PlanListComponent` przy użyciu Angular Signals:
-   `plans: WritableSignal<PlanListItemViewModel[]>`: Lista planów do wyświetlenia. Inicjalizowana jako pusta tablica.
-   `isLoading: WritableSignal<boolean>`: Flaga informująca, czy trwa ładowanie danych. Domyślnie `false`. Ustawiana na `true` przed wywołaniem API i na `false` po jego zakończeniu.
-   `error: WritableSignal<string | null>`: Przechowuje komunikat błędu, jeśli wystąpił podczas pobierania danych. Domyślnie `null`.
-   `offset: WritableSignal<number>`: Aktualny offset używany do paginacji przy pobieraniu danych. Inicjalizowany jako `0`.
-   `limit: number = 20` (stała): Liczba planów do pobrania w jednym żądaniu.
-   `hasMore: WritableSignal<boolean>`: Flaga informująca, czy są jeszcze dostępne plany do załadowania. Domyślnie `true`. Ustawiana na `false`, gdy API zwróci mniej elementów niż `limit`.
-   `currentUser: Signal<User | null>`: Sygnał przechowujący informacje o aktualnie zalogowanym użytkowniku (potrzebne do pobrania `userId`). Pobierane z serwisu autoryzacji Supabase.

Logika ładowania danych (w tym nieskończone przewijanie) będzie zaimplementowana w `PlanListComponent`. `IntersectionObserver API` będzie użyte do monitorowania elementu-wartownika na końcu listy. Kiedy wartownik stanie się widoczny, a `isLoading` jest `false` i `hasMore` jest `true`, zostanie wywołana metoda ładująca kolejną partię planów.

## 7. Integracja API
Nie ma bezpośredniego endpointu HTTP API do wywołania. Zamiast tego, zostanie stworzony serwis `PlansService` w katalogu `src/app/features/plans/services/`.
Serwis ten będzie używał `SupabaseService` (dostępnego w `src/app/shared/db/supabase.service.ts`) do bezpośredniego odpytywania bazy danych Supabase.

### `PlansService`
-   **Metody**:
    *   `getPlans(userId: string, limit: number, offset: number): Observable<{ data: TrainingPlanWithDetailsForListDto[] | null, error: PostgrestError | null }>`
        *   Pobiera listę planów treningowych dla danego `userId` z uwzględnieniem `limit` i `offset`, wraz z informacjami o ćwiczeniach do podglądu.
        *   Używa klienta Supabase z odpowiednim zapytaniem `select` do złączenia potrzebnych tabel:
            ```typescript
            const { data, error } = await this.supabaseService.client
              .from('training_plans')
              .select(`
                id,
                name,
                description,
                created_at,
                user_id,
                training_plan_days (
                  order_index,
                  training_plan_exercises (
                    order_index,
                    exercises (name)
                  )
                )
              `)
              .eq('user_id', userId)
              .order('created_at', { ascending: false }) // Sortowanie od najnowszych
              .limit(limit) // Używamy limit bezpośrednio zamiast range dla uproszczenia
              .range(offset, offset + limit - 1);
            
            // Supabase typuje 'data' jako częściowe na podstawie zapytania select,
            // ale dla bezpieczeństwa rzutujemy na nasz zdefiniowany typ.
            return { data: data as TrainingPlanWithDetailsForListDto[] | null, error };
            ```
-   **Typy żądania**: Parametry `userId: string`, `limit: number`, `offset: number`.
-   **Typy odpowiedzi**: `Observable<{ data: TrainingPlanWithDetailsForListDto[] | null, error: PostgrestError | null }>`.

`PlanListComponent` będzie subskrybować ten `Observable`, mapować wyniki `TrainingPlanWithDetailsForListDto[]` na `PlanListItemViewModel[]` (w tym tworzyć `exercisePreview`), aktualizować sygnały stanu (`plans`, `isLoading`, `error`, `offset`, `hasMore`).

## 8. Interakcje użytkownika
-   **Ładowanie początkowe**:
    *   Po wejściu na `/plans`, `PlanListComponent` inicjuje pobieranie pierwszej partii planów.
    *   Podczas ładowania (`isLoading === true`), wyświetlane są komponenty `PlanCardSkeletonComponent` (np. 3-5 sztuk).
-   **Przewijanie listy**:
    *   Gdy użytkownik przewinie stronę blisko końca listy, `IntersectionObserver` wykryje element-wartownika.
    *   Jeśli `!isLoading()` i `hasMore()`, `PlanListComponent` wywoła `PlansService.getPlans()` z nowym `offset`.
    *   Nowe plany są dołączane do sygnału `plans()`. `isLoading` jest aktualizowane.
-   **Kliknięcie "Dodaj nowy plan"**:
    *   Użytkownik jest przekierowywany na trasę tworzenia nowego planu (np. `/plans/:id`). Nawigacja realizowana przez `Router` z Angulara.
-   **Kliknięcie karty planu**:
    *   `PlanCardComponent` emituje zdarzenie z `id` planu.
    *   `PlanListComponent` obsługuje to zdarzenie i przekierowuje użytkownika na trasę szczegółów planu (np. `/plans/:id`).
-   **Brak planów**:
    *   Jeśli użytkownik nie ma żadnych planów, `PlanListComponent` wyświetli odpowiedni komunikat (np. "Nie masz jeszcze żadnych planów treningowych. Stwórz nowy!") oraz przycisk "Dodaj nowy plan".
-   **Błąd ładowania**:
    *   Jeśli wystąpi błąd podczas pobierania danych, `PlanListComponent` wyświetli komunikat błędu (np. "Nie udało się załadować planów. Spróbuj ponownie". Można dodać przycisk "Spróbuj ponownie".

## 9. Warunki i walidacja
-   **Dostęp do widoku**: Trasa `/plans` powinna być chroniona przez `AuthGuard`. Tylko zalogowani użytkownicy mogą uzyskać do niej dostęp. `AuthGuard` sprawdzi stan sesji użytkownika w Supabase. Jeśli użytkownik nie jest zalogowany, zostanie przekierowany na stronę logowania.
-   **Pobieranie danych**: `PlansService.getPlans()` wymaga poprawnego `userId`. `PlanListComponent` musi uzyskać `userId` aktualnie zalogowanego użytkownika (np. z serwisu autoryzacji) przed wywołaniem serwisu. Jeśli `userId` nie jest dostępne, nie należy podejmować próby pobrania danych, a zamiast tego wyświetlić odpowiedni komunikat.
-   **Nieskończone przewijanie**:
    *   Nowe dane są ładowane tylko jeśli `hasMore()` jest `true` i `!isLoading()`.
    *   `hasMore` jest ustawiane na `false`, gdy ostatnie żądanie API zwróciło mniej elementów niż `limit`.

## 10. Obsługa błędów
-   **Błędy API w `PlansService`**:
    *   `PlansService` powinien przekazywać błędy z Supabase Client do komponentu.
    *   `PlanListComponent` przechwytuje błąd, ustawia sygnał `error` na odpowiedni komunikat i `isLoading` na `false`.
    *   Użytkownikowi wyświetlany jest komunikat błędu (np. w komponencie `MatSnackBar` lub dedykowanym miejscu na stronie). Można zaoferować opcję ponowienia próby.
-   **Brak zalogowanego użytkownika (jeśli `AuthGuard` zawiedzie lub nie jest jeszcze zaimplementowany)**:
    *   `PlanListComponent` powinien wykryć brak `userId` i wyświetlić komunikat proszący o zalogowanie, zamiast próbować ładować dane.
-   **Problem z formatowaniem danych (np. daty)**:
    *   Logika mapowania `TrainingPlanRow` na `PlanListItemViewModel` w `PlanListComponent` powinna być odporna na brakujące lub niepoprawne dane (np. `created_at` może być `null`). Należy zapewnić domyślne wartości lub bezpieczne operacje.
    *   Podgląd opisu (`descriptionPreview`) powinien poprawnie obsługiwać `null` lub pusty opis, a także przycinać tekst do rozsądnej długości, dodając "..." jeśli jest dłuższy.

## 11. Kroki implementacji
1.  **Utworzenie struktury folderów i plików**:
    *   Stworzyć foldery: `src/app/features/plans`, `components/plan-list`, `components/plan-list/plan-card`, `components/plan-list/plan-card-skeleton`, `services`, `shared/models`.
    *   Stworzyć puste pliki komponentów (`.ts`, `.html`, `.scss`), serwisu (`.ts`) i modelu widoku (`.ts`).
2.  **Definicja routingu**:
    *   W `src/app/features/plans/plans.routes.ts` zdefiniować `PLANS_ROUTES` dla ścieżki `''` (w ramach `/plans`) wskazującej na `PlanListComponent`.
    *   Dodać `AuthGuard` do `canActivate` tej trasy.
    *   Zarejestrować `PLANS_ROUTES` w głównym pliku `app.routes.ts` dla ścieżki `/plans` z użyciem `loadChildren`.
3.  **Implementacja `AuthGuard`**:
    *   Jeśli jeszcze nie istnieje, zaimplementować prosty `AuthGuard` sprawdzający sesję Supabase.
4.  **Implementacja `PlanListItemViewModel`**:
    *   Zdefiniować interfejs `PlanListItemViewModel` w `src/app/features/plans/shared/models/plan-list-item.view-model.ts`.
5. **Implementacja `PlansService`**:
    *   Wstrzyknąć `SupabaseService`.
    *   Zaimplementować metodę `getPlans(userId: string, limit: number, offset: number)` używającą klienta Supabase z rozbudowanym zapytaniem `select` (jak opisano w sekcji "Integracja API") do pobrania danych planów wraz z nazwami ćwiczeń. Metoda powinna zwracać `Observable<{ data: TrainingPlanWithDetailsForListDto[] | null, error: PostgrestError | null }>`.
6. **Implementacja `PlanCardSkeletonComponent`**:
    *   Stworzyć szablon HTML z elementami `mat-card` i placeholderami dla tytułu, daty, opisu oraz podglądu ćwiczeń.
    *   Dodać podstawowe style SCSS dla efektu szkieletu (np. animowane tło).
    *   Ustawić `standalone: true` i `changeDetection: ChangeDetectionStrategy.OnPush`.
7. **Implementacja `PlanCardComponent`**:
    *   Zdefiniować `@Input() plan: PlanListItemViewModel`.
    *   Zdefiniować `@Output() planClicked = new EventEmitter<string>();` (emituje `plan.id`).
    *   Stworzyć szablon HTML z `mat-card` wyświetlający `plan.title`, `plan.creationDate`, `plan.descriptionPreview` oraz `plan.exercisePreview`.
    *   Dodać obsługę kliknięcia na karcie, która emituje `planClicked` z `plan.id`.
    *   Dodać style SCSS.
    *   Ustawić `standalone: true` i `changeDetection: ChangeDetectionStrategy.OnPush`.
8. **Implementacja `PlanListComponent` (Logika)**:
    *   Ustawić `standalone: true`. Zaimportować potrzebne moduły (`MatButtonModule`, `CommonModule`, `PlanCardComponent`, `PlanCardSkeletonComponent`, `RouterModule`).
    *   Wstrzyknąć `PlansService`, `Router`, serwis autoryzacji Supabase (lub `SupabaseService` do pobrania sesji).
    *   Zdefiniować sygnały stanu: `plans`, `isLoading`, `error`, `offset`, `hasMore`, `currentUser`.
    *   Zaimplementować metodę `loadPlans(isLoadMore = false)`:
        *   Pobiera `userId` z `currentUser`. Jeśli brak, ustawia błąd lub kończy.
        *   Jeśli `isLoadMore` jest `false`, resetuje `plans` i `offset`.
        *   Ustawia `isLoading` na `true`.
        *   Wywołuje `plansService.getPlans()`.
        *   Po otrzymaniu danych (`TrainingPlanWithDetailsForListDto[]`):
            *   Mapuje `TrainingPlanWithDetailsForListDto[]` na `PlanListItemViewModel[]`.
                *   Logika mapowania powinna iterować po `training_plan_days` (np. wziąć pierwszy dzień), następnie po `training_plan_exercises` (np. wziąć pierwsze 3-5 ćwiczeń), pobrać `exercises.name` i stworzyć string `exercisePreview` (np. "Ćwiczenie A, Ćwiczenie B, ..."). Należy obsłużyć przypadki, gdy dni lub ćwiczenia nie istnieją.
            *   Aktualizuje `plans` (dodaje nowe lub zastępuje).
            *   Aktualizuje `offset`.
            *   Ustawia `hasMore` (jeśli `data.length < limit`).
            *   Ustawia `isLoading` na `false`.
        *   W przypadku błędu: ustawia `error`, `isLoading` na `false`.
    *   Zaimplementować logikę `IntersectionObserver`:
        *   W `ngAfterViewInit` skonfigurować `IntersectionObserver` do obserwowania elementu-wartownika.
        *   W callbacku `IntersectionObserver`, jeśli wartownik jest widoczny oraz `!isLoading()` i `hasMore()`, wywołać `loadPlans(true)`.
        *   Pamiętać o `ngOnDestroy` do odłączenia obserwatora.
    *   Zaimplementować metody nawigacyjne: `navigateToCreatePlan()`, `navigateToPlanDetails(planId: string)`.
    *   Wywołać `loadPlans()` w `ngOnInit` (lub po uzyskaniu `userId`).
9. **Implementacja `PlanListComponent` (Szablon HTML i Style)**:
    *   Dodać `mat-button` "Dodaj nowy plan" z `(click)="navigateToCreatePlan()`.
    *   Kontener na listę planów.
    *   Użyć `@if (isLoading() && !plans().length)` do wyświetlania początkowych szkieletów (`PlanCardSkeletonComponent` w pętli `@for`).
    *   Użyć `@for` do iteracji po `plans()` i renderowania `txg-plan-card`. Przekazać `[plan]="item"` i obsłużyć `(planClicked)="navigateToPlanDetails($event)"`.
    *   Wyświetlić komunikat, jeśli `!isLoading() && !plans().length && !error()` (np. "Nie masz jeszcze żadnych planów...").
    *   Wyświetlić komunikat błędu, jeśli `error()` ma wartość.
    *   Dodać element-wartownik (`<div #sentinel></div>`) na końcu listy.
    *   Dodać style SCSS.
10. **Testowanie i poprawki**:
    *   Przetestować ładowanie początkowe, nieskończone przewijanie, stany ładowania, obsługę błędów, brak planów.
    *   Sprawdzić nawigację.
    *   Upewnić się, że RLS w Supabase działa i użytkownik widzi tylko swoje plany (choć to test backendowy, serwis frontendowy powinien zawsze przekazywać `userId`).
    *   Przetestować responsywność i wygląd na różnych urządzeniach.
    *   Zastosować się do wskazówek z linters.

Ten plan powinien być wystarczająco szczegółowy, aby inny programista mógł wdrożyć widok listy planów. 
