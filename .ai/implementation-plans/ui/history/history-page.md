# Plan implementacji widoku Historii Sesji Treningowych

## 1. Przegląd
Widok Historii Sesji Treningowych (`/history`) ma na celu umożliwienie użytkownikom przeglądania przeszłych sesji treningowych. Użytkownicy będą mogli filtrować sesje według statusu, zakresu dat oraz planu treningowego, a także korzystać z paginacji do nawigacji po dłuższych listach. Widok ten jest kluczowy dla monitorowania postępów i analizy wcześniejszych treningów, zgodnie z historyjką użytkownika US-005.

## 2. Routing widoku
Widok będzie dostępny pod następującą ścieżką:
- `/history`

Dostęp do tej ścieżki będzie chroniony przez guard `authGuard`, wymagający zalogowania użytkownika.

Nowa trasa zostanie dodana do `src/app/app.routes.ts`:
```typescript
{
  path: 'history',
  loadComponent: () => import('@features/history/pages/history-page/history-page.component').then(m => m.HistoryPageComponent),
  canActivate: [authGuard]
},
```

## 3. Struktura komponentów
`HistoryPageComponent` będzie używał `MainLayoutComponent` do zapewnienia ogólnej struktury strony. Zawartość specyficzna dla historii będzie renderowana wewnątrz `MainLayoutComponent`.

```
HistoryPageComponent (Container)
└── MainLayoutComponent (Reusable Layout Component, z @shared/ui/layouts)
    └── <ng-content select="[pageContent]"> lub podobny mechanizm projekcji w MainLayoutComponent
        ├── MatDialog (wywoływany przez HistoryPageComponent, zawiera HistoryFilterDialogComponent)
        │   └── HistoryFilterDialogComponent (Presentational/Smart-ish)
        │       └── ReactiveForm (Angular)
        │           ├── MatFormField (dla wyboru planu treningowego)
        │           │   └── MatSelect
        │           ├── MatFormField (dla daty początkowej)
        │           │   └── MatDatepickerInput
        │           ├── MatFormField (dla daty końcowej)
        │           │   └── MatDatepickerInput
        │           └── MatFormField (dla items per page)
        │               └── MatSelect
        ├── Komunikat "Brak sesji" (Warunkowo w HistoryPageComponent)
        ├── SessionList (Reused from features/sessions/components, warunkowo w HistoryPageComponent)
        │   └── SessionCard (Reused from features/sessions/components, powtarzany przez @for)
        └── Sticky Bottom Bar (w HistoryPageComponent)
            ├── HistoryActionsBarComponent (Nowy komponent)
                ├── MatPaginatorComponent (Angular Material)
                └── Przycisk otwierający HistoryFilterDialogComponent (poprzez event)
```

Komponent `HistoryPageComponent` i jego specyficzne podkomponenty (jak `HistoryFilterDialogComponent` oraz `HistoryActionsBarComponent`) zostaną umieszczone w katalogu `src/app/features/history/pages/history-page/components`. `MainLayoutComponent` jest komponentem współdzielonym. `HistoryFilterDialogComponent` znajduje się w `src/app/features/history/pages/history-page/components/dialogs/history-filter-dialog/`, a `HistoryActionsBarComponent` w `src/app/features/history/pages/history-page/components/history-actions-bar/`.

## 4. Szczegóły komponentów

### `MainLayoutComponent`
- **Lokalizacja**: Zakładana (np. `src/app/shared/ui/layouts/main-layout/main-layout.component.ts`)
- **Opis komponentu**: Główny layout aplikacji, zawierający elementy wspólne takie jak nagłówek, menu nawigacyjne, stopka. Udostępnia mechanizm (np. `<ng-content>` z selektorami lub nazwane outlety) do wstrzykiwania specyficznej zawartości strony oraz potencjalnie tytułu strony.
- **Uwaga**: Implementacja `MainLayoutComponent` jest poza zakresem tego planu, ale jego istnienie i funkcjonalność (możliwość projekcji treści) są kluczowe.

### `HistoryPageComponent`
- **Lokalizacja**: `src/app/features/history/pages/history-page/history-page.component.ts`
- **Opis komponentu**: Główny komponent kontenerowy dla widoku historii. Używa `MainLayoutComponent` do renderowania ogólnej struktury strony. Zarządza stanem widoku historii (filtry, paginacja), komunikuje się z `HistoryPageFacade` i renderuje specyficzną zawartość (listę sesji, `HistoryActionsBarComponent`) wewnątrz `MainLayoutComponent`. Otwiera `HistoryFilterDialogComponent` do zarządzania filtrami.
- **Główne elementy HTML (konceptualny szablon `history-page.component.html`)**:
    ```html
    <txg-main-layout title="Session History" [loadingSignal]="isLoading">
      <div class="p-4">
        <!-- Logika ładowania, błędów, braku sesji -->
        @if (isLoading()) {
          <!-- MatProgressSpinner -->
        } @else if (viewModel().error) {
          <!-- Komunikat błędu z przyciskiem ponowienia (reloadData()) -->
        } @else if (!viewModel().isLoading && viewModel().sessions.length === 0 && !viewModel().error) {
          <!-- Komunikat "Brak sesji" z przyciskiem otwarcia dialogu filtrów (onFilterButtonClicked()) -->
        } @else if (viewModel().sessions.length > 0) {
          <div class="pb-14"> <!-- Padding for sticky bar -->
            <txg-session-list 
              [sessions]="viewModel().sessions"
              (sessionNavigated)="onSessionNavigated($event)">
            </txg-session-list>
          </div>
        } @else {
           <!-- Fallback message -->
        }
      </div>

      @if (viewModel().sessions.length > 0) {
        <txg-history-actions-bar
          [length]="viewModel().totalSessions"
          [pageSize]="viewModel().filters.pageSize"
          [pageIndex]="viewModel().currentPage"
          [pageSizeOptions]="viewModel().filters.pageSizeOptions"
          (filterButtonClicked)="onFilterButtonClicked()"
          (pageChanged)="onPageChanged($event)"
        ></txg-history-actions-bar>
      } @else {
        <div class="flex-grow"></div> <!-- Placeholder for consistent layout when no sessions -->
      }
    </txg-main-layout>
    ```
- **Obsługiwane interakcje**:
    - Otwieranie `HistoryFilterDialogComponent` (poprzez metodę `onFilterButtonClicked()` wywołaną przez `HistoryActionsBarComponent` lub przyciski na stronie).
    - Zmiana strony w paginatorze (z `debounceTime`), obsługiwana przez event `pageChanged` z `HistoryActionsBarComponent`.
    - Otrzymywanie zmian filtrów z `HistoryFilterDialogComponent`.
    - Ponawianie ładowania danych (metoda `reloadData()`).
- **Obsługiwana walidacja**: Brak bezpośredniej walidacji; deleguje do `HistoryFilterDialogComponent`.
- **Typy**: `HistoryFiltersViewModel`, `PageEvent` (z `MatPaginator`), `HistoryPageViewModel`.
- **Propsy**: Brak (jest to komponent routowalny/strona).
- **Zależności**: `HistoryPageFacade`, `Router`, `MatDialog`, `MainLayoutComponent` (importowany do użycia w szablonie).

### `HistoryFilterDialogComponent`
- **Lokalizacja**: `src/app/features/history/pages/history-page/components/dialogs/history-filter-dialog/history-filter-dialog.component.ts`
- **Opis komponentu**: Komponent (dialog) odpowiedzialny za renderowanie formularza filtrów. Umożliwia użytkownikowi wybór planu treningowego, zakresu dat oraz liczby elementów na stronie. Zwraca wybrane filtry po zamknięciu dialogu.
- **Główne elementy HTML**:
    - `<form [formGroup]="filterForm">`
    - `MatSelect` dla planów treningowych (`availableTrainingPlans`).
    - `MatDatepicker` dla `dateFrom` i `dateTo`.
    - `MatSelect` dla `pageSize`.
    - Przyciski "Zastosuj filtry" i "Anuluj".
- **Obsługiwane interakcje**:
    - Zmiana wartości w polach formularza.
    - Zatwierdzenie lub anulowanie filtrów.
- **Obsługiwana walidacja**:
    - `dateFrom` musi być wcześniejsza lub równa `dateTo`, jeśli obie daty są podane (przez `dateRangeValidator`).
    - Pola dat muszą zawierać poprawne daty.
- **Typy**: `HistoryFiltersViewModel`, `FormGroup` (Angular Forms), `HistoryFilterTrainingPlan`.
- **Propsy (Przekazywane jako `MAT_DIALOG_DATA`)**: `{ filters: HistoryFiltersViewModel }`.
- **Event Emitters**: Zamiast emitera, dialog zwraca `HistoryFiltersViewModel` lub `undefined` przez `dialogRef.afterClosed()`.

### `HistoryActionsBarComponent`
- **Lokalizacja**: `src/app/features/history/pages/history-page/components/history-actions-bar/history-actions-bar.component.ts`
- **Opis komponentu**: Prezentacyjny komponent odpowiedzialny za wyświetlanie paska akcji na dole strony historii. Zawiera paginator oraz przycisk do otwierania dialogu filtrów.
- **Główne elementy HTML (`history-actions-bar.component.html`)**:
    ```html
    <div class="fixed bottom-16 left-0 right-0 ...">
      <mat-divider />
      <div class="flex ...">
        <mat-paginator 
          [length]="length"
          [pageSize]="pageSize"
          [pageIndex]="pageIndex"
          [pageSizeOptions]="pageSizeOptions"
          (page)="onPageChanged($event)">
        </mat-paginator>
        <button mat-icon-button (click)="onFilterClicked()">
          <mat-icon>filter_list</mat-icon>
        </button>
      </div>
    </div>
    ```
- **Propsy (Inputs)**:
    - `length: number` (dla `MatPaginator`)
    - `pageSize: number` (dla `MatPaginator`)
    - `pageIndex: number` (dla `MatPaginator`)
    - `pageSizeOptions: number[]` (dla `MatPaginator`)
- **Obsługiwane interakcje**:
    - Kliknięcie przycisku filtra (wywołuje `onFilterClicked()`, co emituje `filterButtonClicked`).
    - Zmiana strony lub wielkości strony w paginatorze (wywołuje `onPageChanged()`, co emituje `pageChanged` z `PageEvent`).
- **Event Emitters (Outputs)**:
    - `filterButtonClicked = new EventEmitter<void>()`
    - `pageChanged = new EventEmitter<PageEvent>()`
- **Zależności**: `CommonModule`, `MatPaginatorModule`, `MatButtonModule`, `MatIconModule`, `MatTooltipModule`, `MatDividerModule` (importowane w komponencie standalone).

## 5. Typy
Modele DTO są zdefiniowane w `src/app/shared/api/api.types.ts`. Wprowadzone zostaną następujące ViewModels w `src/app/features/history/models/history-page.viewmodel.ts`:

### `HistoryFilterTrainingPlan`
Prosty typ do wyświetlania planów treningowych w filtrze.
```typescript
export interface HistoryFilterTrainingPlan {
  id: string;
  name: string;
}
```

### `SessionCardViewModel`
Model widoku dla pojedynczej sesji na liście. Zakłada się, że ten typ jest już zdefiniowany w `@features/sessions/models/session-card.viewmodel.ts` i będzie reużywany.
**Uwaga**: `HistoryPageFacade` będzie odpowiedzialny za mapowanie `TrainingSessionDto` na `SessionCardViewModel`. Wymaga to rozwiązania kwestii brakujących danych w `TrainingSessionDto` (nazwa planu, dnia, nazwy ćwiczeń) poprzez modyfikację API lub dodatkowe zapytania.

### `HistoryFiltersViewModel`
Model widoku dla stanu filtrów.
```typescript
export interface HistoryFiltersViewModel {
  selectedTrainingPlanId: string;            // ID wybranego planu treningowego
  dateFrom: string | null;                   // Data "od" w formacie ISO (YYYY-MM-DDTHH:mm:ss.sssZ) lub null
  dateTo: string | null;                     // Data "do" w formacie ISO lub null
  pageSize: number;                          // Liczba elementów na stronie
  availableTrainingPlans: HistoryFilterTrainingPlan[] | null; // Dostępne plany do wyboru w filtrze
  pageSizeOptions: number[];                 // Dostępne opcje wielkości strony
}
```

### `HistoryPageViewModel`
Agreguje wszystkie dane potrzebne dla szablonu `HistoryPageComponent`.
```typescript
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';

export interface HistoryPageViewModel {
  sessions: SessionCardViewModel[];
  filters: HistoryFiltersViewModel; // Aktualne filtry
  totalSessions: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
}
```

## 6. Zarządzanie stanem
Stan będzie zarządzany głównie przez Angular Signals w `HistoryPageFacade` oraz w `HistoryPageComponent`.

### `HistoryPageFacade` (`src/app/features/history/pages/history-page/history-page.facade.ts`)
- **Odpowiedzialności**:
    - Hermetyzacja logiki pobierania danych z API (`GET /training-sessions`).
    - Zarządzanie stanem ViewModelu strony (`HistoryPageViewModel`).
    - Pobieranie listy dostępnych planów treningowych i ćwiczeń dla mapowania oraz dla filtrów.
    - Ustalanie domyślnie wybranego planu treningowego w filtrach na podstawie profilu użytkownika.
    - Mapowanie `TrainingSessionDto` na `SessionCardViewModel` przy użyciu `mapToSessionCardViewModel`.
    - Filtrowanie sesji po stronie serwera tylko dla statusów `COMPLETED` i `CANCELLED`.
- **Zależności (do wstrzyknięcia)**:
    - `PlanService` (z `@features/plans/api`)
    - `ExerciseService` (z `@shared/api/exercise.service`)
    - `ProfileService` (z `@shared/api/profile.service`)
    - `SessionService` (z `@features/sessions/api/session.service`)
    - `AuthService` (z `@shared/services/auth.service`)
- **Sygnały (Signals)**:
    - `viewModel = signal<HistoryPageViewModel>(initialHistoryPageViewModel)`
    - `internalPlans = signal<TrainingPlanDto[]>([]`
    - `internalExercises = signal<ExerciseDto[]>([]`
- **Stałe**:
    - `REQUIRED_SESSION_STATUSES: SessionStatus[] = ['COMPLETED', 'CANCELLED']`
- **Metody publiczne**:
    - `loadHistoryPageData(): void`
        - Ustawia `isLoading` na `true`.
        - Pobiera równolegle plany treningowe (`PlanService`), ćwiczenia (`ExerciseService`) i profil użytkownika (`ProfileService`).
        - Przechowuje plany i ćwiczenia w wewnętrznych sygnałach.
        - Przygotowuje `availableTrainingPlans` dla `HistoryFiltersViewModel`.
        - Ustawia `selectedTrainingPlanId` w `filters` na aktywny plan użytkownika lub pierwszy dostępny plan.
        - Aktualizuje `viewModel` z danymi filtrów.
        - Wywołuje `loadSessions()`.
        - Obsługuje błędy podczas inicjalizacji.
    - `loadSessions(order?: string): void`
        - Ustawia `isLoading` na `true` w `viewModel`.
        - Buduje parametry zapytania (`GetSessionsParams`) używając `limit`, `offset` (obliczone z `currentPage` i `filters.pageSize`), `order` oraz `status` (używając `REQUIRED_SESSION_STATUSES`).
        - Dodaje `plan_id`, `date_from`, `date_to` do parametrów zapytania, jeśli są zdefiniowane w `viewModel().filters`.
        - Wywołuje API `GET /training-sessions` używając `SessionService`.
        - Po sukcesie: mapuje DTOs na `SessionCardViewModel[]` używając `mapToSessionCardViewModel` (przekazując DTO, odpowiedni plan z `internalPlans` i `internalExercises`).
        - Aktualizuje `sessions`, `totalSessions`, `isLoading` na `false`, czyści `error` w `viewModel`.
        - Po błędzie: aktualizuje `error`, `isLoading` na `false`, `sessions` na pustą tablicę, `totalSessions` na 0 w `viewModel`.
    - `updateFilters(newFilters: Partial<HistoryFiltersViewModel>): void` - aktualizuje `filters` i `currentPage` (resetuje do 0) w `viewModel` i wywołuje `loadSessions`.
    - `updatePagination(currentPage: number, pageSize: number): void` - aktualizuje `currentPage` i `filters.pageSize` w `viewModel` i wywołuje `loadSessions`.

### `HistoryPageComponent`
- Wstrzykuje `HistoryPageFacade`, `Router`, `MatDialog`.
- Używa `viewModel` bezpośrednio z fasady.
  ```typescript
  private readonly facade = inject(HistoryPageFacade);
  readonly viewModel = this.facade.viewModel;

  ngOnInit(): void {
    this.facade.loadHistoryPageData();
    // Logika debounce dla pageChangedSubject
  }
  
  onFilterButtonClicked(): void { // Nowa metoda obsługująca kliknięcie przycisku filtra
    // Otwiera HistoryFilterDialogComponent
    // Po zamknięciu, jeśli są wyniki, wywołuje this.facade.updateFilters(result);
  }

  reloadData(): void { // Nowa metoda do ponownego ładowania danych
    this.facade.loadHistoryPageData();
  }

  onPageChanged(event: PageEvent): void {
    // Używa pageChangedSubject.next(event) do obsługi z debounceTime
    // W subskrypcji: this.facade.updatePagination(event.pageIndex, event.pageSize);
  }

  onFiltersChanged(filters: HistoryFiltersViewModel): void {
    this.facade.updateFilters(filters);
  }
  ```

## 7. Integracja API

- **Endpoint**: `GET /training-sessions`
- **Typy DTO**: `TrainingSessionDto`, `SessionSetDto` (z `src/app/shared/api/api.types.ts`)
- **Zapytanie**:
    - `limit: number`
    - `offset: number`
    - `order: string` (domyślnie `session_date.desc`)
    - `status: SessionStatus[]` (przekazywane jako string rozdzielony przecinkami, np. "COMPLETED,CANCELLED" - fasada używa `REQUIRED_SESSION_STATUSES`)
    - `date_from: string | undefined`
    - `date_to: string | undefined`
    - `plan_id: string | undefined` (Zmieniono z `training_plan_id` na `plan_id` aby dopasować do `GetSessionsParams`)
- **Odpowiedź API (sukces)**:
    - Status: 200 OK
    - Ciało: `TrainingSessionDto[]`
    - **KRYTYCZNE**: Oczekuje się, że API (lub metadane odpowiedzi) dostarczy również `totalCount`. (Nowe pole w odpowiedzi - **wymaga aktualizacji backendu**)
- **Odpowiedź API (błąd)**:
    - Statusy: 400, 401, 500.
    - `HistoryPageFacade` obsłuży błędy.

## 8. Interakcje użytkownika

- **Załadowanie widoku**:
    - `HistoryPageComponent.ngOnInit()` woła `facade.loadHistoryPageData()`.
    - Fasada pobiera dane konfiguracyjne (plany, ćwiczenia, profil), ustawia początkowe filtry, a następnie pierwsze sesje.
    - Wyświetlany jest wskaźnik ładowania na podstawie `viewModel().isLoading`.
- **Zmiana wartości filtra (plan, data od/do, elementy na stronie)**:
    - Użytkownik klika przycisk filtra w `HistoryActionsBarComponent` lub na stronie (w stanach błędu/braku sesji).
    - `HistoryPageComponent.onFilterButtonClicked()` jest wywoływane.
    - Metoda `onFilterButtonClicked()` otwiera `HistoryFilterDialogComponent`.
    - Po zatwierdzeniu filtrów w dialogu, `HistoryPageComponent` woła `facade.updateFilters(selectedFilters)`.
    - Fasada aktualizuje `viewModel.filters`, resetuje `viewModel.currentPage` i wywołuje `loadSessions`.
- **Zmiana strony (MatPaginator w `HistoryActionsBarComponent`)**:
    - `HistoryActionsBarComponent` emituje event `pageChanged`.
    - `HistoryPageComponent.onPageChanged` jest wywoływane. Używa `Subject` z `debounceTime`.
    - W subskrypcji `pageChangedSubject`, wołane jest `facade.updatePagination(pageIndex, pageSize)`.
    - Fasada aktualizuje `viewModel.currentPage`, `viewModel.filters.pageSize` i wywołuje `loadSessions`.

## 9. Warunki i walidacja
- **Dialog Filtrów (`HistoryFilterDialogComponent`)**:
    - Używa Angular `ReactiveFormsModule` do walidacji.
    - `dateFrom`: Musi być poprawną datą.
    - `dateTo`: Musi być poprawną datą.
    - **Walidacja krzyżowa**: Jeśli obie daty (`dateFrom`, `dateTo`) są podane, `dateFrom` nie może być późniejsza niż `dateTo` (obsługiwane przez `dateRangeValidator`).
        - Komunikaty o błędach są wyświetlane przy odpowiednich polach.
    - Dialog zwraca filtry (`HistoryFiltersViewModel`) tylko, gdy formularz jest ważny.
    - Nie ma już filtra statusu.
- **API**:
    - `limit`, `offset`: liczby całkowite, nieujemne.
    - `order`: string w formacie `field.(asc|desc)`.
    - `status`: string z wartościami `SessionStatus` oddzielonymi przecinkami (np. `COMPLETED,CANCELLED`). Backend (`get.ts`) wykonuje własną walidację przy użyciu Zod.
    - `date_from`, `date_to`: stringi daty w formacie ISO. Backend (`get.ts`) wykonuje własną walidację.
    - `plan_id`: string z wartością UUID wybranego planu.

## 10. Obsługa błędów

- **Błąd API (np. sieć, serwer 5xx)**:
    - `HistoryPageFacade` przechwytuje błąd, ustawia sygnał `error` na odpowiedni komunikat (np. "Nie udało się załadować historii sesji. Spróbuj ponownie później.").
    - `HistoryPageComponent` wyświetla ten komunikat na podstawie `viewModel().error`.
- **Brak autoryzacji (401/403)**:
    - Główny `authGuard` (lub `authGuard` na poziomie trasy/layoutu) powinien przekierować na stronę logowania.
    - Jeśli token wygaśnie w trakcie sesji, globalny interceptor HTTP powinien obsłużyć to centralnie (np. wylogowując użytkownika).
- **Brak sesji (pusta odpowiedź z API lub po filtrowaniu)**:
    - `HistoryPageComponent` wyświetla komunikat (np. "Nie znaleziono żadnych sesji treningowych pasujących do kryteriów.") na podstawie `!viewModel().isLoading && !viewModel().sessions.length && !viewModel().error`.
    - `MatPaginator` powinien być odpowiednio zdezaktywowany lub pokazywać "0 z 0" (lub być ukryty).
- **Niepoprawne dane filtrów po stronie klienta**:
    - Walidacja formularza w `HistoryFilterDialogComponent` powinna zapobiegać wysyłaniu niepoprawnych zapytań, wyświetlając błędy bezpośrednio w formularzu.

## 11. Kroki implementacji

1.  **Aktualizacja API (Backend) (Kluczowe)**:
    *   Upewnij się, że endpoint `GET /training-sessions` zwraca pole `totalCount` dla poprawnej paginacji. Jest to **krytyczne**.
    *   Potwierdź, czy API `GET /training-sessions` będzie przyjmować (lub wymagać) parametru `training_plan_id` do zawężenia wyników do konkretnego planu (np. aktywnego planu użytkownika pobranego przez `ProfileService`).
    *   Zweryfikuj, jakie dane są niezbędne dla `mapToSessionCardViewModel` i czy API `GET /training-sessions` zwraca wystarczająco dużo informacji (np. `training_plan_id`, `training_plan_exercise_id` w ramach setów), aby helper mógł zbudować pełny `SessionCardViewModel` z pomocą `PlanService` i `ExerciseService`. Rozważ rozszerzenie DTO odpowiedzi, aby zminimalizować liczbę dodatkowych zapytań na frontendzie.

2.  **Struktura folderów i plików**:
    *   Utwórz folder `src/app/features/history`, jeśli jeszcze nie istnieje.
    *   Wewnątrz `history` utwórz podfoldery: `pages/history-page` (dla `HistoryPageComponent`, `HistoryPageFacade`), `pages/history-page/components/dialogs/history-filter-dialog` (dla `HistoryFilterDialogComponent`), `pages/history-page/components/history-actions-bar` (dla `HistoryActionsBarComponent`), `models` (dla `HistoryFiltersViewModel`, `HistoryPageViewModel`).
    *   Utwórz puste pliki dla komponentów (`.ts`, `.html`, `.scss`), fasady i modeli widoku (`.ts`).

3.  **Definicja typów (`history-page.viewmodel.ts`)**:
    *   Zdefiniuj `HistoryFilterTrainingPlan`.
    *   Zdefiniuj `HistoryFiltersViewModel` (zawierający `selectedTrainingPlanId`, `dateFrom`, `dateTo`, `pageSize`, `availableTrainingPlans`, `pageSizeOptions`).
    *   Zdefiniuj `HistoryPageViewModel` (zawierający `sessions`, `filters`, `isLoading`, `totalSessions`, `error`, `currentPage`).

4.  **Weryfikacja i implementacja serwisów zależnych**:
    *   Upewnij się, że `PlanService` (z `@features/plans/api`) dostarcza metody do pobrania szczegółów planów (potrzebnych dla `mapToSessionCardViewModel`).
    *   Upewnij się, że `ExerciseService` (z `@shared/api/`) dostarcza metody do pobrania szczegółów ćwiczeń (potrzebnych dla `mapToSessionCardViewModel`).
    *   Upewnij się, że `ProfileService` (z `@shared/api/profile.service`) dostarcza metodę do pobrania profilu użytkownika (w tym `active_training_plan_id`).
    *   Upewnij się, że `SessionService` (z `@features/sessions/api/session.service`) istnieje i ma metodę `getSessions` przyjmującą `GetSessionsParams` i zwracającą dane sesji oraz `totalCount`.
    *   Zweryfikuj dokładne wymagania (wejście/wyjście) funkcji `mapToSessionCardViewModel` (z `@features/sessions/models/session.mapping`).

5.  **Fasada (`HistoryPageFacade`)**: (`src/app/features/history/pages/history-page/history-page.facade.ts`)
    *   Wstrzyknij `PlanService`, `ExerciseService`, `ProfileService`, `SessionService`, `AuthService`.
    *   Zaimplementuj sygnał `viewModel = signal<HistoryPageViewModel>(initialHistoryPageViewModel)`. Zdefiniuj `initialHistoryPageViewModel`.
    *   Zaimplementuj `internalPlans` i `internalExercises` jako sygnały.
    *   Zdefiniuj stałą `REQUIRED_SESSION_STATUSES`.
    *   Zaimplementuj metodę `loadHistoryPageData(): void`. Ta metoda powinna:
        *   Pobrać użytkownika z `AuthService`.
        *   Równolegle pobrać plany, ćwiczenia i profil użytkownika.
        *   Zaktualizować `internalPlans` i `internalExercises`.
        *   Przygotować `availableTrainingPlans` dla filtrów.
        *   Ustawić `selectedTrainingPlanId` na podstawie aktywnego planu użytkownika lub pierwszego dostępnego.
        *   Zaktualizować `viewModel.filters`.
        *   Wywołać `loadSessions()` po raz pierwszy.
        *   Obsłużyć błędy.
    *   Zaimplementuj metodę `loadSessions(order?: string): void`:
        *   Ustaw `isLoading` na `true`.
        *   Pobierz aktualne filtry, `currentPage` z `viewModel()`.
        *   Zbuduj parametry zapytania `GetSessionsParams` (w tym `limit`, `offset`, `order`, `status` (z `REQUIRED_SESSION_STATUSES`), `plan_id`, `date_from`, `date_to`).
        *   Wywołaj `sessionService.getSessions()`.
        *   Po sukcesie:
            *   Iteruj po `TrainingSessionDto[]`. Dla każdego DTO, wywołaj `mapToSessionCardViewModel`, przekazując DTO, odpowiedni plan z `internalPlans`, oraz `internalExercises`.
            *   Zaktualizuj `sessions`, `totalSessions` (z odpowiedzi API), `isLoading` na `false`, czyści `error` w `viewModel`.
        *   Po błędzie: zaktualizuj `error`, `isLoading` na `false`, wyczyść `sessions` i `totalSessions` w `viewModel`.
    *   Zaimplementuj metody `updateFilters(newFilters: Partial<HistoryFiltersViewModel>): void` (resetuje `currentPage` do 0) i `updatePagination(currentPage: number, pageSize: number): void`, które aktualizują stan w `viewModel` i wywołują `loadSessions`.

6.  **Komponent `HistoryFilterDialogComponent`**: (`src/app/features/history/pages/history-page/components/dialogs/history-filter-dialog/history-filter-dialog.component.ts`)
    *   Zaimplementuj `ReactiveForm` (`filterForm`) z polami dla `selectedTrainingPlanId` (`MatSelect`), zakresu dat (`MatDatepicker`) i `pageSize` (`MatSelect`).
    *   Dodaj walidację (w tym walidator krzyżowy `dateRangeValidator` dla dat).
    *   Pobierz `filters` (w tym `availableTrainingPlans` i `pageSizeOptions`) z `MAT_DIALOG_DATA`.
    *   Po kliknięciu "Apply Filters", jeśli formularz jest ważny, zamknij dialog, zwracając zaktualizowany `HistoryFiltersViewModel`.
    *   Propsy: `data: { filters: HistoryFiltersViewModel }`.

7.  **Komponent `HistoryPageComponent` (główny)**: (`src/app/features/history/pages/history-page/history-page.component.ts`)
    *   Wstrzyknij `HistoryPageFacade`, `Router`, `MatDialog`.
    *   Użyj `viewModel = this.facade.viewModel;`.
    *   W `ngOnInit` wywołaj `this.facade.loadHistoryPageData();` i skonfiguruj `pageChangedSubject` z `debounceTime`.
    *   Zaimplementuj metodę `openFilterDialog()`:
        *   Otwórz `HistoryFilterDialogComponent`, przekazując `this.viewModel().filters` jako dane.
        *   Po zamknięciu dialogu (`afterClosed()`), jeśli otrzymano wynik (nowe filtry), wywołaj `this.facade.updateFilters(result)`.
    *   Zaimplementuj metodę `onPageChanged(event: PageEvent)`: wywołaj `this.pageChangedSubject.next(event)`.
    *   Zaimplementuj metodę `reloadData()`: wywołaj `this.facade.loadHistoryPageData()`.
    *   Zaimplementuj szablon HTML (`history-page.component.html`):
        *   Użyj `<txg-main-layout>`.
        *   Zintegruj `<txg-history-actions-bar>` i podłącz jego eventy `(filterButtonClicked)` do `onFilterButtonClicked()` oraz `(pageChanged)` do `onPageChanged($event)`.
        *   Warunkowo wyświetlaj `mat-progress-spinner` na podstawie `isLoading()`.
        *   Warunkowo wyświetlaj komunikat o błędzie (z przyciskiem do `reloadData()`) na podstawie `viewModel().error`.
        *   Warunkowo wyświetlaj komunikat o braku sesji (z przyciskiem do `onFilterButtonClicked()`).
        *   Użyj reużywalnego komponentu `<txg-session-list [sessions]="viewModel().sessions">`.

8.  **Routing**:
    *   Skonfiguruj trasę dla `/history` w `src/app/app.routes.ts`, ładując `HistoryPageComponent` jako komponent standalone lub poprzez `routes.ts` feature'u.
    *   Upewnij się, że `authGuard` jest poprawnie zastosowany.

9.  **Moduły Angular Material i Reużywane Komponenty**:
    *   Upewnij się, że wszystkie wymagane moduły Angular Material (np. `MatDrawerModule`, `MatPaginatorModule`, `MatSelectModule`, `MatDatepickerModule`, `MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatIconModule`, `MatProgressSpinnerModule`) oraz reużywane komponenty (`txg-session-list`, `txg-main-layout`) są poprawnie importowane w `imports` tablicy komponentów standalone.

10. **Testowanie**:
    *   Przetestuj ręcznie filtrowanie (status, daty), paginację, obsługę błędów i responsywność.

11. **Styling i UX**:
    *   Dopracuj wygląd widoku zgodnie z zasadami Tailwind CSS i Angular Material.
    *   Upewnij się, że komunikaty o błędach i stanach ładowania są jasne dla użytkownika.
    *   Zapewnij responsywność widoku.

12. **Dokumentacja i PR**:
    *   Przejrzyj kod pod kątem zgodności z wytycznymi projektu.
    *   Przygotuj Pull Request z jasnym opisem zaimplementowanych zmian.
