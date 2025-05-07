# Plan implementacji widoku Rejestracja

## 1. Przegląd
Widok umożliwia nowemu użytkownikowi utworzenie konta poprzez podanie adresu e-mail, hasła oraz potwierdzenia hasła. Po pomyślnym zarejestrowaniu użytkownik zostaje automatycznie zalogowany i przekierowany na stronę główną aplikacji.

## 2. Routing widoku
Ścieżka: `/auth/register`

- W pliku `src/app/features/auth/auth.routes.ts` dodać wpis:
  ```ts
  import { RegisterComponent } from './register/register.component';
  import { NoAuthGuard } from './guards/no-auth.guard';

  export const AUTH_ROUTES: Route[] = [
    // istniejące wpisy…
    {
      path: 'register',
      component: RegisterComponent,
      canActivate: [NoAuthGuard]
    }
  ];
  ```
- Upewnić się, że w `src/app/app.routes.ts` znajduje się:
  ```ts
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  }
  ```

## 3. Struktura komponentów
- `RegisterComponent`
  - Formularz rejestracji (email, password, confirmPassword)
  - Obsługa logiki walidacji i wywołania API
  - Wyświetlanie komunikatów błędów i snackbara

## 4. Szczegóły komponentu
### RegisterComponent
- Opis komponentu
  - Strona z formularzem rejestracji użytkownika.
- Główne elementy
  - `<form [formGroup]="registerForm" (ngSubmit)="onSubmit()">`
  - Trzy pola w `<mat-form-field>`: email, password, potwierdzenie hasła
  - `<mat-error>` pod każdym polem do wyświetlania komunikatów walidacyjnych
  - `<button mat-raised-button type="submit" [disabled]="registerForm.invalid || isLoading">Sign up</button>`
- Obsługiwane zdarzenia
  - `input` i `blur` na polach – aktualizacja i walidacja formularza na żywo
  - `ngSubmit` – uruchomienie metody `onSubmit()`
- Warunki walidacji
  - email: `Validators.required`, `Validators.email`
  - password: `Validators.required`, `Validators.minLength(8)`
  - confirmPassword: `Validators.required`, dopasowanie do pola password (custom validator)
- Typy
  - `RegisterRequestDto`
  - `RegisterResponseDto`
- Propsy
  - Brak (komponent samodzielny)

## 5. Typy
```ts
// src/app/features/auth/register/service/register-contract.model.ts
export interface RegisterRequestDto {
  email: string;
  password: string;
}

export interface RegisterResponseDto {
  user: { id: string; email: string; }; // Supabase.User minimal
  session: { access_token: string; refresh_token: string; }; // Supabase.Session minimal
}

export interface ApiError {
  message: string;
}
```

## 6. Zarządzanie stanem
- `registerForm: FormGroup` – stan pól i walidatorów
- `isLoading: boolean` – flaga włączenia przycisku i spinnera
- `serverError: string | null` – komunikat globalny w przypadku błędu sieci/serwera

## 7. Integracja API
- SupabaseService: `src/app/shared/db/supabase.service.ts`
- W `RegisterComponent` wstrzyknąć `SupabaseService`, `Router`, `MatSnackBar`.
- Przykładowa metoda rejestracji w `RegisterComponent`:
  ```ts
  onSubmit(): void {
    if (this.registerForm.invalid) return;
    this.isLoading = true;
    const { email, password } = this.registerForm.value;
    
    this.supabaseService.client.auth.signUp({ email, password })
      .then(({ error }) => {
        if (error) {
          this.isLoading = false;
          this.snackBar.open(error.message, 'Close', { duration: 5000 });
          return;
        }
        
        // Automatyczne logowanie po rejestracji
        this.signInUser(email, password);
      })
      .catch(() => {
        this.isLoading = false;
        this.snackBar.open('Brak połączenia z serwerem', 'Close', { duration: 5000 });
      });
  }
  
  private signInUser(email: string, password: string): void {
    this.supabaseService.client.auth.signInWithPassword({ email, password })
      .then(({ error }) => {
        this.isLoading = false;
        
        if (error) {
          this.snackBar.open('Rejestracja udana, ale logowanie nie powiodło się. Zaloguj się ręcznie.', 'Close', { duration: 5000 });
          this.router.navigate(['/auth/login']);
          return;
        }
        
        this.snackBar.open('Rejestracja zakończona pomyślnie! Witamy w 10xGains.', 'Close', { duration: 5000 });
        this.router.navigate(['/home']);
      });
  }
  ```

## 8. Interakcje użytkownika
1. Użytkownik wpisuje e-mail → walidacja na żywo (poprawny format lub komunikat)
2. Wpisuje hasło → walidacja minLength(8)
3. Wpisuje potwierdzenie hasła → walidator porównujący z głównym
4. Kliknięcie "Rejestruj" → flaga `isLoading = true`, wywołanie API
5. Sukces rejestracji → automatyczne logowanie → przekierowanie na stronę główną `/home`
6. Błąd rejestracji → `MatSnackBar.open(error.message)` + `isLoading = false`
7. Rejestracja udana, ale logowanie nieudane → przekierowanie na stronę logowania `/auth/login`

## 9. Warunki i walidacja
- Formularz nieaktywny (`disabled`) dopóki `registerForm.invalid` lub `isLoading === true`
- Pola sygnalizują błąd na podstawie `formControl.errors`
- CustomValidator `passwordMatch` zwraca `{ mismatch: true }` gdy hasła się różnią

## 10. Obsługa błędów
- Błędy pola: komunikaty pod polami (`required`, `email`, `minlength`, `mismatch`)
- Błędy serwera: komunikat w snack barze, zapobieganie wielokrotnym wywołaniom
- Edge case: brak połączenia – komunikat ogólny "Brak połączenia z serwerem"
- Edge case: rejestracja udana, logowanie nieudane – komunikat i przekierowanie na stronę logowania

## 11. Kroki implementacji
1. Utworzyć folder `src/app/features/auth/register`.
2. Dodać wpis `register` do pliku `src/app/features/auth/auth.routes.ts`, korzystając z `NoAuthGuard`.
3. Utworzyć `register.component.ts/html/scss` z szablonem i logiką ReactiveForm.
4. Zaimplementować custom validator `passwordMatchValidator`.
5. Utworzyć `service/register.service.ts` i `register-contract.model.ts`.
6. Zarejestrować route w `app.routes.ts` przez lazy-loading.
7. Dodać importy `ReactiveFormsModule`, `MatInputModule`, `MatButtonModule`, `MatSnackBarModule` w module feature lub `AppModule`.
8. Stylowanie pól Tailwind CSS + Angular Material.
9. Zaimplementować automatyczne logowanie po rejestracji.
10. Przetestować walidację formularza i scenariusze błędów.
11. Przeprowadzić manualne testy e2e: rejestracja i automatyczne logowanie, błędne hasła, sieć offline. 
