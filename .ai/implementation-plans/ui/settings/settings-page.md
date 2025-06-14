# Plan implementacji widoku Ustawienia

## 1. Przegląd
Widok Ustawień (`/settings`) umożliwia zalogowanym użytkownikom edycję podstawowych informacji profilowych (imię) oraz wylogowanie się z aplikacji i zmianę hasła. Wyświetla również informacje tylko do odczytu, takie jak adres e-mail użytkownika i pozostała liczba sugestii AI. Widok ten jest kluczowy dla zarządzania kontem użytkownika i zapewnienia podstawowej personalizacji.

## 2. Routing widoku
Widok Ustawień będzie dostępny pod następującą ścieżką:
- `/settings`

Plik `routes.ts` dla funkcji ustawień (`src/app/features/settings/settings.routes.ts`):
```typescript
import { Route } from '@angular/router';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { authGuard } from '@shared/utils/guards';

export const SETTINGS_ROUTES: Route[] = [
  {
    path: '',
    component: SettingsPageComponent,
    canActivate: [authGuard],
  }
];
```

Rejestracja w głównym pliku `app.routes.ts`:
```typescript
{
  path: 'settings',
  loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
  canActivate: [authGuard]
},
```

## 3. Struktura komponentów
Widok Ustawień będzie składał się z głównego komponentu kontenerowego (`SettingsPageComponent`), który jest owinięty w `txg-main-layout`. `SettingsPageComponent` zarządza fasadą i deleguje zadania do dwóch komponentów podrzędnych (prezentacyjnych), oraz dialogu do zmiany hasła.

- **`SettingsPageComponent` (Komponent Kontenerowy/Inteligentny)**
  - Odpowiedzialny za:
    - Wstrzyknięcie i udostępnienie `SettingsPageFacade`.
    - Koordynację między komponentami podrzędnymi a fasadą.
    - Przekazywanie danych z `viewModel` fasady do komponentów podrzędnych.
    - Obsługę zdarzeń emitowanych przez komponenty podrzędne i wywoływanie odpowiednich metod fasady.
    - Otwieranie `ChangePasswordDialogComponent`.
  - Hierarchia:
    ```
    txg-main-layout
    └── SettingsPageComponent
        ├── ProfileSettingsCardComponent (MatCard, zarządzanie profilem)
        │   └── ReactiveFormsModule (dla formularza profilu)
        │       ├── MatFormField (imię)
        │       │   └── MatInput
        │       ├── Wyświetlanie E-mail (read-only)
        │       └── Wyświetlanie Sugestii AI (read-only)
        │       └── MatButton (Zapisz)
        └── AccountSettingsCardComponent (MatCard, zarządzanie kontem)
            ├── MatButton (Zmień Hasło)
            └── MatButton (Wyloguj)
        └── (Uruchamiany przez SettingsPageComponent):
            ChangePasswordDialogComponent (dialog zmiany hasła)
            └── ReactiveFormsModule (dla formularza zmiany hasła)
                ├── MatFormField (aktualne hasło)
                │   └── MatInput
                ├── MatFormField (nowe hasło)
                │   └── MatInput
                ├── MatFormField (potwierdź nowe hasło)
                │   └── MatInput
                ├── MatButton (Zapisz)
                └── MatButton (Anuluj)
    ```

## 4. Szczegóły komponentów
### `SettingsPageComponent`
- **Opis komponentu**: Główny komponent kontenerowy dla widoku ustawień, owinięty w `txg-main-layout`. Nie zawiera bezpośrednio logiki UI, lecz orkiestruje interakcje między `SettingsPageFacade`, komponentami `ProfileSettingsCardComponent`, `AccountSettingsCardComponent` oraz uruchamia `ChangePasswordDialogComponent`.
- **Główne elementy HTML i komponenty dzieci**:
  - `<txg-main-layout>` jako główny wrapper.
  -   Wewnątrz layoutu:
  -     `<txg-profile-settings-card>`
  -     `<txg-account-settings-card>`
  - Elementy do wyświetlania ogólnych komunikatów o błędach z fasady (`viewModel().error`) lub globalnego wskaźnika ładowania (`viewModel().isLoading` na początku).
  - (Logika uruchamiania `ChangePasswordDialogComponent` znajduje się w pliku TS komponentu).
- **Obsługiwane interakcje**:
  - `ngOnInit`: Wywołuje `SettingsPageFacade.loadInitialData()`.
  - Odbiera zdarzenie `profileSaved` z `ProfileSettingsCardComponent` i wywołuje `SettingsPageFacade.saveProfile()`.
  - Odbiera zdarzenie `loggedOut` z `AccountSettingsCardComponent` i wywołuje `SettingsPageFacade.logout()`.
  - Odbiera zdarzenie `passwordChanged` z `AccountSettingsCardComponent`:
    - Otwiera `ChangePasswordDialogComponent` używając `MatDialog`.
    - Po zamknięciu dialogu z danymi (obiekt `ChangePasswordCommand`), wywołuje `SettingsPageFacade.changePassword(passwordData)`.
- **Typy**:
  - Korzysta z `SettingsPageViewModel` poprzez `SettingsPageFacade`.
  - Wstrzykuje `MatDialog` do otwierania dialogów.
- **Propsy (wejścia `@Input`)**: Brak.

### `ProfileSettingsCardComponent`
- **Opis komponentu**: Komponent prezentacyjny odpowiedzialny za wyświetlanie i edycję danych profilu użytkownika (imię, e-mail, sugestie AI). Otrzymuje dane i obsługuje interakcje poprzez `@Input` i `@Output`. Całość zawarta w komponencie `<mat-card>`.
- **Główne elementy HTML i komponenty dzieci**:
  - `<mat-card>`
  - `  <mat-card-header>` (opcjonalnie, np. tytuł karty)
  - `  <mat-card-content>`
  - `    form[formGroup]` dla sekcji profilu.
  - `    mat-form-field` z `matInput` dla pola "Imię".
  - `    mat-form-field` z `matInput readonly` do wyświetlania adresu e-mail.
  - `    mat-form-field` z `matInput readonly` do wyświetlania liczby sugestii AI.
  - `    mat-error` do wyświetlania błędów walidacji formularza.
  - `  <mat-card-actions>`
  - `    mat-raised-button` dla akcji "Zapisz".
- **Obsługiwane interakcje (zdarzenia `@Output`)**:
  - `profileSaved = new EventEmitter<string | null>()`: Emituje, gdy użytkownik klika "Zapisz", przekazując nową wartość imienia.
- **Warunki walidacji (dla pola Imię)**:
  - Wymagane (`Validators.required`).
  - Minimalna długość (np. `Validators.minLength(2)`).
  - Maksymalna długość (np. `Validators.maxLength(50)`).
- **Typy**: 
  - Formularz: `FormGroup` z `FormControl` dla `firstName`, `email` (disabled), `aiSuggestionsRemaining` (disabled).
- **Propsy (wejścia `@Input`)**:
  - `profile!: ProfileSettingsCardViewModel`

### `AccountSettingsCardComponent`
- **Opis komponentu**: Komponent prezentacyjny odpowiedzialny za akcje związane z kontem, takie jak zmiana hasła i wylogowanie. Sygnalizuje intencję wykonania tych akcji poprzez zdarzenia `@Output`. Całość zawarta w komponencie `<mat-card>`.
- **Główne elementy HTML i komponenty dzieci**:
  - `<mat-card>`
  - `  <mat-card-header>` (opcjonalnie, np. tytuł karty)
  - `  <mat-card-content>`
  - `    mat-button` dla akcji "Zmień Hasło".
  - `    mat-button` dla akcji "Wyloguj".
  - `  <mat-card-actions>` (jeśli przyciski są w sekcji akcji karty)
- **Obsługiwane interakcje (zdarzenia `@Output`)**:
  - `passwordChanged = new EventEmitter<void>()`: Emituje, gdy użytkownik klika "Zmień Hasło", sygnalizując potrzebę otwarcia dialogu zmiany hasła.
  - `loggedOut = new EventEmitter<void>()`: Emituje, gdy użytkownik klika "Wyloguj".
- **Typy**: Brak specyficznych.
- **Propsy (wejścia `@Input`)**: Brak. (Stan ładowania/przetwarzania jest zarządzany globalnie przez `SettingsPageComponent` na podstawie `viewModel.isLoading`. Przyciski mogą być wyłączone na podstawie tego globalnego stanu, jeśli `isLoading` zostanie przekazane do tego komponentu jako `@Input`).

### `ChangePasswordDialogComponent`
- **Opis komponentu**: Dialogowy komponent odpowiedzialny za zbieranie od użytkownika aktualnego hasła, nowego hasła i potwierdzenia nowego hasła w celu zmiany hasła.
- **Główne elementy HTML i komponenty dzieci**:
  - `<form [formGroup]="changePasswordForm">`
  - `mat-dialog-content` zawierający:
    - `mat-form-field` z `matInput` dla `currentPassword`.
    - `mat-form-field` z `matInput` dla `newPassword`.
    - `mat-form-field` z `matInput` dla `confirmNewPassword`.
    - `mat-error` do wyświetlania błędów walidacji dla poszczególnych pól oraz błędów dotyczących całego formularza (np. niezgodność haseł).
  - `mat-dialog-actions` zawierający:
    - `button mat-button [mat-dialog-close]` (Anuluj).
    - `button mat-raised-button color="primary" (click)="onSave()"` (Zapisz), wyłączony, jeśli formularz jest nieprawidłowy lub trwa zapis.
- **Obsługiwane interakcje**:
  - Inicjalizacja `changePasswordForm` z `FormControl` dla `currentPassword`, `newPassword`, `confirmNewPassword`.
  - Walidacja formularza:
    - Wszystkie pola wymagane (`Validators.required`).
    - `newPassword`: minimalna długość (np. `Validators.minLength(8)`).
    - Walidator na poziomie formularza sprawdzający, czy `newPassword` i `confirmNewPassword` są identyczne.
  - Metoda `onSave()`:
    - Jeśli `changePasswordForm.valid`, zamyka dialog wywołując `this.dialogRef.close({ currentPassword: this.form.value.currentPassword, newPassword: this.form.value.newPassword })`.
  - Przycisk "Anuluj" zamyka dialog bez przekazywania danych.
- **Typy**:
  - Formularz: `changePasswordForm: FormGroup`.
  - Wstrzykuje `MatDialogRef<ChangePasswordDialogComponent>`.
  - Może wstrzyknąć `MAT_DIALOG_DATA` jeśli potrzeba (w tym przypadku nie są przekazywane żadne dane do dialogu podczas otwierania).
  - Zwracane dane przy zamknięciu (sukces) powinny pasować do struktury `ChangePasswordCommand`.
- **Propsy (wejścia `@Input`)**: Brak (konfiguracja przez `MatDialogConfig` przy otwieraniu, jeśli potrzeba).
- **Zdarzenia (`@Output`)**: Brak (komunikacja przez `dialogRef.close()`).

## 5. Typy
- **`SettingsPageViewModel`** (z `src/app/features/settings/models/settings-page.viewmodel.ts`):
  ```typescript
  export interface ProfileSettingsCardViewModel {
    firstName: string | null;
    email: string | null;
    aiSuggestionsRemaining: number | null;
  }

  export interface SettingsPageViewModel {
    profile: ProfileSettingsCardViewModel;
    isLoading: boolean; // Global loading state for the page
    error: string | null;   // Global error state for the page
  }
  ```
- **`UserProfileDto`** (z `src/app/shared/api/api.types.ts`):
  ```typescript
  export type UserProfileDto = {
    id: string; 
    first_name: string | null;
    active_training_plan_id: string | null; 
    ai_suggestions_remaining: number | null;
    created_at: string | null; 
    updated_at: string | null; 
  };
  ```
- **`UpsertUserProfileCommand`** (z `src/app/shared/api/api.types.ts`):
  ```typescript
  export type UpsertUserProfileCommand = {
    first_name?: string;
  };
  ```
- **`ChangePasswordCommand`** (nowy typ, może być w `src/app/features/auth/models/auth.commands.ts`):
  ```typescript
  export interface ChangePasswordCommand {
    currentPassword: string;
    newPassword: string;
  }
  ```
- **`User` (Supabase Auth)**: Typ użytkownika dostarczany przez `AuthService`, zawierający m.in. `id` i `email`.
  ```typescript
  interface SupabaseUser {
    id: string;
    email?: string;
  }
  ```

## 6. Zarządzanie stanem
- **Fasada (`SettingsPageFacade`)**: Znajduje się w `src/app/features/settings/pages/settings-page.facade.ts`.
  - Właściwość `viewModel = signal<SettingsPageViewModel>(initialSettingsPageViewModel)`: Udostępnia aktualny stan widoku.
  - Metoda `loadInitialData()`:
    - Ustawia `viewModel.update(s => ({ ...s, isLoading: true, error: null }))`.
    - Pobiera `currentUser` z `AuthService`.
    - Jeśli użytkownik istnieje, pobiera jego `id`.
    - Wywołuje `ProfileService.getUserProfile(id)` (zakładając, że `ProfileService` to `UserProfileService` z poprzednich kroków lub nowy serwis w `shared/api/`).
    - Aktualizuje `viewModel.profile.email` (z `currentUser.email`), `viewModel.profile.firstName` (z `UserProfileDto.first_name`), `viewModel.profile.aiSuggestionsRemaining`, oraz `viewModel.isLoading = false`.
    - Obsługuje błędy, aktualizując `viewModel.error` i `viewModel.isLoading = false`.
  - Metoda `saveProfile(firstName: string | null)`:
    - Pobiera `currentUser.id` z `AuthService`.
    - Ustawia `viewModel.update(s => ({ ...s, isLoading: true, error: null }))`.
    - Przygotowuje `UpsertUserProfileCommand`.
    - Wywołuje `ProfileService.upsertUserProfile(userId, command)`.
    - W przypadku sukcesu: aktualizuje `viewModel.profile.firstName`, `viewModel.isLoading = false`, wyświetla powiadomienie przez `MatSnackBar`.
    - W przypadku błędu: ustawia `viewModel.error`, `viewModel.isLoading = false`, wyświetla powiadomienie przez `MatSnackBar`.
  - Metoda `logout()`:
    - Wywołuje `AuthService.logout()`, nawiguje do strony logowania.
    - W przypadku błędu wylogowania, aktualizuje `viewModel.error`.
  - Metoda `changePassword(command: ChangePasswordCommand)`:
    - Ustawia `viewModel.update(s => ({ ...s, isLoading: true, error: null }))`.
    - Wywołuje `AuthService.changePassword(command.currentPassword, command.newPassword)` (lub podobna sygnatura w zależności od implementacji `AuthService`).
    - W przypadku sukcesu: `viewModel.update(s => ({ ...s, isLoading: false }))`, wyświetla powiadomienie przez `MatSnackBar`.
    - W przypadku błędu: `viewModel.update(s => ({ ...s, isLoading: false }))`, wyświetla powiadomienie z treścią błędu przez `MatSnackBar`.
- **Stan lokalny komponentów**:
  - `ProfileSettingsCardComponent`: Zarządza `profileForm`. Reaguje na zmiany `@Input` `profile` do inicjalizacji/resetowania formularza.
  - `AccountSettingsCardComponent`: Brak znaczącego stanu lokalnego; operacje są sterowane przez zdarzenia i globalny `isLoading`.
- **Serwisy**:
  - `AuthService`: Odpowiedzialny za dostarczanie informacji o zalogowanym użytkowniku, obsługę wylogowania i zmiany hasła.
    - Powinien zawierać metodę np. `changePassword(currentPassword: string, newPassword: string): Observable<void>`
  - `ProfileService` (np. `src/app/shared/api/profile.service.ts`): Enkapsuluje logikę komunikacji z API `/user-profiles`.
    - `getUserProfile(userId: string): Observable<UserProfileDto>`
    - `upsertUserProfile(userId: string, command: UpsertUserProfileCommand): Observable<UserProfileDto>`
  - `MatSnackBar`: Do wyświetlania powiadomień (toast).
  - `MatDialog`: Do wyświetlania dialogów (potwierdzenie wylogowania przez fasadę, zmiana hasła przez `SettingsPageComponent`).

## 7. Interakcje użytkownika
- **Ładowanie widoku**:
  - `SettingsPageComponent` wywołuje `SettingsPageFacade.loadInitialData()`.
  - `viewModel` fasady jest używany do przekazania `profile` do `ProfileSettingsCardComponent`.
  - Komponenty wyświetlają wskaźniki ładowania lub błędy na podstawie `viewModel.isLoading` i `viewModel.error`.
- **Edycja imienia (`ProfileSettingsCardComponent`)**:
  - Użytkownik modyfikuje pole "Imię" w formularzu.
  - Formularz w `ProfileSettingsCardComponent` staje się "dirty".
- **Kliknięcie "Zapisz" (`ProfileSettingsCardComponent`)**:
  - `ProfileSettingsCardComponent` emituje `profileSaved` z nową wartością imienia.
  - `SettingsPageComponent` odbiera zdarzenie i wywołuje `SettingsPageFacade.saveProfile()`.
  - Fasada zarządza stanem `viewModel.isLoading` i komunikacją z API.
  - Po zakończeniu, `viewModel.profile.firstName` jest aktualizowane; formularz w `ProfileSettingsCardComponent` powinien zostać zresetowany do `pristine` z nową wartością.
- **Kliknięcie "Wyloguj" (`AccountSettingsCardComponent`)**:
  - `AccountSettingsCardComponent` emituje `loggedOut`.
  - `SettingsPageComponent` odbiera i wywołuje `SettingsPageFacade.logout()`.
- **Kliknięcie "Zmień Hasło" (`AccountSettingsCardComponent`)**:
  - `AccountSettingsCardComponent` emituje `passwordChanged`.
  - `SettingsPageComponent` odbiera to zdarzenie.
  - `SettingsPageComponent` otwiera `ChangePasswordDialogComponent` używając `MatDialog`.
  - Po zamknięciu dialogu z danymi (np. `currentPassword`, `newPassword`):
    - `SettingsPageComponent` wywołuje `SettingsPageFacade.changePassword({ currentPassword, newPassword })`.

## 8. Warunki i walidacja
- **Pole `firstName` (w `ProfileSettingsCardComponent`)**:
  - Wymagane: Tak (`Validators.required`). Komunikat: "Imię jest wymagane."
  - Minimalna długość: 2 znaki (`Validators.minLength(2)`). Komunikat: "Imię musi mieć co najmniej 2 znaki."
  - Maksymalna długość: 50 znaków (`Validators.maxLength(50)`). Komunikat: "Imię może mieć maksymalnie 50 znaków."
  - Walidacja wpływa na stan `profileForm.valid` oraz `profileForm.get('firstName')?.errors`.
  - Przycisk "Zapisz" w `ProfileSettingsCardComponent` jest wyłączony, jeśli `profileForm.invalid` LUB `profileForm.pristine` LUB `isLoading` (przekazane jako `@Input`) jest `true`.
- **Endpoint `PUT /user-profiles/{id}`**:
  - Backend waliduje, czy `id` użytkownika pasuje do zalogowanego użytkownika (403 Forbidden).
  - Backend waliduje ciało żądania (`UpsertUserProfileCommand`).
  - Błędy walidacji z backendu (400 Bad Request) powinny być wyświetlone użytkownikowi poprzez `viewModel.error`.

## 9. Obsługa błędów
- **Błędy ładowania danych (GET) / zapisu danych (PUT)**:
  - `SettingsPageFacade` przechwytuje błędy z `ProfileService`.
  - `viewModel.isLoading` jest ustawiane na `false`.
  - `viewModel.error` jest ustawiane komunikatem błędu.
  - `SettingsPageComponent` wyświetla `viewModel.error`.
  - Konkretne kody błędów (401, 403, 404, 500) powinny skutkować odpowiednimi komunikatami dla użytkownika.
- **Błędy wylogowania / zmiany hasła**:
  - Dla wylogowania: Fasada obsługuje błędy z `AuthService` i aktualizuje `viewModel.error`.
  - Dla zmiany hasła: `SettingsPageFacade` (po otrzymaniu danych z `SettingsPageComponent`) przechwytuje błędy z `AuthService.changePassword`, aktualizuje `viewModel.isLoading = false` i `viewModel.error`, i wyświetla powiadomienie przez `MatSnackBar`.
  - Dialog `ChangePasswordDialogComponent` może mieć własną obsługę błędów walidacji formularza i wewnętrzny stan ładowania podczas próby wysłania.
- **Wyświetlanie błędów**:
  - Ogólne błędy na poziomie strony wyświetlane przez `SettingsPageComponent`.
  - `ProfileSettingsCardComponent` może wyświetlać błędy walidacji formularza inline za pomocą `mat-error`.
  - `MatSnackBar` do informowania o sukcesie/błędzie operacji.

## 10. Kroki implementacji
1.  **Utworzenie struktury katalogów i plików**:
    - `src/app/features/settings/pages/settings-page/settings-page.component.ts|html|scss`
    - `src/app/features/settings/pages/settings-page.facade.ts`
    - `src/app/features/settings/pages/settings-page/components/profile-settings-card/profile-settings-card.component.ts|html|scss`
    - `src/app/features/settings/pages/settings-page/components/account-settings-card/account-settings-card.component.ts|html|scss`
    - `src/app/features/settings/dialogs/change-password-dialog/change-password-dialog.component.ts|html|scss`
    - `src/app/features/settings/models/settings-page.viewmodel.ts`
    - `src/app/features/settings/settings.routes.ts`
    - `src/app/features/auth/models/auth.commands.ts` (dla `ChangePasswordCommand`)
    - `src/app/shared/api/profile.service.ts`
2.  **Zdefiniowanie `SettingsPageViewModel`, `ProfileSettingsCardViewModel`** w `src/app/features/settings/models/settings-page.viewmodel.ts`, oraz **`ChangePasswordCommand`** w `src/app/features/auth/models/auth.commands.ts`.
3.  **Zdefiniowanie Routingu** w `settings.routes.ts` i rejestracja w `app.routes.ts` (zgodnie z sekcją 2).
4.  **Implementacja `ProfileService`** (sprawdzenie, czy aktualna implementacja `getUserProfile` i `upsertUserProfile` spełnia wymagania, jeśli nie, zaktualizowanie jej).
5.  **Implementacja `AuthService`**:
    - Upewnij się, że posiada metodę `changePassword(currentPassword: string, newPass: string): Observable<void>` (lub odpowiednik).
    - Upewnij się, że posiada metodę `logout(): Observable<void>` (lub `Promise<void>`).
6.  **Implementacja `SettingsPageFacade`**:
    - Wstrzyknij `AuthService`, `ProfileService`, `MatSnackBar`, `Router`.
    - Zdefiniuj `viewModel = signal<SettingsPageViewModel>(initialSettingsPageViewModel)`.
    - Zaimplementuj `loadInitialData()` (pobieranie danych profilu i użytkownika, aktualizacja `viewModel`).
    - Zaimplementuj `saveProfile(firstName: string | null)` (wysyłanie danych, aktualizacja `viewModel`, obsługa `MatSnackBar`).
    - Zaimplementuj `changePassword(command: ChangePasswordCommand)`: przyjmuje dane hasła, ustawia `isLoading`, wywołuje `AuthService.changePassword()`, obsługuje wynik (sukces/błąd przez `viewModel` i `MatSnackBar`).
    - Zaimplementuj `logout()`: wywołuje `AuthService.logout()`. Ta metoda będzie wywoływana przez `SettingsPageComponent` po potwierdzeniu dialogu. Fasada zwróci wynik `true/false`, dzięki któremu komponent główny zdecyduje czy przekierować użytkownika na `/home`.
7.  **Implementacja `ChangePasswordDialogComponent`**:
    - Wstrzyknij `MatDialogRef<ChangePasswordDialogComponent>`.
    - Zaimplementuj `changePasswordForm` (`FormGroup`) z polami `currentPassword`, `newPassword`, `confirmNewPassword` i walidatorami (wymagane, min. długość dla nowego hasła, zgodność nowych haseł).
    - Szablon HTML z polami formularza (`mat-form-field`, `matInput`), `mat-error` dla walidacji, oraz przyciskami "Zapisz" (`type="submit"` lub `(click)`) i "Anuluj" (`mat-dialog-close`).
    - Logika przycisku "Zapisz" (lub submit formularza): jeśli formularz jest ważny, zamyka dialog przekazując obiekt `{ currentPassword: form.value.currentPassword, newPassword: form.value.newPassword }` (zgodny z `ChangePasswordCommand`).
8.  **Implementacja `ProfileSettingsCardComponent`**:
    - Zdefiniuj `@Input() profile!: ProfileSettingsCardViewModel;`
    - Zdefiniuj `@Output() profileSaved = new EventEmitter<string | null>();`
    - Zaimplementuj `profileForm: FormGroup` (dla `firstName` z walidatorami, oraz `email` i `aiSuggestionsRemaining` jako pola tylko do odczytu/disabled).
    - W `ngOnChanges`: jeśli `profile` się zmieni (a formularz nie jest `dirty`), zresetuj wartości w `profileForm` nowymi wartościami z `profile` i ustaw formularz jako `pristine`.
    - Logika przycisku "Zapisz": jeśli `profileForm.valid` i `profileForm.dirty`, emituje `profileSaved` z wartością `profileForm.value.firstName`. Przycisk powinien być wyłączony, jeśli `profileForm.invalid || profileForm.pristine`.
    - Szablon HTML: `<mat-card>` jako główny kontener. Wewnątrz `<mat-card-content>` formularz z `mat-form-field` dla `firstName` (edytowalne), `email` (readonly) i `aiSuggestionsRemaining` (readonly). `mat-error` dla walidacji `firstName`. W `<mat-card-actions>` przycisk "Zapisz".
9.  **Implementacja `AccountSettingsCardComponent`**:
    - Zdefiniuj `@Output() passwordChanged = new EventEmitter<void>();`
    - Zdefiniuj `@Output() loggedOut = new EventEmitter<void>();`
    - Szablon HTML: `<mat-card>` jako główny kontener. Wewnątrz `<mat-card-content>` przyciski "Zmień Hasło" i "Wyloguj". Logika przycisków emituje odpowiednie zdarzenia.
10. **Implementacja `SettingsPageComponent` (Kontener)**:
    - Wstrzyknij `SettingsPageFacade` i `MatDialog`.
    - Udostępnij `viewModel = facade.viewModel;` do szablonu.
    - W `ngOnInit` wywołaj `facade.loadInitialData()`.
    - W szablonie owiń całą zawartość w `<txg-main-layout title="Ustawienia" [loadingSignal]="viewModel().isLoading">`.
    - Wewnątrz layoutu użyj `<txg-profile-settings-card>` i `<txg-account-settings-card>`.
    - Powiąż `@Input`y komponentów dzieci z `viewModel()`.
    - Metoda obsługująca `(passwordChanged)` z `AccountSettingsCardComponent`:
        - Otwórz `ChangePasswordDialogComponent` używając `this.dialog.open(...)`.
        - Po zamknięciu dialogu (`dialogRef.afterClosed().subscribe(...)`), jeśli są dane, wywołaj `this.facade.changePassword(result)`.
    - Metoda obsługująca `(loggedOut)` z `AccountSettingsCardComponent` wywołuje `this.facade.logout()`.
    - Metoda obsługująca `(profileSaved)` z `ProfileSettingsCardComponent` wywołuje `this.facade.saveProfile($event)`.
11. **Implementacja Szablonów HTML dla wszystkich komponentów**.
12. **Implementacja Stylów SCSS/CSS dla wszystkich komponentów**.
13. **Testowanie**:
    - Testy manualne.
    - Testy E2E.
14. **Dodanie modułów Angular Material**: Upewnij się, że wszystkie komponenty (standalone) importują potrzebne moduły Material, w tym `MatCardModule`, `MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatDialogModule`, `MatProgressSpinnerModule`, `MatDividerModule`.

Przykład `SettingsPageComponent.html`:
```html
<txg-main-layout title="Ustawienia" [loadingSignal]="facade.viewModel().isLoading">
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Settings</h1>

    @if (facade.viewModel().isLoading && !facade.viewModel().profile.firstName) {
      <div class="flex justify-center items-center h-64">
        <mat-spinner diameter="50"></mat-spinner>
      </div>
    } @else {
      @if (facade.viewModel().error; as error) {
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" 
            role="alert">
          <strong class="font-bold">Error!</strong>
          <span class="block sm:inline"> {{ error }}</span>
        </div>
      }

      <div class="grid grid-cols-1 gap-6">
        <txg-profile-settings-card 
          [profile]="facade.viewModel()!.profile"
          (profileSaved)="onSaveProfile($event)">
        </txg-profile-settings-card>

        <mat-divider class="my-2"></mat-divider>

        <txg-account-settings-card 
          (passwordChanged)="onChangePasswordRequested()" 
          (loggedOut)="onLogout()">
        </txg-account-settings-card>
      </div>
    }
  </div>
</txg-main-layout>
```
