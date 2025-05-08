# Plan implementacji widoku logowania

## 1. Przegląd
Widok logowania umożliwia użytkownikom uwierzytelnienie się w aplikacji poprzez podanie adresu email i hasła, z możliwością przejścia do widoku rejestracji. Zapewnia walidację pól, wyświetlanie komunikatów błędów oraz obsługę pokazywania/ukrywania hasła.

## 2. Routing widoku
- Ścieżka: `/auth/login`
- Lazy loading: W `app.routes.ts` dodaj:
  ```ts
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  }
  ```
- W `auth.routes.ts`:
  ```ts
  export const AUTH_ROUTES: Routes = [
    { 
      path: 'login', 
      loadComponent: () => import('./components/login/login.component').then(c => c.LoginComponent), 
      canActivate: [noAuthGuard] 
    },
    // inne ścieżki auth (register, forgot-password, reset-password)
    { 
      path: '', 
      redirectTo: 'login', 
      pathMatch: 'full' 
    }
  ];
  ```

## 3. Struktura komponentów
```
src/
└── app/
    └── features/
        └── auth/
            ├── auth.routes.ts                      # Routing modułu auth
            ├── components/
            │   ├── shared/
            │   │   └── auth-layout/                # Wspólny layout dla stron autoryzacji
            │   │       ├── auth-layout.component.ts
            │   │       └── auth-layout.component.html
            │   └── login/                          # Komponent strony logowania
            │       ├── login.component.ts
            │       ├── login.component.html
            │       ├── login-form/                 # Formularz logowania
            │       │   ├── login-form.component.ts
            │       │   └── login-form.component.html
            │       ├── email-input/                # Komponent pola email
            │       │   ├── email-input.component.ts
            │       │   └── email-input.component.html
            │       ├── password-input/             # Komponent pola hasła
            │       │   ├── password-input.component.ts
            │       │   └── password-input.component.html
            │       └── actions/                    # Komponent akcji (linki do rejestracji, itp.)
            │           ├── actions.component.ts
            │           └── actions.component.html
            ├── guards/
            │   └── no-auth.guard.ts                # Guard blokujący dostęp dla zalogowanych
            └── shared/
                └── types.ts                        # Wspólne typy i walidatory
```

## 4. Szczegóły komponentów

### AuthLayoutComponent
- Opis: Wspólny layout dla wszystkich stron autoryzacji, zapewniający spójny wygląd.
- Główne elementy: Nagłówek, kontener na zawartość stron auth.
- Propsy:
  - `@Input() title: string = '10xGains'`
  - `@Input() subtitle: string = ''`

### LoginComponent
- Opis: Kontener dla logiki i stylu strony logowania, wykorzystujący AuthLayoutComponent.
- Główne elementy: `<txg-auth-layout>`, `<txg-login-form>`, `<txg-login-actions>`
- Obsługiwane zdarzenia: `formSubmit` z LoginFormComponent.
- Zewnętrzne zależności: AuthService do uwierzytelniania, Router do nawigacji.

### LoginFormComponent
- Opis: Formularz logowania oparty na ReactiveForm z podwójną walidacją: Angular + Zod.
- Główne elementy:
  - `<form [formGroup]="loginForm" (ngSubmit)="onSubmit()">`
  - `<txg-email-input [parentForm]="loginForm">`
  - `<txg-password-input [parentForm]="loginForm">`
  - `<button mat-raised-button type="submit">`
- Obsługiwane interakcje:
  - Wpisywanie email i hasła
  - Submit formularza
- Obsługiwana walidacja:
  - email: required, format email (Angular + Zod)
  - password: required
- Typy:
  - `LoginFormValues { email: string; password: string; }`
- Propsy:
  - `@Output() formSubmit = new EventEmitter<LoginFormValues>()`

### EmailInputComponent
- Opis: Wrapper nad `mat-form-field` i `matInput` dla pola email.
- Główne elementy: `<input matInput [formControl]="getFormControl()" type="email">`
- Obsługiwane interakcje: focus, blur, change
- Walidacja: 
  - Angular: required, Validators.email
  - Zod: required, email (.email())
- Propsy: 
  - `@Input() parentForm: FormGroup`
  - `@Input() controlName: string = 'email'`

### PasswordInputComponent
- Opis: Wrapper nad `mat-form-field` i `matInput` z toggle show/hide.
- Główne elementy:
  - `<input matInput [type]="hide ? 'password' : 'text'" [formControl]="getFormControl()">`
  - `<button mat-icon-button (click)="toggleHide()">`
- Obsługiwane interakcje: toggleHide()
- Walidacja: required
- Propsy: 
  - `@Input() parentForm: FormGroup`
  - `@Input() controlName: string = 'password'`

### ActionsComponent
- Opis: Zawiera linki do innych stron autoryzacji (rejestracja, odzyskiwanie hasła).
- Główne elementy:
  - RouterLink do `/auth/register`
  - RouterLink do `/auth/forgot-password`
- Obsługiwane interakcje: nawigacja do innych widoków

## 5. Typy
```ts
// Modele w auth/shared/types.ts

// Modele żądań
export interface AuthRequest {
  email: string;
  password: string;
}

// Modele formularzy
export interface LoginFormValues {
  email: string;
  password: string;
}

// Schematy walidacji Zod
export const loginFormSchema = z.object({
  email: z.string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z.string()
    .min(1, { message: 'Password is required' })
});
```

## 6. Zarządzanie stanem
- Formularz: `FormGroup` w komponencie `LoginFormComponent` z użyciem FormBuilder.
- Loading: użycie `signal(false)` w `LoginFormComponent`.
- Obsługa błędów: MatSnackBar w `LoginComponent`.
- Autentykacja: wstrzykiwanie SharedAuthService.

## 7. Integracja API
- Serwis: Używamy `AuthService` z `src/app/shared/services/auth.service.ts`, który korzysta z Supabase.
- W `LoginComponent.onFormSubmit()`:
  ```ts
  async onFormSubmit(formValues: LoginFormValues): Promise<void> {
    if (this.loginFormComponent) {
      this.loginFormComponent.setLoading(true);
    }

    try {
      await this.authService.login({
        email: formValues.email,
        password: formValues.password
      });
      // Po zalogowaniu, przekierowanie do /home
    } catch (error) {
      // Wyświetlenie błędu w snackbar
      this.snackBar.open(
        error instanceof Error ? error.message : 'An error occurred. Please try again later.',
        'Close',
        { duration: 5000 }
      );
    } finally {
      if (this.loginFormComponent) {
        this.loginFormComponent.setLoading(false);
      }
    }
  }
  ```

## 8. Interakcje użytkownika
1. Użytkownik wpisuje email i hasło.
2. Formularz waliduje pola w locie (Angular + Zod).
3. Kliknięcie przycisku "Login" wywołuje `onSubmit()`.
4. Podczas oczekiwania przycisk zablokowany, wyświetla się tekst "Logging in...".
5. Po sukcesie: przekierowanie do `/home`.
6. Po błędzie: wyświetlenie komunikatu w MatSnackBar.

## 9. Warunki i walidacja
- Pola wymagane: email, password.
- Podwójna walidacja email:
  - Angular: Validators.required, Validators.email
  - Zod: .min(1), .email()
- Komunikaty błędów:
  - Email is required
  - Please enter a valid email address
  - Password is required
- FormGroup invalid -> przycisk submit disabled.

## 10. Obsługa błędów
- Błędy wyświetlane jako:
  - Inline errors w FormFields
  - MatSnackBar dla błędów z API
- Mapowanie błędów API na przyjazne komunikaty
- Obsługa różnych przypadków błędów (invalid credentials, network error, etc.)

## 11. Kroki implementacji
1. Utworzyć strukturę katalogów dla auth feature.
2. Zaimplementować AuthLayoutComponent jako wspólny layout.
3. Utworzyć plik types.ts ze schematami walidacji Zod.
4. Zaimplementować noAuthGuard dla zabezpieczenia widoków auth.
5. Skonfigurować routing w auth.routes.ts i app.routes.ts.
6. Zaimplementować komponenty: EmailInput, PasswordInput, LoginForm, Actions, Login.
7. Dodać podwójną walidację: Angular + Zod.
8. Przeprowadzić testy wszystkich scenariuszy (poprawne dane, błędne dane, rozłączenie).
9. Upewnić się, że wszystkie testy przechodzą i widok działa zgodnie z oczekiwaniami.
