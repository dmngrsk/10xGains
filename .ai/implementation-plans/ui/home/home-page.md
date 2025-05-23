# Plan implementacji widoku Home Dashboard

## 1. Przegląd
Widok Home Dashboard (`/home`) jest głównym punktem wejścia dla zalogowanego użytkownika. Jego celem jest wyświetlenie informacji o nadchodzącej lub trwającej sesji treningowej (jeśli istnieje) oraz o dwóch ostatnich zakończonych sesjach. Jeśli nie ma aktywnej sesji, zamiast niej wyświetlona zostanie karta zachęcająca do jej utworzenia. Umożliwia szybki dostęp do kluczowych funkcji aplikacji.

## 2. Routing widoku
`HomePageComponent` jest głównym komponentem dla ścieżki `/home`. W swoim szablonie używa `MainLayoutComponent` do zapewnienia dolnej nawigacji, wyświetlenia tytułu strony oraz paska ładowania.

```typescript
// src/app/features/home/home.routes.ts
import { Route } from '@angular/router';
import { HomePageComponent } from './components/home-page/home-page.component';
import { authGuard } from '@shared/utils/guards/auth.guard';

export const HOME_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: HomePageComponent,
    canActivate: [authGuard]
  }
];

// src/app/app.routes.ts
// ...
{
  path: 'home',
  loadChildren: () => import('./features/home/home.routes').then(m => m.HOME_ROUTES),
  canActivate: [authGuard],
},
// ...
```

## 3. Struktura komponentów (jak używane w szablonie `HomePageComponent`)
```
HomePageComponent (features/home/components/home-page/home-page.component.ts)
  └── MainLayoutComponent (shared/ui/layouts/main-layout/main-layout.component.ts) - Używany w szablonie HomePageComponent
      └── BottomNavigationComponent (shared/ui/layouts/main-layout/components/bottom-navigation/bottom-navigation.component.ts) - Używany w MainLayoutComponent
      ├── UserGreetingComponent (features/home/components/user-greeting/user-greeting.component.ts)
      ├── CreateSessionCardComponent (features/home/components/create-session-card/create-session-card.component.ts) - (Warunkowo)
      └── SessionListComponent (features/sessions/components/session-list/session-list.component.ts)
          └── SessionCardComponent (features/sessions/components/session-card/session-card.component.ts)
```

## 4. Szczegóły komponentów

### `MainLayoutComponent`
- **Lokalizacja**: `src/app/shared/ui/layouts/main-layout/main-layout.component.ts`
- **Opis**: Komponent layoutu dostarczający główną strukturę strony z górnym paskiem (nagłówek, opcjonalny pasek ładowania) i dolną nawigacją (`BottomNavigationComponent`). Treść strony jest wstrzykiwana poprzez `<ng-content>`.
- **Główne elementy**:
  - Pasek górny (np. `mat-toolbar`) wyświetlający `@Input() title`.
  - `mat-progress-bar` wyświetlany warunkowo na podstawie `@Input() loadingSignal`.
  - `<div class="page-content-area"> <ng-content></ng-content> </div>`
  - `<txg-bottom-navigation></txg-bottom-navigation>`
- **Propsy**:
  - `@Input() title: string = '10xGains';`
  - `@Input() loadingSignal?: Signal<boolean>;`

### `BottomNavigationComponent`
- **Lokalizacja**: `src/app/shared/ui/layouts/main-layout/components/bottom-navigation/bottom-navigation.component.ts`
- **Selektor**: `txg-bottom-navigation`
- **Opis**: Wyświetla stały dolny pasek nawigacyjny z linkami do głównych sekcji aplikacji. Używa komponentów Angular Material do stylizacji.
- **Główne elementy**:
  - `mat-toolbar` (lub `nav` element) umieszczony na dole ekranu.
  - Seria elementów `<a>` (lub `button` z `routerLink`) działających jako przyciski nawigacyjne.
  - Każdy przycisk zawiera `mat-icon` oraz etykietę tekstową.
  - Aktywny link jest wyróżniony za pomocą `routerLinkActive`.
- **Przyciski/Linki**:
  1.  **Home**:
      - Ikona: `home`
      - Etykieta: "Home"
      - `routerLink="/home"`
  2.  **Plans**:
      - Ikona: `list_alt` (lub `assignment`)
      - Etykieta: "Plans"
      - `routerLink="/plans"`
  3.  **History**:
      - Ikona: `history`
      - Etykieta: "History"
      - Obecnie nieaktywny (np. `pointer-events: none; color: grey;` lub bez `routerLink`).
  4.  **Progress**:
      - Ikona: `bar_chart` (lub `trending_up`)
      - Etykieta: "Progress"
      - Obecnie nieaktywny.
  5.  **Settings**:
      - Ikona: `settings`
      - Etykieta: "Settings"
      - Obecnie nieaktywny.
- **Styling**: Pasek przyklejony do dołu, responsywny, zgodny z tematem Material Design.

### `HomePageComponent`
- **Lokalizacja**: `features/home/components/home-page/home-page.component.ts`
- **Selektor**: `txg-home-page`
- **Opis**: Główny kontener widoku Home. Korzysta z `HomeFacadeService` do pobrania i przetworzenia danych. Jego szablon używa `<txg-main-layout>` jako jedynego wrappera, przekazując do niego tytuł strony ("Home") oraz sygnał `viewModel().isLoading` do zarządzania paskiem postępu.
- **Główne elementy (w szablonie `HomePageComponent`)**:
  ```html
  <txg-main-layout title="Home" [loadingSignal]="viewModel().isLoading">
    <!-- Treść HomePageComponent renderowana wewnątrz <ng-content> w MainLayoutComponent -->
    <txg-user-greeting [userName]="viewModel().userName"></txg-user-greeting>
    <div *ngIf="viewModel().error" class="error-message">{{ viewModel().error }}</div>
    <ng-container *ngIf="!viewModel().isLoading">
      <txg-create-session-card *ngIf="!viewModel().activeSessionExists" (createSession)="handleCreateSession()"></txg-create-session-card>
    </ng-container>
    <txg-session-list [sessions]="viewModel().sessions" [isLoading]="viewModel().isLoading"></txg-session-list>
  </txg-main-layout>
  ```
  (Uwaga: `*ngIf` zostanie zastąpione przez `@if` zgodnie z Angular 17+ w finalnej implementacji.)
- **Obsługiwane interakcje**: Inicjuje pobieranie danych przez `HomeFacadeService.loadHomePageData()`. Obsługuje zdarzenie `createSession` z `CreateSessionCardComponent` wywołując `HomeFacadeService.createSession()`. Przekazuje `viewModel().isLoading` do `loadingSignal` komponentu `MainLayoutComponent`.
- **Typy**:
  - `HomePageViewModel` (sygnał z `HomeFacadeService`)

### `UserGreetingComponent`
- **Lokalizacja**: `features/home/components/user-greeting/user-greeting.component.ts`
- **Selektor**: `txg-user-greeting`
- **Opis**: Wyświetla spersonalizowane powitanie dla użytkownika, np. "Cześć, [Imię użytkownika]!".
- **Główne elementy**: Element tekstowy (np. `h2` lub `p`).
- **Obsługiwane interakcje**: Brak.
- **Obsługiwana walidacja**: Brak.
- **Typy**: Brak.
- **Propsy**:
  - `userName: string | null`

### `CreateSessionCardComponent`
- **Lokalizacja**: `features/home/components/create-session-card/create-session-card.component.ts`
- **Selektor**: `txg-create-session-card`
- **Opis**: Karta wyświetlana, gdy użytkownik nie ma żadnych aktywnych (PENDING, IN_PROGRESS) sesji treningowych. Zachęca do stworzenia nowej sesji.
- **Główne elementy**:
  - `mat-card`
    - `mat-card-title`: "Rozpocznij nowy trening"
    - `mat-card-content`: Krótki tekst zachęcający.
    - `mat-card-actions`: Przycisk "Stwórz sesję treningową".
- **Obsługiwane interakcje**:
  - Kliknięcie przycisku "Stwórz sesję treningową": Emituje zdarzenie `createSession`.
- **Output Events**:
  - `createSession = new EventEmitter<void>();`
- **Typy**: Brak.
- **Propsy**: Brak.

### `SessionListComponent` (Samodzielny komponent)
- **Lokalizacja**: `features/sessions/components/session-list/session-list.component.ts`
- **Selektor**: `txg-session-list`
- **Opis**: Odpowiedzialny za wyświetlanie listy sesji treningowych. Przyjmuje listę przetworzonych danych sesji i renderuje dla każdej z nich komponent `SessionCardComponent`. Jeśli lista jest pusta, wyświetla tekst "No sessions found.".
- **Główne elementy**:
  - Kontener (np. `div` z klasami Tailwind CSS `grid` lub `flex`) do ułożenia kart.
  - Pętla `@for` renderująca `<txg-session-card>` dla każdej sesji w przekazanej liście.
  - Tekst "Brak sesji do wyświetlenia" wyświetlany, jeśli `sessions` jest puste lub `null` po załadowaniu i `isLoading` jest `false`.
- **Obsługiwane interakcje**:
  - Może propagować zdarzenia z `SessionCardComponent` (np. `sessionClicked`) do `HomePageComponent`.
- **Obsługiwana walidacja**: Sprawdzenie, czy lista `sessions` nie jest pusta.
- **Typy**:
  - `SessionViewModel[]`
- **Propsy**:
  - `sessions: SessionViewModel[] | null`
  - `isLoading: boolean`

### `SessionCardComponent` (Samodzielny komponent)
- **Lokalizacja**: `features/sessions/components/session-card/session-card.component.ts`
- **Selektor**: `txg-session-card`
- **Opis**: Wyświetla szczegółowe informacje o pojedynczej sesji treningowej oraz listę jej ćwiczeń. Adaptuje swoje CTA i wyświetlane informacje w zależności od kontekstu sesji.
- **Główne elementy**:
  - `mat-card`
    - `mat-card-header` (z tytułem karty pobranym z `sessionData.title`)
    - `mat-card-subtitle` (data sesji, nazwa planu i dnia treningowego)
    - `mat-card-content`
       - Lista ćwiczeń (renderowana bezpośrednio, np. pętla `@for` po `sessionData.exercises` wyświetlająca `div` lub `p` dla każdego `SessionExerciseViewModel`)
       - Informacja o statusie sesji (np. "W trakcie", "Ukończono")
    - `mat-card-actions` (np. przycisk "Rozpocznij", "Kontynuuj", "Zobacz szczegóły", "Zaplanuj następną" w zależności od `sessionData.cardContext` i `sessionData.status`).
- **Obsługiwane interakcje**:
  - Kliknięcie karty lub przycisku akcji: Emituje zdarzenie (np. `sessionNavigated: { sessionId: string, context: 'active' | 'history' }`) zawierające ID sesji i kontekst nawigacji.
- **Obsługiwana walidacja**: Brak bezpośredniej, polega na danych z `sessionData`.
- **Typy**:
  - `SessionViewModel` (który zawiera `SessionExerciseViewModel[]`)
- **Propsy**:
  - `sessionData: SessionViewModel`

## 5. Typy

### `HomePageViewModel`
```typescript
export interface HomePageViewModel {
  isLoading: boolean;
  error: string | null;
  userName: string | null;
  activeTrainingPlanId: string | null; // ID aktywnego planu użytkownika
  activeSessionExists: boolean; // Czy istnieje sesja PENDING lub IN_PROGRESS dla aktywnego planu
  sessions: SessionViewModel[] | null; // Lista sesji do SessionListComponent (aktywna + 2 historyczne z aktywnego planu)
}
```

### `SessionViewModel`
```typescript
export interface SessionViewModel {
  id: string;
  planName: string;
  dayName: string;
  sessionDate: string;
  status: TrainingSessionDto['status'];
  exercises: SessionExerciseViewModel[];
  title: string; // "Następna sesja", "Ostatnia sesja", "Przedostatnia sesja"
  cardContext: 'next' | 'history';
  ctaLink?: string[]; // Dla [routerLink]
}
```

### `SessionExerciseViewModel`
```typescript
export interface SessionExerciseViewModel {
  exerciseName: string;
  summary: string; // np. "5x10 50kg"
}
```

### Inne używane typy (z `api.types.ts`):
- `UserProfileDto`
- `TrainingSessionDto`
- `SessionSetDto`
- `TrainingPlanDto`
- `TrainingPlanDayDto`
- `TrainingPlanExerciseDto`
- `TrainingPlanExerciseSetDto`
- `ExerciseDto`

## 6. Zarządzanie stanem (`HomeFacadeService`)

- **Lokalizacja**: `src/app/features/home/services/home-facade.service.ts`
- **Odpowiedzialności**: Agregacja danych z `ProfileService`, `SessionService`, `PlanService` i `ExerciseService`. Transformacja danych i udostępnianie `HomePageViewModel` jako sygnału.
- **Wstrzykiwane serwisy**:
  - `ProfileService`
  - `SessionService`
  - `PlanService`
  - `ExerciseService`

- **Publiczne API (Sygnały)**:
  - `viewModel = signal<HomePageViewModel>(initialState)`

- **Logika wewnętrzna**:
  - `initialState`: `{ isLoading: true, error: null, userName: null, activeTrainingPlanId: null, activeSessionExists: false, sessions: [] }`
  - Metoda `loadHomePageData()`:
    1.  Aktualizacja `viewModel` -> `isLoading: true`, `error: null`.
    2.  Pobierz `UserProfileDto` z `ProfileService`.
       - Zapisz `userName` i `active_training_plan_id` do tymczasowych zmiennych.
    3.  Jeśli `active_training_plan_id` istnieje:
       a. Równolegle pobierz:
          i.   Sesje dla aktywnego planu z `SessionService` (`GET /training-sessions?plan_id={active_training_plan_id}&order=session_date.desc&limit=10`).
          ii.  Dane aktywnego planu z `PlanService` (`GET /training-plans/{active_training_plan_id}`).
          iii. Globalną listę ćwiczeń z `ExerciseService` (`GET /exercises`).
       b. Po pobraniu wszystkich danych:
          - Przetwórz sesje: Znajdź jedną `PENDING` lub `IN_PROGRESS` jako "aktywną". Znajdź dwie ostatnie `COMPLETED` jako "historyczne".
          - Ustaw `activeSessionExists`.
          - Zmapuj te sesje do `SessionViewModel[]` (wzbogacając o nazwy planów, dni, ćwiczeń).
          - Zaktualizuj sygnał `viewModel` z `userName`, `activeTrainingPlanId`, `activeSessionExists`, przetworzonymi `sessions`, `isLoading: false`.
    4.  Jeśli brak `active_training_plan_id`:
        - Zaktualizuj sygnał `viewModel` z `userName`, `activeTrainingPlanId` (null), `activeSessionExists: false`, `sessions: []`, `isLoading: false`.
    5.  W przypadku błędu na którymkolwiek etapie pobierania danych:
        - Zaktualizuj sygnał `viewModel` ustawiając `error` na odpowiednią wiadomość i `isLoading: false`.

  - Metoda `createSession()`:
    1.  Pobierz `activeTrainingPlanId` z aktualnego `viewModel()`.
    2.  Jeśli `activeTrainingPlanId` nie istnieje, zaloguj błąd i zakończ (lub obsłuż inaczej).
    3.  Aktualizacja `viewModel` -> `isLoading: true`, `error: null`.
    4.  Wywołaj `SessionService.createSession(activeTrainingPlanId)`.
    5.  Po sukcesie: wywołaj `loadHomePageData()` w celu odświeżenia danych (co również ustawi `isLoading: false` po zakończeniu).
    6.  W przypadku błędu tworzenia sesji: Aktualizacja `viewModel` -> `isLoading: false`, `error: 'Nie udało się utworzyć sesji'` (lub bardziej szczegółowy błąd).

- **`HomePageComponent`**: Wstrzykuje `HomeFacadeService`. W `ngOnInit` (lub konstruktorze z `inject`) wywołuje `homeFacadeService.loadHomePageData()`. Używa `homeFacadeService.viewModel` w szablonie. Obsługuje akcję z `CreateSessionCardComponent` wywołując `homeFacadeService.createSession()`. 

## 7. Integracja API (`HomeFacadeService` korzysta z dedykowanych serwisów)

- **`ProfileService`**:
  - `getUserProfile(userId: string): Observable<UserProfileDto>`
  - Implementacja: `GET /user-profiles/{id}`

- **`SessionService`**:
  - `getSessions(params: { plan_id?: string; limit?: number; order?: string; status?: string }): Observable<TrainingSessionDto[]>`
  - `createSession(trainingPlanId: string): Observable<TrainingSessionDto>` (`POST /training-sessions`)

- **`PlanService`**:
  - `getPlan(planId: string): Observable<TrainingPlanDto>`

- **`ExerciseService`**:
  - `getAll(): Observable<ExerciseDto[]>` (`GET /exercises`, powinno być cachowane w serwisie)

## 8. Interakcje użytkownika
-   **Załadowanie widoku `HomePageComponent`**:
    -   `MainLayoutComponent` pokazuje `mat-progress-bar` na podstawie `viewModel().isLoading` przekazanego przez `HomePageComponent`.
    -   `UserGreetingComponent` pokazuje `viewModel().userName`.
    -   Jeśli `!viewModel().activeSessionExists && !viewModel().isLoading`, wyświetlany jest `<txg-create-session-card>`.
    -   `<txg-session-list>` otrzymuje `viewModel().sessions` i `viewModel().isLoading`.
-   **Kliknięcie "Stwórz sesję treningową" w `CreateSessionCardComponent`**:
    -   `HomePageComponent` wywołuje `homeFacadeService.createSession()`.
    -   `HomeFacadeService` ustawia `isLoading: true`, wywołuje `POST /training-sessions`, po odpowiedzi odświeża dane (`loadHomePageData()`), co finalnie ustawi `isLoading: false`.
-   **Interakcja z `SessionCardComponent`**: Emituje zdarzenie, `HomePageComponent` obsługuje nawigację.

## 9. Warunki i walidacja
-   **`HomePageComponent`**:
    -   `viewModel().isLoading` (przekazywane do `MainLayoutComponent`) i `viewModel().error` (do wyświetlania błędów).
    -   `!viewModel().activeSessionExists && !viewModel().isLoading` kontroluje widoczność `<txg-create-session-card>`.
-   **`SessionListComponent`**:
    -   Jeśli `sessions` jest puste i nie `isLoading`, pokazuje "Brak sesji do wyświetlenia.".

## 10. Obsługa błędów
-   **Globalne błędy API**: `HomeFacadeService` ustawia `error` w `viewModel`, `HomePageComponent` wyświetla komunikat błędu.
-   **Błąd tworzenia sesji**: `HomeFacadeService` ustawia `error` w `viewModel` i `isLoading: false`. `HomePageComponent` wyświetla błąd.

## 11. Kroki implementacji
1.  **Utworzenie/aktualizacja plików i serwisów**:
    -   `shared/ui/layouts/main-layout/...`
    -   `shared/ui/layouts/main-layout/components/bottom-navigation/...`
    -   `features/home/components/home-page/...`
    -   `features/home/components/user-greeting/...`
    -   `features/home/components/create-session-card/...`
    -   `features/home/services/home-facade.service.ts` (nowy serwis fasady)
    -   `features/home/home.routes.ts`
    -   `features/profiles/services/profile.service.ts` (nowy serwis, implementacja `GET /user-profiles/{id}`)
    -   `features/sessions/components/session-list/...`
    -   `features/sessions/components/session-card/...`
    -   Dostosowanie `features/sessions/services/session.service.ts` o metodę `getSessions` z filtrowaniem.

2.  **Implementacja `ProfileService`**.

3.  **Implementacja `HomeFacadeService`**:
    -   Zdefiniuj sygnał `viewModel`.
    -   Implementuj logikę `loadHomePageData()` zarządzającą stanem `isLoading` i `error` w `viewModel`.
    -   Implementuj logikę `createSession()` zarządzającą stanem `isLoading` i `error`, i wywołującą `loadHomePageData()` po sukcesie.
    -   Implementuj logikę transformacji danych (mapowanie do `SessionViewModel`).

4.  **Implementacja `MainLayoutComponent`**:
    -   Lokalizacja: `src/app/shared/ui/layouts/main-layout/main-layout.component.ts`.
    -   Struktura: Pasek górny z `title`, `mat-progress-bar` dla `loadingSignal`, `<div class="page-content-area"><ng-content></ng-content></div>` oraz `<txg-bottom-navigation></txg-bottom-navigation>`.
    -   Propsy: `@Input() title: string`, `@Input() loadingSignal?: Signal<boolean>;`.
    -   Cel: Dostarczenie kompletnego layoutu (tytuł, loader, treść, dolna nawigacja) używanego przez `HomePageComponent`.
    -   (Zakłada istnienie lub równoległe tworzenie `BottomNavigationComponent`).
    
5. **Implementacja `BottomNavigationComponent`**:
    -   Lokalizacja: `src/app/shared/ui/layouts/main-layout/components/bottom-navigation/bottom-navigation.component.ts`.
    -   Struktura: `mat-toolbar` na dole, z pięcioma przyciskami (`<a>` lub `button` z `routerLink`): Home (`/home`), Plans (`/plans`), History (nieaktywny), Progress (nieaktywny), Settings (nieaktywny). Każdy z `mat-icon` i etykietą.
    -   Użyj `routerLinkActive` do wyróżnienia aktywnej zakładki.
    
6.  **Implementacja `HomePageComponent` (`txg-home-page`)**:
    -   Wstrzyknij `HomeFacadeService`.
    -   Użyj sygnału `viewModel` w szablonie.
    -   Przekaż `viewModel().isLoading` do `MainLayoutComponent` (zakładając odpowiednią strukturę szablonu/layoutu strony).
    -   Obsłuż `(createSession)` event z `CreateSessionCardComponent`.

7.  **Implementacja `UserGreetingComponent` (`txg-user-greeting`)**:
    -   Przyjmij `userName` jako `@Input` i wyświetl.

8.  **Implementacja `CreateSessionCardComponent` (`txg-create-session-card`)**.

9.  **Implementacja `SessionListComponent` (`txg-session-list`)**:
    -   Przyjmij `sessions: SessionViewModel[] | null` i `isLoading: boolean` jako `@Input`.
    -   Implementuj szablon z pętlą `@for` renderującą `txg-session-card`.
    -   Dodaj obsługę stanu ładowania (np. skeletony, jeśli `isLoading` jest `true` i `sessions` jest puste) oraz stanu pustego (tekst "Brak sesji do wyświetlenia", jeśli `!isLoading` i `sessions` jest puste).
    -   Emituj zdarzenia akcji z kart do `HomePageComponent` (jeśli potrzebne).

10.  **Implementacja `SessionCardComponent` (`txg-session-card`)**:
    -   Przyjmij `sessionData: SessionViewModel` jako `@Input`.
    -   Użyj `mat-card` do zbudowania UI.
    -   Wyświetlaj dynamicznie dane i CTA na podstawie `sessionData.title`, `sessionData.status`, `sessionData.cardContext`, `sessionData.ctaLink`.
    -   Renderuj listę ćwiczeń bezpośrednio w komponencie (np. pętla `@for` po `sessionData.exercises` wyświetlająca `div` lub `p` dla każdego `SessionExerciseViewModel`).
    -   Emituj zdarzenie po kliknięciu akcji.

11.  **Styling**: Użyj Tailwind CSS i Angular Material zgodnie z wytycznymi.

12. **Testowanie**: Testy manualne.

13. **Refaktoryzacja i optymalizacja**.
