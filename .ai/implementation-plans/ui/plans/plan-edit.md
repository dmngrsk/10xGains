# Plan implementacji widoku: Edytor Planu Treningowego

## 1. Przegląd
Widok "Edytor Planu Treningowego" umożliwia użytkownikom tworzenie lub modyfikowanie istniejących planów treningowych. Użytkownicy mogą zarządzać metadanymi planu (nazwa, opis), dodawać, usuwać, edytować i zmieniać kolejność dni treningowych w ramach planu, a także dodawać, usuwać, edytować (parametry takie jak serie, powtórzenia, ciężar) i zmieniać kolejność ćwiczeń w poszczególnych dniach. Widok wykorzystuje komponenty Angular Material, w tym `MatAccordion` i `MatExpansionPanel` do organizacji dni, `CDK DragDrop` do zmiany kolejności oraz `MatDialog` do formularzy dodawania/edycji. Zmiany są zapisywane w czasie rzeczywistym za pomocą wywołań PATCH do API.

## 2. Routing widoku
Widok będzie dostępny pod następującymi ścieżkami:
- `/plans/:planId/edit`
- `/plans/create`
`planId` to identyfikator istniejącego planu treningowego. Dodajemy również dedykowaną ścieżkę `/plans/create` do tworzenia nowego planu, co wymagałoby początkowego zapisu planu (np. po wprowadzeniu nazwy) w celu uzyskania rzeczywistego `planId`. Jednak główny nacisk kładziony jest na edycję istniejącego planu.

## 3. Struktura komponentów
```
PlanEditComponent (@Component)
│
├── Formularz metadanych planu (nazwa, opis)
│   ├── MatInput (nazwa planu)
│   └── MatInput (opis planu)
│
├── PlanDayListComponent (@Component)
│   ├── Button (Dodaj Dzień) -> otwiera AddEditDayDialogComponent
│   └── MatAccordion (cdkDropList dla dni)
│       └── * @for day of days; track day.id
│           └── PlanDayItemComponent (@Component, MatExpansionPanel, cdkDrag)
│               ├── MatExpansionPanelHeader (cdkDragHandle)
│               │   ├── Input (nazwa dnia)
│               │   └── Button (Usuń Dzień)
│               └── Panel Content
│                   ├── Input (opis dnia)
│                   ├── PlanExerciseListComponent (@Component)
│                   │   ├── Button (Dodaj Ćwiczenie) -> otwiera AddEditExerciseDialogComponent
│                   │   └── Div (cdkDropList dla ćwiczeń)
│                   │       └── * @for exercise of exercises; track exercise.id
│                   │           └── PlanExerciseItemComponent (@Component, cdkDrag)
│                   │               ├── Nazwa ćwiczenia (cdkDragHandle)
│                   │               ├── Button (Usuń Ćwiczenie)
│                   │               └── PlanExerciseSetListComponent (@Component)
│                   │                   ├── Button (Dodaj Serię) -> otwiera AddEditSetDialogComponent / inline
│                   │                   └── * @for set of sets; track set.id
│                   │                       └── PlanExerciseSetItemComponent (@Component) / inline inputs
│                   │                           ├── Input (powtórzenia)
│                   │                           ├── Input (ciężar)
│                   │                           └── Button (Usuń Serię)
│                   └── MatSnackBar (do wyświetlania błędów)

Dialogi (Standalone Components, w osobnym katalogu ./dialogs):
- AddEditDayDialogComponent
- AddEditExerciseDialogComponent (z MatAutocomplete dla globalnych ćwiczeń + opcja "Dodaj nowe ćwiczenie")
- AddEditSetDialogComponent
```

## 4. Szczegóły komponentów

### `PlanEditComponent` (Komponent trasowany)
- **Opis komponentu**: Główny kontener edytora planu. Odpowiedzialny za pobranie danych planu na podstawie `:planId` z URL, zarządzanie edycją metadanych planu (nazwa, opis) oraz koordynację komponentów podrzędnych dla dni i ćwiczeń.
- **Główne elementy**: Pola `MatInput` dla nazwy i opisu planu, komponent `PlanDayListComponent`.
- **Obsługiwane interakcje**:
    - Edycja nazwy/opisu planu (z debouncingiem i zapisem PATCH).
    - Ładowanie danych planu przy inicjalizacji.
    - Zarządzanie stanem ładowania i błędów.
- **Obsługiwana walidacja**:
    - Nazwa planu: wymagana.
- **Typy**:
    - DTO: `TrainingPlanDto`, `UpdateTrainingPlanCommand`
    - ViewModel: `PlanEditorState` (z sygnałami dla `plan`, `isLoading`, `error`, `planName`, `planDescription`, `globalExercises`)
- **Propsy**: Brak (komponent trasowany, pobiera `planId` z `ActivatedRoute`).

### `PlanDayListComponent`
- **Opis komponentu**: Wyświetla listę dni treningowych (`MatAccordion > MatExpansionPanel`). Umożliwia dodawanie nowych dni i zmianę kolejności istniejących dni za pomocą `CDK DragDrop`.
- **Główne elementy**: Przycisk "Dodaj Dzień", `MatAccordion` z dyrektywą `cdkDropList`, iteracja po `PlanDayItemComponent`.
- **Obsługiwane interakcje**:
    - Kliknięcie "Dodaj Dzień" -> otwarcie `AddEditDayDialogComponent`.
    - Przeciągnięcie i upuszczenie dnia (`cdkDropListDropped`) -> aktualizacja kolejności dni i wywołanie API (`PATCH .../days/{dayId}/reorder`).
- **Obsługiwana walidacja**: Brak specyficznej dla listy; walidacja poszczególnych dni w `PlanDayItemComponent` lub dialogu.
- **Typy**:
    - DTO: `TrainingPlanDayDto[]`
- **Propsy**:
    - `planId: string`
    - `days: WritableSignal<TrainingPlanDayDto[]>` (lub podobny reaktywny typ)

### `PlanDayItemComponent`
- **Opis komponentu**: Reprezentuje pojedynczy dzień w planie wewnątrz `MatExpansionPanel`. Wyświetla nazwę i opis dnia (edywowalne), zawiera listę ćwiczeń (`PlanExerciseListComponent`). Umożliwia usunięcie dnia i dodanie do niego ćwiczeń.
- **Główne elementy**: `MatExpansionPanelHeader` z edytowalną nazwą dnia i przyciskiem usuwania. W treści panelu edytowalny opis dnia oraz `PlanExerciseListComponent` i przycisk "Dodaj Ćwiczenie".
- **Obsługiwane interakcje**:
    - Edycja nazwy/opisu dnia (z debouncingiem i zapisem PATCH `PUT .../days/{dayId}`).
    - Kliknięcie "Usuń Dzień" -> potwierdzenie i wywołanie API (`DELETE .../days/{dayId}`).
    - Kliknięcie "Dodaj Ćwiczenie" -> otwarcie `AddEditExerciseDialogComponent`.
- **Obsługiwana walidacja**:
    - Nazwa dnia: wymagana.
- **Typy**:
    - DTO: `TrainingPlanDayDto`
- **Propsy**:
    - `planId: string`
    - `day: WritableSignal<TrainingPlanDayDto>` (lub `TrainingPlanDayDto` jeśli rodzic zarządza całym arrayem)
    - `globalExercises: Signal<ExerciseDto[]>` (przekazane do dialogu dodawania ćwiczeń)

### `PlanExerciseListComponent`
- **Opis komponentu**: Wyświetla listę ćwiczeń dla konkretnego dnia. Umożliwia dodawanie nowych ćwiczeń i zmianę kolejności istniejących ćwiczeń za pomocą `CDK DragDrop`.
- **Główne elementy**: Przycisk "Dodaj Ćwiczenie" (może być w `PlanDayItemComponent`), kontener `div` z dyrektywą `cdkDropList`, iteracja po `PlanExerciseItemComponent`.
- **Obsługiwane interakcje**:
    - Przeciągnięcie i upuszczenie ćwiczenia (`cdkDropListDropped`) -> aktualizacja kolejności i wywołanie API (`PATCH .../exercises/{exerciseId}/reorder`).
    - (Obsługa dodawania ćwiczeń delegowana do rodzica/dialogu).
- **Obsługiwana walidacja**: Brak specyficznej dla listy.
- **Typy**:
    - DTO: `TrainingPlanExerciseDto[]` (ćwiczenia dla danego dnia)
- **Propsy**:
    - `planId: string`
    - `dayId: string`
    - `exercises: WritableSignal<TrainingPlanExerciseDto[]>`
    - `globalExercises: Signal<ExerciseDto[]>`

### `PlanExerciseItemComponent`
- **Opis komponentu**: Reprezentuje pojedyncze ćwiczenie w ramach dnia. Wyświetla nazwę ćwiczenia (pobraną z globalnej definicji `ExerciseDto`) oraz komponent `PlanExerciseSetListComponent` do zarządzania seriami. Umożliwia usunięcie ćwiczenia z dnia.
- **Główne elementy**: Wyświetlanie nazwy ćwiczenia, przycisk "Usuń Ćwiczenie", `PlanExerciseSetListComponent`.
- **Obsługiwane interakcje**:
    - Kliknięcie "Usuń Ćwiczenie" -> potwierdzenie i wywołanie API (`DELETE .../days/{dayId}/exercises/{trainingPlanExerciseId}`).
    - Rozwijanie/zwijanie szczegółów ćwiczenia (jeśli jest taka potrzeba, np. aby leniwie ładować serie).
- **Obsługiwana walidacja**: Walidacja serii w `PlanExerciseSetListComponent`.
- **Typy**:
    - DTO: `TrainingPlanExerciseDto`, `ExerciseDto` (dla nazwy/opisu), `TrainingPlanExerciseSetDto[]`
- **Propsy**:
    - `planId: string`
    - `dayId: string`
    - `planExercise: WritableSignal<TrainingPlanExerciseDto>` (lub `TrainingPlanExerciseDto`)
    - `resolvedExerciseName: Signal<string>`

### `PlanExerciseSetListComponent`
- **Opis komponentu**: Wyświetla listę serii dla konkretnego ćwiczenia. Umożliwia dodawanie, edycję i usuwanie serii.
- **Główne elementy**: Przycisk "Dodaj Serię", lista komponentów `PlanExerciseSetItemComponent` (lub edytowalne pola inline).
- **Obsługiwane interakcje**:
    - Kliknięcie "Dodaj Serię" -> otwarcie `AddEditSetDialogComponent` lub dodanie nowej edytowalnej serii inline.
    - Edycja liczby powtórzeń/ciężaru w serii (z debouncingiem i zapisem PATCH `PUT .../sets/{setId}`).
    - Usunięcie serii -> potwierdzenie i wywołanie API (`DELETE .../sets/{setId}`).
- **Obsługiwana walidacja**: (w `PlanExerciseSetItemComponent` lub dialogu)
    - Powtórzenia: wymagane, liczba dodatnia.
    - Ciężar: wymagany, liczba dodatnia.
- **Typy**:
    - DTO: `TrainingPlanExerciseSetDto[]`
- **Propsy**:
    - `planId: string`
    - `dayId: string`
    - `trainingPlanExerciseId: string`
    - `sets: WritableSignal<TrainingPlanExerciseSetDto[]>`

### `PlanExerciseSetItemComponent` (lub pola inline w `PlanExerciseSetListComponent`)
- **Opis komponentu**: Reprezentuje pojedynczą serię ćwiczenia. Zawiera pola do edycji liczby powtórzeń i ciężaru.
- **Główne elementy**: `MatInput` dla powtórzeń, `MatInput` dla ciężaru, przycisk "Usuń Serię".
- **Obsługiwane interakcje**:
    - Edycja wartości powtórzeń/ciężaru.
    - Kliknięcie "Usuń Serię".
- **Obsługiwana walidacja**:
    - Powtórzenia: wymagane, `Validators.required`, `Validators.min(1)`.
    - Ciężar: wymagany, `Validators.required`, `Validators.min(0.01)`.
- **Typy**:
    - DTO: `TrainingPlanExerciseSetDto`
- **Propsy**:
    - `set: WritableSignal<TrainingPlanExerciseSetDto>` (lub `TrainingPlanExerciseSetDto`)
    - Kontekstowe ID (`planId`, `dayId`, `trainingPlanExerciseId`, `setId`) do wywołań API.

### `AddEditDayDialogComponent` (w katalogu `/dialogs`)
- **Opis komponentu**: Dialog Angular Material do dodawania lub edycji dnia treningowego (nazwa, opis).
- **Główne elementy**: Formularz z polami `MatInput` dla nazwy i opisu dnia, przyciski "Zapisz" i "Anuluj".
- **Obsługiwane interakcje**: Wprowadzanie danych, zapis, anulowanie.
- **Obsługiwana walidacja**: Nazwa dnia: wymagana.
- **Typy**: `TrainingPlanDayDto`, `CreateTrainingPlanDayCommand`, `UpdateTrainingPlanDayCommand`.
- **Propsy**: `data: { day?: TrainingPlanDayDto, planId: string }` (przekazane przez `MatDialog.open`). Zwraca `TrainingPlanDayDto | null`.

### `AddEditExerciseDialogComponent` (w katalogu `/dialogs`)
- **Opis komponentu**: Dialog do dodawania ćwiczenia do dnia. Używa `MatAutocomplete` do wyszukiwania istniejących globalnych ćwiczeń. Zawiera opcję "Dodaj nowe ćwiczenie", która może otworzyć kolejny mały formularz/dialog do zdefiniowania nowego globalnego ćwiczenia.
- **Główne elementy**: `MatAutocomplete` (z listą `ExerciseDto`), opcjonalny formularz do tworzenia nowego globalnego ćwiczenia.
- **Obsługiwane interakcje**: Wyszukiwanie i wybór ćwiczenia, tworzenie nowego globalnego ćwiczenia.
- **Obsługiwana walidacja**: Jeśli tworzone jest nowe globalne ćwiczenie: nazwa ćwiczenia wymagana.
- **Typy**: `TrainingPlanExerciseDto`, `CreateTrainingPlanExerciseCommand`, `ExerciseDto`, `CreateExerciseCommand`.
- **Propsy**: `data: { planId: string, dayId: string, globalExercises: ExerciseDto[] }`. Zwraca `string` (ID wybranego/stworzonego globalnego ćwiczenia) lub `null`.

### `AddEditSetDialogComponent` (w katalogu `/dialogs`)
- **Opis komponentu**: Dialog do dodawania lub edycji serii ćwiczenia (liczba powtórzeń, ciężar).
- **Główne elementy**: Formularz z polami `MatInput` dla powtórzeń i ciężaru.
- **Obsługiwane interakcje**: Wprowadzanie danych, zapis, anulowanie.
- **Obsługiwana walidacja**: Powtórzenia i ciężar: wymagane, liczby dodatnie.
- **Typy**: `TrainingPlanExerciseSetDto`, `CreateTrainingPlanExerciseSetCommand`, `UpdateTrainingPlanExerciseSetCommand`.
- **Propsy**: `data: { set?: TrainingPlanExerciseSetDto, planId: string, dayId: string, trainingPlanExerciseId: string }`. Zwraca `TrainingPlanExerciseSetDto | null`.

## 5. Typy
Główne typy DTO pochodzą z `src/app/shared/api/api.types.ts`:
- `UserProfileDto`, `UpsertUserProfileCommand`
- `TrainingPlanDto`, `CreateTrainingPlanCommand`, `UpdateTrainingPlanCommand`
- `TrainingPlanDayDto`, `CreateTrainingPlanDayCommand`, `UpdateTrainingPlanDayCommand`, `ReorderTrainingPlanDayCommand`
- `ExerciseDto`, `CreateExerciseCommand`, `UpdateExerciseCommand`
- `TrainingPlanExerciseDto`, `CreateTrainingPlanExerciseCommand`, `UpdateTrainingPlanExerciseCommand`
- `TrainingPlanExerciseSetDto`, `CreateTrainingPlanExerciseSetCommand`, `UpdateTrainingPlanExerciseSetCommand`

**Niestandardowe typy ViewModel (interfejsy / typy dla stanu komponentu lub rozszerzonej prezentacji danych, zarządzane przez Angular Signals):**

1.  **`PlanEditorState`**:
    ```typescript
    interface PlanEditorState {
      isLoadingPlan: Signal<boolean>;
      isLoadingGlobalExercises: Signal<boolean>;
      error: Signal<string | null>;
      plan: WritableSignal<TrainingPlanDto | null>;
      globalExercises: WritableSignal<ExerciseDto[]>;
      planName: WritableSignal<string>; // Dla dwukierunkowego bindowania z polem nazwy planu
      planDescription: WritableSignal<string | null>; // Dla opisu planu
    }
    ```
    - `isLoadingPlan`: `boolean`, wskazuje, czy dane planu są ładowane.
    - `isLoadingGlobalExercises`: `boolean`, wskazuje, czy globalne ćwiczenia są ładowane.
    - `error`: `string | null`, przechowuje komunikaty o błędach.
    - `plan`: `TrainingPlanDto | null`, główny obiekt planu treningowego. Pola `days` w `TrainingPlanDto` mogą zawierać zagnieżdżone `exercises`. Serie (`TrainingPlanExerciseSetDto`) będą prawdopodobnie ładowane osobno dla każdego `TrainingPlanExerciseDto`.
    - `globalExercises`: `ExerciseDto[]`, lista globalnych ćwiczeń do użycia w autouzupełnianiu.
    - `planName`: `string`, nazwa edytowanego planu.
    - `planDescription`: `string | null`, opis edytowanego planu.

2.  **Mapy do przechowywania zagnieżdżonych, dynamicznie ładowanych danych (jeśli serie nie są częścią początkowego `TrainingPlanDto`):**
    ```typescript
    // W PlanEditComponent lub dedykowanym serwisie stanu widoku
    // Klucz: day.id (string), Wartość: sygnał z tablicą ćwiczeń dla danego dnia
    exercisesForDayMap: Map<string, WritableSignal<TrainingPlanExerciseDto[]>>;

    // Klucz: trainingPlanExercise.id (string), Wartość: sygnał z tablicą serii dla danego ćwiczenia
    setsForExerciseMap: Map<string, WritableSignal<TrainingPlanExerciseSetDto[]>>;

    // Klucz: global exercise.id (string), Wartość: nazwa ćwiczenia (do wyświetlania)
    resolvedExerciseDetailsMap: Map<string, Pick<ExerciseDto, 'name' | 'description'>>;
    ```
    Te mapy pomogą zarządzać stanem list ćwiczeń i serii, które mogą być ładowane na żądanie (np. po rozwinięciu panelu dnia lub ćwiczenia).

Należy pamiętać, że `TrainingPlanDto` może już zawierać zagnieżdżone `days` (które zawierają `exercises`). Serie (`TrainingPlanExerciseSetDto`) dla każdego `TrainingPlanExerciseDto` będą pobierane oddzielnie, np. przy rozwijaniu panelu ćwiczenia, i zarządzane za pomocą `setsForExerciseMap` lub podobnego mechanizmu.

## 6. Zarządzanie stanem
Stan widoku będzie zarządzany głównie za pomocą Angular Signals.

- **`PlanEditComponent`**:
    - Przechowuje główny stan edytora, w tym załadowany `TrainingPlanDto` (`plan = signal<TrainingPlanDto | null>(null)`), stan ładowania (`isLoading = signal(true)`), błędy (`error = signal(null)`), oraz listę globalnych ćwiczeń (`globalExercises = signal<ExerciseDto[]>([])`).
    - Nazwa i opis planu będą powiązane z osobnymi sygnałami (`planName`, `planDescription`), aby umożliwić łatwą edycję i debouncowane aktualizacje API.
    - Zmiany w zagnieżdżonych strukturach (dni, ćwiczenia, serie) będą aktualizować odpowiednie części głównego sygnału `plan` lub dedykowanych map (`exercisesForDayMap`, `setsForExerciseMap`). Użycie `mutate` na sygnałach tablicowych lub tworzenie nowych instancji tablic/obiektów w celu wywołania aktualizacji.
- **Komponenty podrzędne**:
    - Otrzymują dane (lub sygnały z danymi) od komponentów nadrzędnych poprzez `@Input()`.
    - Emitują zdarzenia (`@Output()`) w celu poinformowania rodzica o konieczności modyfikacji stanu lub wywołania API.
    - Zmiany (np. dodanie, usunięcie, zmiana kolejności) są najpierw odzwierciedlane w lokalnym stanie (sygnałach), a następnie propagowane do API. Można zastosować podejście optymistycznego UI, gdzie UI jest aktualizowane natychmiast, a następnie synchronizowane z serwerem.
- **Dialogi**: Otrzymują dane przez `MAT_DIALOG_DATA`, a po zamknięciu zwracają wynik, który jest używany do aktualizacji stanu w komponencie wywołującym.
- **Brak niestandardowych hooków (custom hooks)**: Standardowe mechanizmy Angular (serwisy, sygnały, `inject`) powinny być wystarczające. Logika transformacji danych może znajdować się w metodach komponentów lub w serwisie `PlanService`.

## 7. Integracja API
Integracja z API będzie realizowana poprzez rozszerzenie istniejącego `PlanService` (`src/app/features/plans/services/plan.service.ts`) o nowe metody. Wszystkie metody powinny zwracać `Observable<PlanServiceResponse>` lub podobny typ, obsługując błędy zgodnie z istniejącym wzorcem.

**Kluczowe punkty końcowe i odpowiadające im metody w `PlanService`**:

1.  **Plan Treningowy**:
    - `GET /training-plans/{planId}` -> `planService.getPlan(planId: string)`
      - Odpowiedź: `TrainingPlanDto` (z zagnieżdżonymi `days` i `exercises`, ale bez serii).
    - `PUT /training-plans/{planId}` -> `planService.updatePlan(planId: string, payload: UpdateTrainingPlanCommand)`
      - Żądanie: `UpdateTrainingPlanCommand` (`{ name, description }`)
      - Odpowiedź: `TrainingPlanDto` (zaktualizowany plan)

2.  **Dni Planu Treningowego**:
    - `POST /training-plans/{planId}/days` -> `planService.createPlanDay(planId: string, payload: CreateTrainingPlanDayCommand)`
      - Żądanie: `CreateTrainingPlanDayCommand` (`{ name, description, order_index }`)
      - Odpowiedź: `TrainingPlanDayDto`
    - `PUT /training-plans/{planId}/days/{dayId}` -> `planService.updatePlanDay(planId: string, dayId: string, payload: UpdateTrainingPlanDayCommand)`
      - Żądanie: `UpdateTrainingPlanDayCommand` (`{ name, description, order_index }`)
      - Odpowiedź: `TrainingPlanDayDto`
    - `DELETE /training-plans/{planId}/days/{dayId}` -> `planService.deletePlanDay(planId: string, dayId: string)`
      - Odpowiedź: `204 No Content`
    - `PATCH /training-plans/{planId}/days/{dayId}/reorder` -> `planService.reorderPlanDay(planId: string, dayId: string, payload: ReorderTrainingPlanDayCommand)`
      - Żądanie: `ReorderTrainingPlanDayCommand` (`{ order_index }`)
      - Odpowiedź: Zaktualizowany `TrainingPlanDayDto` (lub tylko `{id, order_index}`)

3.  **Ćwiczenia Globalne**:
    - `GET /exercises` -> `planService.getGlobalExercises()`
      - Odpowiedź: `ExerciseDto[]`
    - `POST /exercises` -> `planService.createGlobalExercise(payload: CreateExerciseCommand)`
      - Żądanie: `CreateExerciseCommand` (`{ name, description }`)
      - Odpowiedź: `ExerciseDto`

4.  **Ćwiczenia Planu Treningowego (w ramach dnia)**:
    - `POST /training-plans/{planId}/days/{dayId}/exercises` -> `planService.createPlanExercise(planId: string, dayId: string, payload: CreateTrainingPlanExerciseCommand)`
      - Żądanie: `CreateTrainingPlanExerciseCommand` (`{ exercise_id, order_index }`) (`exercise_id` to ID z globalnej tabeli `exercises`)
      - Odpowiedź: `TrainingPlanExerciseDto`
    - `DELETE /training-plans/{planId}/days/{dayId}/exercises/{trainingPlanExerciseId}` -> `planService.deletePlanExercise(planId: string, dayId: string, trainingPlanExerciseId: string)`
      - (`trainingPlanExerciseId` to ID z tabeli `training_plan_exercises`)
      - Odpowiedź: `204 No Content`
    - `PATCH /training-plans/{planId}/days/{dayId}/exercises/{trainingPlanExerciseId}/reorder` -> `planService.reorderPlanExercise(planId: string, dayId: string, trainingPlanExerciseId: string, payload: ReorderTrainingPlanExerciseCommand)`
      - Żądanie: `ReorderTrainingPlanExerciseCommand` (`{ order_index }`)
      - Odpowiedź: Zaktualizowany `TrainingPlanExerciseDto` (lub tylko `{id, order_index}`)

5.  **Serie Ćwiczeń Planu Treningowego**:
    - `GET /training-plans/{planId}/days/{dayId}/exercises/{trainingPlanExerciseId}/sets` -> `planService.getPlanExerciseSets(planId: string, dayId: string, trainingPlanExerciseId: string)`
      - Odpowiedź: `TrainingPlanExerciseSetDto[]`
    - `POST /training-plans/{planId}/days/{dayId}/exercises/{trainingPlanExerciseId}/sets` -> `planService.createPlanExerciseSet(planId: string, dayId: string, trainingPlanExerciseId: string, payload: CreateTrainingPlanExerciseSetCommand)`
      - Żądanie: `CreateTrainingPlanExerciseSetCommand` (`{ set_index, expected_reps, expected_weight }`)
      - Odpowiedź: `TrainingPlanExerciseSetDto`
    - `PUT /training-plans/{planId}/days/{dayId}/exercises/{trainingPlanExerciseId}/sets/{setId}` -> `planService.updatePlanExerciseSet(planId: string, dayId: string, trainingPlanExerciseId: string, setId: string, payload: UpdateTrainingPlanExerciseSetCommand)`
      - Żądanie: `UpdateTrainingPlanExerciseSetCommand` (`{ set_index, expected_reps, expected_weight }`)
      - Odpowiedź: `TrainingPlanExerciseSetDto`
    - `DELETE /training-plans/{planId}/days/{dayId}/exercises/{trainingPlanExerciseId}/sets/{setId}` -> `planService.deletePlanExerciseSet(planId: string, dayId: string, trainingPlanExerciseId: string, setId: string)`
      - Odpowiedź: `204 No Content`

Wszystkie metody `PlanService` powinny wewnętrznie używać `SupabaseService.client` do interakcji z Supabase, mapując operacje na odpowiednie zapytania `.from().select()...`, `.insert()`, `.update()`, `.delete()`.

## 8. Interakcje użytkownika
- **Ładowanie widoku**: Użytkownik przechodzi na `/plans/:planId/edit`. Wyświetlany jest spinner ładowania. Dane planu są pobierane. Nazwa i opis planu wypełniają pola formularza. Lista dni jest wyświetlana.
- **Edycja nazwy/opisu planu**: Użytkownik modyfikuje tekst w polach nazwy lub opisu planu. Po krótkiej chwili (debouncing) zmiana jest automatycznie zapisywana (PATCH). UI wskazuje stan zapisu.
- **Dodawanie dnia**: Użytkownik klika "Dodaj Dzień". Otwiera się dialog. Użytkownik wprowadza nazwę (i opcjonalnie opis), klika "Zapisz". Dialog zamyka się, nowy dzień pojawia się na końcu listy dni w UI i jest zapisywany w API.
- **Edycja dnia**: Użytkownik rozwija panel dnia i modyfikuje jego nazwę lub opis w polach inline. Zmiany są automatycznie zapisywane (PATCH z debouncingiem).
- **Usuwanie dnia**: Użytkownik klika ikonę usuwania przy dniu. Pojawia się dialog potwierdzający. Po potwierdzeniu dzień jest usuwany z UI i API.
- **Zmiana kolejności dni**: Użytkownik przeciąga panel dnia w inne miejsce na liście dni. UI natychmiast odzwierciedla nową kolejność. Wywoływane jest API (PATCH) w celu zapisania nowej kolejności (`order_index`) dla zmienionych dni.
- **Dodawanie ćwiczenia do dnia**: Użytkownik klika "Dodaj Ćwiczenie" w panelu dnia. Otwiera się dialog. Użytkownik może wybrać ćwiczenie z listy (`MatAutocomplete` zasilane globalnymi ćwiczeniami) lub wybrać opcję "Dodaj nowe ćwiczenie".
    - Jeśli wybrano istniejące: dialog zamyka się, ćwiczenie jest dodawane do dnia w UI i API.
    - Jeśli wybrano "Dodaj nowe": Pojawia się formularz/dialog do wprowadzenia nazwy (i opisu) nowego globalnego ćwiczenia. Po zapisie, nowe globalne ćwiczenie jest tworzone w API, a następnie dodawane do bieżącego dnia w UI i API.
- **Usuwanie ćwiczenia z dnia**: Użytkownik klika ikonę usuwania przy ćwiczeniu. Dialog potwierdzający. Ćwiczenie jest usuwane z dnia w UI i API.
- **Zmiana kolejności ćwiczeń**: Użytkownik przeciąga ćwiczenie w inne miejsce na liście ćwiczeń danego dnia. UI natychmiast odzwierciedla nową kolejność. Wywoływane jest API (PATCH) w celu zapisania nowej kolejności (`order_index`).
- **Dodawanie serii do ćwiczenia**: Użytkownik klika "Dodaj Serię" pod listą serii danego ćwiczenia. Pojawia się nowa edytowalna seria (lub otwiera dialog). Użytkownik wprowadza liczbę powtórzeń i ciężar. Seria jest zapisywana w API.
- **Edycja serii**: Użytkownik modyfikuje liczbę powtórzeń lub ciężar w istniejącej serii. Zmiany są automatycznie zapisywane (PATCH z debouncingiem).
- **Usuwanie serii**: Użytkownik klika ikonę usuwania przy serii. Dialog potwierdzający. Seria jest usuwana z UI i API.

## 9. Warunki i walidacja
- **Ogólne**: Wszystkie operacje wymagają zalogowanego użytkownika (obsługa przez guard na trasie).
- **Nazwa planu**: Wymagana (`Validators.required`). Komunikat o błędzie przy próbie zapisu pustej nazwy.
- **Nazwa dnia**: Wymagana (`Validators.required`).
- **Nazwa globalnego ćwiczenia (przy tworzeniu nowego)**: Wymagana.
- **Serie (powtórzenia i ciężar)**:
    - `expected_reps`: Wymagane, liczba całkowita > 0 (`Validators.required`, `Validators.min(1)`).
    - `expected_weight`: Wymagane, liczba > 0 (`Validators.required`, `Validators.min(0.01)`).
- Komunikaty o błędach walidacji powinny być wyświetlane bezpośrednio przy polach formularzy (`MatError`) lub jako `MatSnackBar` w przypadku błędów API.
- Przyciski zapisu w dialogach powinny być nieaktywne, jeśli formularz jest niepoprawny.
- Logika `order_index` i `set_index` jest zarządzana automatycznie przez komponenty list (przy dodawaniu, usuwaniu, zmianie kolejności).

## 10. Obsługa błędów
- **Błędy sieciowe / API niedostępne**: Wyświetlenie `MatSnackBar` z ogólnym komunikatem (np. "Błąd połączenia. Spróbuj ponownie później.").
- **Błędy walidacji API (400 Bad Request)**: Wyświetlenie `MatSnackBar` z komunikatem błędu zwróconym przez API (jeśli jest dostępny i zrozumiały dla użytkownika) lub ogólnym komunikatem.
- **Brak autoryzacji (401 Unauthorized)**: Globalny interceptor HTTP powinien przekierować do strony logowania.
- **Brak uprawnień (403 Forbidden)**: Wyświetlenie `MatSnackBar` (np. "Brak uprawnień do wykonania tej operacji.").
- **Nie znaleziono zasobu (404 Not Found)**:
    - Jeśli `planId` jest nieprawidłowy przy ładowaniu: `PlanEditComponent` wyświetla komunikat "Nie znaleziono planu" i ewentualnie opcję powrotu.
    - Jeśli zasób podrzędny (dzień, ćwiczenie, seria) nie zostanie znaleziony podczas operacji (np. usunięty w innej sesji): UI powinno usunąć element i wyświetlić `MatSnackBar` z informacją.
- **Błędy po stronie serwera (500 Internal Server Error)**: Wyświetlenie `MatSnackBar` z ogólnym komunikatem o błędzie serwera.
- **Stan wyścigu / Konflikty edycji**: Dla "real-time PATCH calls", ryzyko jest mniejsze, ale jeśli operacja się nie powiedzie z powodu konfliktu, należy poinformować użytkownika i ewentualnie odświeżyć dane. Prostszym podejściem jest "last write wins".
- Wszystkie wywołania API w `PlanService` powinny używać `catchError` z RxJS do przechwytywania błędów i zwracania ich w ustandaryzowany sposób, który komponenty mogą łatwo obsłużyć i wyświetlić.

## 11. Kroki implementacji

1.  **Utworzenie struktury folderów i plików**:
    - W `src/app/features/plans/components` utwórz folder `plan-edit` (lub podobny, jeśli plany są częścią szerszej funkcji, np. `plans`).
    - Utwórz główny komponent `PlanEditComponent`.
    - Zdefiniuj trasy `/plans/:planId/edit` oraz `/plans/create` w `plans.routes.ts` i załaduj je leniwie w głównym `app.routes.ts`.
    - Utwórz podstawowe pliki dla komponentów podrzędnych (początkowo mogą być puste lub z minimalną zawartością): `PlanDayListComponent`, `PlanDayItemComponent`, `PlanExerciseListComponent`, `PlanExerciseItemComponent`, `PlanExerciseSetListComponent`, `PlanExerciseSetItemComponent` (lub zdecyduj o inline editing dla serii).
    - Utwórz komponenty dialogów: `AddEditDayDialogComponent`, `AddEditExerciseDialogComponent`, `AddEditSetDialogComponent`.

2.  **Implementacja `PlanService` oraz rozszerzenie wspólnego `ExerciseService`**:
    - Dodaj nowe metody do `plan.service.ts` dla wszystkich wymaganych operacji CRUD i reorder dla planów, dni, ćwiczeń planu i serii ćwiczeń.
    - Dodaj nowe metody dla globalnych ćwiczeń w `exercise.service.ts` (GET, POST). Serwis ten znajduje się w katalogu `/shared`.
    - Upewnij się, że każda metoda poprawnie używa `SupabaseService` i obsługuje błędy.

3.  **Implementacja `PlanEditComponent`**:
    - Wstrzyknij `ActivatedRoute` do pobrania `planId`.
    - Wstrzyknij `PlanService` i `MatDialog`, `MatSnackBar`.
    - Zaimplementuj logikę pobierania danych planu (`planService.getPlan(planId)`) przy inicjalizacji.
    - Zarządzaj stanem za pomocą sygnałów (`plan`, `isLoading`, `error`, `planName`, `planDescription`). Do pobierania listy wszystkich ćwiczeń użyj `ExerciseService`.
    - Zaimplementuj formularz edycji nazwy i opisu planu z zapisem (debounced service call).
    - Zintegruj `PlanDayListComponent`.

4.  **Implementacja `PlanDayListComponent` i `PlanDayItemComponent`**:
    - `PlanDayListComponent`: Wyświetlanie listy dni, obsługa przycisku "Dodaj Dzień" (otwieranie `AddEditDayDialogComponent`).
    - Zaimplementuj `CDK DragDrop` dla zmiany kolejności dni. Po `drop` zaktualizuj `order_index` i wywołaj `planService.reorderPlanDay` dla każdego zmienionego dnia.
    - `PlanDayItemComponent`: Wyświetlanie szczegółów dnia, edycja nazwy/opisu (inline, debounced PATCH), obsługa usuwania dnia (z potwierdzeniem i wywołaniem `planService.deletePlanDay`). Integracja `PlanExerciseListComponent`.

5.  **Implementacja `AddEditDayDialogComponent`**:
    - Formularz z walidacją dla nazwy i opisu dnia.
    - Po zapisie wywołuje odpowiednio `planService.createPlanDay` lub `planService.updatePlanDay` (w zależności od tego, czy edytujemy, czy tworzymy - komponent nadrzędny decyduje, którą metodę serwisu wywołać na podstawie wyniku dialogu).

6.  **Implementacja `PlanExerciseListComponent` i `PlanExerciseItemComponent`**:
    - Podobnie do dni: wyświetlanie listy ćwiczeń, obsługa dodawania, usuwania, zmiany kolejności (`CDK DragDrop` i `planService.reorderPlanExercise`).
    - `PlanExerciseItemComponent`: Wyświetlanie nazwy ćwiczenia (rozwiązanej z `ExerciseService` na podstawie `planExercise.exercise_id`). Integracja `PlanExerciseSetListComponent`.

7.  **Implementacja `AddEditExerciseDialogComponent`**:
    - `MatAutocomplete` do wyszukiwania i wybierania `ExerciseDto` z `ExerciseService`.
    - Logika "Dodaj nowe ćwiczenie": jeśli użytkownik wybierze tę opcję, otwórz kolejny mały formularz/dialog do wprowadzenia nazwy/opisu nowego globalnego ćwiczenia. Wywołaj `exerciseService.createExercise`.
    - Po wybraniu/stworzeniu ćwiczenia, dialog zwraca ID globalnego ćwiczenia. Komponent nadrzędny używa tego ID do wywołania `planService.createPlanExercise`.

8.  **Implementacja `PlanExerciseSetListComponent` i `PlanExerciseSetItemComponent` (lub edycji inline)**:
    - Wyświetlanie listy serii, obsługa dodawania (`AddEditSetDialogComponent` lub inline), edycji (inline, debounced PATCH `planService.updatePlanExerciseSet`), usuwania (`planService.deletePlanExerciseSet` z potwierdzeniem).
    - Logika pobierania serii dla ćwiczenia (`planService.getPlanExerciseSets`), np. przy rozwijaniu `PlanExerciseItemComponent`.

9.  **Implementacja `AddEditSetDialogComponent` (jeśli używany)**:
    - Formularz z walidacją dla liczby powtórzeń i ciężaru.
    - Po zapisie wywołuje `planService.createPlanExerciseSet` lub `planService.updatePlanExerciseSet`.

10. **Styling i UX**:
    - Dopracuj wygląd zgodnie z Tailwind CSS (tam gdzie to możliwe, nie stylując bezpośrednio komponentów Material) i Angular Material Design 3.
    - Zapewnij płynne działanie drag-and-drop i jasne wskazówki wizualne.
    - Zadbaj o dostępność (ARIA atrybuty, zarządzanie focusem w dialogach).
    - Implementacja informacji zwrotnej dla użytkownika (np. snackbary, spinnery).

11. **Testowanie**:
    - Testy jednostkowe dla logiki komponentów i metod serwisowych.
    - Testy manualne kluczowych przepływów użytkownika.
    - Weryfikacja responsywności (jeśli dotyczy).

12. **Refaktoryzacja i optymalizacja**:
    - Przejrzyj kod pod kątem czytelności, wydajności i zgodności z wytycznymi.
    - Zoptymalizuj liczbę wywołań API, jeśli to konieczne (np. przez mądrzejsze grupowanie lub debouncing).

Ten plan powinien zapewnić solidne podstawy do wdrożenia widoku edytora planu treningowego. 
