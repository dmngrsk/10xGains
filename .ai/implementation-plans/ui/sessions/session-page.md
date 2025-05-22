# Plan implementacji widoku Sesji Treningowej

## 1. Przegląd
Widok Sesji Treningowej (`Session View`) umożliwia użytkownikowi śledzenie postępów w czasie rzeczywistym podczas trwającej sesji treningowej. Wyświetla listę ćwiczeń do wykonania wraz z seriami w formie klikalnych "bąbelków". Użytkownik może oznaczać serie jako ukończone lub nieudane, dodawać nowe serie oraz finalnie zakończyć całą sesję. Widok ten jest kluczowy dla interaktywnego doświadczenia użytkownika i automatyzacji logiki progresji treningowej.

## 2. Routing widoku
Widok powinien być dostępny pod następującą ścieżką:
`/sessions/:sessionId`
Gdzie `:sessionId` to identyfikator (UUID) sesji treningowej.

## 3. Struktura komponentów
Hierarchia komponentów dla widoku Sesji Treningowej:

```
SessionPageComponent (Komponent strony, Kontener)
    ├── SessionHeaderComponent (Opcjonalnie, do wyświetlania nazwy dnia/sesji i daty)
    ├── SessionExerciseListComponent (Prezentacyjny)
    │   └── SessionExerciseItemComponent (Prezentacyjny, powtarzany dla każdego ćwiczenia)
    │       ├── ExerciseInfoComponent (Nazwa ćwiczenia, ew. dodatkowe info)
    │       ├── SessionSetListComponent (Prezentacyjny)
    │       │   └── SessionSetBubbleComponent (Prezentacyjny, powtarzany dla każdej serii)
    │       └── MatIconButton (ikona "+" do dodawania nowej serii)
    ├── SessionTimerComponent (Prezentacyjny, wyświetla czas trwania sesji i przycisk zakończenia)
    └── MatDialog (dynamicznie renderowany dla AddEditSetDialogComponent)
```

Komponenty Angular Material:
- `MatButton` (dla bąbelków serii, akcji)
- `MatIconButton` (dla dodawania serii)
- `MatDialog` (dla dodawania/edycji serii)
- `MatSnackBar` (dla potwierdzeń i błędów)
- `MatProgressSpinner` (dla wskaźników ładowania)
- `MatIcon` (dla ikon)
- `MatCard` (do grupowania informacji o ćwiczeniach)
- `MatList` (dla listy ćwiczeń)

## 4. Szczegóły komponentów

### `SessionPageComponent`
- **Opis komponentu:** Główny komponent kontenerowy dla widoku sesji. Odpowiedzialny za pobranie danych sesji na podstawie `:sessionId` z URL, zarządzanie stanem całej sesji, obsługę logiki biznesowej (np. zakończenie sesji) oraz komunikację z serwisami API. Wykorzystuje Angular Signals do zarządzania stanem.
- **Główne elementy HTML i komponenty dzieci:**
    - `<txg-session-header>` (opcjonalnie)
    - `<txg-session-exercise-list>`
    - `<txg-session-timer>`
    - Wywołuje `MatDialog` do otwierania `AddEditSetDialogComponent`.
- **Obsługiwane interakcje:**
    - Pobieranie danych sesji przy inicjalizacji.
    - Otwieranie dialogu dodawania nowej serii.
    - Obsługa zdarzenia `sessionCompleted` od `SessionTimerComponent`.
- **Obsługiwana walidacja:** Sprawdzenie poprawności `sessionId` z URL (np. czy jest to UUID).
- **Typy:**
    - `TrainingSessionDto` (dane sesji)
    - `SessionExerciseViewModel[]` (przetworzone dane ćwiczeń dla widoku)
    - Sygnały: `sessionId: Signal<string>`, `trainingSession: Signal<TrainingSessionDto | null>`, `exercisesViewModel: Signal<SessionExerciseViewModel[]>`, `isLoading: Signal<boolean>`, `error: Signal<string | null>`, `isReadonly: Signal<boolean>`, `timerResetTrigger: WritableSignal<number | null>`, `allExercisesCompleteSignal: Signal<boolean>`.
- **Propsy:** Brak (pobiera `sessionId` z `ActivatedRoute`).

### `SessionExerciseListComponent`
- **Opis komponentu:** Komponent prezentacyjny wyświetlający listę ćwiczeń (`SessionExerciseItemComponent`) w ramach sesji.
- **Główne elementy HTML i komponenty dzieci:** Pętla (`@for`) renderująca `<txg-session-exercise-item>` dla każdego ćwiczenia. Może używać `MatList`.
- **Obsługiwane interakcje:** Przekazuje zdarzenia od dzieci (np. żądanie dodania serii) do komponentu rodzica (`SessionPageComponent`).
- **Obsługiwana walidacja:** Brak.
- **Typy:** `SessionExerciseViewModel[]`.
- **Propsy:** `exercises: SessionExerciseViewModel[]`, `isReadonly: boolean`.

### `SessionExerciseItemComponent`
- **Opis komponentu:** Komponent prezentacyjny dla pojedynczego ćwiczenia w sesji. Wyświetla nazwę ćwiczenia oraz listę jego serii (`SessionSetBubbleComponent`) i przycisk do dodawania nowej serii (jeśli nie jest w trybie readonly).
- **Główne elementy HTML i komponenty dzieci:**
    - `<txg-exercise-info>` (wyświetla nazwę ćwiczenia, np. jako `MatCardTitle`)
    - `<txg-session-set-list>`
    - `button mat-icon-button` (z ikoną `add_circle` do dodawania serii), renderowany warunkowo (`@if !isReadonly`).
- **Obsługiwane interakcje:**
    - Emituje zdarzenie `setAdded` z `training_plan_exercise_id` po kliknięciu przycisku dodawania serii (tylko jeśli nie `isReadonly`).
    - Przekazuje zdarzenia kliknięcia bąbelka serii w górę hierarchii.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `SessionExerciseViewModel`.
- **Propsy:** `exercise: SessionExerciseViewModel`, `isReadonly: boolean`.

### `SessionSetListComponent`
- **Opis komponentu**: Komponent prezentacyjny wyświetlający rząd "bąbelków" reprezentujących serie dla danego ćwiczenia.
- **Główne elementy HTML i komponenty dzieci**: Pętla (`@for`) renderująca `<txg-session-set-bubble>` dla każdej serii. Umieszczone w kontenerze flex.
- **Obsługiwane interakcje**: Przekazuje zdarzenie kliknięcia bąbelka (`setClicked`) do rodzica (`SessionExerciseItemComponent`).
- **Obsługiwana walidacja**: Brak.
- **Typy**: `SessionSetViewModel[]`.
- **Propsy**: `sets: SessionSetViewModel[]`, `trainingPlanExerciseId: string`, `isReadonly: boolean`.

### `SessionSetBubbleComponent`
- **Opis komponentu:** Komponent prezentacyjny reprezentujący pojedynczą serię jako klikalny "bąbelek" (lub nieklikalny w trybie readonly). Wyświetla oczekiwaną liczbę powtórzeń i wagę. Zmienia swój wygląd w zależności od statusu serii.
- **Główne elementy HTML i komponenty dzieci:** `button mat-stroked-button` lub `mat-flat-button` (stylizowany na bąbelek), z atrybutem `[disabled]="isReadonly"`. Tekst wewnątrz przycisku pokazujący np. "5x100kg". Może zawierać `MatIcon` do statusu.
- **Obsługiwane interakcje:**
    - Emituje zdarzenie `setClicked` z `setId` i `currentStatus` po kliknięciu (tylko jeśli nie `isReadonly`).
    - Warunkowe style/klasy CSS w zależności od `set.status`.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `SessionSetViewModel`.
- **Propsy:** `set: SessionSetViewModel`, `isReadonly: boolean`.

### `AddEditSetDialogComponent`
- **Opis komponentu:** Komponent dialogowy (`MatDialog`) służący zarówno do dodawania nowej serii do ćwiczenia, jak i do edycji istniejącej. Tryb działania ('add' lub 'edit') jest określany na podstawie danych wejściowych. W trybie 'add' pozwala na wprowadzenie liczby powtórzeń i wagi, potencjalnie pre-wypełnionych na podstawie ostatniej serii. W trybie 'edit' pozwala na modyfikację `actual_reps` i `actual_weight`.
- **Główne elementy HTML i komponenty dzieci:**
    - `form` z polami `MatFormField` dla `reps` (lub `actual_reps`) i `weight` (lub `actual_weight`).
    - Tytuł dialogu i tekst przycisku akcji (np. "Dodaj"/"Zapisz zmiany") dynamicznie dostosowywane do trybu.
    - Przyciski `MatButton` (np. "Dodaj"/"Zapisz zmiany" i "Anuluj").
- **Obsługiwane interakcje:**
    - Walidacja wprowadzonych danych.
    - Emitowanie danych nowej lub zaktualizowanej serii po kliknięciu przycisku akcji.
- **Obsługiwana walidacja:**
    - `reps` (tryb 'add') / `actual_reps` (tryb 'edit'): wymagane, liczba całkowita > 0.
    - `weight` (tryb 'add') / `actual_weight` (tryb 'edit'): wymagane, liczba >= 0.
- **Typy:**
    - Dane wejściowe (`data` przekazywane przez `dialog.open`): 
      ```typescript
      interface AddEditSetDialogData {
        mode: 'add' | 'edit';
        trainingPlanExerciseId?: string; // Wymagane dla trybu 'add'
        setIndexForNewSet?: number; // Wymagane dla trybu 'add', do ustawienia set_index
        setToEdit?: SessionSetViewModel;   // Wymagane dla trybu 'edit'
        lastSetForPreFill?: SessionSetViewModel; // Opcjonalne, do pre-wypełnienia w trybie 'add'
      }
      ```
    - Dane wyjściowe (przekazywane przy zamykaniu dialogu): `CreateSessionSetCommand` (dla trybu 'add') lub `UpdateSessionSetCommand` (dla trybu 'edit').
- **Propsy (przekazywane przez `dialog.open`):** `data: AddEditSetDialogData`.

### `SessionTimerComponent`
  - **Opis komponentu:** Komponent prezentacyjny wyświetlający czas trwania sesji oraz przycisk do jej zakończenia. Jego implementacja znajduje się w `session-timer.component.ts`.
  - **Główne elementy HTML i komponenty dzieci:** Zgodnie z istniejącą implementacją, zawiera wyświetlacz czasu i przycisk "Zakończ sesję".
  - **Obsługiwane interakcje:**
    - Startuje, zatrzymuje i resetuje timer na podstawie sygnału `resetTrigger`.
    - Emituje zdarzenie `sessionCompleted` po kliknięciu przycisku zakończenia sesji.
    - Może zmieniać swój wygląd (np. pulsowanie, ukrycie timera) na podstawie `allExercisesComplete` i wewnętrznego stanu.
  - **Obsługiwana walidacja:** Brak (logika włączania/wyłączania przycisku zakończenia może zależeć od propsów).
  - **Typy (propsy wejściowe):**
    - `resetTrigger: Signal<number | null>`
    - `allExercisesComplete: boolean` (lub `Signal<boolean>`)
  - **Typy (zdarzenia wyjściowe):**
    - `sessionCompleted: EventEmitter<void>`
  - **Propsy:** `resetTrigger`, `allExercisesComplete`.

## 5. Typy

Kluczowe typy DTO pochodzą z `src/app/shared/api/api.types.ts`. Należy zdefiniować następujące ViewModels dla potrzeb komponentów:

### `SessionExerciseViewModel`
Reprezentuje pojedyncze ćwiczenie w kontekście sesji, gotowe do wyświetlenia.
```typescript
interface SessionExerciseViewModel {
  training_plan_exercise_id: string; // Klucz do identyfikacji w kontekście planu
  exercise_id_original: string; // ID oryginalnego ćwiczenia z globalnej tabeli ćwiczeń
  exerciseName: string;           // Nazwa ćwiczenia (do pobrania/zmapowania)
  sets: SessionSetViewModel[];    // Lista serii dla tego ćwiczenia w tej sesji
  orderIndex: number;             // Kolejność ćwiczenia w sesji
}
```
*Uwaga: `exerciseName` będzie wymagało dodatkowej logiki do pobrania nazwy ćwiczenia na podstawie `exercise_id_original` lub wzbogacenia danych przychodzących z API.*

### `SessionSetViewModel`
Reprezentuje pojedynczą serię ćwiczenia w kontekście sesji, gotową do wyświetlenia. Mapuje dane z `SessionSetDto` i potencjalnie dodaje informacje specyficzne dla widoku.
```typescript
interface SessionSetViewModel {
  id: string;                               // ID seta sesji (z SessionSetDto)
  training_plan_exercise_id: string;        // ID ćwiczenia w planie (z SessionSetDto)
  set_index: number;                        // Indeks serii (z SessionSetDto)
  
  // Oczekiwane wartości (mogą pochodzić z planu, jeśli API ich nie dostarcza bezpośrednio w SessionSetDto)
  // lub być tożsame z actual_weight/reps jeśli seria jest już rozpoczęta/zakończona
  expected_weight?: number; 
  expected_reps?: number;

  actual_weight?: number | null;             // Rzeczywista waga (z SessionSetDto)
  actual_reps?: number | null;               // Rzeczywiste powtórzenia (z SessionSetDto)
  status: 'PENDING' | 'COMPLETED' | 'FAILED'; // Status serii (z SessionSetDto)
  completed_at?: string | null;              // Data ukończenia (z SessionSetDto)
  
  // Dodatkowe pole dla UI, jeśli jest potrzebne do wyświetlania pre-fill w dialogu
  // lub jako fallback jeśli actual_weight/reps są null dla PENDING
  display_weight: number;
  display_reps: number;
}
```
*Logika `display_weight` i `display_reps` będzie musiała inteligentnie wybierać między `actual_` a `expected_` wartościami w zależności od statusu i dostępności danych.*

## 6. Zarządzanie stanem
Stan będzie zarządzany głównie w `SessionPageComponent` przy użyciu Angular Signals.
- `sessionId: Signal<string>`: Pobierany z `ActivatedRoute`.
- `trainingSession: Signal<TrainingSessionDto | null>`: Przechowuje surowe dane sesji pobrane z API.
- `exercisesViewModel: Signal<SessionExerciseViewModel[]>`: `computed` sygnał transformujący `trainingSession` na model widoku dla listy ćwiczeń. Będzie musiał mapować `SessionSetDto` na `SessionSetViewModel` oraz grupować serie per ćwiczenie i potencjalnie pobierać nazwy ćwiczeń.
- `isLoading: Signal<boolean>`: Wskazuje, czy trwa ładowanie danych sesji lub operacja na całej sesji.
- `isSetUpdating: Signal<Record<string, boolean>>`: Słownik (obiekt), gdzie kluczem jest `setId`, a wartością `boolean` wskazujący, czy dana seria jest aktualnie aktualizowana. Pozwoli to na indywidualne wskaźniki ładowania dla każdego bąbelka.
- `error: Signal<string | null>`: Przechowuje komunikaty o błędach.
- `isReadonly: Signal<boolean>`: `computed` sygnał, który zwraca `true`, jeśli sesja ma status `COMPLETED` (lub inny zdefiniowany jako readonly), w przeciwnym razie `false`. `isReadonly = computed(() => trainingSession()?.status === 'COMPLETED')`.
- `timerResetTrigger: WritableSignal<number | null>`: Sygnał do sterowania `SessionTimerComponent`. Inicjalizowany na `null`. Ustawiany na `Date.now()` (lub inny unikalny numer) aby wystartować/zresetować timer, np. przy pierwszej interakcji użytkownika z serią, jeśli sesja nie jest `readonly`.
- `allExercisesCompleteSignal: Signal<boolean>`: `computed` sygnał, który zwraca `true`, jeśli wszystkie serie wszystkich ćwiczeń w sesji mają status `COMPLETED` lub `FAILED`. Przekazywany do `SessionTimerComponent`.

Nie przewiduje się potrzeby tworzenia dedykowanych custom hooks (w rozumieniu Reacta). Funkcjonalność będzie enkapsulowana w serwisach Angulara oraz logice komponentu `SessionPageComponent`. `computed` signals posłużą do tworzenia pochodnych stanów.

## 7. Integracja API
Komponent `SessionPageComponent` będzie współpracował z serwisem (np. `SessionService`), który będzie odpowiedzialny za komunikację z API.

- **Pobieranie danych sesji:**
    - Endpoint: `GET /training-sessions/{sessionId}`
    - Akcja: Wywoływane przy inicjalizacji komponentu.
    - Typ odpowiedzi: `TrainingSessionDto`.
    - Działanie: Aktualizuje sygnał `trainingSession`.
- **Oznaczanie serii jako ukończonej:**
    - Endpoint: `PATCH /training-sessions/{sessionId}/sets/{setId}/complete`
    - Akcja: Wywoływane po kliknięciu bąbelka serii (jeśli status to `PENDING`).
    - Typ żądania: Brak (puste ciało).
    - Typ odpowiedzi: Zaktualizowany `SessionSetDto` (lub jego część).
    - Działanie: Optymistyczna aktualizacja UI, następnie wywołanie API. Po sukcesie, aktualizacja sygnału `trainingSession` (lub jego części) danymi z odpowiedzi.
- **Oznaczanie serii jako nieudanej:**
    - Endpoint: `PATCH /training-sessions/{sessionId}/sets/{setId}/fail?reps={actualReps}`
    - Akcja: Wywoływane po wyborze opcji "nieudana" dla serii (np. po drugim kliknięciu bąbelka lub z menu kontekstowego).
    - Typ żądania: Puste ciało, `actualReps` jako parametr zapytania.
    - Typ odpowiedzi: Zaktualizowany `SessionSetDto` (lub jego część).
    - Działanie: Optymistyczna aktualizacja UI, następnie wywołanie API. Po sukcesie, aktualizacja sygnału `trainingSession`.
- **Dodawanie nowej serii:**
    - Endpoint: `POST /training-sessions/{sessionId}/sets`
    - Akcja: Wywoływane z `AddEditSetDialogComponent` (w trybie 'add').
    - Typ żądania: `CreateSessionSetCommand` (zawierający `training_plan_exercise_id`, `set_index`, `actual_weight`, `actual_reps`, `status: 'PENDING'`). `set_index` musi być obliczony na podstawie danych wejściowych dialogu.
    - Typ odpowiedzi: Nowo utworzony `SessionSetDto`.
    - Działanie: Po sukcesie, aktualizacja sygnału `trainingSession` poprzez dodanie nowej serii.
- **Aktualizacja istniejącej serii (np. zmiana wagi/powtórzeń po fakcie):**
    - Endpoint: `PUT /training-sessions/{sessionId}/sets/{setId}`
    - Akcja: Wywoływane z `AddEditSetDialogComponent` (w trybie 'edit').
    - Typ żądania: `UpdateSessionSetCommand`.
    - Typ odpowiedzi: Zaktualizowany `SessionSetDto`.
    - Działanie: Po sukcesie, aktualizacja `trainingSession`.
- **Zakończenie sesji treningowej:**
    - Endpoint: `POST /training-sessions/{sessionId}/complete`
    - Akcja: Wywoływane po kliknięciu FAB.
    - Typ żądania: Brak (puste ciało).
    - Typ odpowiedzi: Zaktualizowany `TrainingSessionDto` (ze statusem `COMPLETED`).
    - Działanie: Po sukcesie, nawigacja do innego widoku (np. historii treningów) i wyświetlenie komunikatu o sukcesie (`MatSnackBar`).

Serwis API powinien także obsługiwać dodawanie nagłówka autoryzacyjnego do wszystkich żądań.

## 8. Interakcje użytkownika
- **Ładowanie widoku:** Użytkownik przechodzi na `/sessions/:sessionId`. Wyświetlany jest wskaźnik ładowania. Po załadowaniu danych, widoczna jest lista ćwiczeń i ich serie. Jeśli sesja ma status `COMPLETED`, widok jest w trybie "readonly".
- **Kliknięcie bąbelka serii (`SessionSetBubbleComponent`):** Logika obsługi kliknięć z `debounceTime` (np. 300-500ms) przed wysłaniem żądania do API. **Interakcja jest zablokowana, jeśli `isReadonly` jest `true`.**
    - **Stan początkowy/aktualny: `PENDING`**
        - Wygląd: Styl "outline" (np. `mat-stroked-button`), wyświetla `set.expected_reps` (lub `set.display_reps` jeśli `actual_reps` jest `null`).
        - Akcja po kliknięciu: 
            1. UI (optymistycznie): Zmiana statusu na `COMPLETED`, `actual_reps` ustawiane na `set.expected_reps`. Bąbelek wypełnia się kolorem (np. `mat-flat-button` z kolorem sukcesu).
            2. API Call (po debounce): `PATCH /training-sessions/{sessionId}/sets/{setId}/complete`.
            3. Sukces API: Stan potwierdzony. Komunikat (`MatSnackBar`) "Seria ukończona".
            4. Błąd API: Powrót do stanu `FAILED` z `actual_reps = 0`. Komunikat błędu.
    - **Stan aktualny: `COMPLETED`**
        - Wygląd: Styl "wypełniony" (kolor sukcesu), wyświetla `set.actual_reps`.
        - Akcja po kliknięciu:
            1. UI (optymistycznie): `actual_reps` zmniejszane o 1. Status zmienia się na `FAILED`. Kolor bąbelka zmienia się na kolor ostrzeżenia/błędu.
            2. API Call (po debounce): `PATCH /training-sessions/{sessionId}/sets/{setId}/fail?reps={newActualReps}`.
            3. Sukces API: Stan potwierdzony.
            4. Błąd API: Powrót do stanu `COMPLETED` z poprzednią wartością `actual_reps`. Komunikat błędu.
    - **Stan aktualny: `FAILED` z `actual_reps > 0`**
        - Wygląd: Styl "wypełniony" (kolor ostrzeżenia/błędu), wyświetla `set.actual_reps`.
        - Akcja po kliknięciu:
            1. UI (optymistycznie): `actual_reps` zmniejszane o 1. Status pozostaje `FAILED` (chyba że `actual_reps` staje się 0, wtedy patrz niżej).
            2. API Call (po debounce): `PATCH /training-sessions/{sessionId}/sets/{setId}/fail?reps={newActualReps}`.
            3. Sukces API: Stan potwierdzony.
            4. Błąd API: Powrót do poprzedniej wartości `actual_reps` w stanie `FAILED`. Komunikat błędu.
    - **Stan aktualny: `FAILED` z `actual_reps === 0`**
        - Wygląd: Styl "wypełniony" (kolor ostrzeżenia/błędu), wyświetla `0`.
        - Akcja po kliknięciu:
            1. UI (optymistycznie): Zmiana statusu na `PENDING`. `actual_reps` ustawiane na `null` (lub `set.expected_reps` do wyświetlania). Bąbelek wraca do stylu "outline".
            2. API Call (po debounce): `PUT /training-sessions/{sessionId}/sets/{setId}` z payloadem `{ status: 'PENDING', actual_reps: null }`.
            3. Sukces API: Stan potwierdzony.
            4. Błąd API: Powrót do stanu `FAILED` z `actual_reps = 0`. Komunikat błędu.
- **Kliknięcie ikony "+" (dodaj serię) przy ćwiczeniu:** **Interakcja jest zablokowana, jeśli `isReadonly` jest `true`.**
    - Otwiera się `AddEditSetDialogComponent` w trybie 'add'.
    - Dialog może być pre-wypełniony danymi z ostatniej serii tego ćwiczenia lub wartościami domyślnymi.
    - Użytkownik wprowadza dane, klika "Dodaj".
    - Wywoływane jest API `POST .../sets`.
    - Sukces: Dialog zamyka się, nowa seria pojawia się na liście z statusem `PENDING`.
    - Błąd: Komunikat błędu w dialogu lub jako `MatSnackBar`. Dialog pozostaje otwarty.
- **Kliknięcie przycisku "Zakończ sesję" w `SessionTimerComponent`:** Przycisk powinien być nieaktywny lub ukryty, jeśli `isReadonly` jest `true` (sesja już zakończona). `SessionTimerComponent` może sam zarządzać stanem przycisku lub `SessionPageComponent` może kontrolować widoczność/aktywność całego timera/przycisku w trybie readonly.
    - Wyświetlany jest wskaźnik ładowania (np. w `SessionTimerComponent` lub globalnie).
    - Wywoływane jest API `POST .../complete`.
    - Sukces: Użytkownik jest przekierowywany (np. do historii treningów). Wyświetlany komunikat o sukcesie (`MatSnackBar`). Widok tej sesji po powrocie będzie w trybie readonly.
    - Błąd: Wyświetlany komunikat błędu (`MatSnackBar`). Użytkownik pozostaje w widoku.

## 9. Warunki i walidacja
- **`AddEditSetDialogComponent`:**
    - Liczba powtórzeń (`reps` / `actual_reps`): Musi być liczbą całkowitą > 0. Komunikat błędu walidacji formularza Angulara.
    - Waga (`weight` / `actual_weight`): Musi być liczbą >= 0. Komunikat błędu walidacji formularza Angulara.
    - Przycisk "Dodaj"/"Zapisz zmiany" jest nieaktywny, dopóki formularz nie jest poprawny.
- **Oznaczanie serii jako `FAILED`:**
    - Jeśli wymagane jest podanie liczby wykonanych powtórzeń (`reps` w query param), wartość musi być liczbą całkowitą >= 0. Walidacja po stronie klienta przed wysłaniem API.
- **Ogólne:**
    - `sessionId` w URL musi być prawidłowym UUID. Można to sprawdzić w resolverze trasy lub na początku w `SessionPageComponent`. Jeśli nieprawidłowy, przekierowanie na stronę błędu lub listę sesji.
    - Przed próbą zakończenia sesji, można sprawdzić, czy wszystkie serie są w jakimś stanie końcowym (choć API powinno to obsłużyć).

## 10. Obsługa błędów
- **Błąd pobierania danych sesji (`GET /training-sessions/{sessionId}`):**
    - 401 Unauthorized: Przekierowanie na stronę logowania.
    - 404 Not Found: Wyświetlenie komunikatu "Sesja nie znaleziona" i przycisku powrotu.
    - 5xx Server Error: Wyświetlenie generycznego komunikatu "Wystąpił błąd serwera. Spróbuj ponownie później." i ewentualnie przycisku "Spróbuj ponownie".
- **Błędy aktualizacji/dodawania serii (PATCH/POST/PUT):**
    - 400 Bad Request: Wyświetlenie szczegółowego błędu z API jeśli dostępne, w przeciwnym razie "Nieprawidłowe dane". W przypadku dialogu, błąd może być wyświetlony w dialogu.
    - 401 Unauthorized: Przekierowanie na stronę logowania.
    - 404 Not Found: Komunikat "Nie znaleziono elementu do aktualizacji."
    - 5xx Server Error: Generyczny komunikat błędu, cofnij optymistyczną aktualizację.
    - Wszystkie błędy powinny być komunikowane użytkownikowi za pomocą `MatSnackBar` (z odpowiednim kolorem dla błędu/sukcesu).
- **Błąd zakończenia sesji (`POST .../complete`):**
    - Podobnie jak przy aktualizacji serii, wyświetlenie `MatSnackBar` z błędem.
- **Brak połączenia sieciowego:**
    - Wykorzystanie `navigator.onLine` do detekcji.
    - Wyświetlenie globalnego paska informacyjnego "Brak połączenia z internetem. Niektóre funkcje mogą być niedostępne."
    - Akcje wymagające API powinny być zablokowane lub informować o niemożności wykonania.
    - Po przywróceniu połączenia, pasek znika.

## 11. Kroki implementacji

1.  **Przygotowanie środowiska i struktur folderów:**
    *   Utworzenie nowego feature module dla sesji, jeśli jeszcze nie istnieje (np. `src/app/features/sessions`).
    *   Definicja routingu w `sessions.routes.ts` i dodanie go do `app.routes.ts`.
    *   Utworzenie plików dla komponentów w katalogu `src/app/features/sessions/components`: `session-page.component.ts/.html/.scss`, `session-exercise-list.component.ts/...`, itd.
2.  **Implementacja serwisu `SessionService`:**
    *   Dodanie metod do komunikacji z wszystkimi wymaganymi endpointami API (`GET /training-sessions/{id}`, `PATCH /sets/{id}/complete`, `PATCH /sets/{id}/fail`, `POST /sets`, `POST /{id}/complete`, `PUT /sets/{id}`).
    *   Implementacja obsługi błędów i dodawania nagłówka autoryzacji.
3.  **Implementacja `SessionPageComponent`:**
    *   Wstrzyknięcie `ActivatedRoute` do pobrania `sessionId`.
    *   Wstrzyknięcie `SessionService` i `MatDialog`, `MatSnackBar`.
    *   Implementacja logiki pobierania danych sesji przy użyciu sygnałów (`trainingSession`, `isLoading`, `error`, `isReadonly`).
    *   Stworzenie `computed` sygnału `exercisesViewModel` transformującego `TrainingSessionDto`. Logika ta musi:
        *   Grupować `SessionSetDto` według `training_plan_exercise_id`.
        *   Pobrać/zmapować nazwy ćwiczeń (to może wymagać dodatkowego zapytania lub modyfikacji API `GET /training-sessions/{sessionId}`, aby zwracało nazwy ćwiczeń). Nazwy ćwiczeń pobieramy korzystając z `ExerciseService`.
        *   Mapować `SessionSetDto` na `SessionSetViewModel`.
        *   Implementacja metod obsługujących akcje od komponentów dzieci (np. `handleSetStatusChange`, `openAddEditSetDialog`, `handleCompleteSession`), z uwzględnieniem flagi `isReadonly` do blokowania akcji.
        *   Zarządzanie sygnałami `timerResetTrigger` (np. ustawienie na `Date.now()` przy pierwszej interakcji z serią, jeśli sesja nie jest readonly, i na `null` gdy sesja jest zakończona lub nieaktywna) oraz `allExercisesCompleteSignal`.
4.  **Implementacja komponentów prezentacyjnych (`SessionExerciseListComponent`, `SessionExerciseItemComponent`, `SessionSetListComponent`, `SessionSetBubbleComponent`, `CompleteSessionFabComponent`):**
    *   Stworzenie szablonów HTML i stylów SCSS (zgodnie z Tailwind CSS i Angular Material).
    *   Implementacja logiki wyświetlania danych przekazanych przez `@Input()`, w tym `isReadonly`.
    *   Warunkowe renderowanie/dezaktywacja elementów (np. przycisk dodawania serii, bąbelki) na podstawie `isReadonly`.
    *   Emitowanie zdarzeń przez `@Output()`.
    *   Dla `SessionSetBubbleComponent`: dynamiczne klasy CSS w zależności od `set.status`.
5.  **Implementacja `AddEditSetDialogComponent`:**
    *   Stworzenie formularza reaktywnego Angulara.
    *   Implementacja logiki dynamicznego tytułu i tekstu przycisku w zależności od trybu ('add'/'edit').
    *   Implementacja walidacji.
    *   Logika przekazywania danych do `SessionPageComponent` po zamknięciu dialogu, rozróżniając tryb 'add' i 'edit'.
    *   Pre-wypełnianie formularza danymi przekazanymi przy otwieraniu (`setToEdit` dla trybu 'edit', `lastSetForPreFill` dla 'add').
6.  **Połączenie komponentów i obsługa interakcji:**
    *   Przekazywanie danych i zdarzeń między rodzicem a dziećmi.
    *   Przekazanie sygnałów `timerResetTrigger` i `allExercisesCompleteSignal` z `SessionPageComponent` do `SessionTimerComponent` oraz obsługa zdarzenia `sessionCompleted`.
    *   Implementacja logiki optymistycznej aktualizacji UI i obsługi błędów API w `SessionPageComponent`, z uwzględnieniem `isReadonly`.
    *   Wyświetlanie wskaźników ładowania (`isSetUpdating`, `isLoading`).
7.  **Styling i UX:**
    *   Dopracowanie wyglądu zgodnie z makietami/wymaganiami.
    *   Zapewnienie czytelnych informacji zwrotnych dla użytkownika (`MatSnackBar`).
    *   Testowanie responsywności.
8.  **Testowanie:**
    *   Testy jednostkowe dla logiki serwisów i komponentów (szczególnie `SessionPageComponent` i transformacji danych).
    *   Testy manualne przepływów użytkownika.
9. **Refaktoryzacja i finalizacja:**
    * Przegląd kodu, optymalizacja.
    * Upewnienie się, że wszystkie wymagania PRD i User Stories są spełnione. 
