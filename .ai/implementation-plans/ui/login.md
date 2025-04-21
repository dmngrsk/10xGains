# Plan implementacji widoku logowania

## 1. Przegląd
Widok logowania umożliwia użytkownikom uwierzytelnienie się w aplikacji poprzez podanie adresu email i hasła, z możliwością przejścia do widoku rejestracji. Zapewnia walidację pól, wyświetlanie komunikatów błędów oraz obsługę pokazywania/ukrywania hasła.

## 2. Routing widoku
- Ścieżka: `/login`
- Lazy loading: W `app.routes.ts` dodaj:
  ```ts
  {
    path: 'login',
    loadChildren: () => import('./features/login/login.routes').then(m => m.LOGIN_ROUTES)
  }
  ```

## 3. Struktura komponentów
```
LoginPageComponent
└── LoginFormComponent
    ├── EmailInputComponent (MatInput)
    ├── PasswordInputComponent (MatInput + toggle show/hide)
    └── ActionsComponent (SubmitButton + RegisterLink)
```

## 4. Szczegóły komponentów

### LoginPageComponent
- Opis: Kontener dla logiki i stylu strony logowania.
- Główne elementy: `<app-login-form>`
- Obsługiwane zdarzenia: Nie bezpośrednio; przekazuje callback z `LoginFormComponent`.
- Propsy: brak (feature module wstrzykuje routing i guardy).

### LoginFormComponent
- Opis: Formularz logowania oparty na ReactiveForm z walidacją Zod.
- Główne elementy:
  - `<form [formGroup]="loginForm" (ngSubmit)="onSubmit()">`
  - `<mat-form-field>` dla email i dla hasła
  - `<mat-icon-button>` do przełączania widoczności hasła
  - `<button mat-raised-button type="submit" [disabled]="loginForm.invalid || loading">Zaloguj się</button>`
  - `<a routerLink="/register">Zarejestruj się</a>`
- Obsługiwane interakcje:
  - Wpisywanie email i hasła
  - Kliknięcie ikonki show/hide
  - Submit formularza
- Obsługiwana walidacja:
  - email: required, format email (Zod.email())
  - password: required, minLength 8
- Typy:
  - `LoginFormValues { email: string; password: string; }`
- Propsy:
  - `@Output() login = new EventEmitter<LoginFormValues>()`

### EmailInputComponent
- Opis: Wrapper nad `mat-form-field` i `matInput` dla pola email.
- Główne elementy: `<input matInput formControlName="email" type="email">`
- Obsługiwane interakcje: focus, blur, change
- Walidacja: required, format email
- Propsy: `formControlName`

### PasswordInputComponent
- Opis: Wrapper nad `mat-form-field` i `matInput` z toggle show/hide.
- Główne elementy:
  - `<input matInput [type]="hide ? 'password' : 'text'" formControlName="password">`
  - `<button mat-icon-button (click)="toggleHide()">`
- Obsługiwane interakcje: toggleHide()
- Walidacja: required, minLength 8
- Propsy: `formControlName`

### ActionsComponent
- Opis: Zawiera przycisk submit i link do rejestracji.
- Główne elementy:
  - SubmitButton
  - RouterLink do `/register`
- Obsługiwane interakcje: `click submit`, `navigate to register`
- Propsy: `loading: boolean`

## 5. Typy
```ts
// DTO wysyłane do API
type LoginRequest = {
  email: string;
  password: string;
};

// Odpowiedź z API
type LoginResponse = {
  user: User;
  session: Session;
};

// Typy formularza
interface LoginFormValues {
  email: string;
  password: string;
}
```

## 6. Zarządzanie stanem
- Formularz: `FormGroup` w komponencie `LoginFormComponent`.
- Loading i error: użycie lokalnych `BehaviorSubject<boolean>`/`Subject<string>` lub `loading` i `errorMessage` w komponencie.
- Opcjonalnie: Custom hook `useLoginState()` (service Angularowy), zarządza stanem ładowania i błędów.

## 7. Integracja API
- Serwis: `AuthService.login(request: LoginRequest): Promise<LoginResponse>` oparte na `SupabaseService.auth.signInWithPassword`.
- W `LoginFormComponent.onSubmit()`:
  ```ts
  this.loading = true;
  this.authService.login(this.loginForm.value)
    .then(res => this.router.navigate(['/home']))
    .catch(err => this.errorMessage = mapError(err))
    .finally(() => this.loading = false);
  ```

## 8. Interakcje użytkownika
1. Użytkownik wpisuje email i hasło.
2. Formularz waliduje pola w locie (ngModelChange + Zod).
3. Kliknięcie przycisku "Zaloguj się" wywołuje `onSubmit()`.
4. Podczas oczekiwania przycisk zablokowany, może pojawić się spinner.
5. Po sukcesie: przekierowanie do `/home`.
6. Po błędzie: wyświetlenie komunikatu np. w `<mat-error>` lub `<mat-snackbar>`.

## 9. Warunki i walidacja
- Pola wymagane: email, password.
- email: zgodny z regex `/.+@.+\..+/`
- password: minLength 8.
- FormGroup invalid -> przycisk submit disabled.
- Walidacja wykonywana zarówno na poziomie Zod jak i Angular.

## 10. Obsługa błędów
- Błędne dane logowania: komunikat "Nieprawidłowy email lub hasło."
- Błąd sieci: "Błąd połączenia. Spróbuj ponownie później."
- Timeout: pokaż spinner do 5s, potem błąd.
- Każdy błąd tłumaczony przez `mapError()` w `AuthService`.

## 11. Kroki implementacji
1. Utworzyć folder `src/app/features/login` oraz plik `login.routes.ts` z konfiguracją routingu.
2. W `app.routes.ts` dodać lazy loading dla ścieżki `/login`.
3. Wygenerować komponenty: `LoginPageComponent`, `LoginFormComponent`, `EmailInputComponent`, `PasswordInputComponent`, `ActionsComponent`.
4. Zainstalować i skonfigurować `zod` oraz integrację z Angular ReactiveForms.
5. Utworzyć typy DTO (`LoginRequest`, `LoginResponse`) w `shared/services/auth.service.ts`.
6. Utworzyć typy DTO (`LoginFormValues`) w `src/app/features/login/shared/types.ts`.
7. Zaimplementować `AuthService` w `shared/services/auth.service.ts`, używający `SupabaseService`.
8. Utworzyć szkielet formularza w `LoginFormComponent`, dodać pola i walidację Zod.
9. Dodać obsługę toggla hasła w `PasswordInputComponent`.
10. Podłączyć `AuthService.login()` w `onSubmit()`, zarządzać stanem `loading` i `errorMessage`.
11. Dodać markup Angular Material oraz Tailwind klasy dla responsywności i dostępności.
12. Przetestować scenariusze: sukces, błąd walidacji, błąd sieci.
13. Dodać e2e testy i unit testy dla `LoginFormComponent`.
14. Code review i merge do głównego brancha.
